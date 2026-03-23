import { webhookMessages, endpoints } from "@/db/webhooks.schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { DestinationDelivery } from "@/lib/destinations/DestinationDelivery";
import { triggerFailureAlerts } from "@/lib/alerts";
import { maybeDisableEndpointForFailures, resetEndpointFailureCount } from "@/lib/autoDisable";
import { shouldRetry, calculateRetryDelay } from "@/lib/retryUtils";
import type { DeliveryMessage } from "@/lib/queue/types";

type QueueMessageAdapter = {
  body: DeliveryMessage;
  attempts: number;
  ack(): void;
  retry(options: { delaySeconds: number }): void;
};

export class DestinationConsumer {
  private env: CloudflareEnv;

  constructor(env: CloudflareEnv) {
    this.env = env;
  }

  private async updateMessageStatus(
    messageId: string,
    status: "processing" | "delivered" | "retrying" | "failed",
    attempts: number,
    error?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status, attempts };
    const now = new Date();

    if (status === "processing") {
      updateData.processingStartedAt = now;
    } else if (status === "delivered") {
      updateData.deliveredAt = now;
      updateData.lastError = null;
    } else {
      updateData.lastError = error || "Unknown error";
      updateData.lastErrorAt = now;
      if (status === "failed") {
        updateData.failedAt = now;
      }
    }

    const db = await getDb(this.env);
    await db
      .update(webhookMessages)
      .set(updateData as never)
      .where(eq(webhookMessages.id, messageId));
  }

  private async storeFailedMessage(message: DeliveryMessage, error: string, attempts: number): Promise<void> {
    try {
      const key = `failed:${message.id}:${message.endpointId}`;
      let payload = message.payload;

      if (message.payloadKey && (payload === null || payload === undefined)) {
        const storedPayload = await this.env.KV.get(message.payloadKey);
        if (storedPayload) {
          payload = JSON.parse(storedPayload);
          await this.env.KV.delete(message.payloadKey);
        }
      }

      await this.env.KV.put(
        key,
        JSON.stringify({
          message: { ...message, payload, payloadKey: null },
          error,
          attempts,
          failedAt: new Date().toISOString(),
          retryable: true,
        }),
        { expirationTtl: 60 * 60 * 24 * 30 }
      );
    } catch (storageError) {
      console.error("Error storing failed destination message:", storageError);
    }
  }

  private async triggerAlerts(message: DeliveryMessage, error: string) {
    const db = await getDb(this.env);
    const endpoint = await db
      .select({ id: endpoints.id, name: endpoints.name, environmentId: endpoints.environmentId })
      .from(endpoints)
      .where(eq(endpoints.id, message.endpointId))
      .limit(1);

    if (!endpoint[0]) {
      return;
    }

    const destinationLabel =
      message.destination.type === "webhook"
        ? message.destination.url
        : message.destination.type === "sqs"
          ? `SQS ${message.destination.queueUrl}`
          : `Pub/Sub ${message.destination.topicName}`;

    await triggerFailureAlerts({
      env: this.env,
      environmentId: endpoint[0].environmentId,
      endpointId: endpoint[0].id,
      endpointName: endpoint[0].name,
      destinationLabel,
      message,
      error,
    });
  }

  private async handleSuccess(queueMessage: QueueMessageAdapter, deliveryMessage: DeliveryMessage) {
    queueMessage.ack();
    await this.updateMessageStatus(deliveryMessage.id, "delivered", queueMessage.attempts);
    await resetEndpointFailureCount(this.env, deliveryMessage.endpointId);
  }

  private async handleRetry(queueMessage: QueueMessageAdapter, deliveryMessage: DeliveryMessage, error: string) {
    const delaySeconds = calculateRetryDelay(queueMessage.attempts, deliveryMessage.retryConfig);
    queueMessage.retry({ delaySeconds });
    await this.updateMessageStatus(deliveryMessage.id, "retrying", queueMessage.attempts, error);
  }

  private async handleFailure(queueMessage: QueueMessageAdapter, deliveryMessage: DeliveryMessage, error: string) {
    queueMessage.ack();
    await this.updateMessageStatus(deliveryMessage.id, "failed", queueMessage.attempts, error);
    await this.storeFailedMessage(deliveryMessage, error, queueMessage.attempts);
    await this.triggerAlerts(deliveryMessage, error);
    const autoDisableResult = await maybeDisableEndpointForFailures(this.env, deliveryMessage.endpointId);
    if (autoDisableResult.disabled) {
      console.warn("Endpoint auto-disabled after consecutive failures", {
        endpointId: deliveryMessage.endpointId,
        threshold: autoDisableResult.threshold,
      });
    }
  }

  private async processMessage(queueMessage: QueueMessageAdapter) {
    const deliveryMessage = queueMessage.body as DeliveryMessage;
    const delivery = new DestinationDelivery(deliveryMessage, this.env);
    await delivery.setAttempts(queueMessage.attempts);
    await this.updateMessageStatus(deliveryMessage.id, "processing", queueMessage.attempts);

    try {
      const result = await delivery.send(deliveryMessage.endpointId);
      const retry = shouldRetry(result.success, queueMessage.attempts, deliveryMessage.retryConfig);

      if (result.success) {
        await this.handleSuccess(queueMessage, deliveryMessage);
      } else if (retry) {
        await this.handleRetry(queueMessage, deliveryMessage, result.error || "Unknown error");
      } else {
        await this.handleFailure(queueMessage, deliveryMessage, result.error || "Unknown error");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (shouldRetry(false, queueMessage.attempts, deliveryMessage.retryConfig)) {
        await this.handleRetry(queueMessage, deliveryMessage, errorMessage);
      } else {
        await this.handleFailure(queueMessage, deliveryMessage, errorMessage);
      }
    }
  }

  private createWorkerMessageAdapter(queueMessage: Message): QueueMessageAdapter {
    return {
      body: queueMessage.body as DeliveryMessage,
      attempts: queueMessage.attempts,
      ack: () => queueMessage.ack(),
      retry: options => queueMessage.retry(options),
    };
  }

  private createLocalMessageAdapter(
    deliveryMessage: DeliveryMessage,
    attempts: number,
    onRetry: (delaySeconds: number) => void
  ): QueueMessageAdapter {
    return {
      body: deliveryMessage,
      attempts,
      ack: () => {},
      retry: ({ delaySeconds }) => onRetry(delaySeconds),
    };
  }

  private async processLocalMessage(deliveryMessage: DeliveryMessage, attempts: number): Promise<void> {
    const adapter = this.createLocalMessageAdapter(deliveryMessage, attempts, delaySeconds => {
      setTimeout(() => {
        void this.processLocalMessage(deliveryMessage, attempts + 1);
      }, delaySeconds * 1000);
    });

    await this.processMessage(adapter);
  }

  async processBatch(batch: MessageBatch): Promise<void> {
    for (const queueMessage of batch.messages) {
      try {
        await this.processMessage(this.createWorkerMessageAdapter(queueMessage));
      } catch (error) {
        console.error("Error processing destination message:", error);
      }
    }
  }

  async processLocalBatch(messages: DeliveryMessage[]): Promise<void> {
    for (const message of messages) {
      try {
        await this.processLocalMessage(message, 1);
      } catch (error) {
        console.error("Error processing local destination message:", error);
      }
    }
  }
}
