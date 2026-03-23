import { initAuth } from "@/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { users } from "@/db/auth.schema";
import { proxyGroups, proxyServers } from "@/db/webhooks.schema";
import { and, eq, like, not } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { checkProxyServerHealth, encryptProxySecret, readProxyHealth } from "@/lib/proxy";

async function getCurrentEnvironmentId() {
  const authInstance = await initAuth();
  const session = await authInstance.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = await getDb(env);
  const user = await db
    .select({ lastEnvironment: users.lastEnvironment })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user[0]?.lastEnvironment) {
    return { error: NextResponse.json({ error: "No environment selected" }, { status: 400 }) };
  }

  return { db, env, environmentId: user[0].lastEnvironment };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentEnvironmentId();
  if ("error" in context) {
    return context.error;
  }

  const { db, env, environmentId } = context;
  const { id } = await params;
  const [existing] = await db
    .select()
    .from(proxyServers)
    .where(and(eq(proxyServers.id, id), eq(proxyServers.environmentId, environmentId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Proxy server not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<{
    name: string;
    description: string;
    url: string;
    region: string;
    provider: string;
    staticIp: string;
    timeoutMs: number;
    isActive: boolean;
    rotateSecret: boolean;
  }>;

  if (body.url) {
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }
  }

  let nextSecret: string | undefined;
  const updateData: Partial<typeof proxyServers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.url !== undefined) updateData.url = body.url;
  if (body.region !== undefined) updateData.region = body.region;
  if (body.provider !== undefined) updateData.provider = body.provider;
  if (body.staticIp !== undefined) updateData.staticIp = body.staticIp;
  if (body.timeoutMs !== undefined) updateData.timeoutMs = body.timeoutMs;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  if (body.rotateSecret) {
    nextSecret = randomBytes(32).toString("hex");
    updateData.secret = await encryptProxySecret(nextSecret, env);
  }

  await db.update(proxyServers).set(updateData).where(eq(proxyServers.id, id));
  const [updated] = await db.select().from(proxyServers).where(eq(proxyServers.id, id)).limit(1);
  if (updated) {
    await checkProxyServerHealth(updated, env);
  }

  return NextResponse.json({
    proxyServer: {
      id: updated.id,
      environmentId: updated.environmentId,
      name: updated.name,
      description: updated.description,
      url: updated.url,
      isActive: updated.isActive,
      region: updated.region,
      provider: updated.provider,
      staticIp: updated.staticIp,
      timeoutMs: updated.timeoutMs,
      hasSecret: Boolean(updated.secret),
      health: await readProxyHealth(env, updated.id),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
    rotatedSecret: nextSecret,
  });
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
    .from(proxyServers)
    .where(and(eq(proxyServers.id, id), eq(proxyServers.environmentId, environmentId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Proxy server not found" }, { status: 404 });
  }

  const groups = await db
    .select({ id: proxyGroups.id })
    .from(proxyGroups)
    .where(
      and(
        eq(proxyGroups.environmentId, environmentId),
        like(proxyGroups.proxyIds, `%${id}%`),
        not(eq(proxyGroups.id, ""))
      )
    );

  await db.delete(proxyServers).where(eq(proxyServers.id, id));
  return NextResponse.json({ success: true });
}
