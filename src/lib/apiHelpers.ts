import { NextRequest, NextResponse } from "next/server";
import { extractApiKeyFromHeader } from "./apiKeyAuth";
import { initAuth } from "@/auth";
import { eq, getDb } from "@/db";
import { users } from "@/db/auth.schema";

type AuthResult = 
  | { success: true; environmentId: string; body: any | null }
  | { success: false; response: NextResponse };

export async function authenticateApiRequest(
  request: NextRequest, 
  permissions?: Record<string, string[]>
): Promise<AuthResult> {
  const authInstance = await initAuth();
  const apiKey = extractApiKeyFromHeader(request.headers.get("Authorization"));
  let session = null;

  if (!apiKey) {
    session = await authInstance.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return {
        success: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      };
    }
  }

  if (!apiKey && !session?.user) {
    console.error("No API key found in request");
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  try {
    // Get current environment from user's last environment
    const db = await getDb();
    let environmentId = null;

    if (apiKey) {
      const authResult = await authInstance.api.verifyApiKey({
        body: {
          key: apiKey,
          permissions,
        },
      });

      if (authResult.error && authResult.error.code === "RATE_LIMITED") {
        return {
          success: false,
          response: NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
        };
      }

      if (!authResult.valid) {
        console.error("Invalid API key");
        return {
          success: false,
          response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
        };
      }

      environmentId = authResult.key?.metadata?.environment;
    } else if (session) {
      const user = await db
        .select({ lastEnvironment: users.lastEnvironment })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
      
      if (!user[0]?.lastEnvironment) {
        return {
          success: false,
          response: NextResponse.json({ error: "No environment selected" }, { status: 400 })
        };
      }
  
      environmentId = user[0].lastEnvironment;
    }

    if (!environmentId) {
      return {
        success: false,
        response: NextResponse.json({ error: "Internal server error" }, { status: 500 })
      };
    }

    // Only parse body for methods that typically have one
    let body = null;
    if (request.method !== "GET" && request.method !== "DELETE") {
      try {
        body = await request.json();
      } catch {
        return {
          success: false,
          response: NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        };
      }
    }

    return {
      success: true,
      environmentId,
      body,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      success: false,
      response: NextResponse.json({ error: "Internal server error" }, { status: 500 })
    };
  }
}