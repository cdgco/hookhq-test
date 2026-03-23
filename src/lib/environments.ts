import { randomBytes } from "crypto";
import { publicApiFetch } from "@/lib/publicApi/utils";

const ENVIRONMENT_COOKIE_NAME = "hookhq_environment";

/**
 * Generate a 4-character hex environment ID
 */
export function generateEnvironmentId(): string {
  return randomBytes(2).toString("hex"); // 2 bytes = 4 hex characters
}

/**
 * Set environment in cookie
 */
export function setEnvironmentCookie(environmentId: string) {
  if (typeof document !== "undefined") {
    document.cookie = `${ENVIRONMENT_COOKIE_NAME}=${environmentId}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
  }
}

/**
 * Get environment from cookie
 */
export function getEnvironmentCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === ENVIRONMENT_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

/**
 * Clear environment cookie
 */
export function clearEnvironmentCookie() {
  if (typeof document !== "undefined") {
    document.cookie = `${ENVIRONMENT_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

/**
 * Update user's last environment in database
 */
export async function updateUserLastEnvironment(environmentId: string) {
  try {
    const response = await fetch("/api/user/last-environment", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ environmentId }),
    });

    if (!response.ok) {
      throw new Error("Failed to update last environment");
    }

    // Also update the cookie
    setEnvironmentCookie(environmentId);

    return true;
  } catch (error) {
    console.error("Error updating last environment:", error);
    return false;
  }
}

/**
 * Get user's last environment from database
 */
export async function getUserLastEnvironment(): Promise<string | null> {
  try {
    const response = await fetch("/api/user/last-environment");

    if (!response.ok) {
      throw new Error("Failed to fetch last environment");
    }

    const data = (await response.json()) as { environmentId: string | null };
    return data.environmentId;
  } catch (error) {
    console.error("Error fetching last environment:", error);
    return null;
  }
}

/**
 * Get current environment with fallback
 */
export async function getCurrentEnvironment(): Promise<string | null> {
  // First try cookie (fastest)
  const cookieEnv = getEnvironmentCookie();
  if (cookieEnv) {
    return cookieEnv;
  }

  // Then try database
  const dbEnv = await getUserLastEnvironment();
  if (dbEnv) {
    // Update cookie with database value
    setEnvironmentCookie(dbEnv);
    return dbEnv;
  }

  // Finally, try to get default environment
  try {
    const response = await publicApiFetch("/environments");
    if (response.ok) {
      const data = (await response.json()) as { environments: Array<{ id: string; isDefault: boolean }> };
      const defaultEnv = data.environments.find(env => env.isDefault);
      if (defaultEnv) {
        setEnvironmentCookie(defaultEnv.id);
        return defaultEnv.id;
      }
    }
  } catch (error) {
    console.error("Error fetching default environment:", error);
  }

  return null;
}
