import { publicApiFetch } from "@/lib/publicApi/utils";

type EndpointBase = {
  id: string;
  environmentId: string;
  name: string;
  description?: string | null;
  eventTypes: string[];
  enabled: boolean;
  retry: {
    strategy: "none" | "fixed" | "linear" | "exponential";
    maxAttempts: number;
    baseDelaySeconds: number;
    maxDelaySeconds: number;
    jitterFactor: number;
  };
  autoDisable: {
    enabled: boolean;
    threshold: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type WebhookEndpoint = EndpointBase & {
  destinationType: "webhook";
  destination: {
    url: string;
    timeoutMs?: number;
    hasCustomHeaders: boolean;
    proxyGroupId?: string | null;
  };
};

export type SqsEndpoint = EndpointBase & {
  destinationType: "sqs";
  destination: {
    queueUrl: string;
    region: string;
    accessKeyId: string;
    hasSecretAccessKey: boolean;
    delaySeconds?: number;
    messageGroupId?: string;
    messageDeduplicationId?: string;
  };
};

export type PubSubEndpoint = EndpointBase & {
  destinationType: "pubsub";
  destination: {
    topicName: string;
    hasServiceAccountJson: boolean;
    attributes?: Record<string, string>;
    orderingKey?: string;
  };
};

export type Endpoint = WebhookEndpoint | SqsEndpoint | PubSubEndpoint;

export type EndpointWriteDestination =
  | {
      url: string;
      timeoutMs?: number;
      customHeaders?: Record<string, string>;
      proxyGroupId?: string | null;
    }
  | {
      queueUrl: string;
      region: string;
      accessKeyId: string;
      secretAccessKey?: string;
      delaySeconds?: number;
      messageGroupId?: string;
      messageDeduplicationId?: string;
    }
  | {
      topicName: string;
      serviceAccountJson?: string;
      attributes?: Record<string, string>;
      orderingKey?: string;
    };

export type EndpointWritePayload = {
  name: string;
  description?: string;
  eventTypes?: string[];
  destinationType: "webhook" | "sqs" | "pubsub";
  destination: EndpointWriteDestination;
  enabled: boolean;
  retry: Partial<Endpoint["retry"]>;
  autoDisable?: Partial<Endpoint["autoDisable"]>;
};

export type EndpointUpdatePayload = Partial<{
  name: string;
  description: string;
  eventTypes: string[];
  destinationType: "webhook" | "sqs" | "pubsub";
  destination: EndpointWriteDestination;
  enabled: boolean;
  retry: Partial<Endpoint["retry"]>;
  autoDisable: Partial<Endpoint["autoDisable"]>;
}>;

export interface EndpointGroup {
  id: string;
  environmentId: string;
  name: string;
  description?: string | null;
  endpointIds: string[];
  eventTypes: string[];
  proxyGroupId?: string | null;
  enabled: boolean;
  failureAlerts: {
    enabled: boolean;
    threshold: number;
    windowMinutes: number;
    endpointIds: string[];
    channelType: "webhook" | "slack";
    destinationUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EventType {
  id: string;
  environmentId: string;
  name: string;
  description?: string | null;
  schema?: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyGroup {
  id: string;
  name: string;
  description?: string;
  loadBalancingStrategy: string;
  isActive: boolean;
}

export type ErrorBody = {
  error?: string;
  message?: string;
};

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response =
    typeof input === "string" && input.startsWith("/") ? await publicApiFetch(input, init) : await fetch(input, init);

  if (!response.ok) {
    let message = "Request failed";

    try {
      const errorBody = (await response.json()) as ErrorBody;
      message = errorBody.message || errorBody.error || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchEndpoints() {
  const data = await requestJson<{ endpoints: Endpoint[] }>("/endpoints");
  return data.endpoints;
}

export async function createEndpoint(payload: EndpointWritePayload) {
  return requestJson<Endpoint>("/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateEndpoint(id: string, payload: EndpointUpdatePayload) {
  const data = await requestJson<{ message: string; endpoint: Endpoint }>(`/endpoints/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.endpoint;
}

export async function deleteEndpoint(id: string) {
  await requestJson(`/endpoints/${id}`, { method: "DELETE" });
}

export async function fetchEndpointGroups() {
  const data = await requestJson<{ endpointGroups: EndpointGroup[] }>("/endpoint-groups");
  return data.endpointGroups;
}

export async function createEndpointGroup(payload: {
  name: string;
  description?: string;
  endpointIds: string[];
  eventTypes?: string[];
  proxyGroupId?: string | null;
  enabled: boolean;
  failureAlerts?: Partial<EndpointGroup["failureAlerts"]>;
}) {
  return requestJson<EndpointGroup>("/endpoint-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateEndpointGroup(
  id: string,
  payload: Partial<
    Pick<
      EndpointGroup,
      "name" | "description" | "endpointIds" | "eventTypes" | "proxyGroupId" | "enabled" | "failureAlerts"
    >
  >
) {
  const data = await requestJson<{ message: string; group: EndpointGroup }>(`/endpoint-groups/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.group;
}

export async function deleteEndpointGroup(id: string) {
  await requestJson(`/endpoint-groups/${id}`, { method: "DELETE" });
}

export async function fetchEventTypes() {
  const data = await requestJson<{ eventTypes: EventType[] }>("/event-types");
  return data.eventTypes;
}

export async function createEventType(payload: {
  name: string;
  description?: string;
  schema?: Record<string, unknown> | null;
  enabled: boolean;
}) {
  return requestJson<EventType>("/event-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateEventType(
  id: string,
  payload: Partial<Pick<EventType, "name" | "description" | "schema" | "enabled">>
) {
  const data = await requestJson<{ message: string; eventType: EventType }>(`/event-types/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.eventType;
}

export async function deleteEventType(id: string) {
  await requestJson(`/event-types/${id}`, { method: "DELETE" });
}

export async function fetchProxyGroups() {
  const data = await requestJson<{ proxyGroups: ProxyGroup[] }>("/proxy-groups?active=true");
  return data.proxyGroups ?? [];
}
