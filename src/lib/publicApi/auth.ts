import { createCloudflareAuth } from "@/auth";
import { users } from "@/db/auth.schema";
import { getDb } from "@/db";
import { type CrudOperation, type ResourceType } from "@/lib/apiKeys";
import { eq } from "drizzle-orm";

type PublicApiAuthResult = { success: true; environmentId: string } | { success: false; response: Response };
type SessionAuthResult = { success: true; userId: string } | { success: false; response: Response };

type PublicApiAuthOptions = {
  permissions?: Partial<Record<ResourceType, CrudOperation[]>>;
  allowSession?: boolean;
};

export async function authenticatePublicApiRequest(
  request: Request,
  env: CloudflareEnv,
  options: PublicApiAuthOptions = {}
): Promise<PublicApiAuthResult> {
  const apiKey = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const auth = await createCloudflareAuth(env, request);

  if (!apiKey && options.allowSession !== false) {
    const sessionResult = await authenticateSessionRequest(request, env);

    if (!sessionResult.success) {
      return sessionResult;
    }

    const db = await getDb(env);
    const user = await db
      .select({ lastEnvironment: users.lastEnvironment })
      .from(users)
      .where(eq(users.id, sessionResult.userId))
      .limit(1);

    const environmentId = user[0]?.lastEnvironment;

    if (!environmentId) {
      return {
        success: false,
        response: Response.json({ error: "No environment selected" }, { status: 400 }),
      };
    }

    return {
      success: true,
      environmentId,
    };
  }

  if (!apiKey) {
    return {
      success: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const authResult = await auth.api.verifyApiKey({
    body: {
      key: apiKey,
      permissions: options.permissions,
    },
  });

  if (authResult.error?.code === "RATE_LIMITED") {
    return {
      success: false,
      response: Response.json({ error: "Rate limit exceeded" }, { status: 429 }),
    };
  }

  if (!authResult.valid) {
    return {
      success: false,
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const environmentId = authResult.key?.metadata?.environment;

  if (typeof environmentId !== "string") {
    return {
      success: false,
      response: Response.json({ error: "Internal server error" }, { status: 500 }),
    };
  }

  return {
    success: true,
    environmentId,
  };
}

export async function authenticateSessionRequest(request: Request, env: CloudflareEnv): Promise<SessionAuthResult> {
  const auth = await createCloudflareAuth(env, request);
  const session = await auth.api.getSession({ headers: {
    cookie: request.headers.get("cookie") || "",
  } });

  if (!session?.user?.id && !session?.session && !session?.session?.userId) {
    return {
      success: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    success: true,
    userId: session.user.id,
  };
}
