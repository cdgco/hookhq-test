import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { logger } from "hono/logger";
import { isApiDocsEnabled } from "@/lib/publicApi/docs";
import { registerAdminRoutes } from "@/lib/publicApi/routes/admin/queue-metrics";
import { registerEndpointGroupItemRoutes } from "@/lib/publicApi/routes/endpoint-groups/[id]";
import { registerEndpointGroupPortalRoutes } from "@/lib/publicApi/routes/endpoint-groups/[id]/token";
import { registerEndpointGroupCollectionRoutes } from "@/lib/publicApi/routes/endpoint-groups";
import { registerEndpointItemRoutes } from "@/lib/publicApi/routes/endpoints/[id]";
import { registerEndpointCollectionRoutes } from "@/lib/publicApi/routes/endpoints";
import { registerEnvironmentItemRoutes } from "@/lib/publicApi/routes/environments/[id]";
import { registerEnvironmentCollectionRoutes } from "@/lib/publicApi/routes/environments";
import { registerEventTypeItemRoutes } from "@/lib/publicApi/routes/event-types/[id]";
import { registerEventTypeCollectionRoutes } from "@/lib/publicApi/routes/event-types";
import { registerMessageRoutes } from "@/lib/publicApi/routes/messages/[messageId]/[endpointId]/retry";
import { registerSendWebhookOpenApiRoutes } from "@/lib/publicApi/routes/send";

export const publicApiApp = new OpenAPIHono<{ Bindings: CloudflareEnv }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const authorizationIssue = result.error.issues.find(issue => {
        const normalizedPath = issue.path.map(segment => String(segment).toLowerCase());
        return normalizedPath[normalizedPath.length - 1] === "authorization";
      });

      if (authorizationIssue) {
        return c.json(
          {
            error: "Unauthorized",
            message: "Missing or invalid Authorization header",
          },
          401
        );
      }

      return c.json(
        {
          error: "Bad Request",
          details: result.error.issues.map(issue => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "root";
            return `${path}: ${issue.message}`;
          }),
        },
        400
      );
    }
  },
});

publicApiApp.use("*", logger());
publicApiApp.use(
  "*",
  cors({
    origin: origin => origin || "*",
    allowHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
publicApiApp.use("*", etag());

publicApiApp.use("/spec", async (c, next) => {
  if (!isApiDocsEnabled(c.env.NEXT_PUBLIC_API_DOCS_ENABLED)) {
    return c.json({ error: "Not Found" }, 404);
  }

  await next();
});

publicApiApp.use("/ui", async (c, next) => {
  if (!isApiDocsEnabled(c.env.NEXT_PUBLIC_API_DOCS_ENABLED)) {
    return c.json({ error: "Not Found" }, 404);
  }

  await next();
});

publicApiApp.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
  description: "Bearer API key authentication",
  type: "http",
  scheme: "bearer",
});

publicApiApp.openAPIRegistry.registerComponent("securitySchemes", "SessionCookie", {
  description: "Session cookie authentication.",
  type: "apiKey",
  in: "cookie",
  name: "hookhq.session_token",
});

publicApiApp.doc("/spec", {
  openapi: "3.0.3",
  info: {
    title: "HookHQ API",
    version: "1.0.0",
    description: "The HookHQ API is a RESTful API that allows you to manage your endpoints and send messages.",
  },
  servers: [{ url: "/api/v1" }],
  externalDocs: {
    description: "HookHQ Documentation",
    url: "https://hookhq.dev/",
  },
  security: [{ ApiKeyAuth: [] }, { SessionCookie: [] }],
});

publicApiApp.get(
  "/ui",
  Scalar({
    url: "spec",
    pageTitle: "HookHQ API Reference",
    theme: "deepSpace",
  })
);

registerAdminRoutes(publicApiApp);
registerEnvironmentCollectionRoutes(publicApiApp);
registerEnvironmentItemRoutes(publicApiApp);
registerEndpointGroupCollectionRoutes(publicApiApp);
registerEndpointGroupItemRoutes(publicApiApp);
registerEndpointGroupPortalRoutes(publicApiApp);
registerEndpointCollectionRoutes(publicApiApp);
registerEndpointItemRoutes(publicApiApp);
registerEventTypeCollectionRoutes(publicApiApp);
registerEventTypeItemRoutes(publicApiApp);
registerMessageRoutes(publicApiApp);
registerSendWebhookOpenApiRoutes(publicApiApp);
