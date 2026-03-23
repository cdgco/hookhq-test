export const DESTINATION_TYPES = ["webhook", "sqs", "pubsub"] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const RETRY_STRATEGIES = ["none", "fixed", "linear", "exponential"] as const;
export type RetryStrategy = (typeof RETRY_STRATEGIES)[number];

export const ALERT_CHANNEL_TYPES = ["webhook", "slack"] as const;
export type AlertChannelType = (typeof ALERT_CHANNEL_TYPES)[number];

export interface RetryConfig {
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  jitterFactor: number;
}

export interface WebhookDestinationConfig {
  type: "webhook";
  url: string;
  timeoutMs: number;
  customHeaders: Record<string, string>;
  proxyGroupId?: string | null;
}

export interface SqsDestinationConfig {
  type: "sqs";
  queueUrl: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  delaySeconds?: number;
  messageGroupId?: string;
  messageDeduplicationId?: string;
}

export interface PubSubDestinationConfig {
  type: "pubsub";
  topicName: string;
  serviceAccountJson: string;
  attributes?: Record<string, string>;
  orderingKey?: string;
}

export type DestinationConfig = WebhookDestinationConfig | SqsDestinationConfig | PubSubDestinationConfig;

export interface FailureAlertConfig {
  enabled: boolean;
  threshold: number;
  windowMinutes: number;
  endpointIds: string[];
  channelType: AlertChannelType;
  destinationUrl: string;
}

export interface AutoDisableConfig {
  enabled: boolean;
  threshold: number;
}

export interface EndpointRecordShape {
  url: string;
  timeoutMs: number;
  headers: string | null;
  proxyGroupId: string | null;
  destinationType: string | null;
  destinationConfig: string | null;
  retryStrategy: string | null;
  maxRetries: number;
  baseDelaySeconds: number | null;
  maxRetryDelaySeconds: number | null;
  retryJitterFactor: number | null;
  retryPolicy?: string | null;
  backoffStrategy?: string | null;
  autoDisableConfig?: string | null;
}
