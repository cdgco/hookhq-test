import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Webhook endpoints table
export const endpoints = sqliteTable("endpoints", {
  id: text("id").primaryKey(), // Format: {environmentId}_{endpointId}
  environmentId: text("environment_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  retryPolicy: text("retry_policy").default("retry"), // legacy field kept for compatibility
  backoffStrategy: text("backoff_strategy").default("exponential"), // legacy field kept for compatibility
  retryStrategy: text("retry_strategy").default("exponential"),
  baseDelaySeconds: integer("base_delay_seconds").default(5), // in seconds
  maxRetryDelaySeconds: integer("max_retry_delay_seconds").default(300).notNull(),
  retryJitterFactor: real("retry_jitter_factor").default(0.2).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  timeoutMs: integer("timeout_ms").default(30000).notNull(),
  headers: text("headers"), // JSON string of custom headers
  proxyGroupId: text("proxy_group_id"), // Optional proxy group assignment
  destinationType: text("destination_type").default("webhook"),
  destinationConfig: text("destination_config").default("{}").notNull(),
  autoDisableConfig: text("auto_disable_config").default("{}").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  topics: text("topics").default('["*"]'), // JSON array of event type subscriptions
});

// Webhook endpoint groups table
export const endpointGroups = sqliteTable("endpoint_groups", {
  id: text("id").primaryKey(), // Format: {environmentId}_{groupId}
  environmentId: text("environment_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  endpointIds: text("endpoint_ids").notNull(), // JSON array of endpoint IDs
  eventTypes: text("event_types").default('["*"]').notNull(), // JSON array of event type subscriptions
  proxyGroupId: text("proxy_group_id"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  failureAlertConfig: text("failure_alert_config").default("{}").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Event types table
export const eventTypes = sqliteTable("event_types", {
  id: text("id").primaryKey(), // Format: {environmentId}_{eventTypeId}
  environmentId: text("environment_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  schema: text("schema"), // JSON schema for event payload validation
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Webhook messages table
export const webhookMessages = sqliteTable("webhook_messages", {
  id: text("id").primaryKey(), // UUID from producer
  eventId: text("event_id"), // Optional event ID from user
  eventType: text("event_type"),
  environmentId: text("environment_id").notNull(),

  // Target information
  endpointIds: text("endpoint_ids").notNull(), // JSON array
  endpointGroupIds: text("endpoint_group_ids").notNull(), // JSON array

  // Message content
  payload: text("payload"), // Optional JSON payload (if user wants to log it)
  payloadSize: integer("payload_size"), // Size in bytes

  // Status tracking
  status: text("status").notNull().default("pending"), // pending, processing, delivered, failed, retrying
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),

  // Timing
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  queuedAt: integer("queued_at", { mode: "timestamp" }),
  processingStartedAt: integer("processing_started_at", { mode: "timestamp" }),
  deliveredAt: integer("delivered_at", { mode: "timestamp" }),
  failedAt: integer("failed_at", { mode: "timestamp" }),

  // Error tracking
  lastError: text("last_error"),
  lastErrorAt: integer("last_error_at", { mode: "timestamp" }),

  // Response tracking
  responseStatus: integer("response_status"),
  responseTimeMs: integer("response_time_ms"),
  responseBody: text("response_body"), // Optional response body

  // Idempotency
  idempotencyKey: text("idempotency_key"),

  // Metadata
  metadata: text("metadata"), // JSON string for additional data
});

// Webhook delivery attempts table (for detailed retry tracking)
export const webhookAttempts = sqliteTable("webhook_attempts", {
  id: text("id").primaryKey(), // UUID
  messageId: text("message_id").notNull(), // References webhookMessages.id
  endpointId: text("endpoint_id").notNull(),
  attemptNumber: integer("attempt_number").notNull(),

  // Request details
  requestUrl: text("request_url").notNull(),
  requestMethod: text("request_method").default("POST").notNull(),
  requestHeaders: text("request_headers"), // JSON string
  requestBody: text("request_body"), // JSON string

  // Response details
  responseStatus: integer("response_status"),
  responseHeaders: text("response_headers"), // JSON string
  responseBody: text("response_body"),
  responseTimeMs: integer("response_time_ms"),

  // Status
  status: text("status").notNull(), // success, failed, timeout, error
  errorMessage: text("error_message"),

  // Timing
  attemptedAt: integer("attempted_at", { mode: "timestamp" }).defaultNow().notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// Proxy groups table
export const proxyGroups = sqliteTable("proxy_groups", {
  id: text("id").primaryKey(), // Format: {environmentId}_{groupId}
  environmentId: text("environment_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  proxyIds: text("proxy_ids").notNull(), // JSON array of proxy server IDs
  loadBalancingStrategy: text("load_balancing_strategy").default("random").notNull(), // random, round_robin
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Proxy servers table
export const proxyServers = sqliteTable("proxy_servers", {
  id: text("id").primaryKey(), // Format: {environmentId}_{proxyId}
  environmentId: text("environment_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(), // Base URL of the proxy server
  description: text("description"),
  secret: text("secret").notNull(), // Secret for authentication
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  region: text("region"), // e.g., "us-east-1", "europe-west-1"
  provider: text("provider"), // e.g., "aws", "gcp", "azure"
  staticIp: text("static_ip"), // The static IP address
  healthCheckUrl: text("health_check_url"), // Optional custom health check endpoint
  timeoutMs: integer("timeout_ms").default(30000).notNull(),
  maxConcurrentRequests: integer("max_concurrent_requests").default(100).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Webhook metrics table (for aggregated statistics)
export const webhookMetrics = sqliteTable("webhook_metrics", {
  id: text("id").primaryKey(),
  environmentId: text("environment_id").notNull(),
  endpointId: text("endpoint_id"), // null for environment-wide metrics
  date: text("date").notNull(), // YYYY-MM-DD format

  // Counts
  totalMessages: integer("total_messages").default(0).notNull(),
  deliveredMessages: integer("delivered_messages").default(0).notNull(),
  failedMessages: integer("failed_messages").default(0).notNull(),
  retryMessages: integer("retry_messages").default(0).notNull(),

  // Response times (in milliseconds)
  avgResponseTime: real("avg_response_time"),
  minResponseTime: integer("min_response_time"),
  maxResponseTime: integer("max_response_time"),

  // Error counts by status code
  error4xx: integer("error_4xx").default(0).notNull(),
  error5xx: integer("error_5xx").default(0).notNull(),
  timeoutErrors: integer("timeout_errors").default(0).notNull(),
  networkErrors: integer("network_errors").default(0).notNull(),

  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
