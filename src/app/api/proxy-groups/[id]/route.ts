import { initAuth } from "@/auth";
import { getDb } from "@/db";
import { serverConfig } from "@/db/environments.schema";
import { users } from "@/db/auth.schema";
import { endpointGroups, endpoints, proxyGroups, proxyServers } from "@/db/webhooks.schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function getCurrentEnvironmentId() {
  const authInstance = await initAuth();
  const session = await authInstance.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = await getDb();
  const user = await db
    .select({ lastEnvironment: users.lastEnvironment })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user[0]?.lastEnvironment) {
    return { error: NextResponse.json({ error: "No environment selected" }, { status: 400 }) };
  }

  return { db, environmentId: user[0].lastEnvironment };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentEnvironmentId();
  if ("error" in context) {
    return context.error;
  }

  const { db, environmentId } = context;
  const { id } = await params;
  const [existing] = await db
    .select()
    .from(proxyGroups)
    .where(and(eq(proxyGroups.id, id), eq(proxyGroups.environmentId, environmentId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Proxy group not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<{
    name: string;
    description: string;
    proxyIds: string[];
    loadBalancingStrategy: "random" | "round_robin";
    isActive: boolean;
    isDefault: boolean;
  }>;

  if (body.proxyIds && body.proxyIds.length > 0) {
    const proxies = await db
      .select({ id: proxyServers.id })
      .from(proxyServers)
      .where(and(eq(proxyServers.environmentId, environmentId), eq(proxyServers.isActive, true)));

    const validIds = new Set(proxies.map(proxy => proxy.id));
    const invalidIds = body.proxyIds.filter(proxyId => !validIds.has(proxyId));

    if (invalidIds.length > 0) {
      return NextResponse.json({ error: `Invalid proxy IDs: ${invalidIds.join(", ")}` }, { status: 400 });
    }
  }

  await db
    .update(proxyGroups)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.proxyIds !== undefined ? { proxyIds: JSON.stringify(body.proxyIds) } : {}),
      ...(body.loadBalancingStrategy !== undefined ? { loadBalancingStrategy: body.loadBalancingStrategy } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(proxyGroups.id, id));

  if (body.isDefault !== undefined) {
    await db
      .update(serverConfig)
      .set({
        defaultProxyGroupId: body.isDefault ? id : null,
        updatedAt: new Date(),
      })
      .where(eq(serverConfig.id, "default"));
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentEnvironmentId();
  if ("error" in context) {
    return context.error;
  }

  const { db, environmentId } = context;
  const { id } = await params;
  const [existing] = await db
    .select()
    .from(proxyGroups)
    .where(and(eq(proxyGroups.id, id), eq(proxyGroups.environmentId, environmentId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Proxy group not found" }, { status: 404 });
  }

  const [endpointUsingGroup] = await db
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.environmentId, environmentId), eq(endpoints.proxyGroupId, id)))
    .limit(1);
  const [endpointGroupUsingGroup] = await db
    .select({ id: endpointGroups.id })
    .from(endpointGroups)
    .where(and(eq(endpointGroups.environmentId, environmentId), eq(endpointGroups.proxyGroupId, id)))
    .limit(1);

  if (endpointUsingGroup || endpointGroupUsingGroup) {
    return NextResponse.json(
      {
        error: "Proxy group is still assigned to endpoints or endpoint groups",
      },
      { status: 400 }
    );
  }

  await db.delete(proxyGroups).where(eq(proxyGroups.id, id));
  await db
    .update(serverConfig)
    .set({ defaultProxyGroupId: null, updatedAt: new Date() })
    .where(eq(serverConfig.defaultProxyGroupId, id));

  return NextResponse.json({ success: true });
}
