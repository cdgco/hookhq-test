import { initAuth } from "@/auth";
import { getDb } from "@/db";
import { serverConfig } from "@/db/environments.schema";
import { proxyGroups, proxyServers } from "@/db/webhooks.schema";
import { users } from "@/db/auth.schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// GET /api/proxy-groups - List proxy groups for the current environment
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
    const [config] = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    // Build query conditions
    const conditions = [eq(proxyGroups.environmentId, environmentId)];

    // Add active filter if provided
    if (active !== null) {
      conditions.push(eq(proxyGroups.isActive, active === "true"));
    }

    // Execute query
    const groupList = await db
      .select()
      .from(proxyGroups)
      .where(and(...conditions))
      .orderBy(proxyGroups.createdAt);

    // Format the response with proxy server details
    const formattedGroups = await Promise.all(
      groupList.map(async group => {
        const proxyIds = JSON.parse(group.proxyIds);

        // Get proxy server details
        const proxies = await db
          .select({
            id: proxyServers.id,
            name: proxyServers.name,
            url: proxyServers.url,
            region: proxyServers.region,
            provider: proxyServers.provider,
            isActive: proxyServers.isActive,
          })
          .from(proxyServers)
          .where(eq(proxyServers.environmentId, environmentId));

        const groupProxies = proxies.filter(proxy => proxyIds.includes(proxy.id));

        return {
          id: group.id,
          environmentId: group.environmentId,
          name: group.name,
          description: group.description,
          proxyIds: proxyIds,
          proxies: groupProxies,
          loadBalancingStrategy: group.loadBalancingStrategy,
          isDefault: config?.defaultProxyGroupId === group.id,
          isActive: group.isActive,
          createdAt: group.createdAt.toISOString(),
          updatedAt: group.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ proxyGroups: formattedGroups });
  } catch (error) {
    console.error("Error fetching proxy groups:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/proxy-groups - Create new proxy group
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      name,
      description,
      proxyIds = [],
      loadBalancingStrategy = "random",
      isDefault = false,
      isActive = true,
    } = body as {
      name: string;
      description?: string;
      proxyIds?: string[];
      loadBalancingStrategy?: "random" | "round_robin";
      isDefault?: boolean;
      isActive?: boolean;
    };

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!Array.isArray(proxyIds)) {
      return NextResponse.json({ error: "proxyIds must be an array" }, { status: 400 });
    }

    // Validate that all proxy IDs exist and belong to this environment
    if (proxyIds.length > 0) {
      const existingProxies = await db
        .select({ id: proxyServers.id })
        .from(proxyServers)
        .where(and(eq(proxyServers.environmentId, environmentId), eq(proxyServers.isActive, true)));

      const existingProxyIds = existingProxies.map(p => p.id);
      const invalidProxyIds = proxyIds.filter(id => !existingProxyIds.includes(id));

      if (invalidProxyIds.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid proxy IDs: ${invalidProxyIds.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Generate proxy group ID with prefix (grp_{environmentId}_{random})
    const groupId = `proxygrp_${environmentId}_${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date();

    await db.insert(proxyGroups).values({
      id: groupId,
      environmentId,
      name,
      description,
      proxyIds: JSON.stringify(proxyIds),
      loadBalancingStrategy,
      isActive,
      createdAt: now,
      updatedAt: now,
    });

    if (isDefault) {
      const [existingConfig] = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);
      if (existingConfig) {
        await db
          .update(serverConfig)
          .set({ defaultProxyGroupId: groupId, updatedAt: now })
          .where(eq(serverConfig.id, "default"));
      } else {
        await db.insert(serverConfig).values({
          id: "default",
          defaultProxyGroupId: groupId,
          updatedAt: now,
          createdAt: now,
        });
      }
    }

    return NextResponse.json({
      id: groupId,
      environmentId,
      name,
      description,
      proxyIds,
      loadBalancingStrategy,
      isDefault,
      isActive,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Error creating proxy group:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
