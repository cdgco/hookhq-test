import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { endpoints, endpointGroups, webhookAttempts } from "@/db/webhooks.schema";
import { eq, and, inArray, gte, sql } from "drizzle-orm";
import { authenticatePortalRequest } from "@/lib/portalAuth";

export async function GET(request: NextRequest) {
  const authResult = authenticatePortalRequest(request);

  if (!authResult.success) {
    return NextResponse.json(
      {
        error: authResult.error,
      },
      { status: 401 }
    );
  }

  const { payload } = authResult;
  const db = await getDb();

  try {
    // Get endpoints for the endpoint group
    const endpointList = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.environmentId, payload.environmentId))
      .orderBy(endpoints.createdAt);

    // Filter endpoints that belong to the endpoint group
    const endpointGroup = await db
      .select()
      .from(endpointGroups)
      .where(eq(endpointGroups.id, payload.endpointGroupId))
      .limit(1);

    if (endpointGroup.length === 0) {
      return NextResponse.json(
        {
          error: "Endpoint group not found",
        },
        { status: 404 }
      );
    }

    const groupEndpointIds = JSON.parse(endpointGroup[0].endpointIds || "[]");
    const groupEndpoints = endpointList.filter(endpoint => groupEndpointIds.includes(endpoint.id));

    // Get latest attempt per messageId using SQL window function
    const rankedAttemptsSubquery = db
      .select({
        messageId: webhookAttempts.messageId,
        endpointId: webhookAttempts.endpointId,
        status: webhookAttempts.status,
        attemptNumber: webhookAttempts.attemptNumber,
        attemptedAt: webhookAttempts.attemptedAt,
        rowNumber:
          sql<number>`ROW_NUMBER() OVER (PARTITION BY ${webhookAttempts.messageId} ORDER BY ${webhookAttempts.attemptNumber} DESC, ${webhookAttempts.attemptedAt} DESC)`.as(
            "row_number"
          ),
      })
      .from(webhookAttempts)
      .where(
        and(
          inArray(webhookAttempts.endpointId, groupEndpointIds),
          gte(webhookAttempts.attemptedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      )
      .as("ranked_attempts");

    const latestAttempts = (await db
      .select({
        messageId: rankedAttemptsSubquery.messageId,
        endpointId: rankedAttemptsSubquery.endpointId,
        status: rankedAttemptsSubquery.status,
        attemptNumber: rankedAttemptsSubquery.attemptNumber,
        attemptedAt: rankedAttemptsSubquery.attemptedAt,
      })
      .from(rankedAttemptsSubquery)
      .where(sql`${rankedAttemptsSubquery.rowNumber} = 1`)) as Array<{
      messageId: string;
      endpointId: string;
      status: string;
      attemptNumber: number;
      attemptedAt: Date;
    }>;

    return NextResponse.json({
      endpoints: groupEndpoints.map(endpoint => ({
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        description: endpoint.description,
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt.toISOString(),
        updatedAt: endpoint.updatedAt.toISOString(),
        topics: endpoint.topics ? JSON.parse(endpoint.topics) : [],
        metrics24h: latestAttempts.filter(
          metric =>
            metric.endpointId === endpoint.id &&
            metric.attemptedAt &&
            metric.attemptedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ),
        metrics7d: latestAttempts.filter(
          metric =>
            metric.endpointId === endpoint.id &&
            metric.attemptedAt &&
            metric.attemptedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ),
      })),
    });
  } catch (error) {
    console.error("Error fetching portal endpoints:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = authenticatePortalRequest(request);

  if (!authResult.success) {
    return NextResponse.json(
      {
        error: authResult.error,
      },
      { status: 401 }
    );
  }

  const { payload } = authResult;
  const body = await request.json();
  const { name, url, description } = body as {
    name: string;
    url: string;
    description?: string;
  };

  if (!name || !url) {
    return NextResponse.json(
      {
        error: "Name and URL are required",
      },
      { status: 400 }
    );
  }

  const db = await getDb();

  try {
    // Generate endpoint ID
    const endpointId = `${payload.environmentId}_${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date();

    // Create the endpoint
    await db.insert(endpoints).values({
      id: endpointId,
      environmentId: payload.environmentId,
      name,
      url,
      description,
      isActive: true,
      retryPolicy: "exponential",
      backoffStrategy: "exponential",
      retryStrategy: "exponential",
      baseDelaySeconds: 5,
      maxRetryDelaySeconds: 300,
      retryJitterFactor: 0.2,
      maxRetries: 3,
      timeoutMs: 30000,
      headers: JSON.stringify({}),
      proxyGroupId: null,
      destinationType: "webhook",
      destinationConfig: JSON.stringify({
        url,
        timeoutMs: 30000,
        proxyGroupId: null,
      }),
      createdAt: now,
      updatedAt: now,
    });

    // Add endpoint to the endpoint group
    const endpointGroup = await db
      .select()
      .from(endpointGroups)
      .where(eq(endpointGroups.id, payload.endpointGroupId))
      .limit(1);

    if (endpointGroup.length > 0) {
      const currentEndpointIds = JSON.parse(endpointGroup[0].endpointIds || "[]");
      const updatedEndpointIds = [...currentEndpointIds, endpointId];

      await db
        .update(endpointGroups)
        .set({
          endpointIds: JSON.stringify(updatedEndpointIds),
          updatedAt: now,
        })
        .where(eq(endpointGroups.id, payload.endpointGroupId));
    }

    return NextResponse.json({
      id: endpointId,
      name,
      url,
      description,
      isActive: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Error creating portal endpoint:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
