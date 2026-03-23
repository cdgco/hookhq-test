import { getDb } from "@/db";
import { serverConfig } from "@/db/environments.schema";
import { endpointGroups, endpoints, eventTypes, webhookMessages } from "@/db/webhooks.schema";
import { cacheEndpointData } from "@/lib/cacheUtils";
import { resolveDestinationConfig, resolveRetryConfig } from "@/lib/destinations/config";
import { enqueueDeliveryMessages } from "@/lib/queue/enqueue";
import type { DeliveryMessage } from "@/lib/queue/types";
import { createRetryConfig } from "@/lib/retryUtils";
import { validateEventPayload } from "@/lib/schemaValidation";
import { matchesEventSubscription, parseEventSubscriptions } from "@/lib/subscriptions";
import { and, eq, inArray } from "drizzle-orm";

type SendEventBody = {
  destinations?: string[];
  eventType?: string;
  payload?: unknown;
  eventId?: string;
  logPayload?: boolean;
};

type HandleSendEventRequestInput = {
  body: unknown;
  env: CloudflareEnv;
  request: Request;
  environmentId: string;
};

type ResolvedEndpointTarget = {
  endpointId: string;
  proxyGroupId?: string | null;
};

export async function handleSendEventRequest({
  body,
  env,
  request,
  environmentId,
}: HandleSendEventRequestInput): Promise<Response> {
  const { destinations, eventType, eventId, payload, logPayload } = (body ?? {}) as SendEventBody;

  if (!destinations || payload === undefined) {
    return Response.json(
      {
        error: `${!destinations ? "Destinations are" : "Payload is"} required`,
      },
      { status: 400 }
    );
  }

  const endpointGroupIds = destinations.filter(destination => destination.startsWith("grp_"));
  const endpointIds = destinations.filter(destination => !destination.startsWith("grp_"));

  if (
    [endpointIds, endpointGroupIds].some(ids =>
      ids.some(id => !(id.startsWith(`ep_${environmentId}_`) || id.startsWith(`grp_${environmentId}_`)))
    )
  ) {
    return Response.json(
      {
        error: "Forbidden",
        message: "API key does not have permissions on all endpoints",
      },
      { status: 403 }
    );
  }

  const db = await getDb(env);
  const [globalConfig] = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);
  const defaultProxyGroupId = globalConfig?.defaultProxyGroupId ?? null;

  if (eventType) {
    const eventTypeRecord = await db
      .select({ schema: eventTypes.schema })
      .from(eventTypes)
      .where(and(eq(eventTypes.name, eventType), eq(eventTypes.environmentId, environmentId)))
      .limit(1);

    if (eventTypeRecord.length > 0 && eventTypeRecord[0].schema) {
      const validation = validateEventPayload(eventTypeRecord[0].schema, payload);

      if (!validation.valid) {
        return Response.json(
          {
            error: "Payload validation failed",
            details: validation.errors,
          },
          { status: 400 }
        );
      }
    }
  }

  const date = new Date();
  const webhookId = crypto.randomUUID();
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
  const serializedPayload = JSON.stringify(payload);

  const resolvedEndpoints = await resolveEndpointGroups({
    endpointGroupIds,
    eventType,
    environmentId,
    env,
  });
  const directEndpoints =
    endpointIds.length > 0 ? await resolveDirectEndpoints({ endpointIds, eventType, environmentId, env }) : [];
  const endpointTargets = new Map<string, string | null>();

  for (const endpointId of directEndpoints) {
    endpointTargets.set(endpointId, null);
  }

  for (const target of resolvedEndpoints) {
    if (!endpointTargets.has(target.endpointId) || target.proxyGroupId) {
      endpointTargets.set(target.endpointId, target.proxyGroupId ?? null);
    }
  }

  const allEndpointIds = [...endpointTargets.keys()];

  if (allEndpointIds.length === 0) {
    return Response.json({ error: "No endpoints found" }, { status: 400 });
  }

  await db.insert(webhookMessages).values({
    id: webhookId,
    eventId,
    eventType,
    environmentId,
    endpointIds: JSON.stringify(allEndpointIds),
    endpointGroupIds: JSON.stringify(endpointGroupIds),
    payload: logPayload ? JSON.stringify(payload) : null,
    payloadSize: serializedPayload.length,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    createdAt: date,
    queuedAt: date,
    idempotencyKey,
    metadata: JSON.stringify({
      payloadKey: `webhook-payload:${webhookId}`,
      queueRecoveryAttempts: 0,
    }),
  });

  const endpointData = await cacheEndpointData(allEndpointIds, environmentId, env);
  const endpointMap = new Map(endpointData.map(endpoint => [endpoint.id, endpoint]));
  const endpointMessages: DeliveryMessage[] = [];

  const payloadSize = serializedPayload.length;
  const shouldUseKV = payloadSize / 1024 > 64 || allEndpointIds.length > 50;
  const payloadKey = `webhook-payload:${webhookId}`;
  let maxRetryPeriodDays = 7;

  const baseMessageBody = {
    id: webhookId,
    eventType,
    eventId,
    timestamp: date.toISOString(),
    idempotencyKey,
    payloadKey,
    payload: shouldUseKV ? null : payload,
  };

  const baseMessageSize = JSON.stringify(baseMessageBody).length;
  let optimalBatchSize = Math.floor((256 * 1024) / baseMessageSize);
  optimalBatchSize = Math.min(optimalBatchSize, 100);

  for (const endpointId of allEndpointIds) {
    const endpoint = endpointMap.get(endpointId);
    if (!endpoint) {
      continue;
    }

    const retryConfig = await createRetryConfig(resolveRetryConfig(endpoint), env);
    const destination = await resolveDestinationConfig(endpoint, env);
    const proxyOverride = endpointTargets.get(endpointId) ?? null;

    if (shouldUseKV) {
      maxRetryPeriodDays = Math.max(
        maxRetryPeriodDays,
        getRetryPeriodDays(retryConfig.maxAttempts, retryConfig.baseDelaySeconds, retryConfig.strategy)
      );
    }

    endpointMessages.push({
      ...baseMessageBody,
      endpointId,
      retryConfig,
      destination:
        destination.type === "webhook"
          ? {
              ...destination,
              proxyGroupId: destination.proxyGroupId ?? proxyOverride ?? defaultProxyGroupId,
            }
          : destination,
    });
  }

  maxRetryPeriodDays = Math.max(3, Math.min(30, maxRetryPeriodDays));
  await env.KV.put(payloadKey, serializedPayload, {
    expirationTtl: 60 * 60 * 24 * maxRetryPeriodDays,
  });

  const batches = Math.ceil(endpointMessages.length / optimalBatchSize);

  for (let index = 0; index < batches; index++) {
    const batch = endpointMessages.slice(index * optimalBatchSize, (index + 1) * optimalBatchSize);
    await enqueueDeliveryMessages(env, batch, request);
  }

  return Response.json({
    id: webhookId,
    eventId,
    eventType,
    payload,
    channels: [...endpointIds, ...endpointGroupIds],
    timestamp: date.toISOString(),
  });
}

