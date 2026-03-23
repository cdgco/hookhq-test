import { proxyGroups, proxyServers } from "@/db/webhooks.schema";
import { decryptValue, encryptValue } from "@/lib/destinations/secrets";

export const PROXY_HEALTH_PATH = "/health";
export const PROXY_RELAY_PATH = "/proxy";

export type ProxyHealthState = "healthy" | "unhealthy" | "unknown";

export type ProxyHealthRecord = {
  checkedAt: string;
  error?: string;
  responseTimeMs?: number;
  state: ProxyHealthState;
};

function healthKey(proxyId: string) {
  return `proxy-health:${proxyId}`;
}

export async function encryptProxySecret(secret: string, env: CloudflareEnv) {
  return encryptValue(secret, env);
}

export async function decryptProxySecret(secret: string, env: CloudflareEnv) {
  return decryptValue(secret, env);
}

export async function readProxyHealth(env: CloudflareEnv, proxyId: string): Promise<ProxyHealthRecord> {
  const value = await env.KV.get(healthKey(proxyId), "json");

  if (!value || typeof value !== "object") {
    return {
      state: "unknown",
      checkedAt: new Date(0).toISOString(),
    };
  }

  const record = value as Partial<ProxyHealthRecord>;

  return {
    state: record.state === "healthy" || record.state === "unhealthy" ? record.state : "unknown",
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : new Date(0).toISOString(),
    error: typeof record.error === "string" ? record.error : undefined,
    responseTimeMs: typeof record.responseTimeMs === "number" ? record.responseTimeMs : undefined,
  };
}

export async function writeProxyHealth(env: CloudflareEnv, proxyId: string, record: ProxyHealthRecord) {
  await env.KV.put(healthKey(proxyId), JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * 7,
  });
}

export function getProxyHealthUrl(url: string) {
  return new URL(PROXY_HEALTH_PATH, url).toString();
}

export function getProxyRelayUrl(url: string) {
  return new URL(PROXY_RELAY_PATH, url).toString();
}

export async function checkProxyServerHealth(proxy: typeof proxyServers.$inferSelect, env: CloudflareEnv) {
  const startedAt = Date.now();

  try {
    const response = await fetch(getProxyHealthUrl(proxy.url), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "HookHQ/1.0",
      },
      signal: AbortSignal.timeout(Math.max(proxy.timeoutMs, 1000)),
    });

    const state: ProxyHealthState = response.ok ? "healthy" : "unhealthy";
    const record: ProxyHealthRecord = {
      state,
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };

    await writeProxyHealth(env, proxy.id, record);
    return record;
  } catch (error) {
    const record: ProxyHealthRecord = {
      state: "unhealthy",
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Health check failed",
    };

    await writeProxyHealth(env, proxy.id, record);
    return record;
  }
}

export async function chooseProxyServer(
  env: CloudflareEnv,
  group: typeof proxyGroups.$inferSelect,
  servers: Array<typeof proxyServers.$inferSelect>
) {
  const statuses = await Promise.all(
    servers.map(async server => ({
      health: await readProxyHealth(env, server.id),
      server,
    }))
  );

  const healthyServers = statuses.filter(item => item.health.state !== "unhealthy").map(item => item.server);

  const availableServers = healthyServers.length > 0 ? healthyServers : servers;
  if (availableServers.length === 0) {
    return null;
  }

  if (group.loadBalancingStrategy === "round_robin") {
    const counterKey = `proxy-group:rr:${group.id}`;
    const current = Number.parseInt((await env.KV.get(counterKey)) || "0", 10);
    const nextIndex = Number.isFinite(current) ? current % availableServers.length : 0;
    await env.KV.put(counterKey, String(current + 1), { expirationTtl: 60 * 60 * 24 * 30 });
    return availableServers[nextIndex];
  }

  const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % availableServers.length;
  return availableServers[randomIndex];
}
