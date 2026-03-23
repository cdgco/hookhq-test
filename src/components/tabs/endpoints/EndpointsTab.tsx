"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Edit, Globe, Hash, Plus, Power, PowerOff, Trash2, Users } from "lucide-react";
import EditableTemplate from "@/components/EditableTemplate";
import EventTypeSelector from "@/components/shared/EventTypeSelector";
import { EmptyStateCard, ErrorStateCard, LoadingStateCard } from "@/components/shared/resource-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createEndpoint,
  deleteEndpoint,
  fetchEndpoints,
  fetchEventTypes,
  type Endpoint,
  type EventType,
  updateEndpoint,
} from "@/lib/webhookApi";
import { getPublicApiUrl } from "@/lib/publicApi/utils";

type EndpointFormState = {
  name: string;
  description: string;
  eventTypes: string[];
  destinationType: "webhook" | "sqs" | "pubsub";
  target: string;
  sqsRegion: string;
  sqsAccessKeyId: string;
  sqsSecretAccessKey: string;
  sqsDelaySeconds: number;
  sqsMessageGroupId: string;
  pubsubServiceAccountJson: string;
  pubsubAttributes: string;
  pubsubOrderingKey: string;
  enabled: boolean;
  retryStrategy: "none" | "fixed" | "linear" | "exponential";
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  jitterFactor: number;
  autoDisableEnabled: boolean;
  autoDisableThreshold: number;
  timeoutMs: number;
  customHeaders: string;
  proxyGroupId: string;
};

interface ProxyGroup {
  id: string;
  name: string;
  description?: string;
  loadBalancingStrategy: string;
  isActive: boolean;
}

function getEndpointTarget(endpoint: Endpoint) {
  return endpoint.destinationType === "webhook"
    ? endpoint.destination.url
    : endpoint.destinationType === "sqs"
      ? endpoint.destination.queueUrl
      : endpoint.destination.topicName;
}

const initialFormState: EndpointFormState = {
  name: "",
  description: "",
  eventTypes: ["*"],
  destinationType: "webhook",
  target: "",
  sqsRegion: "",
  sqsAccessKeyId: "",
  sqsSecretAccessKey: "",
  sqsDelaySeconds: 0,
  sqsMessageGroupId: "",
  pubsubServiceAccountJson: "",
  pubsubAttributes: "",
  pubsubOrderingKey: "",
  enabled: true,
  retryStrategy: "exponential",
  maxAttempts: 3,
  baseDelaySeconds: 5,
  maxDelaySeconds: 300,
  jitterFactor: 0.2,
  autoDisableEnabled: false,
  autoDisableThreshold: 10,
  timeoutMs: 10_000,
  customHeaders: "",
  proxyGroupId: "none",
};

async function fetchProxyGroups() {
  const response = await fetch("/api/proxy-groups?active=true");

  if (!response.ok) {
    console.error("Failed to fetch proxy groups", response);
    return [];
  }

  try {
    const data = (await response.json()) as { proxyGroups: ProxyGroup[] };
    return data.proxyGroups;
  } catch {
    console.error("Failed to parse proxy groups", response);
    return [];
  }
}

function getEndpointPayload(formData: EndpointFormState, existingEndpoint: Endpoint | null) {
  const customHeaders = formData.customHeaders.trim()
    ? (JSON.parse(formData.customHeaders) as Record<string, string>)
    : undefined;

  return {
    name: formData.name.trim(),
    description: formData.description.trim() || undefined,
    eventTypes: formData.eventTypes,
    destinationType: formData.destinationType,
    destination:
      formData.destinationType === "webhook"
        ? {
            url: formData.target.trim(),
            timeoutMs: formData.timeoutMs,
            ...(customHeaders !== undefined || !existingEndpoint ? { customHeaders } : {}),
            proxyGroupId: formData.proxyGroupId === "none" ? undefined : formData.proxyGroupId,
          }
        : formData.destinationType === "sqs"
          ? {
              queueUrl: formData.target.trim(),
              region: formData.sqsRegion.trim(),
              accessKeyId: formData.sqsAccessKeyId.trim(),
              ...(formData.sqsSecretAccessKey.trim() || !existingEndpoint
                ? { secretAccessKey: formData.sqsSecretAccessKey.trim() }
                : {}),
              delaySeconds: formData.sqsDelaySeconds || undefined,
              messageGroupId: formData.sqsMessageGroupId.trim() || undefined,
            }
          : {
              topicName: formData.target.trim(),
              ...(formData.pubsubServiceAccountJson.trim() || !existingEndpoint
                ? { serviceAccountJson: formData.pubsubServiceAccountJson.trim() }
                : {}),
              attributes: formData.pubsubAttributes.trim()
                ? (JSON.parse(formData.pubsubAttributes) as Record<string, string>)
                : undefined,
              orderingKey: formData.pubsubOrderingKey.trim() || undefined,
            },
    enabled: formData.enabled,
    retry: {
      strategy: formData.retryStrategy,
      maxAttempts: formData.maxAttempts,
      baseDelaySeconds: formData.baseDelaySeconds,
      maxDelaySeconds: formData.maxDelaySeconds,
      jitterFactor: formData.jitterFactor,
    },
    autoDisable: {
      enabled: formData.autoDisableEnabled,
      threshold: formData.autoDisableThreshold,
    },
  };
}

