CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `apikeys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`start` text,
	`prefix` text,
	`key` text NOT NULL,
	`user_id` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_time_window` integer DEFAULT 86400000,
	`rate_limit_max` integer DEFAULT 10,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`timezone` text,
	`city` text,
	`country` text,
	`region` text,
	`region_code` text,
	`colo` text,
	`latitude` text,
	`longitude` text,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `two_factors` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`two_factor_enabled` integer DEFAULT false,
	`last_environment` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `environments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `environments_name_unique` ON `environments` (`name`);--> statement-breakpoint
CREATE TABLE `server_config` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`cloudflare_api_key` text,
	`cloudflare_account_id` text,
	`cloudflare_queue_id` text,
	`log_retention_days` integer DEFAULT 30 NOT NULL,
	`payload_retention_days` integer DEFAULT 7 NOT NULL,
	`default_max_retries` integer DEFAULT 3 NOT NULL,
	`default_timeout_ms` integer DEFAULT 30000 NOT NULL,
	`default_retry_policy` text DEFAULT 'retry' NOT NULL,
	`default_backoff_strategy` text DEFAULT 'exponential' NOT NULL,
	`default_retry_strategy` text DEFAULT 'exponential' NOT NULL,
	`default_base_delay_seconds` integer DEFAULT 5 NOT NULL,
	`default_max_retry_delay_seconds` integer DEFAULT 300 NOT NULL,
	`default_retry_jitter_factor` integer DEFAULT 20 NOT NULL,
	`default_failure_alert_config` text DEFAULT '{}' NOT NULL,
	`default_auto_disable_config` text DEFAULT '{}' NOT NULL,
	`queue_management_enabled` integer DEFAULT false NOT NULL,
	`jwt_expiration` text DEFAULT '1day' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `endpoint_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`endpoint_ids` text NOT NULL,
	`event_types` text DEFAULT '["*"]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`failure_alert_config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`retry_policy` text DEFAULT 'retry',
	`backoff_strategy` text DEFAULT 'exponential',
	`retry_strategy` text DEFAULT 'exponential',
	`base_delay_seconds` integer DEFAULT 5,
	`max_retry_delay_seconds` integer DEFAULT 300 NOT NULL,
	`retry_jitter_factor` real DEFAULT 0.2 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`timeout_ms` integer DEFAULT 30000 NOT NULL,
	`headers` text,
	`proxy_group_id` text,
	`destination_type` text DEFAULT 'webhook',
	`destination_config` text DEFAULT '{}' NOT NULL,
	`auto_disable_config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`topics` text DEFAULT '["*"]'
);
--> statement-breakpoint
CREATE TABLE `event_types` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`schema` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `proxy_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`proxy_ids` text NOT NULL,
	`load_balancing_strategy` text DEFAULT 'random' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `proxy_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`secret` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`region` text,
	`provider` text,
	`static_ip` text,
	`health_check_url` text,
	`timeout_ms` integer DEFAULT 30000 NOT NULL,
	`max_concurrent_requests` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`endpoint_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`request_url` text NOT NULL,
	`request_method` text DEFAULT 'POST' NOT NULL,
	`request_headers` text,
	`request_body` text,
	`response_status` integer,
	`response_headers` text,
	`response_body` text,
	`response_time_ms` integer,
	`status` text NOT NULL,
	`error_message` text,
	`attempted_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `webhook_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`event_type` text,
	`environment_id` text NOT NULL,
	`endpoint_ids` text NOT NULL,
	`endpoint_group_ids` text NOT NULL,
	`payload` text,
	`payload_size` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`queued_at` integer,
	`processing_started_at` integer,
	`delivered_at` integer,
	`failed_at` integer,
	`last_error` text,
	`last_error_at` integer,
	`response_status` integer,
	`response_time_ms` integer,
	`response_body` text,
	`idempotency_key` text,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `webhook_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`endpoint_id` text,
	`date` text NOT NULL,
	`total_messages` integer DEFAULT 0 NOT NULL,
	`delivered_messages` integer DEFAULT 0 NOT NULL,
	`failed_messages` integer DEFAULT 0 NOT NULL,
	`retry_messages` integer DEFAULT 0 NOT NULL,
	`avg_response_time` real,
	`min_response_time` integer,
	`max_response_time` integer,
	`error_4xx` integer DEFAULT 0 NOT NULL,
	`error_5xx` integer DEFAULT 0 NOT NULL,
	`timeout_errors` integer DEFAULT 0 NOT NULL,
	`network_errors` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
