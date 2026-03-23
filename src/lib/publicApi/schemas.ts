import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string().optional(),
    details: z.array(z.string()).optional(),
  })
  .openapi("PublicApiError");

export const genericObjectSchema = z.record(z.string(), z.any()).openapi("GenericObject");

export const endpointIdParamSchema = z.object({
  id: z.string().describe("ID of the endpoint."),
});

export const endpointGroupIdParamSchema = z.object({
  id: z.string().describe("ID of the endpoint group."),
});

export const eventTypeIdParamSchema = z.object({
  id: z.string().describe("ID of the event type."),
});

export const environmentIdParamSchema = z.object({
  id: z.string().describe("ID of the environment."),
});

export const environmentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    isDefault: z.boolean(),
    createdAt: z.string(),
  })
  .openapi("Environment");

export const createEnvironmentSchema = z
  .object({
    name: z.string().min(1).describe("Name of the environment."),
    description: z.string().optional().describe("Optional description for the environment."),
  })
  .openapi("CreateEnvironmentRequest");

export const messageRetryParamSchema = z.object({
  messageId: z.string().describe("ID of the message to retry."),
  endpointId: z.string().describe("ID of the endpoint to retry the message on."),
});

export const enabledQuerySchema = z.object({
  enabled: z.enum(["true", "false"]).optional().describe("Whether to filter endpoints by enabled status."),
});

export const eventSubscriptionSchema = z
  .array(z.string().min(1))
  .min(1)
  .openapi({
    description:
      'Event type subscriptions. Use ["*"] to subscribe to all events, including events sent without a type.',
    example: ["*"],
  });

export const destinationTypeSchema = z
  .enum(["webhook", "sqs", "pubsub"])
  .describe(
    "Destination type for the endpoint. See destination configuration schemas for corresponding configuration fields."
  );
export const retryStrategySchema = z.enum(["none", "fixed", "linear", "exponential"]);
export const alertChannelTypeSchema = z.enum(["webhook", "slack"]);

export const retryConfigSchema = z
  .object({
    strategy: retryStrategySchema.describe("Retry strategy for the endpoint."),
    maxAttempts: z.number().int().min(1).describe("Maximum number of attempts for the retry strategy."),
    baseDelaySeconds: z.number().int().min(1).describe("Base delay in seconds for the retry strategy."),
    maxDelaySeconds: z.number().int().min(1).describe("Maximum delay in seconds for the retry strategy."),
    jitterFactor: z.number().min(0).max(1).describe("Jitter factor for the retry strategy."),
  })
  .openapi("RetryConfig");

const webhookDestinationConfigSchema = z
  .object({
    url: z.string().url(),
    timeoutMs: z.number().int().min(1000).optional(),
    customHeaders: z.record(z.string(), z.string()).optional(),
    proxyGroupId: z.string().nullable().optional(),
  })
  .describe("Webhook destination configuration")
  .openapi("Webhook");

const webhookDestinationResponseSchema = z
  .object({
    url: z.string().url(),
    timeoutMs: z.number().int().min(1000).optional(),
    hasCustomHeaders: z.boolean(),
    proxyGroupId: z.string().nullable().optional(),
  })
  .describe("Webhook destination configuration");

const sqsDestinationConfigSchema = z
  .object({
    queueUrl: z.string().url(),
    region: z.string().min(1),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
    delaySeconds: z.number().int().min(0).max(900).optional(),
    messageGroupId: z.string().optional(),
    messageDeduplicationId: z.string().optional(),
  })
  .describe("Amazon SQS destination configuration")
  .openapi("Amazon-SQS");

const sqsDestinationUpdateConfigSchema = z
  .object({
    queueUrl: z.string().url().optional(),
    region: z.string().min(1).optional(),
    accessKeyId: z.string().min(1).optional(),
    secretAccessKey: z.string().min(1).optional(),
    delaySeconds: z.number().int().min(0).max(900).optional(),
    messageGroupId: z.string().optional(),
    messageDeduplicationId: z.string().optional(),
  })
  .describe("Amazon SQS destination configuration");

const sqsDestinationResponseSchema = z
  .object({
    queueUrl: z.string().url(),
    region: z.string().min(1),
    accessKeyId: z.string().min(1),
    hasSecretAccessKey: z.boolean(),
    delaySeconds: z.number().int().min(0).max(900).optional(),
    messageGroupId: z.string().optional(),
    messageDeduplicationId: z.string().optional(),
  })
  .describe("Amazon SQS destination configuration");

