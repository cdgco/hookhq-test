import { createCloudflareAuth } from "@/auth";
import { getDb } from "@/db";
import { serverConfig } from "@/db/environments.schema";
import { eq } from "drizzle-orm";

export interface CloudflareConfig {
  cloudflareApiKey: string;
  cloudflareAccountId: string;
  cloudflareQueueId: string;
}

export async function getCloudflareConfig(env?: CloudflareEnv): Promise<CloudflareConfig | null> {
  try {
    const db = await getDb(env);
    const config = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);

    if (config.length === 0) {
      return null;
    }

    const serverConfigData = config[0];
    if (
      !serverConfigData.cloudflareApiKey ||
      !serverConfigData.cloudflareAccountId ||
      !serverConfigData.cloudflareQueueId
    ) {
      return null;
    }

    return {
      cloudflareApiKey: serverConfigData.cloudflareApiKey,
      cloudflareAccountId: serverConfigData.cloudflareAccountId,
      cloudflareQueueId: serverConfigData.cloudflareQueueId,
    };
  } catch (error) {
    console.error("Error fetching Cloudflare config:", error);
    return null;
  }
}

export async function validateAdminAccess(request: Request, env: CloudflareEnv): Promise<boolean> {
  try {
    const authInstance = await createCloudflareAuth(env, request);
    const session = await authInstance.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return false;
    }

    if (session?.user?.role !== "admin") {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validating admin access:", error);
    return false;
  }
}
