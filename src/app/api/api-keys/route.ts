import { initAuth } from "@/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// POST /api/api-keys - Create new API key
export async function POST(request: NextRequest) {
  try {
    const authInstance = await initAuth();
    const session = await authInstance.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, permissions, environment } = body as { name: string; permissions: Record<string, string[]>; environment: string };

    if (!name || !permissions || !environment) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Validate permissions are valid ApiKeyPermission types
    const validPermissions = Object.keys(permissions).every(p =>
      p.startsWith("endpoints") || p.startsWith("messages") || p.startsWith("endpointGroups") || p.startsWith("eventTypes")
    ) && Object.values(permissions).every(p => p.every((op: string) => ["create", "read", "update", "delete"].includes(op)));

    if (Object.keys(permissions).length === 0 || !validPermissions) {
      return NextResponse.json({ error: "At least one valid permission is required" }, { status: 400 });
    }

    const apiKey = await authInstance.api.createApiKey({
      body: {
        name: name,
        userId: session.user.id,
        metadata: { environment },
        permissions,
      },
    });

    return NextResponse.json(apiKey);
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
