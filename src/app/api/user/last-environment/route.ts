import { initAuth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/auth.schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// GET /api/user/last-environment - Get user's last environment
export async function GET() {
  try {
    const authInstance = await initAuth();
    const session = await authInstance.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const user = await db
      .select({ lastEnvironment: users.lastEnvironment })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      environmentId: user[0].lastEnvironment
    });
  } catch (error) {
    console.error("Error fetching last environment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/user/last-environment - Update user's last environment
export async function PATCH(request: NextRequest) {
  try {
    const authInstance = await initAuth();
    const session = await authInstance.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { environmentId } = body as { environmentId: string };

    if (!environmentId) {
      return NextResponse.json({ error: "Environment ID is required" }, { status: 400 });
    }

    const db = await getDb();

    // Update user's last environment
    await db
      .update(users)
      .set({
        lastEnvironment: environmentId,
        updatedAt: new Date()
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      environmentId
    });
  } catch (error) {
    console.error("Error updating last environment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