const pubsubDestinationConfigSchema = z
  .object({
    topicName: z.string().min(1).openapi({
      description: "Google Pub/Sub topic name only, without the projects/{project}/topics/ prefix.",
      example: "orders-created",
    }),
    serviceAccountJson: z.string().min(1).openapi({
      description: "Raw Google service account JSON document used to derive project ID, client email, and private key.",
    }),
    attributes: z.record(z.string(), z.string()).optional(),
    orderingKey: z.string().optional(),
  })
  .describe("Google Pub/Sub destination configuration")
  .openapi("Google-PubSub");

const pubsubDestinationUpdateConfigSchema = z
  .object({
    topicName: z.string().min(1).optional(),
    serviceAccountJson: z.string().min(1).optional().openapi({
      description: "Raw Google service account JSON document used to derive project ID, client email, and private key.",
    }),
    attributes: z.record(z.string(), z.string()).optional(),
    orderingKey: z.string().optional(),
  })
  .describe("Google Pub/Sub destination configuration");

const pubsubDestinationResponseSchema = z
  .object({
    topicName: z.string().min(1),
    hasServiceAccountJson: z.boolean(),
    attributes: z.record(z.string(), z.string()).optional(),
    orderingKey: z.string().optional(),
  })
  .describe("Google Pub/Sub destination configuration");

export const failureAlertConfigSchema = z
  .object({
    enabled: z.boolean().describe("Whether failure alerts are enabled."),
    threshold: z.number().int().min(1).describe("Threshold for the failure alert."),
    windowMinutes: z.number().int().min(1).describe("Window minutes for the failure alert."),
    endpointIds: z.array(z.string()).describe("IDs of the endpoints to send failure alerts to."),
    channelType: alertChannelTypeSchema.describe("Channel type for the failure alert."),
    destinationUrl: z.string().optional().describe("Destination URL for the failure alert."),
  })
  .openapi("FailureAlertConfig");

export const autoDisableConfigSchema = z
  .object({
    enabled: z.boolean().describe("Whether auto-disable is enabled."),
    threshold: z.number().int().min(1).openapi({
      description: "Disable the destination after this many consecutive permanent delivery failures.",
    }),
  })
  .openapi("AutoDisableConfig");

export const endpointSchema = z
  .object({
    id: z.string().describe("ID of the endpoint."),
    environmentId: z.string().describe("ID of the environment the endpoint belongs to."),
    name: z.string().describe("Name of the endpoint."),
    description: z.string().nullable().optional().describe("Optional description for the endpoint."),
    eventTypes: eventSubscriptionSchema,
    destinationType: destinationTypeSchema,
    destination: z.union([
      webhookDestinationResponseSchema,
      sqsDestinationResponseSchema,
      pubsubDestinationResponseSchema,
    ]),
    enabled: z.boolean().describe("Whether the endpoint is enabled."),
    retry: retryConfigSchema,
    autoDisable: autoDisableConfigSchema.describe("Auto-disable configuration for the endpoint."),
    createdAt: z.string().describe("Timestamp when the endpoint was created."),
    updatedAt: z.string().describe("Timestamp when the endpoint was last updated."),
  })
  .openapi("Endpoint");

export const endpointCreateSchema = z
  .object({
    name: z.string().describe("Name of the endpoint."),
    description: z.string().optional().describe("Optional description for the endpoint."),
    eventTypes: eventSubscriptionSchema.optional(),
    destinationType: destinationTypeSchema.default("webhook"),
    destination: z.union([webhookDestinationConfigSchema, sqsDestinationConfigSchema, pubsubDestinationConfigSchema]),
    enabled: z.boolean().optional().describe("Whether the endpoint is enabled."),
    retry: retryConfigSchema.partial().optional().describe("Retry configuration for the endpoint."),
    autoDisable: autoDisableConfigSchema.partial().optional().describe("Auto-disable configuration for the endpoint."),
  })
  .describe("Create a new endpoint for either a webhook, Amazon SQS, or Google Pub/Sub destination")
  .openapi("CreateEndpointRequest");

export const endpointUpdateSchema = z
  .object({
    name: z.string().optional().describe("Name of the endpoint."),
    description: z.string().optional().describe("Optional description for the endpoint."),
    eventTypes: eventSubscriptionSchema.optional().describe("Event type subscriptions for the endpoint."),
    destinationType: destinationTypeSchema.optional().describe("Destination type for the endpoint."),
    destination: z
      .union([
        webhookDestinationConfigSchema.partial(),
        sqsDestinationUpdateConfigSchema,
        pubsubDestinationUpdateConfigSchema,
      ])
      .optional(),
    enabled: z.boolean().optional().describe("Whether the endpoint is enabled."),
    retry: retryConfigSchema.partial().optional().describe("Retry configuration for the endpoint."),
    autoDisable: autoDisableConfigSchema.partial().optional().describe("Auto-disable configuration for the endpoint."),
  })
  .describe("Update an existing endpoint for either a webhook, Amazon SQS, or Google Pub/Sub destination")
  .openapi("UpdateEndpointRequest");

