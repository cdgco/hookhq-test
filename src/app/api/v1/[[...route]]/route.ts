/*
 * This is a proxy to the public API used in development.
 * In production requests to /api/v1 are routed at the entry point before they hit this file.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import publicApiApp from "@/lib/publicApi";

async function handleRequest(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const headers = new Headers(request.headers);
  headers.set("x-local-dev-queue", "1");
  const proxiedRequest = new Request(request, { headers });
  return publicApiApp.fetch(proxiedRequest, env);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;
