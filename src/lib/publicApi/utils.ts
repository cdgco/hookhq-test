import { authenticatePublicApiRequest } from "@/lib/publicApi/auth";

export async function requireEnvironmentAccess(
  request: Request,
  env: CloudflareEnv,
  options?: Parameters<typeof authenticatePublicApiRequest>[2]
): Promise<{ environmentId: string } | Response> {
  const authResult = await authenticatePublicApiRequest(request, env, options);

  if (!authResult.success) {
    return authResult.response;
  }

  return { environmentId: authResult.environmentId };
}

export function parseEnabledFilter(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  return value === "true";
}

export function jsonError(error: string, status: number, extras?: Record<string, unknown>) {
  return Response.json({ error, ...extras }, { status });
}

const PUBLIC_API_BASE_PATH = "/api/v1";

export function getPublicApiUrl(path = "", full = false) {
  const configuredOrigin = process.env.NEXT_PUBLIC_PUBLIC_API_ORIGIN?.replace(/\/$/, "");
  const baseUrl = configuredOrigin ? `${configuredOrigin}${PUBLIC_API_BASE_PATH}` : full ? `${window.location.origin}${PUBLIC_API_BASE_PATH}` : PUBLIC_API_BASE_PATH;

  if (!path) {
    return baseUrl;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function publicApiFetch(path: string, init?: RequestInit) {
  return fetch(getPublicApiUrl(path), {
    credentials: "include",
    ...init,
  });
}