export const endpointGroupSchema = z
  .object({
    id: z.string(),
    environmentId: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    endpointIds: z.array(z.string()),
    eventTypes: eventSubscriptionSchema,
    proxyGroupId: z.string().nullable().optional(),
    enabled: z.boolean(),
    failureAlerts: failureAlertConfigSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("EndpointGroup");

export const endpointGroupCreateSchema = z
  .object({
    name: z.string().describe("Name of the endpoint group."),
    description: z.string().optional().describe("Optional description for the endpoint group."),
    endpointIds: z.array(z.string()).optional().describe("IDs of the endpoints to add to the group."),
    eventTypes: eventSubscriptionSchema.optional().describe("Event type subscriptions for the endpoint group."),
    proxyGroupId: z
      .string()
      .nullable()
      .optional()
      .describe("Optional proxy group applied to webhook deliveries in this group."),
    enabled: z.boolean().optional().describe("Whether the endpoint group is enabled."),
    failureAlerts: failureAlertConfigSchema
      .partial()
      .optional()
      .describe("Failure alert configuration for the endpoint group."),
  })
  .openapi("CreateEndpointGroupRequest");

export const endpointGroupUpdateSchema = z
  .object({
    name: z.string().optional().describe("Name of the endpoint group."),
    description: z.string().optional().describe("Optional description for the endpoint group."),
    endpointIds: z.array(z.string()).optional().describe("IDs of the endpoints to add to the group."),
    eventTypes: eventSubscriptionSchema.optional().describe("Event type subscriptions for the endpoint group."),
    proxyGroupId: z
      .string()
      .nullable()
      .optional()
      .describe("Optional proxy group applied to webhook deliveries in this group."),
    enabled: z.boolean().optional().describe("Whether the endpoint group is enabled."),
    failureAlerts: failureAlertConfigSchema
      .partial()
      .optional()
      .describe("Failure alert configuration for the endpoint group."),
  })
  .openapi("UpdateEndpointGroupRequest");

export const eventTypeSchema = z
  .object({
    id: z.string(),
    environmentId: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    schema: genericObjectSchema.nullable().optional(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("EventType");

export const eventTypeCreateSchema = z
  .object({
    name: z.string().describe("Name of the event type."),
    description: z.string().optional().describe("Optional description for the event type."),
    schema: genericObjectSchema.optional().describe("Schema to validate the event payload against."),
    enabled: z.boolean().optional().describe("Whether the event type is enabled."),
  })
  .openapi("CreateEventTypeRequest");

export const eventTypeUpdateSchema = z
  .object({
    name: z.string().optional().describe("Name of the event type."),
    description: z.string().optional().describe("Optional description for the event type."),
    schema: genericObjectSchema.optional().describe("Schema to validate the event payload against."),
    enabled: z.boolean().optional().describe("Whether the event type is enabled."),
  })
  .openapi("UpdateEventTypeRequest");

export const portalTokenRequestSchema = z
  .object({
    allowedEventTypes: z.array(z.string()).optional().describe("Event types allowed for the portal token."),
    applicationName: z.string().optional().describe("Name of the application to return to after the portal is used."),
    returnUrl: z.string().url().optional().describe("URL to return to after the portal is used."),
  })
  .openapi("CreatePortalTokenRequest");

export const portalTokenResponseSchema = z
  .object({
    token: z.string(),
    portalUrl: z.string(),
    expiresIn: z.union([z.string(), z.number()]).optional(),
    endpointGroup: z.object({
      id: z.string(),
      name: z.string(),
      environmentId: z.string(),
    }),
  })
  .openapi("PortalTokenResponse");

export const deleteResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi("DeleteResponse");

export const retryResponseSchema = z
  .object({
    message: z.string(),
    retryId: z.string(),
    originalMessageId: z.string(),
    endpointId: z.string(),
  })
  .openapi("RetryMessageResponse");

export const queueMetricsQuerySchema = z.object({
  timeRange: z.enum(["1h", "24h", "7d", "30d"]).optional().describe("Time range for the metrics."),
  includeRaw: z.enum(["true", "false"]).optional().describe("Whether to include raw data in the response."),
});

export const queueMetricsSchema = z
  .object({
    backlog: z.object({
      messages: z.number(),
      bytes: z.number(),
    }),
    consumerConcurrency: z.number(),
    messageOperations: z.object({
      totalOperations: z.number(),
      totalBytes: z.number(),
      avgLagTime: z.number(),
      avgRetries: z.number(),
      maxMessageSize: z.number(),
    }),
    timeRange: z.string(),
    lastUpdated: z.string(),
    rawData: genericObjectSchema.optional(),
  })
  .openapi("QueueMetrics");
