import { initAuth } from "@/auth";
import { getDb } from "@/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { invalidateGlobalRetryConfigCache } from "@/lib/retryUtils";
import { serverConfig } from "@/db/environments.schema";
import { eq } from "drizzle-orm";
import { serializeAutoDisableConfig, serializeFailureAlertConfig } from "@/lib/destinations/config";

// GET /api/admin/config - Get server configuration
export async function GET() {
  try {
    const authInstance = await initAuth();
    const session = await authInstance.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await getDb();

    // Get server configuration from database
    const config = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);

    if (config.length === 0) {
      // Return default configuration if none exists
      const defaultConfig = {
        id: "default",
        cloudflareApiKey: null,
        cloudflareAccountId: null,
        cloudflareQueueId: null,
        logRetentionDays: 30,
        payloadRetentionDays: 7,
        defaultMaxRetries: 3,
        defaultTimeoutMs: 30000,
        defaultRetryPolicy: "retry",
        defaultBackoffStrategy: "exponential",
        defaultRetryStrategy: "exponential",
        defaultBaseDelaySeconds: 5,
        defaultMaxRetryDelaySeconds: 300,
        defaultRetryJitterFactor: 20,
        defaultFailureAlertConfig: serializeFailureAlertConfig({
          enabled: false,
          threshold: 5,
          windowMinutes: 60,
          endpointIds: [],
          channelType: "webhook",
          destinationUrl: "",
        }),
        defaultAutoDisableConfig: serializeAutoDisableConfig({
          enabled: false,
          threshold: 10,
        }),
        queueManagementEnabled: false,
        jwtExpiration: "1day",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ config: defaultConfig });
    }

    return NextResponse.json({ config: config[0] });
  } catch (error) {
    console.error("Error fetching server config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/config - Update server configuration
export async function POST(request: NextRequest) {
  try {
    const authInstance = await initAuth();
    const session = await authInstance.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      cloudflareApiKey: string;
      cloudflareAccountId: string;
      cloudflareQueueId: string;
      logRetentionDays: string;
      payloadRetentionDays: string;
      defaultMaxRetries: string;
      defaultTimeoutMs: string;
      defaultBackoffStrategy: string;
      defaultRetryStrategy?: string;
      defaultBaseDelaySeconds?: string;
      defaultMaxRetryDelaySeconds?: string;
      defaultRetryJitterFactor?: string;
      defaultFailureAlertConfig?: string;
      defaultAutoDisableConfig?: string;
      queueManagementEnabled: string;
      jwtExpiration: string;
    };
    const {
      cloudflareApiKey,
      cloudflareAccountId,
      cloudflareQueueId,
      logRetentionDays,
      payloadRetentionDays,
      defaultMaxRetries,
      defaultTimeoutMs,
      defaultBackoffStrategy,
      defaultRetryStrategy,
      defaultBaseDelaySeconds,
      defaultMaxRetryDelaySeconds,
      defaultRetryJitterFactor,
      defaultFailureAlertConfig,
      defaultAutoDisableConfig,
      queueManagementEnabled,
      jwtExpiration,
    } = body;

    // Validate JWT expiration format
    const jwtExpirationRegex = /^(\d+)(hour|day|week|month)$/;
    if (!jwtExpirationRegex.test(jwtExpiration)) {
      return NextResponse.json(
        { error: "Invalid JWT expiration format. Must be in format like '1day', '12hour', '2week', '3month'" },
        { status: 400 }
      );
    }

    // Validate JWT expiration values
    const jwtMatch = jwtExpiration.match(jwtExpirationRegex);
    if (jwtMatch) {
      const value = parseInt(jwtMatch[1]);
      const unit = jwtMatch[2];

      // Set reasonable limits
      if (value < 1 || value > 999) {
        return NextResponse.json({ error: "JWT expiration value must be between 1 and 999" }, { status: 400 });
      }

      // Additional validation for specific units
      if (unit === "hour" && value > 24) {
        return NextResponse.json({ error: "JWT expiration cannot exceed 24 hours" }, { status: 400 });
      }
      if (unit === "month" && value > 12) {
        return NextResponse.json({ error: "JWT expiration cannot exceed 12 months" }, { status: 400 });
      }
    }

    const db = await getDb();

    // Check if config exists
    const existingConfig = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);

    const configData = {
      id: "default",
      cloudflareApiKey,
      cloudflareAccountId,
      cloudflareQueueId,
      logRetentionDays: parseInt(logRetentionDays),
      payloadRetentionDays: parseInt(payloadRetentionDays),
      defaultMaxRetries: parseInt(defaultMaxRetries),
      defaultTimeoutMs: parseInt(defaultTimeoutMs),
      defaultBackoffStrategy,
      defaultRetryStrategy: defaultRetryStrategy || defaultBackoffStrategy,
      defaultBaseDelaySeconds: parseInt(defaultBaseDelaySeconds || "5"),
      defaultMaxRetryDelaySeconds: parseInt(defaultMaxRetryDelaySeconds || "300"),
      defaultRetryJitterFactor: parseInt(defaultRetryJitterFactor || "20"),
      defaultFailureAlertConfig:
        defaultFailureAlertConfig ||
        serializeFailureAlertConfig({
          enabled: false,
          threshold: 5,
          windowMinutes: 60,
          endpointIds: [],
          channelType: "webhook",
          destinationUrl: "",
        }),
      defaultAutoDisableConfig:
        defaultAutoDisableConfig ||
        serializeAutoDisableConfig({
          enabled: false,
          threshold: 10,
        }),
      queueManagementEnabled: Boolean(queueManagementEnabled),
      jwtExpiration,
      updatedAt: new Date(),
    };

    if (existingConfig.length === 0) {
      // Insert new config
      await db.insert(serverConfig).values({
        ...configData,
        createdAt: new Date(),
      });
    } else {
      // Update existing config
      await db.update(serverConfig).set(configData).where(eq(serverConfig.id, "default"));
    }

    // Invalidate retry config cache if retry settings changed
    await invalidateGlobalRetryConfigCache();

    return NextResponse.json({ config: configData });
  } catch (error) {
    console.error("Error updating server config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
