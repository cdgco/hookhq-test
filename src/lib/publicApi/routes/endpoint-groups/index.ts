import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { endpointGroups } from "@/db/webhooks.schema";
import { buildEndpointGroupInsertValues, formatEndpointGroup } from "@/lib/publicApi/serializers";
import {
  enabledQuerySchema,
  endpointGroupCreateSchema,
  endpointGroupSchema,
  errorResponseSchema,
} from "@/lib/publicApi/schemas";
import { parseEnabledFilter, requireEnvironmentAccess } from "@/lib/publicApi/utils";

const listGroupsRoute = createRoute({
  method: "get",
  path: "/endpoint-groups",
  tags: ["Endpoint Groups"],
  summary: "List Endpoint Groups",
  request: { query: enabledQuerySchema },
  responses: {
    200: {
      description: "Success",
      content: { "application/json": { schema: z.object({ endpointGroups: z.array(endpointGroupSchema) }) } },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
    429: { description: "Rate limited", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

const createGroupRoute = createRoute({
  method: "post",
  path: "/endpoint-groups",
  tags: ["Endpoint Groups"],
  summary: "Create Endpoint Group",
  request: {
    body: { required: true, content: { "application/json": { schema: endpointGroupCreateSchema } } },
  },
  responses: {
    200: { description: "Success", content: { "application/json": { schema: endpointGroupSchema } } },
    400: { description: "Bad Request", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

export function registerEndpointGroupCollectionRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  app.openapi(listGroupsRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { endpointGroups: ["read"] },
    });
    if (auth instanceof Response) return auth;
    const enabled = parseEnabledFilter(c.req.valid("query").enabled);
    const conditions = [eq(endpointGroups.environmentId, auth.environmentId)];
    if (enabled !== undefined) conditions.push(eq(endpointGroups.isActive, enabled));
    const db = await getDb(c.env);
    const groups = await db
      .select()
      .from(endpointGroups)
      .where(and(...conditions))
      .orderBy(endpointGroups.createdAt);
    return c.json({ endpointGroups: groups.map(formatEndpointGroup) }, 200);
  }) as never);

  app.openapi(createGroupRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { endpointGroups: ["create"] },
    });
    if (auth instanceof Response) return auth;
    const body = c.req.valid("json");
    const now = new Date();
    const id = `grp_${auth.environmentId}_${crypto.randomUUID().substring(0, 8)}`;
    const db = await getDb(c.env);
    const values = buildEndpointGroupInsertValues({
      id,
      environmentId: auth.environmentId,
      name: body.name,
      description: body.description,
      endpointIds: body.endpointIds,
      eventTypes: body.eventTypes,
      proxyGroupId: body.proxyGroupId,
      enabled: body.enabled,
      failureAlerts: body.failureAlerts,
      now,
    });
    await db.insert(endpointGroups).values(values);
    return c.json(formatEndpointGroup(values as typeof endpointGroups.$inferSelect), 200);
  }) as never);
}
