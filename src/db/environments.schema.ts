import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(), // 4-character hex string
  name: text("name").notNull().unique(),
  description: text("description"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const serverConfig = sqliteTable("server_config", {
  id: text("id").primaryKey().default("default"),
  cloudflareApiKey: text("cloudflare_api_key"),
  cloudflareAccountId: text("cloudflare_account_id"),
  cloudflareQueueId: text("cloudflare_queue_id"),
  logRetentionDays: integer("log_retention_days").default(30).notNull(),
  payloadRetentionDays: integer("payload_retention_days").default(7).notNull(),
  defaultMaxRetries: integer("default_max_retries").default(3).notNull(),
  defaultTimeoutMs: integer("default_timeout_ms").default(30000).notNull(),
  defaultRetryPolicy: text("default_retry_policy").default("retry").notNull(),
  defaultBackoffStrategy: text("default_backoff_strategy").default("exponential").notNull(),
  defaultRetryStrategy: text("default_retry_strategy").default("exponential").notNull(),
  defaultBaseDelaySeconds: integer("default_base_delay_seconds").default(5).notNull(),
  defaultMaxRetryDelaySeconds: integer("default_max_retry_delay_seconds").default(300).notNull(),
  defaultRetryJitterFactor: integer("default_retry_jitter_factor").default(20).notNull(),
  defaultFailureAlertConfig: text("default_failure_alert_config").default("{}").notNull(),
  defaultAutoDisableConfig: text("default_auto_disable_config").default("{}").notNull(),
  defaultProxyGroupId: text("default_proxy_group_id"),
  queueManagementEnabled: integer("queue_management_enabled", { mode: "boolean" }).default(false).notNull(),
  jwtExpiration: text("jwt_expiration").default("1day").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
