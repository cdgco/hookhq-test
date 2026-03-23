import { getDb } from "@/db";
import { serverConfig } from "@/db/environments.schema";
import { endpoints } from "@/db/webhooks.schema";
import { parseAutoDisableConfig, parseOptionalAutoDisableConfig } from "@/lib/destinations/config";
import { and, eq } from "drizzle-orm";

function mergeAutoDisableConfig(
  defaults: { enabled: boolean; threshold: number },
  overrides: Partial<{ enabled: boolean; threshold: number }>
) {
  return {
    enabled: overrides.enabled ?? defaults.enabled,
    threshold: overrides.threshold ?? defaults.threshold,
  };
}

function failureKey(endpointId: string) {
  return `endpoint:consecutive-failures:${endpointId}`;
}

export async function resetEndpointFailureCount(env: CloudflareEnv, endpointId: string): Promise<void> {
  await env.KV.delete(failureKey(endpointId));
}

export async function maybeDisableEndpointForFailures(
  env: CloudflareEnv,
  endpointId: string
): Promise<{ disabled: boolean; count: number; threshold: number | null }> {
  const db = await getDb(env);
  const endpoint = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (endpoint.length === 0) {
    return { disabled: false, count: 0, threshold: null };
  }

  const [defaults] = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);
  const defaultConfig = parseAutoDisableConfig(defaults?.defaultAutoDisableConfig);
  const endpointConfig = parseOptionalAutoDisableConfig(endpoint[0].autoDisableConfig);
  const resolved = mergeAutoDisableConfig(defaultConfig, endpointConfig);

  if (!resolved.enabled) {
    return { disabled: false, count: 0, threshold: resolved.threshold };
  }

  const key = failureKey(endpointId);
  const currentCount = Number.parseInt((await env.KV.get(key)) || "0", 10) + 1;

  if (currentCount >= resolved.threshold) {
    await db
      .update(endpoints)
      .set({
        isActive: false,
        updatedAt: new Date(),
      } as never)
      .where(and(eq(endpoints.id, endpointId), eq(endpoints.isActive, true)));
    await env.KV.delete(key);
    return { disabled: true, count: currentCount, threshold: resolved.threshold };
  }

  await env.KV.put(key, String(currentCount), {
    expirationTtl: 60 * 60 * 24 * 30,
  });

  return { disabled: false, count: currentCount, threshold: resolved.threshold };
}
