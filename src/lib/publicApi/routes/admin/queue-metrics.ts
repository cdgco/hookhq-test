import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { getCloudflareConfig, validateAdminAccess } from "@/lib/cloudflareConfig";
import type {
  CloudflareGraphQLResponse,
  QueueBacklogMetrics,
  QueueConsumerMetrics,
  QueueMessageOperationsMetrics,
  TimeRange,
} from "@/lib/queueMetricsTypes";
import { errorResponseSchema, queueMetricsQuerySchema, queueMetricsSchema } from "@/lib/publicApi/schemas";
import { jsonError } from "@/lib/publicApi/utils";

const CLOUDFLARE_GRAPHQL_API = "https://api.cloudflare.com/client/v4/graphql";
type QueueMetricsField =
  | "queueBacklogAdaptiveGroups"
  | "queueConsumerMetricsAdaptiveGroups"
  | "queueMessageOperationsAdaptiveGroups";

const queueMetricsRoute = createRoute({
  method: "get",
  path: "/admin/queue-metrics",
  tags: ["Admin"],
  summary: "Get Cloudflare Queue Metrics",
  request: { query: queueMetricsQuerySchema },
  responses: {
    200: { description: "Success", content: { "application/json": { schema: queueMetricsSchema } } },
    400: { description: "Bad Request", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponseSchema } } },
    500: { description: "Internal Server Error", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

export function registerAdminRoutes(app: OpenAPIHono<{ Bindings: CloudflareEnv }>) {
  app.openapi(queueMetricsRoute, (async (c: any) => {
    const hasAccess = await validateAdminAccess(c.req.raw, c.env);
    if (!hasAccess) return jsonError("Unauthorized", 401);
    const query = c.req.valid("query");
    const timeRange = (query.timeRange ?? "24h") as TimeRange;
    const includeRaw = query.includeRaw === "true";
    const config = await getCloudflareConfig(c.env);
    if (!config) {
      return jsonError(
        "Cloudflare credentials not configured. Please configure Cloudflare API token, Account ID, and Queue ID in the admin settings.",
        400
      );
    }
    const now = new Date();
    const start = new Date(now.getTime() - getTimeRangeMs(timeRange));
    const [backlogMetrics, consumerMetrics, messageOpsMetrics] = await Promise.all([
      fetchQueueBacklogMetrics(
        config.cloudflareApiKey,
        config.cloudflareAccountId,
        config.cloudflareQueueId,
        start,
        now
      ),
      fetchQueueConsumerMetrics(
        config.cloudflareApiKey,
        config.cloudflareAccountId,
        config.cloudflareQueueId,
        start,
        now
      ),
      fetchQueueMessageOperationsMetrics(
        config.cloudflareApiKey,
        config.cloudflareAccountId,
        config.cloudflareQueueId,
        start,
        now
      ),
    ]);
    const response: Record<string, unknown> = {
      backlog: {
        messages:
          backlogMetrics.length > 0
            ? backlogMetrics.reduce((sum, m) => sum + m.avg.messages, 0) / backlogMetrics.length
            : 0,
        bytes:
          backlogMetrics.length > 0
            ? backlogMetrics.reduce((sum, m) => sum + m.avg.bytes, 0) / backlogMetrics.length
            : 0,
      },
      consumerConcurrency:
        consumerMetrics.length > 0
          ? consumerMetrics.reduce((sum, m) => sum + m.avg.concurrency, 0) / consumerMetrics.length
          : 0,
      messageOperations: {
        totalOperations: messageOpsMetrics.reduce((sum, m) => sum + m.count, 0),
        totalBytes: messageOpsMetrics.reduce((sum, m) => sum + m.sum.bytes, 0),
        avgLagTime:
          messageOpsMetrics.length > 0
            ? messageOpsMetrics.reduce((sum, m) => sum + m.avg.lagTime, 0) / messageOpsMetrics.length
            : 0,
        avgRetries:
          messageOpsMetrics.length > 0
            ? messageOpsMetrics.reduce((sum, m) => sum + m.avg.retryCount, 0) / messageOpsMetrics.length
            : 0,
        maxMessageSize: messageOpsMetrics.length > 0 ? Math.max(...messageOpsMetrics.map(m => m.max.messageSize)) : 0,
      },
      timeRange,
      lastUpdated: new Date().toISOString(),
    };
    if (includeRaw) {
      response.rawData = { backlog: backlogMetrics, consumer: consumerMetrics, operations: messageOpsMetrics };
    }
    return c.json(response as never, 200);
  }) as never);
}

async function fetchQueueBacklogMetrics(
  apiKey: string,
  accountId: string,
  queueId: string,
  startTime: Date,
  endTime: Date
): Promise<QueueBacklogMetrics[]> {
  const query = `
    query QueueBacklog($accountTag: string!, $queueId: string!, $datetimeStart: Time!, $datetimeEnd: Time!) {
      viewer { accounts(filter: { accountTag: $accountTag }) { queueBacklogAdaptiveGroups(limit: 10000 filter: { queueId: $queueId datetime_geq: $datetimeStart datetime_leq: $datetimeEnd }) { avg { messages bytes } dimensions { datetime } } } }
    }
  `;
  return fetchGraphQl<QueueBacklogMetrics>(
    apiKey,
    { accountTag: accountId, queueId, datetimeStart: startTime.toISOString(), datetimeEnd: endTime.toISOString() },
    query,
    "queueBacklogAdaptiveGroups"
  );
}

async function fetchQueueConsumerMetrics(
  apiKey: string,
  accountId: string,
  queueId: string,
  startTime: Date,
  endTime: Date
): Promise<QueueConsumerMetrics[]> {
  const query = `
    query QueueConcurrency($accountTag: string!, $queueId: string!, $datetimeStart: Time!, $datetimeEnd: Time!) {
      viewer { accounts(filter: { accountTag: $accountTag }) { queueConsumerMetricsAdaptiveGroups(limit: 10000 filter: { queueId: $queueId datetime_geq: $datetimeStart datetime_leq: $datetimeEnd } orderBy: [datetimeHour_DESC]) { avg { concurrency } dimensions { datetimeHour } } } }
    }
  `;
  return fetchGraphQl<QueueConsumerMetrics>(
    apiKey,
    { accountTag: accountId, queueId, datetimeStart: startTime.toISOString(), datetimeEnd: endTime.toISOString() },
    query,
    "queueConsumerMetricsAdaptiveGroups"
  );
}

async function fetchQueueMessageOperationsMetrics(
  apiKey: string,
  accountId: string,
  queueId: string,
  startTime: Date,
  endTime: Date
): Promise<QueueMessageOperationsMetrics[]> {
  const query = `
    query QueueOps($accountTag: string!, $queueId: string!, $datetimeStart: Time!, $datetimeEnd: Time!) {
      viewer { accounts(filter: { accountTag: $accountTag }) { queueMessageOperationsAdaptiveGroups(limit: 10000 filter: { queueId: $queueId datetime_geq: $datetimeStart datetime_leq: $datetimeEnd } orderBy: [datetimeHour_DESC]) { count sum { bytes } avg { lagTime retryCount } max { messageSize } dimensions { datetimeHour } } } }
    }
  `;
  return fetchGraphQl<QueueMessageOperationsMetrics>(
    apiKey,
    { accountTag: accountId, queueId, datetimeStart: startTime.toISOString(), datetimeEnd: endTime.toISOString() },
    query,
    "queueMessageOperationsAdaptiveGroups"
  );
}

async function fetchGraphQl<T>(
  apiKey: string,
  variables: Record<string, string>,
  query: string,
  field: QueueMetricsField
): Promise<T[]> {
  const response = await fetch(CLOUDFLARE_GRAPHQL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Cloudflare API error: ${response.status} ${response.statusText}`);
  const result: CloudflareGraphQLResponse<T> = await response.json();
  if (result.errors) throw new Error(`GraphQL errors: ${result.errors.map(error => error.message).join(", ")}`);
  return result.data.viewer.accounts[0]?.[field] || [];
}

function getTimeRangeMs(timeRange: TimeRange): number {
  switch (timeRange) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}
