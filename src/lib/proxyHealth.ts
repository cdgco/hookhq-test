import { getDb } from "@/db";
import { proxyServers } from "@/db/webhooks.schema";
import { eq } from "drizzle-orm";
import { checkProxyServerHealth } from "@/lib/proxy";

export async function reconcileProxyHealth(env: CloudflareEnv) {
  const db = await getDb(env);
  const activeProxies = await db.select().from(proxyServers).where(eq(proxyServers.isActive, true));

  await Promise.all(activeProxies.map(proxy => checkProxyServerHealth(proxy, env)));
}