async function resolveEndpointGroups({
  endpointGroupIds,
  eventType,
  environmentId,
  env,
}: {
  endpointGroupIds: string[];
  eventType?: string;
  environmentId: string;
  env: CloudflareEnv;
}): Promise<ResolvedEndpointTarget[]> {
  if (endpointGroupIds.length === 0) {
    return [];
  }

  const db = await getDb(env);
  const resolvedEndpoints: ResolvedEndpointTarget[] = [];

  for (const groupId of endpointGroupIds) {
    const cacheEventTypeKey = eventType && eventType.trim() ? eventType : "*";
    const cacheKey = `group:${groupId}:${cacheEventTypeKey}`;
    const cachedResult = await env.KV.get(cacheKey);

    if (cachedResult) {
      const parsed = JSON.parse(cachedResult) as Array<string | ResolvedEndpointTarget>;
      resolvedEndpoints.push(
        ...parsed.map(item => (typeof item === "string" ? { endpointId: item, proxyGroupId: null } : item))
      );
      continue;
    }

    const group = await db
      .select()
      .from(endpointGroups)
      .where(
        and(
          eq(endpointGroups.id, groupId),
          eq(endpointGroups.environmentId, environmentId),
          eq(endpointGroups.isActive, true)
        )
      )
      .limit(1);

    if (!group[0]) {
      await env.KV.put(cacheKey, JSON.stringify([]), { expirationTtl: 60 * 60 * 24 * 30 });
      continue;
    }

    const groupEndpointIds = JSON.parse(group[0].endpointIds);
    const groupEventTypes = parseEventSubscriptions(group[0].eventTypes);

    if (groupEndpointIds.length === 0 || !matchesEventSubscription(groupEventTypes, eventType)) {
      await env.KV.put(cacheKey, JSON.stringify([]), { expirationTtl: 60 * 60 * 24 * 30 });
      continue;
    }

    const subscribedEndpoints = await db
      .select()
      .from(endpoints)
      .where(
        and(
          eq(endpoints.environmentId, environmentId),
          eq(endpoints.isActive, true),
          inArray(endpoints.id, groupEndpointIds)
        )
      );

    const groupResolvedEndpoints = subscribedEndpoints
      .filter(endpoint => matchesEventSubscription(parseEventSubscriptions(endpoint.topics), eventType))
      .map(endpoint => ({
        endpointId: endpoint.id,
        proxyGroupId: group[0].proxyGroupId ?? null,
      }));

    await env.KV.put(cacheKey, JSON.stringify(groupResolvedEndpoints), {
      expirationTtl: 60 * 60 * 24 * 30,
    });

    resolvedEndpoints.push(...groupResolvedEndpoints);
  }

  return resolvedEndpoints;
}

async function resolveDirectEndpoints({
  endpointIds,
  eventType,
  environmentId,
  env,
}: {
  endpointIds: string[];
  eventType?: string;
  environmentId: string;
  env: CloudflareEnv;
}): Promise<string[]> {
  if (endpointIds.length === 0) {
    return [];
  }

  const db = await getDb(env);
  const selectedEndpoints = await db
    .select()
    .from(endpoints)
    .where(
      and(eq(endpoints.environmentId, environmentId), eq(endpoints.isActive, true), inArray(endpoints.id, endpointIds))
    );

  return selectedEndpoints
    .filter(endpoint => matchesEventSubscription(parseEventSubscriptions(endpoint.topics), eventType))
    .map(endpoint => endpoint.id);
}

function getRetryPeriodDays(
  maxAttempts: number,
  baseDelaySeconds: number,
  strategy: "none" | "exponential" | "linear" | "fixed"
): number {
  let maxRetrySeconds = 0;

  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    let delaySeconds = 0;

    switch (strategy) {
      case "none":
        delaySeconds = 0;
        break;
      case "exponential":
        delaySeconds = Math.min(baseDelaySeconds * 2 ** (attempt - 1), 300);
        break;
      case "linear":
        delaySeconds = Math.min(baseDelaySeconds * attempt, 300);
        break;
      case "fixed":
        delaySeconds = baseDelaySeconds;
        break;
    }

    maxRetrySeconds += delaySeconds;
  }

  return Math.ceil(maxRetrySeconds / (24 * 60 * 60));
}
