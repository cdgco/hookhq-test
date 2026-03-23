import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { eventTypes } from "@/db/webhooks.schema";
import { validateSchema } from "@/lib/schemaValidation";
import {
  enabledQuerySchema,
  errorResponseSchema,
  eventTypeCreateSchema,
  eventTypeSchema,
} from "@/lib/publicApi/schemas";
import { jsonError, parseEnabledFilter, requireEnvironmentAccess } from "@/lib/publicApi/utils";

function formatEventType(eventType: typeof eventTypes.$inferSelect) {
  return {
    id: eventType.id,
    environmentId: eventType.environmentId,
    name: eventType.name,
    description: eventType.description,
    schema: eventType.schema ? JSON.parse(eventType.schema) : null,
    enabled: eventType.enabled,
    createdAt: eventType.createdAt.toISOString(),
    updatedAt: eventType.updatedAt.toISOString(),
  };
}

const listEventTypesRoute = createRoute({
  method: "get",
  path: "/event-types",
  tags: ["Event Types"],
  summary: "List Event Types",
  request: { query: enabledQuerySchema },
  responses: {
    200: {
      description: "Success",
      content: { "application/json": { schema: z.object({ eventTypes: z.array(eventTypeSchema) }) } },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

const createEventTypeRoute = createRoute({
  method: "post",
  path: "/event-types",
  tags: ["Event Types"],
  summary: "Create Event Type",
  request: {
    body: { required: true, content: { "application/json": { schema: eventTypeCreateSchema } } },
  },
  responses: {
    200: { description: "Success", content: { "application/json": { schema: eventTypeSchema } } },
    400: { description: "Bad Request", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

export function registerEventTypeCollectionRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  app.openapi(listEventTypesRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { eventTypes: ["read"] },
    });
    if (auth instanceof Response) return auth;
    const enabled = parseEnabledFilter(c.req.valid("query").enabled);
    const conditions = [eq(eventTypes.environmentId, auth.environmentId)];
    if (enabled !== undefined) conditions.push(eq(eventTypes.enabled, enabled));
    const db = await getDb(c.env);
    const rows = await db
      .select()
      .from(eventTypes)
      .where(and(...conditions))
      .orderBy(eventTypes.createdAt);
    return c.json({ eventTypes: rows.map(formatEventType) }, 200);
  }) as never);

  app.openapi(createEventTypeRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { eventTypes: ["create"] },
    });
    if (auth instanceof Response) return auth;
    const body = c.req.valid("json");
    if (body.schema) {
      const validation = validateSchema(body.schema);
      if (!validation.valid) return jsonError("Invalid schema", 400, { details: validation.errors });
    }
    const now = new Date();
    const id = `${auth.environmentId}_${crypto.randomUUID().substring(0, 8)}`;
    const db = await getDb(c.env);
    await db.insert(eventTypes).values({
      id,
      environmentId: auth.environmentId,
      name: body.name,
      description: body.description,
      schema: body.schema ? JSON.stringify(body.schema) : null,
      enabled: body.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return c.json(
      formatEventType({
        id,
        environmentId: auth.environmentId,
        name: body.name,
        description: body.description ?? null,
        schema: body.schema ? JSON.stringify(body.schema) : null,
        enabled: body.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      } as typeof eventTypes.$inferSelect),
      200
    );
  }) as never);
}