export default function EndpointsTab() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EndpointFormState>(initialFormState);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [nextEndpoints, nextProxyGroups, nextEventTypes] = await Promise.all([
          fetchEndpoints(),
          fetchProxyGroups(),
          fetchEventTypes(),
        ]);
        if (!isMounted) return;
        setEndpoints(nextEndpoints);
        setProxyGroups(nextProxyGroups);
        setEventTypes(nextEventTypes);
      } catch (nextError) {
        if (!isMounted) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load endpoints");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  function resetForm() {
    setFormData(initialFormState);
    setEditingEndpoint(null);
  }

  function openCreateDialog() {
    resetForm();
    setCreateDialogOpen(true);
  }

  function openEditDialog(endpoint: Endpoint) {
    setFormData({
      name: endpoint.name,
      description: endpoint.description || "",
      eventTypes: endpoint.eventTypes,
      destinationType: endpoint.destinationType,
      target: getEndpointTarget(endpoint),
      sqsRegion: endpoint.destinationType === "sqs" ? endpoint.destination.region : "",
      sqsAccessKeyId: endpoint.destinationType === "sqs" ? endpoint.destination.accessKeyId : "",
      sqsSecretAccessKey: "",
      sqsDelaySeconds: endpoint.destinationType === "sqs" ? (endpoint.destination.delaySeconds ?? 0) : 0,
      sqsMessageGroupId: endpoint.destinationType === "sqs" ? (endpoint.destination.messageGroupId ?? "") : "",
      pubsubServiceAccountJson: "",
      pubsubAttributes:
        endpoint.destinationType === "pubsub" && endpoint.destination.attributes
          ? JSON.stringify(endpoint.destination.attributes, null, 2)
          : "",
      pubsubOrderingKey: endpoint.destinationType === "pubsub" ? (endpoint.destination.orderingKey ?? "") : "",
      enabled: endpoint.enabled,
      retryStrategy: endpoint.retry.strategy,
      maxAttempts: endpoint.retry.maxAttempts,
      baseDelaySeconds: endpoint.retry.baseDelaySeconds,
      maxDelaySeconds: endpoint.retry.maxDelaySeconds,
      jitterFactor: endpoint.retry.jitterFactor,
      autoDisableEnabled: endpoint.autoDisable.enabled,
      autoDisableThreshold: endpoint.autoDisable.threshold,
      timeoutMs: endpoint.destinationType === "webhook" ? (endpoint.destination.timeoutMs ?? 10000) : 10000,
      customHeaders: "",
      proxyGroupId: endpoint.destinationType === "webhook" ? endpoint.destination.proxyGroupId || "none" : "none",
    });
    setEditingEndpoint(endpoint);
    setCreateDialogOpen(true);
  }

  async function handleSubmit() {
    try {
      setError(null);
      const payload = getEndpointPayload(formData, editingEndpoint);

      if (editingEndpoint) {
        const updatedEndpoint = await updateEndpoint(editingEndpoint.id, payload);
        setEndpoints(current =>
          current.map(endpoint => (endpoint.id === editingEndpoint.id ? updatedEndpoint : endpoint))
        );
      } else {
        const createdEndpoint = await createEndpoint(payload);
        setEndpoints(current => [...current, createdEndpoint]);
      }

      setCreateDialogOpen(false);
      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save endpoint");
    }
  }

  async function handleToggleEndpoint(endpoint: Endpoint) {
    try {
      setError(null);
      const updatedEndpoint = await updateEndpoint(endpoint.id, { enabled: !endpoint.enabled });
      setEndpoints(current => current.map(item => (item.id === endpoint.id ? updatedEndpoint : item)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update endpoint");
    }
  }

  async function handleDeleteEndpoint(id: string) {
    if (!confirm("Are you sure you want to delete this endpoint?")) return;

    try {
      setError(null);
      await deleteEndpoint(id);
      setEndpoints(current => current.filter(endpoint => endpoint.id !== id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete endpoint");
    }
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to copy value");
    }
  }

  if (loading) {
    return <LoadingStateCard />;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Endpoints</h2>
          <p className="text-muted-foreground">Manage your event endpoints</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEndpoint ? "Edit Endpoint" : "Create New Endpoint"}</DialogTitle>
              <DialogDescription>
                {editingEndpoint
                  ? "Update your event endpoint configuration"
                  : "Add a new event endpoint to receive notifications"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint-name">Name *</Label>
                  <Input
                    id="endpoint-name"
                    value={formData.name}
                    onChange={event => setFormData(current => ({ ...current, name: event.target.value }))}
                    placeholder="My Endpoint"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endpoint-target">
                    {formData.destinationType === "webhook"
                      ? "URL *"
                      : formData.destinationType === "sqs"
                        ? "Queue URL *"
                        : "Topic Name *"}
                  </Label>
                  <Input
                    id="endpoint-target"
                    value={formData.target}
                    onChange={event => setFormData(current => ({ ...current, target: event.target.value }))}
                    placeholder={
                      formData.destinationType === "webhook"
                        ? "https://example.com/webhook"
                        : formData.destinationType === "sqs"
                          ? "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
                          : "my-topic"
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpoint-destination-type">Destination Type</Label>
                <Select
                  value={formData.destinationType}
                  onValueChange={(value: EndpointFormState["destinationType"]) =>
                    setFormData(current => ({ ...current, destinationType: value }))
                  }
                >
                  <SelectTrigger id="endpoint-destination-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="sqs">Amazon SQS</SelectItem>
                    <SelectItem value="pubsub">Google Pub/Sub</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpoint-description">Description</Label>
                <Input
                  id="endpoint-description"
                  value={formData.description}
                  onChange={event => setFormData(current => ({ ...current, description: event.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpoint-event-types">Subscribed Event Types</Label>
                <EventTypeSelector
                  eventTypes={eventTypes}
                  value={formData.eventTypes}
                  onChange={value => setFormData(current => ({ ...current, eventTypes: value }))}
                />
                <p className="text-sm text-muted-foreground">
                  Choose which event types should trigger this destination. “All event types” includes events sent
                  without a type.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint-retry-policy">Retry Policy</Label>
                  <Select
                    value={formData.retryStrategy}
                    onValueChange={(value: EndpointFormState["retryStrategy"]) =>
                      setFormData(current => ({ ...current, retryStrategy: value }))
                    }
                  >
                    <SelectTrigger id="endpoint-retry-policy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="exponential">Exponential</SelectItem>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpoint-max-attempts">Max Attempts</Label>
                  <Input
                    id="endpoint-max-attempts"
                    type="number"
                    min={1}
                    value={formData.maxAttempts}
                    onChange={event =>
                      setFormData(current => ({
                        ...current,
                        maxAttempts: Number.parseInt(event.target.value || "1", 10),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpoint-base-delay">Base Delay (s)</Label>
                  <Input
                    id="endpoint-base-delay"
                    type="number"
                    min={1}
                    value={formData.baseDelaySeconds}
                    onChange={event =>
                      setFormData(current => ({
                        ...current,
                        baseDelaySeconds: Number.parseInt(event.target.value || "1", 10),
                      }))
                    }
                  />
                </div>
              </div>

              {formData.destinationType === "pubsub" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-pubsub-ordering-key">Ordering Key</Label>
                    <Input
                      id="endpoint-pubsub-ordering-key"
                      value={formData.pubsubOrderingKey}
                      onChange={event =>
                        setFormData(current => ({ ...current, pubsubOrderingKey: event.target.value }))
                      }
                      placeholder="Optional ordering key"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="endpoint-pubsub-service-account-json">Service Account JSON</Label>
                    <Textarea
                      id="endpoint-pubsub-service-account-json"
                      value={formData.pubsubServiceAccountJson}
                      onChange={event =>
                        setFormData(current => ({ ...current, pubsubServiceAccountJson: event.target.value }))
                      }
                      placeholder={`{"type":"service_account","project_id":"my-project",...}`}
                      rows={4}
                    />
                    {editingEndpoint?.destinationType === "pubsub" &&
                    editingEndpoint.destination.hasServiceAccountJson ? (
                      <p className="text-sm text-muted-foreground">
                        A service account is already stored. Paste a new JSON document only if you want to replace it.
                      </p>
                    ) : null}
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="endpoint-pubsub-attributes">Attributes (JSON)</Label>
                    <Textarea
                      id="endpoint-pubsub-attributes"
                      value={formData.pubsubAttributes}
                      onChange={event => setFormData(current => ({ ...current, pubsubAttributes: event.target.value }))}
                      placeholder={'{"source":"hookhq"}'}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint-auto-disable">Auto Disable</Label>
                  <Select
                    value={formData.autoDisableEnabled ? "enabled" : "disabled"}
                    onValueChange={value =>
                      setFormData(current => ({ ...current, autoDisableEnabled: value === "enabled" }))
                    }
                  >
                    <SelectTrigger id="endpoint-auto-disable">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disabled">Disabled</SelectItem>
                      <SelectItem value="enabled">Enabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpoint-auto-disable-threshold">Disable After Consecutive Failures</Label>
                  <Input
                    id="endpoint-auto-disable-threshold"
                    type="number"
                    min={1}
                    value={formData.autoDisableThreshold}
                    onChange={event =>
                      setFormData(current => ({
                        ...current,
                        autoDisableThreshold: Number.parseInt(event.target.value || "1", 10),
                      }))
                    }
                    disabled={!formData.autoDisableEnabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint-max-delay">Max Delay (s)</Label>
                  <Input
                    id="endpoint-max-delay"
                    type="number"
                    min={1}
                    value={formData.maxDelaySeconds}
                    onChange={event =>
                      setFormData(current => ({
                        ...current,
                        maxDelaySeconds: Number.parseInt(event.target.value || "1", 10),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpoint-jitter">Jitter</Label>
                  <Input
                    id="endpoint-jitter"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={formData.jitterFactor}
                    onChange={event =>
                      setFormData(current => ({
                        ...current,
                        jitterFactor: Number.parseFloat(event.target.value || "0"),
                      }))
                    }
                  />
                </div>

                {formData.destinationType === "webhook" ? (
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-timeout">Timeout (ms)</Label>
                    <Input
                      id="endpoint-timeout"
                      type="number"
                      min={100}
                      value={formData.timeoutMs}
                      onChange={event =>
                        setFormData(current => ({
                          ...current,
                          timeoutMs: Number.parseInt(event.target.value || "100", 10),
                        }))
                      }
                    />
                  </div>
                ) : formData.destinationType === "sqs" ? (
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-sqs-delay">SQS Delay (s)</Label>
                    <Input
                      id="endpoint-sqs-delay"
                      type="number"
                      min={0}
                      max={900}
                      value={formData.sqsDelaySeconds}
                      onChange={event =>
                        setFormData(current => ({
                          ...current,
                          sqsDelaySeconds: Number.parseInt(event.target.value || "0", 10),
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>

              {formData.destinationType === "webhook" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-custom-headers">Custom Headers (JSON)</Label>
                    <Textarea
                      id="endpoint-custom-headers"
                      className="min-h-[100px] font-mono text-sm"
                      value={formData.customHeaders}
                      onChange={event => setFormData(current => ({ ...current, customHeaders: event.target.value }))}
                      placeholder='{"Authorization":"Bearer token","X-Custom":"value"}'
                    />
                    {editingEndpoint?.destinationType === "webhook" && editingEndpoint.destination.hasCustomHeaders ? (
                      <p className="text-sm text-muted-foreground">
                        Custom headers are already stored. Leave this blank to keep them, or enter new JSON to replace
                        them.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endpoint-proxy-group">Proxy Group (Optional)</Label>
                    <Select
                      value={formData.proxyGroupId}
                      onValueChange={value => setFormData(current => ({ ...current, proxyGroupId: value }))}
                    >
                      <SelectTrigger id="endpoint-proxy-group">
                        <SelectValue placeholder="Select proxy group for static IP delivery" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Direct Delivery (No Proxy)</SelectItem>
                        {proxyGroups.map(group => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name} ({group.loadBalancingStrategy})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : formData.destinationType === "sqs" ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-sqs-region">AWS Region</Label>
                    <Input
                      id="endpoint-sqs-region"
                      value={formData.sqsRegion}
                      onChange={event => setFormData(current => ({ ...current, sqsRegion: event.target.value }))}
                      placeholder="us-east-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-sqs-access-key">Access Key ID</Label>
                    <Input
                      id="endpoint-sqs-access-key"
                      value={formData.sqsAccessKeyId}
                      onChange={event => setFormData(current => ({ ...current, sqsAccessKeyId: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-sqs-secret">Secret Access Key</Label>
                    <Input
                      id="endpoint-sqs-secret"
                      type="password"
                      value={formData.sqsSecretAccessKey}
                      onChange={event =>
                        setFormData(current => ({ ...current, sqsSecretAccessKey: event.target.value }))
                      }
                    />
                    {editingEndpoint?.destinationType === "sqs" && editingEndpoint.destination.hasSecretAccessKey ? (
                      <p className="text-sm text-muted-foreground">
                        A secret access key is already stored. Leave this blank to keep it, or enter a new value to
                        replace it.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint-sqs-group-id">FIFO Group ID</Label>
                    <Input
                      id="endpoint-sqs-group-id"
                      value={formData.sqsMessageGroupId}
                      onChange={event =>
                        setFormData(current => ({ ...current, sqsMessageGroupId: event.target.value }))
                      }
                      placeholder="Required for FIFO queues"
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>{editingEndpoint ? "Update" : "Create"} Endpoint</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <ErrorStateCard message={error} />}

      {endpoints.length === 0 ? (
        <EmptyStateCard
          icon={Globe}
          title="No Endpoints"
          description="Create your first webhook endpoint to start receiving notifications."
        >
          <code className="m-4 min-w-[500px] rounded-md bg-neutral-600 p-4 text-sm text-white dark:bg-neutral-800">
            <EditableTemplate
              template={`curl ${getPublicApiUrl("endpoints", true)} \\
-H 'Content-Type: application/json' \\
-H 'Authorization: Bearer {{apiKey="API KEY"}}' \\
-d '{
  "name": "My First Destination",
  "destinationType": "webhook",
  "destination": { "url": "https://example.com/webhook" }
}'`}
              className="whitespace-pre"
            />
          </code>
        </EmptyStateCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {endpoints.map(endpoint => (
            <Card key={endpoint.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Globe className="h-4 w-4" />
                      {endpoint.name}
                    </CardTitle>
                    <CardDescription>{endpoint.description || "No description"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(endpoint)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEndpoint(endpoint.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="mb-1 text-sm font-medium">
                      {endpoint.destinationType === "webhook"
                        ? "URL"
                        : endpoint.destinationType === "sqs"
                          ? "Queue"
                          : "Topic"}
                    </h4>
                    <div className="break-all text-sm text-muted-foreground">{getEndpointTarget(endpoint)}</div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3 w-3 text-gray-400" />
                      <span className="text-muted-foreground">Endpoint ID:</span>
                      <span className="flex items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-xs">
                        {endpoint.id}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-gray-200"
                          onClick={() => copyToClipboard(endpoint.id, `endpoint-${endpoint.id}`)}
                        >
                          {copiedId === `endpoint-${endpoint.id}` ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </span>
                    </div>

                    {endpoint.destinationType === "webhook" && endpoint.destination.proxyGroupId && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-muted-foreground">Proxy Group ID:</span>
                        <span className="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 font-mono text-xs dark:bg-blue-900">
                          {endpoint.destination.proxyGroupId}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-blue-200"
                            onClick={() =>
                              copyToClipboard(
                                endpoint.destination.proxyGroupId!,
                                `proxy-${endpoint.destination.proxyGroupId}`
                              )
                            }
                          >
                            {copiedId === `proxy-${endpoint.destination.proxyGroupId}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={endpoint.enabled ? "default" : "secondary"}>
                        {endpoint.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant="outline">{endpoint.destinationType}</Badge>
                      <Badge variant="outline">{endpoint.retry.strategy}</Badge>
                      <Badge variant="outline">
                        {endpoint.eventTypes.includes("*") ? "All event types" : endpoint.eventTypes.join(", ")}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleEndpoint(endpoint)}>
                      {endpoint.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
