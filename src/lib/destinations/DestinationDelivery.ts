import { webhookAttempts, endpoints, proxyServers, proxyGroups } from "@/db/webhooks.schema";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "@/db/schema";
import { sendToPubSub } from "@/lib/destinations/pubsub";
import { sendToSqs } from "@/lib/destinations/sqs";
import { chooseProxyServer, decryptProxySecret, getProxyRelayUrl } from "@/lib/proxy";
import type { DeliveryMessage } from "@/lib/queue/types";
import type { DestinationConfig, WebhookDestinationConfig } from "@/lib/destinations/types";

interface DeliveryResult {
  endpointId: string;
  success: boolean;
  error?: string;
  responseTime?: number;
}

interface EndpointData {
  id: string;
  url: string;
  environmentId: string;
  proxyGroupId?: string | null;
  timeoutMs?: number;
  headers?: string | null;
  isActive: boolean;
}

interface ProxyData {
  id: string;
  url: string;
  secret: string;
  environmentId: string;
  isActive: boolean;
}

interface ProxyGroupData {
  id: string;
  proxyIds: string;
  loadBalancingStrategy: string;
  isActive: boolean;
  environmentId: string;
  servers: ProxyData[];
}

export class DestinationDelivery {
  private message: DeliveryMessage;
  private startTime: number;
  private env: CloudflareEnv;
  private attempts: number;

  constructor(message: DeliveryMessage, env: CloudflareEnv) {
    this.message = message;
    this.startTime = Date.now();
    this.env = env;
    this.attempts = 0;
  }

  async setAttempts(attempts: number) {
    this.attempts = attempts;
  }

  private async getPayload(): Promise<unknown> {
    if (this.message.payload !== null && this.message.payload !== undefined) {
      return this.message.payload;
    }

    if (this.message.payloadKey) {
      const payloadData = await this.env.KV.get(this.message.payloadKey);
      if (payloadData) {
        await this.extendPayloadTTL();
        return JSON.parse(payloadData);
      }
      throw new Error(`Payload not found in KV: ${this.message.payloadKey}`);
    }

    throw new Error("No payload available in message or KV");
  }

  private async extendPayloadTTL(): Promise<void> {
    if (!this.message.payloadKey) return;

    try {
      const payloadData = await this.env.KV.get(this.message.payloadKey);
      if (payloadData) {
        await this.env.KV.put(this.message.payloadKey, payloadData, {
          expirationTtl: 60 * 60 * 24 * 7,
        });
      }
    } catch (error) {
      console.error("Error extending payload TTL:", error);
    }
  }

  async send(endpointId: string): Promise<DeliveryResult> {
    try {
      const endpointData = await this.getEndpointWithCache(endpointId);
      if (!endpointData) {
        throw new Error(`Endpoint ${endpointId} not found`);
      }

      if (!endpointData.isActive) {
        throw new Error(`Endpoint ${endpointId} is not active`);
      }

      if (this.message.destination.type === "sqs") {
        return await this.sendToSqs(endpointData.id);
      }

      if (this.message.destination.type === "pubsub") {
        return await this.sendToPubSub(endpointData.id);
      }

      return this.message.destination.proxyGroupId
        ? await this.sendViaProxy(endpointData)
        : await this.sendWebhookDirect(endpointData);
    } catch (error) {
      const responseTime = Date.now() - this.startTime;
      await this.logAttempt(endpointId, {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        responseTime,
        endpointId,
      });

      return {
        endpointId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        responseTime,
      };
    }
  }

  private async sendViaProxy(endpointData: EndpointData): Promise<DeliveryResult> {
    const destination = this.message.destination as WebhookDestinationConfig;
    const selectedProxy = await this.selectProxy(destination.proxyGroupId!);
    if (!selectedProxy) {
      return this.sendWebhookDirect(endpointData);
    }

    const payload = await this.getPayload();
    const proxyRequest = {
      url: destination.url,
      method: "POST",
      headers: this.buildHeaders(destination),
      body: payload,
    };

    const proxySecret = await decryptProxySecret(selectedProxy.secret, this.env);
    if (!proxySecret) {
      throw new Error("Proxy secret could not be decrypted");
    }

    const response = await fetch(getProxyRelayUrl(selectedProxy.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "HookHQ/1.0",
        Authorization: `Bearer ${proxySecret}`,
      },
      body: JSON.stringify(proxyRequest),
      signal: AbortSignal.timeout(destination.timeoutMs),
    });

    const responseTime = Date.now() - this.startTime;
    const responseBody = await response.text();
    let proxyResponse: Record<string, unknown>;
    try {
      proxyResponse = JSON.parse(responseBody) as Record<string, unknown>;
    } catch {
      proxyResponse = { success: false, error: "Invalid proxy response" };
    }

    const result: DeliveryResult = {
      endpointId: endpointData.id,
      success: Boolean(proxyResponse.success),
      responseTime: Number(proxyResponse.responseTime ?? responseTime),
    };

    if (!result.success) {
      result.error = String(proxyResponse.error ?? `HTTP ${response.status}: ${responseBody}`);
    }

    await this.logAttempt(endpointData.id, result, {
      requestUrl: destination.url,
      requestMethod: "POST",
      requestHeaders: JSON.stringify(proxyRequest.headers),
      requestBody: JSON.stringify(payload),
      responseStatus: Number(proxyResponse.status ?? response.status),
      responseHeaders: JSON.stringify(proxyResponse.headers ?? Object.fromEntries(response.headers.entries())),
      responseBody,
      status: result.success ? "delivered" : "failed",
      errorMessage: result.error,
    });

