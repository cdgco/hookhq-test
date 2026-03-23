import { getDb } from "@/db";
import { endpoints, webhookMessages } from "@/db/webhooks.schema";
import { resolveDestinationConfig, resolveRetryConfig } from "@/lib/destinations/config";
import { enqueueDeliveryMessages } from "@/lib/queue/enqueue";
import type { DeliveryMessage } from "@/lib/queue/types";
import { createRetryConfig } from "@/lib/retryUtils";
import { and, eq, inArray, lt } from "drizzle-orm";

const STALE_PENDING_MINUTES = 5;
const MAX_QUEUE_RECOVERY_ATTEMPTS = 3;
const MAX_MESSAGES_PER_RUN = 100;

type MessageMetadata = {
  payloadKey?: string | null;
  queueRecoveryAttempts?: number;
};

function parseMetadata(value: string | null): MessageMetadata {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as MessageMetadata;
  } catch {
    return {};
  }
}

async function updatePendingMessage(
  env: CloudflareEnv,
  messageId: string,
  data: Partial<{
    status: "pending" | "failed";
    metadata: string;
    lastError: string | null;
    lastErrorAt: Date | null;
    failedAt: Date | null;
  }>
): Promise<void> {
  const db = await getDb(env);
  await db
    .update(webhookMessages)
    .set(data as never)
    .where(eq(webhookMessages.id, messageId));
}

async function markQueueRecoveryFailed(env: CloudflareEnv, messageId: string, reason: string): Promise<void> {
  const now = new Date();
  await updatePendingMessage(env, messageId, {
    status: "failed",
    lastError: reason,
    lastErrorAt: now,
    failedAt: now,
  });
}

export async function reconcileStalePendingMessages(env: CloudflareEnv): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_PENDING_MINUTES * 60 * 1000);
  const db = await getDb(env);
  const staleMessages = await db
    .select()
    .from(webhookMessages)
    .where(and(eq(webhookMessages.status, "pending"), lt(webhookMessages.createdAt, staleBefore)))
    .limit(MAX_MESSAGES_PER_RUN);

  for (const message of staleMessages) {
    try {
      const metadata = parseMetadata(message.metadata);
      const recoveryAttempts = metadata.queueRecoveryAttempts ?? 0;

      if (recoveryAttempts >= MAX_QUEUE_RECOVERY_ATTEMPTS) {
        await markQueueRecoveryFailed(
          env,
          message.id,
          "Message was never processed by the queue consumer and exceeded queue recovery attempts"
        );
        continue;
      }

      const endpointIds = JSON.parse(message.endpointIds) as string[];
      if (endpointIds.length === 0) {
        await markQueueRecoveryFailed(env, message.id, "Message has no destinations to recover");
        continue;
      }

      const payloadText =
        typeof message.payload === "string"
          ? message.payload
          : metadata.payloadKey
            ? await env.KV.get(metadata.payloadKey)
            : null;

      if (!payloadText) {
        await markQueueRecoveryFailed(env, message.id, "Message payload is no longer available for queue recovery");
        continue;
      }

      const payload = JSON.parse(payloadText) as unknown;
      const endpointRecords = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.environmentId, message.environmentId), inArray(endpoints.id, endpointIds)));

      if (endpointRecords.length === 0) {
        await markQueueRecoveryFailed(env, message.id, "Message destinations no longer exist for queue recovery");
        continue;
      }

      const deliveryMessages: DeliveryMessage[] = [];
      for (const endpoint of endpointRecords) {
        const retryConfig = await createRetryConfig(resolveRetryConfig(endpoint), env);
        deliveryMessages.push({
          id: message.id,
          endpointId: endpoint.id,
          eventType: message.eventType ?? undefined,
          eventId: message.eventId ?? undefined,
          payload,
          payloadKey: metadata.payloadKey ?? null,
          timestamp: (message.queuedAt ?? message.createdAt).toISOString(),
          idempotencyKey: message.idempotencyKey ?? undefined,
          retryConfig,
          destination: await resolveDestinationConfig(endpoint, env),
        });
      }

      if (deliveryMessages.length === 0) {
        await markQueueRecoveryFailed(env, message.id, "Message destinations could not be rebuilt for queue recovery");
        continue;
      }

      await enqueueDeliveryMessages(env, deliveryMessages);
      await updatePendingMessage(env, message.id, {
        metadata: JSON.stringify({
          ...metadata,
          payloadKey: metadata.payloadKey ?? null,
          queueRecoveryAttempts: recoveryAttempts + 1,
        }),
        lastError: `Queue recovery re-enqueued message after ${STALE_PENDING_MINUTES} minutes pending`,
        lastErrorAt: new Date(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown queue recovery error";
      console.error("Error reconciling stale pending message:", error);
      await markQueueRecoveryFailed(env, message.id, errorMessage);
    }
  }
}
