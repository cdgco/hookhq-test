import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { apikeys } from "@/db/auth.schema";
import { getDb } from "@/db";
import { environments } from "@/db/environments.schema";
import {
  endpointGroups,
  endpoints,
  eventTypes,
  proxyGroups,
  proxyServers,
  webhookAttempts,
  webhookMessages,
} from "@/db/webhooks.schema";
import { authenticateSessionRequest } from "@/lib/publicApi/auth";
import { deleteResponseSchema, errorResponseSchema, environmentIdParamSchema } from "@/lib/publicApi/schemas";
import { jsonError } from "@/lib/publicApi/utils";
import { eq } from "drizzle-orm";

const deleteEnvironmentRoute = createRoute({
  method: "delete",
  path: "/environments/{id}",
  tags: ["Environments"],
  summary: "Delete Environment",
  request: { params: environmentIdParamSchema },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: deleteResponseSchema.extend({
            deletedEnvironment: z.object({
              id: z.string(),
              name: z.string(),
            }),
            deletedResources: z.record(z.string(), z.string()),
          }),
        },
      },
    },
    400: { description: "Bad Request", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    404: { description: "Not Found", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

export function registerEnvironmentItemRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  app.openapi(deleteEnvironmentRoute, (async (c: any) => {
    const session = await authenticateSessionRequest(c.req.raw, c.env);

    if (!session.success) {
      return session.response;
    }

    const { id: environmentId } = c.req.valid("param");
    const db = await getDb(c.env);
    const environment = await db.select().from(environments).where(eq(environments.id, environmentId)).limit(1);

    if (environment.length === 0) {
      return jsonError("Environment not found", 404);
    }

    if (environment[0].isDefault) {
      return jsonError("Cannot delete default environment", 400);
    }

    const messageIds = await db
      .select({ id: webhookMessages.id })
      .from(webhookMessages)
      .where(eq(webhookMessages.environmentId, environmentId));

    for (const message of messageIds) {
      await db.delete(webhookAttempts).where(eq(webhookAttempts.messageId, message.id));
    }

    await db.delete(webhookMessages).where(eq(webhookMessages.environmentId, environmentId));
    await db.delete(endpoints).where(eq(endpoints.environmentId, environmentId));
    await db.delete(endpointGroups).where(eq(endpointGroups.environmentId, environmentId));
    await db.delete(eventTypes).where(eq(eventTypes.environmentId, environmentId));
    await db.delete(proxyServers).where(eq(proxyServers.environmentId, environmentId));
    await db.delete(proxyGroups).where(eq(proxyGroups.environmentId, environmentId));

    const allApiKeys = await db.select({ id: apikeys.id, metadata: apikeys.metadata }).from(apikeys);
    const apiKeysToDelete = allApiKeys.filter(apiKey => {
      if (!apiKey.metadata) return false;

      try {
        const metadata = JSON.parse(apiKey.metadata);
        return metadata.environment === environmentId;
      } catch {
        return false;
      }
    });

    for (const apiKey of apiKeysToDelete) {
      await db.delete(apikeys).where(eq(apikeys.id, apiKey.id));
    }

    await db.delete(environments).where(eq(environments.id, environmentId));

    return c.json(
      {
        message: "Environment and all associated resources deleted successfully",
        deletedEnvironment: {
          id: environment[0].id,
          name: environment[0].name,
        },
        deletedResources: {
          webhookMessages: "All webhook messages and attempts",
          endpoints: "All endpoints",
          endpointGroups: "All endpoint groups",
          eventTypes: "All event types",
          proxyServers: "All proxy servers",
          proxyGroups: "All proxy groups",
          apiKeys: `${apiKeysToDelete.length} API keys`,
        },
      },
      200
    );
  }) as never);
}