    return result;
  }

  private async sendWebhookDirect(endpointData: EndpointData): Promise<DeliveryResult> {
    const destination = this.message.destination as WebhookDestinationConfig;
    const headers = this.buildHeaders(destination);
    const payload = await this.getPayload();
    const response = await fetch(destination.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(destination.timeoutMs),
    });

    const responseTime = Date.now() - this.startTime;
    const responseBody = await response.text();
    const result: DeliveryResult = {
      endpointId: endpointData.id,
      success: response.ok,
      responseTime,
    };

    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${responseBody}`;
    }

    await this.logAttempt(endpointData.id, result, {
      requestUrl: destination.url,
      requestMethod: "POST",
      requestHeaders: JSON.stringify(headers),
      requestBody: JSON.stringify(payload),
      responseStatus: response.status,
      responseHeaders: JSON.stringify(Object.fromEntries(response.headers.entries())),
      responseBody: responseBody.length > 1000 ? `${responseBody.slice(0, 1000)}...` : responseBody,
      status: response.ok ? "delivered" : "failed",
      errorMessage: result.error,
    });

    return result;
  }

  private async sendToSqs(endpointId: string): Promise<DeliveryResult> {
    const destination = this.message.destination;
    if (destination.type !== "sqs") {
      throw new Error("Invalid destination type for SQS delivery");
    }

    const payload = await this.getPayload();
    const response = await sendToSqs(destination, payload, this.message.idempotencyKey);
    const responseTime = Date.now() - this.startTime;
    const result: DeliveryResult = {
      endpointId,
      success: response.ok,
      responseTime,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.body}`,
    };

    await this.logAttempt(endpointId, result, {
      requestUrl: response.requestUrl,
      requestMethod: "POST",
      requestHeaders: JSON.stringify({ "Content-Type": "application/x-www-form-urlencoded" }),
      requestBody: JSON.stringify(payload),
      responseStatus: response.status,
      responseBody: response.body,
      status: response.ok ? "delivered" : "failed",
      errorMessage: result.error,
    });

    return result;
  }

  private async sendToPubSub(endpointId: string): Promise<DeliveryResult> {
    const destination = this.message.destination;
    if (destination.type !== "pubsub") {
      throw new Error("Invalid destination type for Pub/Sub delivery");
    }

    const payload = await this.getPayload();
    const response = await sendToPubSub(destination, payload, this.env, this.message.idempotencyKey);
    const responseTime = Date.now() - this.startTime;
    const result: DeliveryResult = {
      endpointId,
      success: response.ok,
      responseTime,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.body}`,
    };

    await this.logAttempt(endpointId, result, {
      requestUrl: response.requestUrl,
      requestMethod: "POST",
      requestHeaders: JSON.stringify({ "Content-Type": "application/json" }),
      requestBody: JSON.stringify(payload),
      responseStatus: response.status,
      responseBody: response.body,
      status: response.ok ? "delivered" : "failed",
      errorMessage: result.error,
    });

    return result;
  }

  private buildHeaders(destination: WebhookDestinationConfig): HeadersInit {
    return {
      "Content-Type": "application/json",
      "User-Agent": "HookHQ/1.0",
      ...(destination.customHeaders ?? {}),
      ...(this.message.idempotencyKey ? { "Idempotency-Key": this.message.idempotencyKey } : {}),
    };
  }

  private async getEndpointWithCache(endpointId: string) {
    const db = drizzle(this.env.DATABASE, { schema });
    const endpoint = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
    return endpoint[0] ?? null;
  }

  private async selectProxy(proxyGroupId: string): Promise<ProxyData | null> {
    const db = drizzle(this.env.DATABASE, { schema });
    const group = await db
      .select()
      .from(proxyGroups)
      .where(and(eq(proxyGroups.id, proxyGroupId), eq(proxyGroups.isActive, true)))
      .limit(1);

    if (!group[0]) {
      return null;
    }

    const proxyIds = JSON.parse(group[0].proxyIds || "[]") as string[];
    if (proxyIds.length === 0) {
      return null;
    }

    const servers = await db
      .select()
      .from(proxyServers)
      .where(and(eq(proxyServers.isActive, true), eq(proxyServers.environmentId, group[0].environmentId)));
    const availableServers = servers.filter(server => proxyIds.includes(server.id));
    if (availableServers.length === 0) {
      return null;
    }

    return chooseProxyServer(this.env, group[0], availableServers);
  }

  private async logAttempt(
    endpointId: string,
    result: DeliveryResult,
    details?: Partial<typeof webhookAttempts.$inferInsert>
  ): Promise<void> {
    const db = drizzle(this.env.DATABASE, { schema });
    await db.insert(webhookAttempts).values({
      id: crypto.randomUUID(),
      messageId: this.message.id,
      endpointId,
      attemptNumber: this.attempts,
      requestUrl:
        details?.requestUrl ??
        (this.message.destination.type === "webhook"
          ? this.message.destination.url
          : this.message.destination.type === "sqs"
            ? this.message.destination.queueUrl
            : this.message.destination.topicName),
      requestMethod: details?.requestMethod ?? "POST",
      requestHeaders: details?.requestHeaders ?? null,
      requestBody: details?.requestBody ?? null,
      responseStatus: details?.responseStatus ?? null,
      responseHeaders: details?.responseHeaders ?? null,
      responseBody: details?.responseBody ?? null,
      responseTimeMs: result.responseTime ?? null,
      status: details?.status ?? (result.success ? "delivered" : "failed"),
      errorMessage: details?.errorMessage ?? result.error ?? null,
      attemptedAt: new Date(),
      completedAt: new Date(),
    });
  }
}
