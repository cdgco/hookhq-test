import { timingSafeEqual } from "node:crypto";

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function normalizeSecret(secret) {
  return typeof secret === "string" ? secret : "";
}

function isAuthorized(authorizationHeader, secret) {
  if (!secret) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorizationHeader || "");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

async function readRawBody(request) {
  if (typeof request.rawBody === "string") {
    return request.rawBody;
  }

  if (Buffer.isBuffer(request.rawBody)) {
    return request.rawBody.toString("utf8");
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request) {
  const rawBody = await readRawBody(request);
  return rawBody ? JSON.parse(rawBody) : {};
}

function getMethod(request) {
  return request.method || "GET";
}

function getPath(request) {
  if (request.path) {
    return request.path;
  }

  if (request.url) {
    return new URL(request.url, "http://localhost").pathname;
  }

  return "/";
}

function getHeaders(request) {
  return request.headers ?? {};
}

export function createProxyRelayHandler({ secret = process.env.PROXY_SECRET || "" } = {}) {
  const normalizedSecret = normalizeSecret(secret);

  return async function proxyRelayHandler(request, response) {
    const method = getMethod(request);
    const path = getPath(request);

    if (method === "GET" && path === "/health") {
      return json(response, 200, {
        ok: true,
        service: "hookhq-proxy-relay",
        timestamp: new Date().toISOString(),
      });
    }

    if (method !== "POST" || path !== "/proxy") {
      return json(response, 404, { error: "Not Found" });
    }

    if (!isAuthorized(getHeaders(request).authorization, normalizedSecret)) {
      return json(response, 401, { error: "Unauthorized" });
    }

    try {
      const body = await readJsonBody(request);
      const targetUrl = typeof body.url === "string" ? body.url : "";

      if (!targetUrl) {
        return json(response, 400, { error: "Target URL is required" });
      }

      const startedAt = Date.now();
      const upstream = await fetch(targetUrl, {
        method: typeof body.method === "string" ? body.method : "POST",
        headers: typeof body.headers === "object" && body.headers ? body.headers : {},
        body: body.body === undefined ? undefined : JSON.stringify(body.body),
      });
      const responseBody = await upstream.text();

      return json(response, 200, {
        success: upstream.ok,
        status: upstream.status,
        headers: Object.fromEntries(upstream.headers.entries()),
        body: responseBody,
        responseTime: Date.now() - startedAt,
      });
    } catch (error) {
      return json(response, 502, {
        success: false,
        error: error instanceof Error ? error.message : "Proxy request failed",
      });
    }
  };
}
