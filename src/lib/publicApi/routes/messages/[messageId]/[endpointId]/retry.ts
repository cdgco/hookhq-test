import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  messageRetryParamSchema,
  retryResponseSchema,
} from "@/lib/publicApi/schemas";
import { enqueueDeliveryMessage } from "@/lib/queue/enqueue";
import { jsonError, requireEnvironmentAccess } from "@/lib/publicApi/utils";

const retryMessageRoute = createRoute({
  method: "post",
  path: "/messages/{messageId}/{endpointId}/retry",
  tags: ["Messages"],
  summary: "Retry Failed Message",
  description:
    "Retry a permanently failed delivery for a specific endpoint. This only works while the failed delivery record is still retained in failure storage.",
  request: { params: messageRetryParamSchema },
  responses: {
    200: { description: "Success", content: { "application/json": { schema: retryResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
    404: { description: "Not Found", content: { "application/json": { schema: errorResponseSchema } } },
    500: { description: "Internal Server Error", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

export function registerMessageRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  app.openapi(retryMessageRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { messages: ["create"] },
    });
    if (auth instanceof Response) return auth;
    const { messageId, endpointId } = c.req.valid("param");
    const key = `failed:${messageId}:${endpointId}`;
    const failedMessageRaw = await c.env.KV.get(key);
    if (!failedMessageRaw) return jsonError("Failed message not found or expired", 404);
    const failedMessageData = JSON.parse(failedMessageRaw);
    const { message: deliveryMessage } = failedMessageData;
    const retryWebhookId = crypto.randomUUID();
    await enqueueDeliveryMessage(
      c.env,
      {
        ...deliveryMessage,
        id: retryWebhookId,
        isManualRetry: true,
        originalMessageId: messageId,
        timestamp: new Date().toISOString(),
      },
      c.req.raw
    );
    await c.env.KV.delete(key);
    return c.json(
      {
        message: "Message queued for retry successfully",
        retryId: retryWebhookId,
        originalMessageId: messageId,
        endpointId,
      },
      200
    );
  }) as never);
}
