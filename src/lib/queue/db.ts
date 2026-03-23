import { drizzle } from "drizzle-orm/d1";
import { schema } from "@/db/schema";

export async function getDb(env: CloudflareEnv) {
  return drizzle(env.DATABASE, {
    schema,
  });
}