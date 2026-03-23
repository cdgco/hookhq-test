// Types for Cloudflare Queue Metrics based on their GraphQL Analytics API
// Reference: https://developers.cloudflare.com/queues/observability/metrics/

export interface QueueBacklogMetrics {
  avg: {
    messages: number;
    bytes: number;
  };
  dimensions: {
    datetime: string;
  };
}

export interface QueueConsumerMetrics {
  avg: {
    concurrency: number;
  };
  dimensions: {
    datetimeHour: string;
  };
}

export interface QueueMessageOperationsMetrics {
  count: number;
  sum: {
    bytes: number;
  };
  avg: {
    lagTime: number;
    retryCount: number;
  };
  max: {
    messageSize: number;
  };
  dimensions: {
    datetimeMinute: string;
    actionType: string;
    consumerType?: string;
    outcome?: string;
  };
}

export interface CloudflareGraphQLResponse<T> {
  data: {
    viewer: {
      accounts: Array<{
        queueBacklogAdaptiveGroups?: T[];
        queueConsumerMetricsAdaptiveGroups?: T[];
        queueMessageOperationsAdaptiveGroups?: T[];
      }>;
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
  }>;
}

export interface ProcessedQueueMetrics {
  backlog: {
    messages: number;
    bytes: number;
  };
  consumerConcurrency: number;
  messageOperations: {
    totalOperations: number;
    totalBytes: number;
    avgLagTime: number;
    avgRetries: number;
    maxMessageSize: number;
  };
  timeRange: string;
  lastUpdated: string;
}

export type TimeRange = "1h" | "24h" | "7d" | "30d";
