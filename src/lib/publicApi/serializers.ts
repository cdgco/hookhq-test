import { endpointGroups, endpoints } from "@/db/webhooks.schema";
import {
  parseAutoDisableConfig,
  parseFailureAlertConfig,
  resolveDestinationConfig,
  resolveRetryConfig,
  serializeAutoDisableConfig,
  serializeDestinationConfig,
  serializeFailureAlertConfig,
} from "@/lib/destinations/config";
import { parseEventSubscriptions, serializeEventSubscriptions } from "@/lib/subscriptions";
import type { AutoDisableConfig, DestinationConfig, FailureAlertConfig, RetryConfig } from "@/lib/destinations/types";

function normalizeDestinationInput(
  destinationType: "webhook" | "sqs" | "pubsub" | undefined,
  destination: Record<string, unknown> | DestinationConfig,
  existingDestination?: DestinationConfig
): DestinationConfig {
  const rawDestination = destination as Record<string, unknown>;

  if (destinationType === "sqs") {
    const existing = existingDestination?.type === "sqs" ? existingDestination : undefined;

    return {
      type: "sqs",
      queueUrl: String(rawDestination.queueUrl ?? existing?.queueUrl ?? ""),
      region: String(rawDestination.region ?? existing?.region ?? ""),
      accessKeyId: String(rawDestination.accessKeyId ?? existing?.accessKeyId ?? ""),
      secretAccessKey:
        typeof rawDestination.secretAccessKey === "string" && rawDestination.secretAccessKey.trim()
          ? rawDestination.secretAccessKey
          : (existing?.secretAccessKey ?? ""),
      delaySeconds: rawDestination.delaySeconds != null ? Number(rawDestination.delaySeconds) : undefined,
      messageGroupId: rawDestination.messageGroupId ? String(rawDestination.messageGroupId) : undefined,
      messageDeduplicationId: rawDestination.messageDeduplicationId
        ? String(rawDestination.messageDeduplicationId)
        : undefined,
    };
  }

  if (destinationType === "pubsub") {
    const existing = existingDestination?.type === "pubsub" ? existingDestination : undefined;

    return {
      type: "pubsub",
      topicName: String(rawDestination.topicName ?? existing?.topicName ?? ""),
      serviceAccountJson:
        typeof rawDestination.serviceAccountJson === "string" && rawDestination.serviceAccountJson.trim()
          ? rawDestination.serviceAccountJson
          : (existing?.serviceAccountJson ?? ""),
      attributes: (rawDestination.attributes as Record<string, string> | undefined) ?? {},
      orderingKey: rawDestination.orderingKey ? String(rawDestination.orderingKey) : undefined,
    };
  }

  const existing = existingDestination?.type === "webhook" ? existingDestination : undefined;

  return {
    type: "webhook",
    url: String(rawDestination.url ?? existing?.url ?? ""),
    timeoutMs: rawDestination.timeoutMs != null ? Number(rawDestination.timeoutMs) : (existing?.timeoutMs ?? 30000),
    customHeaders:
      rawDestination.customHeaders !== undefined
        ? ((rawDestination.customHeaders as Record<string, string> | undefined) ?? {})
        : (existing?.customHeaders ?? {}),
    proxyGroupId: (rawDestination.proxyGroupId as string | null | undefined) ?? null,
  };
}

export async function formatEndpoint(endpoint: typeof endpoints.$inferSelect, env?: CloudflareEnv) {
  const destination = await resolveDestinationConfig(endpoint, env);

  return {
    id: endpoint.id,
    environmentId: endpoint.environmentId,
    name: endpoint.name,
    description: endpoint.description,
    eventTypes: parseEventSubscriptions(endpoint.topics),
    destinationType:
      endpoint.destinationType === "sqs" || endpoint.destinationType === "pubsub"
        ? endpoint.destinationType
        : "webhook",
    destination:
      destination.type === "webhook"
        ? {
            url: destination.url,
            timeoutMs: destination.timeoutMs,
            hasCustomHeaders: Object.keys(destination.customHeaders ?? {}).length > 0,
            proxyGroupId: destination.proxyGroupId ?? null,
          }
        : destination.type === "sqs"
          ? {
              queueUrl: destination.queueUrl,
              region: destination.region,
              accessKeyId: destination.accessKeyId,
              hasSecretAccessKey: Boolean(destination.secretAccessKey),
              delaySeconds: destination.delaySeconds,
              messageGroupId: destination.messageGroupId,
              messageDeduplicationId: destination.messageDeduplicationId,
            }
          : {
              topicName: destination.topicName,
              hasServiceAccountJson: Boolean(destination.serviceAccountJson),
              attributes: destination.attributes ?? {},
              orderingKey: destination.orderingKey,
            },
    enabled: endpoint.isActive,
    retry: resolveRetryConfig(endpoint),
    autoDisable: parseAutoDisableConfig(endpoint.autoDisableConfig),
    createdAt: endpoint.createdAt.toISOString(),
    updatedAt: endpoint.updatedAt.toISOString(),
  };
}

