import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { serverConfig } from "@/db/environments.schema";
import type { RetryConfig, RetryStrategy } from "@/lib/destinations/types";
import { eq } from "drizzle-orm";

export interface GlobalRetryConfig extends RetryConfig {}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveLegacyStrategy(defaultRetryPolicy?: string, defaultBackoffStrategy?: string): RetryStrategy {
  if (defaultRetryPolicy === "none") {
    return "none";
  }

  if (defaultRetryPolicy === "fixed" || defaultRetryPolicy === "linear" || defaultRetryPolicy === "exponential") {
    return defaultRetryPolicy;
  }

  if (
    defaultBackoffStrategy === "fixed" ||
    defaultBackoffStrategy === "linear" ||
    defaultBackoffStrategy === "exponential"
  ) {
    return defaultBackoffStrategy;
  }

  return "exponential";
}

export function calculateBackoffDelay(attempts: number, retryConfig: RetryConfig): number {
  if (retryConfig.strategy === "none") {
    return 0;
  }

  const baseAttempt = Math.max(1, attempts);
  let delay = retryConfig.baseDelaySeconds;

  switch (retryConfig.strategy) {
    case "fixed":
      delay = retryConfig.baseDelaySeconds;
      break;
    case "linear":
      delay = retryConfig.baseDelaySeconds * baseAttempt;
      break;
    case "exponential":
      delay = retryConfig.baseDelaySeconds * 2 ** (baseAttempt - 1);
      break;
    default:
      delay = retryConfig.baseDelaySeconds;
      break;
  }

  delay = clamp(1, delay, retryConfig.maxDelaySeconds);

  if (retryConfig.jitterFactor > 0) {
    const jitterRange = delay * retryConfig.jitterFactor;
    const jitterOffset = (Math.random() * 2 - 1) * jitterRange;
    delay += jitterOffset;
  }

  return Math.max(1, Math.round(delay));
}

export async function getGlobalRetryConfig(env?: CloudflareEnv): Promise<GlobalRetryConfig> {
  try {
    const resolvedEnv = env ?? (await getCloudflareContext({ async: true })).env;
    const cacheKey = "global:retry:config";
    const cachedConfig = await resolvedEnv.KV.get(cacheKey);

    if (cachedConfig) {
      return JSON.parse(cachedConfig) as GlobalRetryConfig;
    }

    const db = await getDb(resolvedEnv);
    const config = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);

    const resolved: GlobalRetryConfig =
      config[0] != null
        ? {
            strategy: resolveLegacyStrategy(config[0].defaultRetryStrategy, config[0].defaultBackoffStrategy),
            maxAttempts: config[0].defaultMaxRetries,
            baseDelaySeconds: config[0].defaultBaseDelaySeconds ?? 5,
            maxDelaySeconds: config[0].defaultMaxRetryDelaySeconds ?? 300,
            jitterFactor: (config[0].defaultRetryJitterFactor ?? 20) / 100,
          }
        : {
            strategy: "exponential",
            maxAttempts: 3,
            baseDelaySeconds: 5,
            maxDelaySeconds: 300,
            jitterFactor: 0.2,
          };

    await resolvedEnv.KV.put(cacheKey, JSON.stringify(resolved), { expirationTtl: 60 * 60 * 24 });
    return resolved;
  } catch (error) {
    console.error("Error getting global retry config:", error);
    return {
      strategy: "exponential",
      maxAttempts: 3,
      baseDelaySeconds: 5,
      maxDelaySeconds: 300,
      jitterFactor: 0.2,
    };
  }
}

export async function invalidateGlobalRetryConfigCache(env?: CloudflareEnv): Promise<void> {
  try {
    const resolvedEnv = env ?? (await getCloudflareContext({ async: true })).env;
    await resolvedEnv.KV.delete("global:retry:config");
  } catch (error) {
    console.error("Error invalidating global retry config cache:", error);
  }
}

export async function createRetryConfig(
  overrides: Partial<RetryConfig> = {},
  env?: CloudflareEnv
): Promise<RetryConfig> {
  const globalConfig = await getGlobalRetryConfig(env);

  return {
    strategy: overrides.strategy ?? globalConfig.strategy,
    maxAttempts: Math.max(1, overrides.maxAttempts ?? globalConfig.maxAttempts),
    baseDelaySeconds: Math.max(1, overrides.baseDelaySeconds ?? globalConfig.baseDelaySeconds),
    maxDelaySeconds: Math.max(1, overrides.maxDelaySeconds ?? globalConfig.maxDelaySeconds),
    jitterFactor: clamp(0, overrides.jitterFactor ?? globalConfig.jitterFactor, 1),
  };
}

export function shouldRetry(success: boolean, attempts: number, retryConfig: RetryConfig): boolean {
  if (success || retryConfig.strategy === "none") {
    return false;
  }

  return attempts < retryConfig.maxAttempts;
}

export function calculateRetryDelay(attempts: number, retryConfig: RetryConfig): number {
  return calculateBackoffDelay(attempts, retryConfig);
}
