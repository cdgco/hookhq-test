import { initAuth } from "@/auth";
import { getDb } from "@/db";
import { webhookMessages } from "@/db/webhooks.schema";
import { users } from "@/db/auth.schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, desc, and } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// GET /api/webhooks/messages - List webhook messages for the current environment
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
    const { env } = await getCloudflareContext({ async: true });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query conditions
    const conditions = [eq(webhookMessages.environmentId, environmentId)];

    // Add status filter if provided
    if (status && status !== "all") {
      conditions.push(eq(webhookMessages.status, status));
    }

    // Execute query
    const messages = await db
      .select()
      .from(webhookMessages)
      .where(and(...conditions))
      .orderBy(desc(webhookMessages.createdAt))
      .limit(limit)
      .offset(offset);

    // Format the response
    const formattedMessages = await Promise.all(
      messages.map(async msg => {
        const endpointIds = JSON.parse(msg.endpointIds) as string[];
        const retryableEndpointIds = (
          await Promise.all(
            endpointIds.map(async endpointId => {
              const retryKey = `failed:${msg.id}:${endpointId}`;
              const retryable = await env.KV.get(retryKey, "text");
              return retryable ? endpointId : null;
            })
          )
        ).filter(Boolean) as string[];

        return {
          id: msg.id,
          eventId: msg.eventId,
          eventType: msg.eventType,
          environmentId: msg.environmentId,
          endpointIds,
          endpointGroupIds: JSON.parse(msg.endpointGroupIds),
          retryableEndpointIds,
          payload: msg.payload ? JSON.parse(msg.payload) : null,
          payloadSize: msg.payloadSize,
          status: msg.status,
          attempts: msg.attempts,
          maxAttempts: msg.maxAttempts,
          createdAt: msg.createdAt.toISOString(),
          queuedAt: msg.queuedAt?.toISOString(),
          processingStartedAt: msg.processingStartedAt?.toISOString(),
          deliveredAt: msg.deliveredAt?.toISOString(),
          failedAt: msg.failedAt?.toISOString(),
          lastError: msg.lastError,
          lastErrorAt: msg.lastErrorAt?.toISOString(),
          responseStatus: msg.responseStatus,
          responseTimeMs: msg.responseTimeMs,
          responseBody: msg.responseBody,
          idempotencyKey: msg.idempotencyKey,
          metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
        };
      })
    );

    return NextResponse.json({
      messages: formattedMessages,
      total: formattedMessages.length,
      hasMore: formattedMessages.length === limit,
    });
  } catch (error) {
    console.error("Error fetching webhook messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
