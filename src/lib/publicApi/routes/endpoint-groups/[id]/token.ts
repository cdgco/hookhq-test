import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { endpointGroups } from "@/db/webhooks.schema";
import { generatePortalToken } from "@/lib/portalAuth";
import {
  errorResponseSchema,
  endpointGroupIdParamSchema,
  portalTokenRequestSchema,
  portalTokenResponseSchema,
} from "@/lib/publicApi/schemas";
import { jsonError, requireEnvironmentAccess } from "@/lib/publicApi/utils";

const createPortalTokenRoute = createRoute({
  method: "post",
  path: "/endpoint-groups/{id}/token",
  tags: ["Endpoint Groups"],
  summary: "Generate Portal Token",
  request: {
    params: endpointGroupIdParamSchema,
    body: { required: true, content: { "application/json": { schema: portalTokenRequestSchema } } },
  },
  responses: {
    200: { description: "Success", content: { "application/json": { schema: portalTokenResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: errorResponseSchema } } },
    404: { description: "Not Found", content: { "application/json": { schema: errorResponseSchema } } },
    500: { description: "Internal Server Error", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

export function registerEndpointGroupPortalRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  app.openapi(createPortalTokenRoute, (async (c: any) => {
    const auth = await requireEnvironmentAccess(c.req.raw, c.env, {
      permissions: { endpoints: ["create", "read", "update", "delete"] },
    });
    if (auth instanceof Response) return auth;
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = await getDb(c.env);
    const group = await db.select().from(endpointGroups).where(eq(endpointGroups.id, id)).limit(1);
    if (group.length === 0) return jsonError("Endpoint group not found", 404);
    const result = await generatePortalToken(
      {
        endpointGroupId: id,
        environmentId: group[0].environmentId,
        allowedEventTypes: body.allowedEventTypes,
        applicationName: body.applicationName,
        returnUrl: body.returnUrl,
      },
      c.req.raw,
      c.env
    );
    if (!result.success) return jsonError(result.error, 500);
    return c.json(
      {
        token: result.token,
        portalUrl: result.portalUrl,
        expiresIn: result.expiresIn,
        endpointGroup: {
          id: group[0].id,
          name: group[0].name,
          environmentId: group[0].environmentId,
        },
      },
      200
    );
  }) as never);
}
