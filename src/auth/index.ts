import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey, admin, twoFactor } from "better-auth/plugins";
import { getDb } from "../db";

type AuthBuilderOptions = {
  cf?: Record<string, unknown>;
  env?: CloudflareEnv;
};

function getAuthSecret(env?: CloudflareEnv) {
  return env?.AUTH_SECRET || process.env.AUTH_SECRET;
}

async function authBuilder({ cf, env }: AuthBuilderOptions = {}, useEnv = false) {
  const resolvedEnv = env ?? (await getCloudflareContext({ async: true })).env;
  const dbInstance = useEnv ? await getDb(resolvedEnv) : await getDb();
  const authSecret = getAuthSecret(env);

  return betterAuth(
    withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf ?? getCloudflareContext().cf ?? {},
        d1: {
          db: dbInstance as any,
          options: {
            usePlural: true,
          },
        },
        kv: useEnv ? (resolvedEnv.KV as any) : (process.env.KV as any),
      },
      {
        secret: authSecret,
        rateLimit: {
          enabled: true,
        },
        plugins: [
          apiKey({
            enableMetadata: true,
            defaultPrefix: "wh_",
            rateLimit: {
              enabled: false,
            },
          }),
          admin(),
          twoFactor(),
        ],
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
        },
        user: {
          deleteUser: {
            enabled: true,
          },
          additionalFields: {
            lastEnvironment: {
              type: "string",
              required: false,
            },
            role: {
              type: "string",
              required: false,
            },
          },
        },
        advanced: {
          cookiePrefix: "hookhq",
        }
      }
    )
  );
}

// Singleton pattern to ensure a single auth instance
let authInstance: Awaited<ReturnType<typeof authBuilder>> | null = null;

// Asynchronously initializes and retrieves the shared auth instance
export async function initAuth() {
  if (!authInstance) {
    authInstance = await authBuilder();
  }
  return authInstance;
}

export async function createCloudflareAuth(env: CloudflareEnv, request?: Request) {
  return authBuilder(
    {
      env,
      cf: getRequestCf(request),
    },
    true
  );
}

function getRequestCf(request?: Request): Record<string, unknown> {
  if (!request) {
    return {};
  }

  return (request as Request & { cf?: Record<string, unknown> }).cf ?? {};
}

/* ======================================================================= */
/* Configuration for Schema Generation                                     */
/* ======================================================================= */

// This simplified configuration is used by the Better Auth CLI for schema generation.
// It includes only the options that affect the database schema.
// It's necessary because the main `authBuilder` performs operations (like `getDb()`)
// which use `getCloudflareContext` (not available in a CLI context only on Cloudflare).
// For more details, see: https://www.answeroverflow.com/m/1362463260636479488
export const auth = betterAuth({
  ...withCloudflare(
    {
      autoDetectIpAddress: true,
      geolocationTracking: true,
      cf: {},
    },
    {
      secret: process.env.AUTH_SECRET,
      // Include only configurations that influence the Drizzle schema
      plugins: [apiKey({ enableMetadata: true, defaultPrefix: "wh_" }), admin(), twoFactor()],
      emailAndPassword: {
        enabled: true,
      },
      user: {
        additionalFields: {
          lastEnvironment: {
            type: "string",
            required: false,
          },
          role: {
            type: "string",
            required: false,
          },
        },
      },
      advanced: {
        cookiePrefix: "hookhq",
      },
    }
  ),

  // Used by the Better Auth CLI for schema generation.
  database: drizzleAdapter({} as D1Database, {
    provider: "sqlite",
    usePlural: true,
  }),
});
