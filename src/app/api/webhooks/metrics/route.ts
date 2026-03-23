import { initAuth } from "@/auth";
import { getDb } from "@/db";
import { webhookMessages, webhookAttempts, endpoints, endpointGroups } from "@/db/webhooks.schema";
import { users } from "@/db/auth.schema";
import { eq, desc, and, sql, gte, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// GET /api/webhooks/metrics - Get webhook metrics for the current environment
export async function GET(request: NextRequest) {
  try {
    const authInstance = await initAuth();
    const session = await authInstance.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current environment from user's last environment
    const db = await getDb();
    const user = await db
      .select({ lastEnvironment: users.lastEnvironment })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.lastEnvironment) {
      return NextResponse.json({ error: "No environment selected" }, { status: 400 });
    }

    const environmentId = user[0].lastEnvironment;

    // Parse query parameters for time range
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "7d"; // 1h, 24h, 7d, 30d

    // Calculate time threshold based on range
    const now = new Date();
    let timeThreshold: Date;
    switch (timeRange) {
      case "1h":
        timeThreshold = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "24h":
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }


    // Get all messages in time range
    const allMessages = await db
      .select()
      .from(webhookMessages)
      .where(
        and(
          eq(webhookMessages.environmentId, environmentId),
          gte(webhookMessages.createdAt, timeThreshold)
        )
      );

    // Calculate message statistics
    const totalMessages = allMessages.length;
    const pendingMessages = allMessages.filter(m => m.status === 'pending').length;
    const processingMessages = allMessages.filter(m => m.status === 'processing').length;
    const deliveredMessages = allMessages.filter(m => m.status === 'delivered').length;
    const failedMessages = allMessages.filter(m => m.status === 'failed').length;
    const retryingMessages = allMessages.filter(m => m.status === 'retrying').length;

    // Calculate average queue time (time from queued to processing started)
    const avgQueueTime = allMessages.length > 0
      ? allMessages.reduce((sum, m) => {
        if (m.queuedAt && m.processingStartedAt) {
          const queueTime = m.processingStartedAt.getTime() - m.queuedAt.getTime();
          return sum + queueTime;
        }
        return sum;
      }, 0) / allMessages.filter(m => m.queuedAt && m.processingStartedAt).length || 0
      : 0;

    const totalPayloadSize = allMessages.reduce((sum, m) => sum + (m.payloadSize || 0), 0);

    // Get attempts for messages in this environment
    const messageIds = allMessages.map(m => m.id);
    let allAttempts: any[] = [];
    if (messageIds.length > 0) {
      // Get all attempts for these messages
      const attempts = await db
        .select()
        .from(webhookAttempts)
        .where(sql`${webhookAttempts.attemptedAt} >= ${timeThreshold.getTime()}`);

      // Filter attempts that belong to messages in our environment
      allAttempts = attempts.filter(attempt => messageIds.includes(attempt.messageId));
    }

    // Calculate attempt statistics
    const totalAttempts = allAttempts.length;
    const successfulAttempts = allAttempts.filter(a => a.responseStatus && a.responseStatus >= 200 && a.responseStatus < 300).length;
    const failedAttempts = allAttempts.filter(a => !a.responseStatus || a.responseStatus < 200 || a.responseStatus >= 300).length;

    const avgAttemptResponseTime = allAttempts.length > 0
      ? allAttempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0) / allAttempts.length
      : 0;

    // Calculate success rates
    const successRate = totalMessages > 0 ? (deliveredMessages / totalMessages) * 100 : 0;
    const attemptSuccessRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

    // Group messages by hour for hourly data
    const hourlyDataMap = new Map<number, { count: number; delivered: number; failed: number }>();
    allMessages.forEach(msg => {
      const hour = new Date(msg.createdAt).getHours();
      const current = hourlyDataMap.get(hour) || { count: 0, delivered: 0, failed: 0 };
      current.count++;
      if (msg.status === 'delivered') current.delivered++;
      if (msg.status === 'failed') current.failed++;
      hourlyDataMap.set(hour, current);
    });

    const hourlyData = Array.from(hourlyDataMap.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour - b.hour);

    // Group messages by event type (only include non-empty event types)
    const eventTypeMap = new Map<string, number>();
    allMessages.forEach(msg => {
      // Skip messages with empty, null, or undefined event types
      if (msg.eventType && msg.eventType.trim() !== '') {
        const current = eventTypeMap.get(msg.eventType) || 0;
        eventTypeMap.set(msg.eventType, current + 1);
      }
    });

    const topEventTypes = Array.from(eventTypeMap.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get recent messages for activity feed
    const recentMessagesData = await db
      .select({
        id: webhookMessages.id,
        eventId: webhookMessages.eventId,
        eventType: webhookMessages.eventType,
        status: webhookMessages.status,
        createdAt: webhookMessages.createdAt,
        responseTimeMs: webhookMessages.responseTimeMs,
        attempts: webhookMessages.attempts,
        endpointIds: webhookMessages.endpointIds,
        endpointGroupIds: webhookMessages.endpointGroupIds
      })
      .from(webhookMessages)
      .where(eq(webhookMessages.environmentId, environmentId))
      .orderBy(desc(webhookMessages.createdAt))
      .limit(10);

    // Get all unique endpoint and endpoint group IDs from recent messages
    const allEndpointIds = new Set<string>();
    const allEndpointGroupIds = new Set<string>();

    recentMessagesData.forEach(msg => {
      try {
        const endpointIds = JSON.parse(msg.endpointIds || '[]');
        const endpointGroupIds = JSON.parse(msg.endpointGroupIds || '[]');
        endpointIds.forEach((id: string) => allEndpointIds.add(id));
        endpointGroupIds.forEach((id: string) => allEndpointGroupIds.add(id));
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Fetch endpoint and endpoint group names
    const endpointNames = new Map<string, string>();
    const endpointGroupNames = new Map<string, string>();

    if (allEndpointIds.size > 0) {
      const endpointsData = await db
        .select({ id: endpoints.id, name: endpoints.name })
        .from(endpoints)
        .where(inArray(endpoints.id, Array.from(allEndpointIds)));

      endpointsData.forEach(ep => endpointNames.set(ep.id, ep.name));
    }

    if (allEndpointGroupIds.size > 0) {
      const endpointGroupsData = await db
        .select({ id: endpointGroups.id, name: endpointGroups.name })
        .from(endpointGroups)
        .where(inArray(endpointGroups.id, Array.from(allEndpointGroupIds)));

      endpointGroupsData.forEach(eg => endpointGroupNames.set(eg.id, eg.name));
    }

    // Process recent messages with destination names
    const recentMessages = recentMessagesData.map(msg => {
      const destinations: string[] = [];

      try {
        const endpointIds = JSON.parse(msg.endpointIds || '[]');
        const endpointGroupIds = JSON.parse(msg.endpointGroupIds || '[]');

        endpointIds.forEach((id: string) => {
          const name = endpointNames.get(id);
          if (name) destinations.push(name);
        });

        endpointGroupIds.forEach((id: string) => {
          const name = endpointGroupNames.get(id);
          if (name) destinations.push(name);
        });
      } catch (e) {
        // Skip invalid JSON
      }

      return {
        id: msg.id,
        eventId: msg.eventId,
        eventType: msg.eventType,
        status: msg.status,
        createdAt: msg.createdAt.toISOString(),
        responseTimeMs: msg.responseTimeMs,
        attempts: msg.attempts,
        destinations
      };
    });

    return NextResponse.json({
      timeRange,
      summary: {
        totalMessages,
        deliveredMessages,
        failedMessages,
        pendingMessages,
        processingMessages,
        retryingMessages,
        successRate: Math.round(successRate * 100) / 100,
        avgQueueTime: Math.round(avgQueueTime * 100) / 100,
        totalPayloadSize
      },
      attempts: {
        totalAttempts,
        successfulAttempts,
        failedAttempts,
        successRate: Math.round(attemptSuccessRate * 100) / 100,
        avgResponseTime: Math.round(avgAttemptResponseTime * 100) / 100
      },
      hourlyData: hourlyData.map(h => ({
        hour: h.hour,
        count: h.count,
        delivered: h.delivered,
        failed: h.failed
      })),
      topEventTypes: topEventTypes.map(e => ({
        eventType: e.eventType,
        count: e.count
      })),
      recentMessages: recentMessages.map(m => ({
        id: m.id,
        eventId: m.eventId,
        eventType: m.eventType,
        status: m.status,
        createdAt: m.createdAt,
        responseTimeMs: m.responseTimeMs,
        attempts: m.attempts,
        destinations: m.destinations
      }))
    });
  } catch (error) {
    console.error("Error fetching webhook metrics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
