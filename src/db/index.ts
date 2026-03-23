import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "./schema";

export async function getDb(env?: CloudflareEnv) {
  const resolvedEnv = env ?? (await getCloudflareContext({ async: true })).env;

  return drizzle(resolvedEnv.DATABASE, {
    schema,
  });
}

export * from "drizzle-orm";
export * from "@/db/auth.schema";
export * from "@/db/environments.schema";
export * from "@/db/webhooks.schema";
export * from "./schema";
