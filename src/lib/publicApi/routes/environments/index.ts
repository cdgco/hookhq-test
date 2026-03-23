import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@/db";
import { environments } from "@/db/environments.schema";
import { generateEnvironmentId } from "@/lib/environments";
import { authenticateSessionRequest } from "@/lib/publicApi/auth";
import { createEnvironmentSchema, environmentSchema, errorResponseSchema } from "@/lib/publicApi/schemas";

const listEnvironmentsRoute = createRoute({
  method: "get",
  path: "/environments",
  tags: ["Environments"],
  summary: "List Environments",
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: z.object({ environments: z.array(environmentSchema) }),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

const createEnvironmentRoute = createRoute({
  method: "post",
  path: "/environments",
  tags: ["Environments"],
  summary: "Create Environment",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: createEnvironmentSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: environmentSchema,
        },
      },
    },
    400: { description: "Bad Request", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

function formatEnvironment(environment: typeof environments.$inferSelect) {
  return {
    id: environment.id,
    name: environment.name,
    description: environment.description,
    isDefault: environment.isDefault,
    createdAt: environment.createdAt.toISOString(),
  };
}

export function registerEnvironmentCollectionRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  app.openapi(listEnvironmentsRoute, (async (c: any) => {
    const session = await authenticateSessionRequest(c.req.raw, c.env);

    if (!session.success) {
      return session.response;
    }

    const db = await getDb(c.env);
    const allEnvironments = await db.select().from(environments).orderBy(environments.createdAt);

    return c.json({ environments: allEnvironments.map(formatEnvironment) }, 200);
  }) as never);

  app.openapi(createEnvironmentRoute, (async (c: any) => {
    const session = await authenticateSessionRequest(c.req.raw, c.env);

    if (!session.success) {
      return session.response;
    }

    const body = c.req.valid("json");
    const db = await getDb(c.env);
    const environmentId = generateEnvironmentId();
    const now = new Date();

    await db.insert(environments).values({
      id: environmentId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });

    return c.json(
      formatEnvironment({
        id: environmentId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      } as typeof environments.$inferSelect),
      200
    );
  }) as never);
}
