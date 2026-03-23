import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { endpoints, endpointGroups, webhookAttempts, webhookMessages, eventTypes } from "@/db/webhooks.schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { authenticatePortalRequest } from "@/lib/portalAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = authenticatePortalRequest(request);

  if (!authResult.success) {
    return NextResponse.json({
      error: authResult.error
    }, { status: 401 });
  }

  const { payload } = authResult;
  const { id: endpointId } = await params;

  if (!endpointId) {
    return NextResponse.json({
      error: "Endpoint ID is required"
    }, { status: 400 });
  }

  const db = await getDb();

  try {
    // Get endpoint details
    const endpoint = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.id, endpointId))
      .limit(1);

    if (endpoint.length === 0) {
      return NextResponse.json({
        error: "Endpoint not found"
      }, { status: 404 });
    }

    if (endpoint[0].environmentId !== payload.environmentId) {
      return NextResponse.json({
        error: "Endpoint not found"
      }, { status: 404 });
    }

    // Verify endpoint belongs to the group
    const endpointGroup = await db
      .select()
      .from(endpointGroups)
      .where(eq(endpointGroups.id, payload.endpointGroupId))
      .limit(1);

    if (endpointGroup.length === 0) {
      return NextResponse.json({
        error: "Endpoint group not found"
      }, { status: 404 });
    }

    const groupEndpointIds = JSON.parse(endpointGroup[0].endpointIds || "[]");
    if (!groupEndpointIds.includes(endpointId)) {
      return NextResponse.json({
        error: "Endpoint not found in group"
      }, { status: 404 });
    }

    // Get latest attempts for metrics (last 7 days)
    const rankedAttemptsSubquery = db
      .select({
        messageId: webhookAttempts.messageId,
        status: webhookAttempts.status,
        attemptNumber: webhookAttempts.attemptNumber,
        attemptedAt: webhookAttempts.attemptedAt,
        rowNumber: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${webhookAttempts.messageId} ORDER BY ${webhookAttempts.attemptNumber} DESC, ${webhookAttempts.attemptedAt} DESC)`.as('row_number'),
      })
      .from(webhookAttempts)
      .where(
        and(
          eq(webhookAttempts.endpointId, endpointId),
          gte(webhookAttempts.attemptedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        )
      )
      .as('ranked_attempts');

    const latestAttempts = await db
      .select({
        messageId: rankedAttemptsSubquery.messageId,
        status: rankedAttemptsSubquery.status,
        attemptNumber: rankedAttemptsSubquery.attemptNumber,
        attemptedAt: rankedAttemptsSubquery.attemptedAt,
      })
      .from(rankedAttemptsSubquery)
      .where(sql`${rankedAttemptsSubquery.rowNumber} = 1`) as Array<{
        messageId: string;
        status: string;
        attemptNumber: number;
        attemptedAt: Date;
      }>;

    // Get recent events with message details
    const recentEvents = await db
      .select({
        attemptId: webhookAttempts.id,
        messageId: webhookAttempts.messageId,
        eventId: webhookMessages.eventId,
        eventType: webhookMessages.eventType,
        createdAt: webhookMessages.createdAt,
        attemptedAt: webhookAttempts.attemptedAt,
        completedAt: webhookAttempts.completedAt,
        attemptNumber: webhookAttempts.attemptNumber,
        maxAttempts: webhookMessages.maxAttempts,
        requestBody: webhookAttempts.requestBody,
        responseStatus: webhookAttempts.responseStatus,
        responseHeaders: webhookAttempts.responseHeaders,
        responseBody: webhookAttempts.responseBody,
        responseTimeMs: webhookAttempts.responseTimeMs,
        status: webhookAttempts.status,
        errorMessage: webhookAttempts.errorMessage,
      })
      .from(webhookAttempts)
      .leftJoin(webhookMessages, eq(webhookAttempts.messageId, webhookMessages.id))
      .where(
        and(
          eq(webhookAttempts.endpointId, endpointId),
          gte(webhookAttempts.attemptedAt, new Date(Date.now() - 24 * 60 * 60 * 1000 * 7))
        )
      )
      .orderBy(desc(webhookAttempts.attemptedAt))
      .limit(50);

    // Get event types for this environment
    const availableEventTypes = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.environmentId, payload.environmentId))
      .orderBy(eventTypes.name);

    // Calculate metrics
    const metrics24h = latestAttempts.filter(metric =>
      metric.attemptedAt && metric.attemptedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const metrics7d = latestAttempts;

    const totalEvents24h = metrics24h.length;
    const successfulEvents24h = metrics24h.filter(m => m.status === 'delivered').length;
    const errorRate24h = totalEvents24h > 0 ? ((totalEvents24h - successfulEvents24h) / totalEvents24h * 100).toFixed(1) : "0.0";

    const totalEvents7d = metrics7d.length;
    const successfulEvents7d = metrics7d.filter(m => m.status === 'delivered').length;
    const errorRate7d = totalEvents7d > 0 ? ((totalEvents7d - successfulEvents7d) / totalEvents7d * 100).toFixed(1) : "0.0";

    // Generate chart data for 24h (hourly intervals)
    const generateHourlyChartData = () => {
      const chartData = [];
      const now = new Date();

      for (let i = 23; i >= 0; i--) {
        const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

        const hourMetrics = metrics24h.filter(m => {
          const attemptedAt = new Date(m.attemptedAt);
          return attemptedAt >= hourStart && attemptedAt < hourEnd;
        });

        const success = hourMetrics.filter(m => m.status === 'delivered').length;
        const failed = hourMetrics.filter(m => m.status !== 'delivered').length;

        chartData.push({
          time: hourStart.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }),
          count: success + failed,
          success,
          failed,
          errorRate: success + failed > 0 ? ((failed / (success + failed)) * 100).toFixed(1) : "0.0"
        });
      }

      return chartData;
    };

    // Generate chart data for 7d (daily intervals)
    const generateDailyChartData = () => {
      const chartData = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const dayMetrics = metrics7d.filter(m => {
          const attemptedAt = new Date(m.attemptedAt);
          return attemptedAt >= dayStart && attemptedAt < dayEnd;
        });

        const success = dayMetrics.filter(m => m.status === 'delivered').length;
        const failed = dayMetrics.filter(m => m.status !== 'delivered').length;

        chartData.push({
          time: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: success + failed,
          success,
          failed,
          errorRate: success + failed > 0 ? ((failed / (success + failed)) * 100).toFixed(1) : "0.0"
        });
      }

      return chartData;
    };

    return NextResponse.json({
      endpoint: {
        id: endpoint[0].id,
        name: endpoint[0].name,
        url: endpoint[0].url,
        description: endpoint[0].description,
        isActive: endpoint[0].isActive,
        createdAt: endpoint[0].createdAt.toISOString(),
        updatedAt: endpoint[0].updatedAt.toISOString(),
        topics: endpoint[0].topics ? JSON.parse(endpoint[0].topics) : [],
        retryPolicy: endpoint[0].retryPolicy,
        maxRetries: endpoint[0].maxRetries,
        timeoutMs: endpoint[0].timeoutMs,
        headers: endpoint[0].headers,
      },
      metrics: {
        totalEvents24h,
        totalEvents7d,
        successfulEvents24h,
        successfulEvents7d,
        errorRate24h,
        errorRate7d,
        chartData24h: generateHourlyChartData(),
        chartData7d: generateDailyChartData(),
      },
      recentEvents: recentEvents,
      availableEventTypes: availableEventTypes.map(et => ({
        id: et.id,
        name: et.name,
        description: et.description,
      }))
    });

  } catch (error) {
    console.error("Error fetching endpoint details:", error);
    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = authenticatePortalRequest(request);

  if (!authResult.success) {
    return NextResponse.json({
      error: authResult.error
    }, { status: 401 });
  }

  const { payload } = authResult;
  const { id: endpointId } = await params;

  if (!endpointId) {
    return NextResponse.json({
      error: "Endpoint ID is required"
    }, { status: 400 });
  }

  const db = await getDb();

  try {
    // Check if endpoint exists and belongs to the environment
    const endpoint = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.id, endpointId))
      .limit(1);

    if (endpoint.length === 0) {
      return NextResponse.json({
        error: "Endpoint not found"
      }, { status: 404 });
    }

    if (endpoint[0].environmentId !== payload.environmentId) {
      return NextResponse.json({
        error: "Endpoint not found"
      }, { status: 404 });
    }

    // Get the endpoint group to verify the endpoint belongs to it
    const endpointGroup = await db
      .select()
      .from(endpointGroups)
      .where(eq(endpointGroups.id, payload.endpointGroupId))
      .limit(1);

    if (endpointGroup.length === 0) {
      return NextResponse.json({
        error: "Endpoint group not found"
      }, { status: 404 });
    }

    const groupEndpointIds = JSON.parse(endpointGroup[0].endpointIds || "[]");
    if (!groupEndpointIds.includes(endpointId)) {
      return NextResponse.json({
        error: "Endpoint not found in group"
      }, { status: 404 });
    }

    // Remove endpoint from the group
    const updatedEndpointIds = groupEndpointIds.filter((id: string) => id !== endpointId);

    await db
      .update(endpointGroups)
      .set({
        endpointIds: JSON.stringify(updatedEndpointIds),
        updatedAt: new Date()
      })
      .where(eq(endpointGroups.id, payload.endpointGroupId));

    // Delete the endpoint
    await db
      .delete(endpoints)
      .where(eq(endpoints.id, endpointId));

    return NextResponse.json({
      message: "Endpoint deleted successfully",
      deletedEndpoint: {
        id: endpoint[0].id,
        name: endpoint[0].name
      }
    });

  } catch (error) {
    console.error("Error deleting portal endpoint:", error);
    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 });
  }
}
