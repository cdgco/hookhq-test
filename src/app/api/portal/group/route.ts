import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { endpointGroups } from "@/db/webhooks.schema";
import { eq } from "drizzle-orm";
import { authenticatePortalRequest } from "@/lib/portalAuth";
import { buildEndpointGroupUpdateValues, formatEndpointGroup } from "@/lib/publicApi/serializers";
import { parseFailureAlertConfig } from "@/lib/destinations/config";

export async function GET(request: NextRequest) {
  const authResult = authenticatePortalRequest(request);

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const db = await getDb();
  const group = await db
    .select()
    .from(endpointGroups)
    .where(eq(endpointGroups.id, authResult.payload.endpointGroupId))
    .limit(1);

  if (group.length === 0) {
    return NextResponse.json({ error: "Endpoint group not found" }, { status: 404 });
  }

  return NextResponse.json({ group: formatEndpointGroup(group[0]) });
}

export async function PATCH(request: NextRequest) {
  const authResult = authenticatePortalRequest(request);

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const body = (await request.json()) as {
    failureAlerts?: {
      enabled?: boolean;
      threshold?: number;
      windowMinutes?: number;
      endpointIds?: string[];
      channelType?: "webhook" | "slack";
      destinationUrl?: string;
    };
  };

  const db = await getDb();
  const existing = await db
    .select()
    .from(endpointGroups)
    .where(eq(endpointGroups.id, authResult.payload.endpointGroupId))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Endpoint group not found" }, { status: 404 });
  }

  const updateData = buildEndpointGroupUpdateValues({
    failureAlerts: body.failureAlerts,
    existingFailureAlerts: parseFailureAlertConfig(existing[0].failureAlertConfig),
  });

  await db
    .update(endpointGroups)
    .set(updateData as never)
    .where(eq(endpointGroups.id, authResult.payload.endpointGroupId));
  const updated = await db
    .select()
    .from(endpointGroups)
    .where(eq(endpointGroups.id, authResult.payload.endpointGroupId))
    .limit(1);

  return NextResponse.json({ group: formatEndpointGroup(updated[0]) });
}
