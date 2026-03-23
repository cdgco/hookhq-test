import { getDb } from "@/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { users } from "@/db/auth.schema";
import { NextResponse } from "next/server";

// GET /api/setup/status - Check if setup is needed (no auth required)
export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = await getDb();

    // Check if any users exist
    const existingUsers = await db.select({ id: users.id }).from(users).limit(1);

    const needsSetup = existingUsers.length === 0;
    const missingDestinationEncryptionKey = !env.DESTINATION_ENCRYPTION_KEY;

    return NextResponse.json({
      needsSetup,
      missingDestinationEncryptionKey,
    });
  } catch (error) {
    console.error("Error checking setup status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
