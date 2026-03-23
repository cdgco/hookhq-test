import { getTokenFromGCPServiceAccount } from "@sagi.io/workers-jwt";
import type { PubSubDestinationConfig } from "@/lib/destinations/types";

const PUBSUB_API_AUDIENCE = "https://pubsub.googleapis.com/";
const PUBSUB_API_URL = "https://pubsub.googleapis.com/v1";

type ServiceAccountJson = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
};

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getAccessToken(config: PubSubDestinationConfig, env: CloudflareEnv): Promise<string> {
  const serviceAccount = parseServiceAccountJson(config.serviceAccountJson);
  const cacheKey = `google:pubsub:token:${serviceAccount.client_email}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) {
    return cached;
  }

  const token = await getTokenFromGCPServiceAccount({
    serviceAccountJSON: serviceAccount,
    aud: PUBSUB_API_AUDIENCE,
    cryptoImpl: crypto,
  });

  await env.KV.put(cacheKey, token, { expirationTtl: 55 * 60 });
  return token;
}

function parseServiceAccountJson(serviceAccountJson: string): ServiceAccountJson {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("Pub/Sub service account JSON is not valid JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("project_id" in parsed) ||
    !("client_email" in parsed) ||
    !("private_key" in parsed)
  ) {
    throw new Error("Pub/Sub service account JSON is missing project_id, client_email, or private_key");
  }

  const serviceAccount = parsed as Partial<ServiceAccountJson>;

  return {
    type: serviceAccount.type ?? "service_account",
    project_id: String(serviceAccount.project_id),
    private_key_id: serviceAccount.private_key_id ?? "",
    private_key: String(serviceAccount.private_key),
    client_email: String(serviceAccount.client_email),
    client_id: serviceAccount.client_id ?? "",
    auth_uri: serviceAccount.auth_uri ?? "https://accounts.google.com/o/oauth2/auth",
    token_uri: serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url:
      serviceAccount.auth_provider_x509_cert_url ?? "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: serviceAccount.client_x509_cert_url ?? "",
  };
}

export async function sendToPubSub(
  config: PubSubDestinationConfig,
  payload: unknown,
  env: CloudflareEnv,
  idempotencyKey?: string
) {
  const accessToken = await getAccessToken(config, env);
  const serviceAccount = parseServiceAccountJson(config.serviceAccountJson);
  const topicPath = `projects/${serviceAccount.project_id}/topics/${config.topicName}`;
  const response = await fetch(`${PUBSUB_API_URL}/${topicPath}:publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messages: [
        {
          data: toBase64Url(JSON.stringify(payload)),
          attributes: {
            ...(config.attributes ?? {}),
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
          orderingKey: config.orderingKey,
        },
      ],
    }),
  });

  const responseText = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body: responseText,
    requestUrl: response.url,
  };
}
