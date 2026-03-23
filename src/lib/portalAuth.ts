import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { getDb } from "@/db";
import { serverConfig } from "@/db/environments.schema";
import { eq } from "drizzle-orm";

export interface PortalTokenPayload {
  endpointGroupId: string;
  environmentId: string;
  allowedEventTypes?: string[];
  applicationName?: string;
  returnUrl?: string;
  iat?: number;
  exp?: number;
}

export type PortalAuthResult =
  | {
      success: true;
      payload: PortalTokenPayload;
      portalUrl: string;
      token: string;
      expiresIn?: StringValue | number;
    }
  | { success: false; error: string };

const DEFAULT_EXPIRES_IN = "1day";
type PortalEnvConfig = {
  AUTH_SECRET?: string;
  JWT_PREFIX?: string;
  NEXT_PUBLIC_BASE_URL?: string;
};

function getJwtPrefix(env?: PortalEnvConfig): string {
  return env?.JWT_PREFIX || process.env.JWT_PREFIX || "hookhq";
}

function getAuthSecret(env?: PortalEnvConfig): string | undefined {
  return env?.AUTH_SECRET || process.env.AUTH_SECRET;
}

function getBaseUrl(request: Request, env?: PortalEnvConfig): string {
  return (
    env?.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    request.headers.get("origin") ||
    new URL(request.url).origin
  );
}

async function getJwtExpiration(env?: CloudflareEnv): Promise<StringValue | number> {
  try {
    const db = await getDb(env);
    const config = await db.select().from(serverConfig).where(eq(serverConfig.id, "default")).limit(1);

    return config.length > 0 ? (config[0].jwtExpiration as StringValue | number) : DEFAULT_EXPIRES_IN;
  } catch (error) {
    console.error("Error fetching JWT expiration from config:", error);
    return DEFAULT_EXPIRES_IN;
  }
}

export async function generatePortalToken(
  payload: PortalTokenPayload,
  request: Request,
  env?: CloudflareEnv & PortalEnvConfig,
  expiresIn?: StringValue | number
): Promise<PortalAuthResult> {
  try {
    const authSecret = getAuthSecret(env);
    if (!authSecret) {
      return {
        success: false,
        error: "AUTH_SECRET is not set",
      };
    }

    const tokenExpiration = expiresIn || (await getJwtExpiration(env));
    const jwtPrefix = getJwtPrefix(env);

    const token = jwt.sign(payload, authSecret, {
      expiresIn: tokenExpiration,
      issuer: `${jwtPrefix}-api`,
      audience: `${jwtPrefix}-portal`,
    });

    const portalUrl = generatePortalUrl(request, token, undefined, env);

    return {
      success: true,
      payload,
      portalUrl,
      token,
      expiresIn: tokenExpiration,
    };
  } catch (error) {
    console.error("Error generating portal token:", error);
    return {
      success: false,
      error: "Error generating portal token",
    };
  }
}

export function verifyPortalToken(
  token: string,
  request: Request,
  env?: CloudflareEnv & PortalEnvConfig
): PortalAuthResult {
  try {
    const authSecret = getAuthSecret(env);
    if (!authSecret) {
      return {
        success: false,
        error: "AUTH_SECRET is not set",
      };
    }

    const jwtPrefix = getJwtPrefix(env);
    const payload = jwt.verify(token, authSecret, {
      issuer: `${jwtPrefix}-api`,
      audience: `${jwtPrefix}-portal`,
    }) as PortalTokenPayload;

    const portalUrl = generatePortalUrl(request, token, undefined, env);

    return {
      success: true,
      payload,
      portalUrl,
      token,
    };
  } catch (error) {
    console.error("Error verifying portal token:", error);
    if (error && typeof error === "object" && "name" in error) {
      if (error.name === "TokenExpiredError") {
        return {
          success: false,
          error: "Token has expired",
        };
      } else if (error.name === "JsonWebTokenError") {
        return {
          success: false,
          error: "Invalid token",
        };
      }
    }
    return {
      success: false,
      error: "Token verification failed",
    };
  }
}

export function authenticatePortalRequest(request: Request, env?: CloudflareEnv & PortalEnvConfig): PortalAuthResult {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return {
      success: false,
      error: "No token provided",
    };
  }

  return verifyPortalToken(token, request, env);
}

export function isEventTypeAllowed(eventType: string, allowedEventTypes?: string[]): boolean {
  if (!allowedEventTypes || allowedEventTypes.length === 0) {
    return true;
  }

  return allowedEventTypes.includes(eventType);
}

export function generatePortalUrl(
  request: Request,
  token: string,
  path?: string,
  env?: CloudflareEnv & PortalEnvConfig
): string {
  const baseUrl = getBaseUrl(request, env);
  const portalPath = path ? `/portal${path}` : "/portal";
  return `${baseUrl}${portalPath}?token=${token}`;
}
