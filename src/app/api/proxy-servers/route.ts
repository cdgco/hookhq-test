import { initAuth } from "@/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { proxyServers } from "@/db/webhooks.schema";
import { users } from "@/db/auth.schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { checkProxyServerHealth, encryptProxySecret, readProxyHealth } from "@/lib/proxy";

export async function GET(request: NextRequest) {
  try {
    const authInstance = await initAuth();
    const session = await authInstance.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current environment from user's last environment
    const { env } = await getCloudflareContext({ async: true });
    const db = await getDb(env);
    const user = await db
      .select({ lastEnvironment: users.lastEnvironment })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.lastEnvironment) {
      return NextResponse.json({ error: "No environment selected" }, { status: 400 });
    }

    const environmentId = user[0].lastEnvironment;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    // Build query conditions
    const conditions = [eq(proxyServers.environmentId, environmentId)];

    // Add active filter if provided
    if (active !== null) {
      conditions.push(eq(proxyServers.isActive, active === "true"));
    }

    // Execute query
    const proxyList = await db
      .select()
      .from(proxyServers)
      .where(and(...conditions))
      .orderBy(proxyServers.createdAt);

    // Format the response (exclude secret for security)
    const formattedProxies = await Promise.all(
      proxyList.map(async proxy => ({
        id: proxy.id,
        environmentId: proxy.environmentId,
        name: proxy.name,
        description: proxy.description,
        url: proxy.url,
        isActive: proxy.isActive,
        region: proxy.region,
        provider: proxy.provider,
        staticIp: proxy.staticIp,
        timeoutMs: proxy.timeoutMs,
        hasSecret: Boolean(proxy.secret),
        health: await readProxyHealth(env, proxy.id),
        createdAt: proxy.createdAt.toISOString(),
        updatedAt: proxy.updatedAt.toISOString(),
      }))
    );

    return NextResponse.json({ proxyServers: formattedProxies });
  } catch (error) {
    console.error("Error fetching proxy servers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/proxy-servers - Create new proxy server
export async function POST(request: NextRequest) {
  try {
    const authInstance = await initAuth();
    const session = await authInstance.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current environment from user's last environment
    const { env } = await getCloudflareContext({ async: true });
    const db = await getDb(env);
    const user = await db
      .select({ lastEnvironment: users.lastEnvironment })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]?.lastEnvironment) {
      return NextResponse.json({ error: "No environment selected" }, { status: 400 });
    }

    const environmentId = user[0].lastEnvironment;

    const body = await request.json();
    const {
      name,
      description,
      url,
      region,
      provider,
      staticIp,
      timeoutMs = 30000,
      isActive = true,
    } = body as {
      name: string;
      description?: string;
      url: string;
      region?: string;
      provider?: string;
      staticIp?: string;
      timeoutMs?: number;
      isActive?: boolean;
    };

    if (!name || !url) {
      return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Generate proxy server ID with prefix and secret
    const proxyId = `proxy_${environmentId}_${crypto.randomUUID().substring(0, 8)}`;
    const secret = randomBytes(32).toString("hex");
    const encryptedSecret = await encryptProxySecret(secret, env);
    const now = new Date();

    await db.insert(proxyServers).values({
      id: proxyId,
      environmentId,
      name,
      description,
      url,
      secret: encryptedSecret,
      region,
      provider,
      staticIp,
      timeoutMs,
      isActive,
      createdAt: now,
      updatedAt: now,
    });

    await checkProxyServerHealth(
      {
        id: proxyId,
        environmentId,
        name,
        description: description ?? null,
        url,
        secret: encryptedSecret,
        isActive,
        region: region ?? null,
        provider: provider ?? null,
        staticIp: staticIp ?? null,
        healthCheckUrl: null,
        timeoutMs,
        maxConcurrentRequests: 100,
        createdAt: now,
        updatedAt: now,
      },
      env
    );

    // Generate configuration instructions
    const configInstructions = {
      docker: {
        commands: [`docker run -d -p 3000:3000 -e PROXY_SECRET=${secret} nuovar/hookhq-relay`],
        env: `PROXY_SECRET=${secret}`,
      },
      gcp: {
        env: `PROXY_SECRET=${secret}`,
        commands: [`gcloud run deploy --image nuovar/hookhq-relay --set-env-vars PROXY_SECRET=${secret}`],
      },
      railway: {
        env: `PROXY_SECRET=${secret}`,
        commands: ['railway new', `railway deploy -t hookhq-relay -v PROXY_SECRET=${secret}`],
      },
    };

    return NextResponse.json({
      id: proxyId,
      environmentId,
      name,
      description,
      url,
      region,
      provider,
      staticIp,
      timeoutMs,
      isActive,
      secret, // Only returned on creation
      configInstructions,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Error creating proxy server:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
