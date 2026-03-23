import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { eventTypes } from "@/db/webhooks.schema";
import { validateSchema } from "@/lib/schemaValidation";
import {
  deleteResponseSchema,
  errorResponseSchema,
  eventTypeSchema,
  eventTypeUpdateSchema,
  eventTypeIdParamSchema,
} from "@/lib/publicApi/schemas";
import { jsonError, requireEnvironmentAccess } from "@/lib/publicApi/utils";

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

const getEventTypeRoute = createRoute({
  method: "get",
  path: "/event-types/{id}",
  tags: ["Event Types"],
  summary: "Get Event Type",
  request: { params: eventTypeIdParamSchema },
  responses: {
    200: {
      description: "Success",
      content: { "application/json": { schema: z.object({ eventType: eventTypeSchema }) } },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
    404: { description: "Not Found", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

const deleteEventTypeRoute = createRoute({
  method: "delete",
  path: "/event-types/{id}",
  tags: ["Event Types"],
  summary: "Delete Event Type",
  request: { params: eventTypeIdParamSchema },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: deleteResponseSchema.extend({
            deletedEventType: z.object({ id: z.string(), name: z.string() }),
          }),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
    404: { description: "Not Found", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

const updateEventTypeRoute = createRoute({
  method: "patch",
  path: "/event-types/{id}",
  tags: ["Event Types"],
  summary: "Update Event Type",
  request: {
    params: eventTypeIdParamSchema,
    body: { required: true, content: { "application/json": { schema: eventTypeUpdateSchema } } },
  },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": { schema: z.object({ message: z.string(), eventType: eventTypeSchema }) },
      },
    },
    400: { description: "Bad Request", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
    404: { description: "Not Found", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

export function registerEventTypeItemRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  app.openapi(getEventTypeRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { eventTypes: ["read"] },
    });
    if (auth instanceof Response) return auth;
    const { id } = c.req.valid("param");
    const db = await getDb(c.env);
    const row = await db.select().from(eventTypes).where(eq(eventTypes.id, id)).limit(1);
    if (row.length === 0) return jsonError("Event type not found", 404);
    return c.json({ eventType: formatEventType(row[0]) }, 200);
  }) as never);

  app.openapi(deleteEventTypeRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { eventTypes: ["delete"] },
    });
    if (auth instanceof Response) return auth;
    const { id } = c.req.valid("param");
    const db = await getDb(c.env);
    const row = await db.select().from(eventTypes).where(eq(eventTypes.id, id)).limit(1);
    if (row.length === 0) return jsonError("Event type not found", 404);
    await db.delete(eventTypes).where(eq(eventTypes.id, id));
    return c.json(
      { message: "Event type deleted successfully", deletedEventType: { id: row[0].id, name: row[0].name } },
      200
    );
  }) as never);

  app.openapi(updateEventTypeRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { eventTypes: ["update"] },
    });
    if (auth instanceof Response) return auth;
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = await getDb(c.env);
    const existing = await db.select().from(eventTypes).where(eq(eventTypes.id, id)).limit(1);
    if (existing.length === 0) return jsonError("Event type not found", 404);
    if (body.schema !== undefined) {
      const validation = validateSchema(body.schema);
      if (!validation.valid) return jsonError("Invalid schema", 400, { details: validation.errors });
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.schema !== undefined) updateData.schema = JSON.stringify(body.schema);
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    await db
      .update(eventTypes)
      .set(updateData as never)
      .where(eq(eventTypes.id, id));
    const updated = await db.select().from(eventTypes).where(eq(eventTypes.id, id)).limit(1);
    return c.json({ message: "Event type updated successfully", eventType: formatEventType(updated[0]) }, 200);
  }) as never);
}
