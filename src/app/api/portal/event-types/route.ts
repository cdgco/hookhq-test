import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { eventTypes } from "@/db/webhooks.schema";
import { eq } from "drizzle-orm";
import { authenticatePortalRequest, isEventTypeAllowed } from "@/lib/portalAuth";

export async function GET(request: NextRequest) {
  const authResult = authenticatePortalRequest(request);

  if (!authResult.success) {
    return NextResponse.json({
      error: authResult.error
    }, { status: 401 });
  }

  const { payload } = authResult;
  const db = await getDb();

  try {
    // Get all event types for the environment
    const eventTypeList = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.environmentId, payload.environmentId))
      .orderBy(eventTypes.createdAt);

    // Filter by allowed event types if specified
    const filteredEventTypes = eventTypeList.filter(eventType =>
      isEventTypeAllowed(eventType.name, payload.allowedEventTypes)
    );

    return NextResponse.json({
      eventTypes: filteredEventTypes.map(eventType => ({
        id: eventType.id,
        name: eventType.name,
        description: eventType.description,
        schema: eventType.schema ? JSON.parse(eventType.schema) : null,
        enabled: eventType.enabled,
        createdAt: eventType.createdAt.toISOString(),
        updatedAt: eventType.updatedAt.toISOString()
      }))
    });

  } catch (error) {
    console.error("Error fetching portal event types:", error);
    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 });
  }
}