export function formatEndpointGroup(group: typeof endpointGroups.$inferSelect) {
  return {
    id: group.id,
    environmentId: group.environmentId,
    name: group.name,
    description: group.description,
    endpointIds: group.endpointIds ? JSON.parse(group.endpointIds) : [],
    eventTypes: parseEventSubscriptions(group.eventTypes),
    proxyGroupId: group.proxyGroupId,
    enabled: group.isActive,
    failureAlerts: parseFailureAlertConfig(group.failureAlertConfig),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export async function buildEndpointInsertValues(input: {
  environmentId: string;
  name: string;
  description?: string;
  eventTypes?: string[];
  enabled?: boolean;
  destinationType?: "webhook" | "sqs" | "pubsub";
  destination: Record<string, unknown> | DestinationConfig;
  retry?: Partial<RetryConfig>;
  autoDisable?: Partial<AutoDisableConfig>;
  id?: string;
  now?: Date;
  env?: CloudflareEnv;
}) {
  const now = input.now ?? new Date();
  const retry = input.retry;
  const destination = normalizeDestinationInput(input.destinationType, input.destination);
  const autoDisableConfig =
    input.autoDisable !== undefined
      ? serializeAutoDisableConfig({
          enabled: input.autoDisable.enabled ?? false,
          threshold: input.autoDisable.threshold ?? 10,
        })
      : "{}";

  return {
    id: input.id ?? crypto.randomUUID(),
    environmentId: input.environmentId,
    name: input.name,
    description: input.description,
    topics: serializeEventSubscriptions(input.eventTypes),
    url:
      destination.type === "webhook"
        ? destination.url
        : destination.type === "sqs"
          ? destination.queueUrl
          : destination.topicName,
    isActive: input.enabled ?? true,
    retryPolicy: retry?.strategy ?? "exponential",
    backoffStrategy: retry?.strategy ?? "exponential",
    retryStrategy: retry?.strategy ?? "exponential",
    baseDelaySeconds: retry?.baseDelaySeconds ?? 5,
    maxRetryDelaySeconds: retry?.maxDelaySeconds ?? 300,
    retryJitterFactor: retry?.jitterFactor ?? 0.2,
    maxRetries: retry?.maxAttempts ?? 3,
    autoDisableConfig,
    timeoutMs: destination.type === "webhook" ? destination.timeoutMs : 30000,
    headers: null,
    proxyGroupId: destination.type === "webhook" ? (destination.proxyGroupId ?? null) : null,
    destinationType: input.destinationType ?? destination.type,
    destinationConfig: await serializeDestinationConfig(destination, input.env),
    createdAt: now,
    updatedAt: now,
  };
}

export async function buildEndpointUpdateValues(input: {
  name?: string;
  description?: string;
  eventTypes?: string[];
  enabled?: boolean;
  destinationType?: "webhook" | "sqs" | "pubsub";
  destination?: Record<string, unknown> | DestinationConfig;
  retry?: Partial<RetryConfig>;
  autoDisable?: Partial<AutoDisableConfig>;
  existingAutoDisable?: AutoDisableConfig;
  existingDestination?: DestinationConfig;
  env?: CloudflareEnv;
}) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.eventTypes !== undefined) updateData.topics = serializeEventSubscriptions(input.eventTypes);
  if (input.enabled !== undefined) updateData.isActive = input.enabled;

  if (input.destinationType !== undefined) {
    updateData.destinationType = input.destinationType;
  }

  if (input.destination) {
    const destination = normalizeDestinationInput(input.destinationType, input.destination, input.existingDestination);
    updateData.url =
      destination.type === "webhook"
        ? destination.url
        : destination.type === "sqs"
          ? destination.queueUrl
          : destination.topicName;
    updateData.timeoutMs = destination.type === "webhook" ? destination.timeoutMs : 30000;
    updateData.headers = null;
    updateData.proxyGroupId = destination.type === "webhook" ? (destination.proxyGroupId ?? null) : null;
    updateData.destinationConfig = await serializeDestinationConfig(destination, input.env);
    updateData.destinationType = destination.type;
  }

  if (input.retry) {
    if (input.retry.strategy !== undefined) {
      updateData.retryPolicy = input.retry.strategy;
      updateData.backoffStrategy = input.retry.strategy;
      updateData.retryStrategy = input.retry.strategy;
    }
    if (input.retry.maxAttempts !== undefined) updateData.maxRetries = input.retry.maxAttempts;
    if (input.retry.baseDelaySeconds !== undefined) updateData.baseDelaySeconds = input.retry.baseDelaySeconds;
    if (input.retry.maxDelaySeconds !== undefined) updateData.maxRetryDelaySeconds = input.retry.maxDelaySeconds;
    if (input.retry.jitterFactor !== undefined) updateData.retryJitterFactor = input.retry.jitterFactor;
  }

  if (input.autoDisable !== undefined) {
    updateData.autoDisableConfig = serializeAutoDisableConfig({
      enabled: input.autoDisable.enabled ?? input.existingAutoDisable?.enabled ?? false,
      threshold: input.autoDisable.threshold ?? input.existingAutoDisable?.threshold ?? 10,
    });
  }

  return updateData;
}

