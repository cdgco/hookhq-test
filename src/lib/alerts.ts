import { endpointGroups } from "@/db/webhooks.schema";
import { getDb } from "@/db";
import { serverConfig } from "@/db/environments.schema";
import { and, eq } from "drizzle-orm";
import { parseFailureAlertConfig } from "@/lib/destinations/config";
import type { FailureAlertConfig } from "@/lib/destinations/types";
import type { DeliveryMessage } from "@/lib/queue/types";

type AlertContext = {
  env: CloudflareEnv;
  environmentId: string;
  endpointId: string;
  endpointName: string;
  destinationLabel: string;
  message: DeliveryMessage;
  error: string;
};

function mergeAlertConfig(defaults: FailureAlertConfig, overrides: FailureAlertConfig): FailureAlertConfig {
  return {
    enabled: overrides.enabled || defaults.enabled,
    threshold: overrides.threshold || defaults.threshold,
    windowMinutes: overrides.windowMinutes || defaults.windowMinutes,
    endpointIds: overrides.endpointIds.length > 0 ? overrides.endpointIds : defaults.endpointIds,
    channelType: overrides.destinationUrl ? overrides.channelType : defaults.channelType,
    destinationUrl: overrides.destinationUrl || defaults.destinationUrl,
  };
}

function buildAlertBody({
  channelType,
  groupName,
  count,
  threshold,
  context,
}: {
  channelType: FailureAlertConfig["channelType"];
  groupName: string;
  count: number;
  threshold: number;
  context: AlertContext;
}) {
  const details = {
    group: groupName,
    endpointId: context.endpointId,
    endpointName: context.endpointName,
    destination: context.destinationLabel,
    eventId: context.message.eventId,
    eventType: context.message.eventType,
    messageId: context.message.id,
    threshold,
    failuresInWindow: count,
    error: context.error,
    occurredAt: new Date().toISOString(),
  };

  if (channelType === "slack") {
    return {
      text: `Destination failures detected for ${groupName}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Destination failures detected*\nGroup: *${groupName}*\nEndpoint: *${context.endpointName}*\nFailures in window: *${count}* (threshold ${threshold})`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Destination*\n${context.destinationLabel}` },
            { type: "mrkdwn", text: `*Event Type*\n${context.message.eventType ?? "unknown"}` },
            { type: "mrkdwn", text: `*Message ID*\n${context.message.id}` },
            { type: "mrkdwn", text: `*Error*\n${context.error}` },
          ],
        },
      ],
      metadata: details,
    };
  }

  return {
    type: "destination.failure",
    summary: `Destination failures detected for ${groupName}`,
    details,
  };
}

async function postAlert(config: FailureAlertConfig, groupName: string, count: number, context: AlertContext) {
  const body = buildAlertBody({
    channelType: config.channelType,
    groupName,
    count,
    threshold: config.threshold,
    context,
  });

  const response = await fetch(config.destinationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    console.error("Failed to send failure alert", {
      groupName,
      status: response.status,
      responseBody,
    });
  }
}

export async function triggerFailureAlerts(context: AlertContext): Promise<void> {
  const db = await getDb(context.env);
  const [globalDefaults] = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);
  const defaultAlertConfig = parseFailureAlertConfig(globalDefaults?.defaultFailureAlertConfig);
  const groups = await db
    .select()
    .from(endpointGroups)
    .where(and(eq(endpointGroups.environmentId, context.environmentId), eq(endpointGroups.isActive, true)));

  const now = Date.now();

  for (const group of groups) {
    const groupEndpointIds = JSON.parse(group.endpointIds || "[]") as string[];
    if (!groupEndpointIds.includes(context.endpointId)) {
      continue;
    }

    const resolvedConfig = mergeAlertConfig(defaultAlertConfig, parseFailureAlertConfig(group.failureAlertConfig));
    if (!resolvedConfig.enabled || !resolvedConfig.destinationUrl) {
      continue;
    }

    const monitoredEndpointIds = resolvedConfig.endpointIds.length > 0 ? resolvedConfig.endpointIds : groupEndpointIds;
    if (!monitoredEndpointIds.includes(context.endpointId)) {
      continue;
    }

    const historyKey = `alerts:failures:${group.id}`;
    const sentKey = `alerts:sent:${group.id}:${Math.floor(now / (resolvedConfig.windowMinutes * 60 * 1000))}`;
    const historyValue = await context.env.KV.get(historyKey);
    const history = historyValue ? (JSON.parse(historyValue) as Array<{ endpointId: string; timestamp: number }>) : [];
    const windowStart = now - resolvedConfig.windowMinutes * 60 * 1000;
    const nextHistory = history
      .filter(entry => entry.timestamp >= windowStart && monitoredEndpointIds.includes(entry.endpointId))
      .concat({ endpointId: context.endpointId, timestamp: now });

    await context.env.KV.put(historyKey, JSON.stringify(nextHistory), {
      expirationTtl: resolvedConfig.windowMinutes * 60 * 2,
    });

    if (nextHistory.length < resolvedConfig.threshold) {
      continue;
    }

    const alreadySent = await context.env.KV.get(sentKey);
    if (alreadySent) {
      continue;
    }

    await postAlert(resolvedConfig, group.name, nextHistory.length, context);
    await context.env.KV.put(sentKey, String(now), {
      expirationTtl: resolvedConfig.windowMinutes * 60,
    });
  }
}
