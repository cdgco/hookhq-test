import { DestinationConsumer } from "@/lib/queue/DestinationConsumer";
import type { DeliveryMessage } from "@/lib/queue/types";

function isNextDevQueueShim(request?: Request): boolean {
  return request?.headers.get("x-local-dev-queue") === "1" && process.env.NODE_ENV === "development";
}

export async function enqueueDeliveryMessages(
  env: CloudflareEnv,
  messages: DeliveryMessage[],
  request?: Request
): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  if (isNextDevQueueShim(request)) {
    const consumer = new DestinationConsumer(env);
    void consumer.processLocalBatch(messages);
    return;
  }

  await env.WEBHOOKS.sendBatch(
    messages.map(message => ({
      body: message,
    }))
  );
}

export async function enqueueDeliveryMessage(
  env: CloudflareEnv,
  message: DeliveryMessage,
  request?: Request
): Promise<void> {
  if (isNextDevQueueShim(request)) {
    const consumer = new DestinationConsumer(env);
    void consumer.processLocalBatch([message]);
    return;
  }

  await env.WEBHOOKS.send(message);
}