export function buildEndpointGroupInsertValues(input: {
  id?: string;
  environmentId: string;
  name: string;
  description?: string;
  endpointIds?: string[];
  eventTypes?: string[];
  proxyGroupId?: string | null;
  enabled?: boolean;
  failureAlerts?: Partial<FailureAlertConfig>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    id: input.id ?? crypto.randomUUID(),
    environmentId: input.environmentId,
    name: input.name,
    description: input.description,
    endpointIds: JSON.stringify(input.endpointIds ?? []),
    eventTypes: serializeEventSubscriptions(input.eventTypes),
    proxyGroupId: input.proxyGroupId ?? null,
    isActive: input.enabled ?? true,
    failureAlertConfig: serializeFailureAlertConfig({
      enabled: input.failureAlerts?.enabled ?? false,
      threshold: input.failureAlerts?.threshold ?? 5,
      windowMinutes: input.failureAlerts?.windowMinutes ?? 60,
      endpointIds: input.failureAlerts?.endpointIds ?? [],
      channelType: input.failureAlerts?.channelType ?? "webhook",
      destinationUrl: input.failureAlerts?.destinationUrl ?? "",
    }),
    createdAt: now,
    updatedAt: now,
  };
}

export function buildEndpointGroupUpdateValues(input: {
  name?: string;
  description?: string;
  endpointIds?: string[];
  eventTypes?: string[];
  proxyGroupId?: string | null;
  enabled?: boolean;
  failureAlerts?: Partial<FailureAlertConfig>;
  existingFailureAlerts: FailureAlertConfig;
}) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.endpointIds !== undefined) updateData.endpointIds = JSON.stringify(input.endpointIds);
  if (input.eventTypes !== undefined) updateData.eventTypes = serializeEventSubscriptions(input.eventTypes);
  if (input.proxyGroupId !== undefined) updateData.proxyGroupId = input.proxyGroupId;
  if (input.enabled !== undefined) updateData.isActive = input.enabled;
  if (input.failureAlerts !== undefined) {
    updateData.failureAlertConfig = serializeFailureAlertConfig({
      ...input.existingFailureAlerts,
      ...input.failureAlerts,
      endpointIds: input.failureAlerts.endpointIds ?? input.existingFailureAlerts.endpointIds,
    });
  }
  return updateData;
}
