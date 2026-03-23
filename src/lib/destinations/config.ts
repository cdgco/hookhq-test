import type {
  AutoDisableConfig,
  DestinationConfig,
  EndpointRecordShape,
  FailureAlertConfig,
  RetryConfig,
  RetryStrategy,
} from "@/lib/destinations/types";
import { decryptValue, encryptValue } from "@/lib/destinations/secrets";

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  strategy: "exponential",
  maxAttempts: 3,
  baseDelaySeconds: 5,
  maxDelaySeconds: 300,
  jitterFactor: 0.2,
};

const DEFAULT_ALERT_CONFIG: FailureAlertConfig = {
  enabled: false,
  threshold: 5,
  windowMinutes: 60,
  endpointIds: [],
  channelType: "webhook",
  destinationUrl: "",
};

const DEFAULT_AUTO_DISABLE_CONFIG: AutoDisableConfig = {
  enabled: false,
  threshold: 10,
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return {
      ...fallback,
      ...JSON.parse(value),
    };
  } catch {
    return fallback;
  }
}

function normalizeRetryStrategy(record: EndpointRecordShape): RetryStrategy {
  const strategy =
    record.retryStrategy ?? record.backoffStrategy ?? record.retryPolicy ?? DEFAULT_RETRY_CONFIG.strategy;

  if (strategy === "retry") {
    return "exponential";
  }

  if (strategy === "none" || strategy === "fixed" || strategy === "linear" || strategy === "exponential") {
    return strategy;
  }

  return DEFAULT_RETRY_CONFIG.strategy;
}

export function resolveRetryConfig(record: EndpointRecordShape): RetryConfig {
  return {
    strategy: normalizeRetryStrategy(record),
    maxAttempts: Math.max(1, record.maxRetries ?? DEFAULT_RETRY_CONFIG.maxAttempts),
    baseDelaySeconds: Math.max(1, record.baseDelaySeconds ?? DEFAULT_RETRY_CONFIG.baseDelaySeconds),
    maxDelaySeconds: Math.max(1, record.maxRetryDelaySeconds ?? DEFAULT_RETRY_CONFIG.maxDelaySeconds),
    jitterFactor: Math.min(1, Math.max(0, record.retryJitterFactor ?? DEFAULT_RETRY_CONFIG.jitterFactor)),
  };
}

export async function resolveDestinationConfig(
  record: EndpointRecordShape,
  env?: CloudflareEnv
): Promise<DestinationConfig> {
  const destinationType =
    record.destinationType === "sqs" || record.destinationType === "pubsub" ? record.destinationType : "webhook";
  const decryptedConfig = await decryptValue(record.destinationConfig, env);
  const config = parseJson<Record<string, unknown>>(decryptedConfig, {});

  if (destinationType === "sqs") {
    return {
      type: "sqs",
      queueUrl: String(config.queueUrl ?? record.url),
      region: String(config.region ?? ""),
      accessKeyId: String(config.accessKeyId ?? ""),
      secretAccessKey: String(config.secretAccessKey ?? ""),
      delaySeconds: config.delaySeconds ? Number(config.delaySeconds) : undefined,
      messageGroupId: config.messageGroupId ? String(config.messageGroupId) : undefined,
      messageDeduplicationId: config.messageDeduplicationId ? String(config.messageDeduplicationId) : undefined,
    };
  }

  if (destinationType === "pubsub") {
    return {
      type: "pubsub",
      topicName: String(config.topicName ?? record.url),
      serviceAccountJson: String(config.serviceAccountJson ?? ""),
      attributes:
        typeof config.attributes === "object" && config.attributes !== null
          ? (config.attributes as Record<string, string>)
          : {},
      orderingKey: config.orderingKey ? String(config.orderingKey) : undefined,
    };
  }

  return {
    type: "webhook",
    url: String(config.url ?? record.url),
    timeoutMs: Math.max(1000, Number(config.timeoutMs ?? record.timeoutMs ?? 30000)),
    customHeaders:
      typeof config.customHeaders === "object" && config.customHeaders !== null
        ? (config.customHeaders as Record<string, string>)
        : parseJson<Record<string, string>>(record.headers, {}),
    proxyGroupId: (config.proxyGroupId as string | null | undefined) ?? record.proxyGroupId,
  };
}

export async function serializeDestinationConfig(config: DestinationConfig, env?: CloudflareEnv): Promise<string> {
  if (config.type === "sqs") {
    return encryptValue(
      JSON.stringify({
        queueUrl: config.queueUrl,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        delaySeconds: config.delaySeconds,
        messageGroupId: config.messageGroupId,
        messageDeduplicationId: config.messageDeduplicationId,
      }),
      env
    );
  }

  if (config.type === "pubsub") {
    return encryptValue(
      JSON.stringify({
        topicName: config.topicName,
        serviceAccountJson: config.serviceAccountJson,
        attributes: config.attributes ?? {},
        orderingKey: config.orderingKey,
      }),
      env
    );
  }

  return encryptValue(
    JSON.stringify({
      url: config.url,
      timeoutMs: config.timeoutMs,
      customHeaders: config.customHeaders ?? {},
      proxyGroupId: config.proxyGroupId ?? null,
    }),
    env
  );
}

export function parseFailureAlertConfig(value: string | null | undefined): FailureAlertConfig {
  const config = parseJson<FailureAlertConfig>(value, DEFAULT_ALERT_CONFIG);

  return {
    enabled: Boolean(config.enabled),
    threshold: Math.max(1, Number(config.threshold ?? DEFAULT_ALERT_CONFIG.threshold)),
    windowMinutes: Math.max(1, Number(config.windowMinutes ?? DEFAULT_ALERT_CONFIG.windowMinutes)),
    endpointIds: Array.isArray(config.endpointIds) ? config.endpointIds.filter(Boolean) : [],
    channelType: config.channelType === "slack" ? "slack" : "webhook",
    destinationUrl: String(config.destinationUrl ?? ""),
  };
}

export function serializeFailureAlertConfig(config: FailureAlertConfig): string {
  return JSON.stringify({
    enabled: config.enabled,
    threshold: config.threshold,
    windowMinutes: config.windowMinutes,
    endpointIds: config.endpointIds,
    channelType: config.channelType,
    destinationUrl: config.destinationUrl,
  });
}

export function parseAutoDisableConfig(value: string | null | undefined): AutoDisableConfig {
  const config = parseJson<AutoDisableConfig>(value, DEFAULT_AUTO_DISABLE_CONFIG);

  return {
    enabled: Boolean(config.enabled),
    threshold: Math.max(1, Number(config.threshold ?? DEFAULT_AUTO_DISABLE_CONFIG.threshold)),
  };
}

export function serializeAutoDisableConfig(config: AutoDisableConfig): string {
  return JSON.stringify({
    enabled: config.enabled,
    threshold: config.threshold,
  });
}

export function parseOptionalAutoDisableConfig(value: string | null | undefined): Partial<AutoDisableConfig> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Partial<AutoDisableConfig>;
    const result: Partial<AutoDisableConfig> = {};

    if (typeof parsed.enabled === "boolean") {
      result.enabled = parsed.enabled;
    }

    if (parsed.threshold !== undefined) {
      result.threshold = Math.max(1, Number(parsed.threshold));
    }

    return result;
  } catch {
    return {};
  }
}
