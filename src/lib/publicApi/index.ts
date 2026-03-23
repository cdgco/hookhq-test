import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { publicApiApp } from "./app";
import { isApiDocsEnabled } from "./docs";

const app = new Hono<{ Bindings: CloudflareEnv }>();
app.use(cors());
app.use(logger());

app.get("/", c => {
  if (!isApiDocsEnabled(c.env.NEXT_PUBLIC_API_DOCS_ENABLED)) {
    return c.json({ error: "Not Found" }, 404);
  }

  return c.redirect("/api/v1/ui", 301);
});

app.get("/api/v1", c => {
  if (!isApiDocsEnabled(c.env.NEXT_PUBLIC_API_DOCS_ENABLED)) {
    return c.json({ error: "Not Found" }, 404);
  }

  return c.redirect("/api/v1/ui", 301);
});

app.route("/api/v1", publicApiApp);

app.get("*", c => {
  return c.json({ error: "Not Found" }, 404);
});

export default app;
