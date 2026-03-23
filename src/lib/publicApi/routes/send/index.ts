import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { authenticatePublicApiRequest } from "@/lib/publicApi/auth";
import { handleSendEventRequest } from "@/lib/publicApi/send";

const payloadSchema = z.object({}).catchall(z.any()).openapi("SendPayload");

const sendRequestSchema = z
  .object({
    destinations: z
      .array(z.string())
      .min(1)
      .openapi({
        description: "List of endpoints or endpoint groups to send the event to",
        example: ["ep_a1b2_abcd1234", "grp_a1b2_efgh5678"],
      }),
    eventType: z.string().optional().openapi({
      description: "Event type to send. Required when sending to an endpoint group",
      example: "user.created",
    }),
    payload: payloadSchema.openapi({
      description: "Payload to send with the event",
      example: { userId: "abcd1234" },
    }),
    eventId: z.string().optional().openapi({
      description: "Optional unique event ID to track the event",
      example: "abcdef1234567890",
    }),
    logPayload: z.boolean().optional().openapi({
      description: "Whether to persist the payload with the message record",
      example: false,
    }),
  })
  .openapi("SendWebhookRequest");

const sendResponseSchema = z
  .object({
    id: z.string(),
    eventId: z.string().optional(),
    eventType: z.string().optional(),
    payload: payloadSchema,
    channels: z.array(z.string()),
    timestamp: z.string(),
  })
  .openapi("SendWebhookResponse");

const errorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string().optional(),
    details: z.array(z.string()).optional(),
  })
  .openapi("PublicApiError");

export const sendWebhookRoute = createRoute({
  method: "post",
  path: "/send",
  tags: ["Send"],
  summary: "Send Event",
  description: "Send an event to endpoints and/or endpoint groups. When sending to a group, `eventType` is required.",
  request: {
    headers: z.object({
      "idempotency-key": z.string().optional().openapi({
        description: "Optional idempotency key",
        example: "1234567890",
      }),
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: sendRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: sendResponseSchema,
        },
      },
    },
    400: {
      description: "Bad Request",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    429: {
      description: "Too Many Requests",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal Server Error",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const sendWebhookAliasRoute = createRoute({
  ...sendWebhookRoute,
  path: "/webhooks/send",
  hide: true,
});

export function registerSendWebhookOpenApiRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  const handler = async (c: {
    req: {
      raw: Request;
      valid: (target: "json") => z.infer<typeof sendRequestSchema>;
    };
    env: CloudflareEnv;
  }) => {
    const authResult = await authenticatePublicApiRequest(c.req.raw, c.env, {
      permissions: { messages: ["create"] },
      allowSession: false,
    });

    if (!authResult.success) {
      return authResult.response;
    }

    return handleSendEventRequest({
      body: c.req.valid("json"),
      env: c.env,
      request: c.req.raw,
      environmentId: authResult.environmentId,
    });
  };

  app.openapi(sendWebhookRoute, handler as never);
  app.openapi(sendWebhookAliasRoute, handler as never);
}
