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
import {
  createEndpointGroup,
  deleteEndpointGroup,
  fetchProxyGroups,
  fetchEndpointGroups,
  fetchEndpoints,
  fetchEventTypes,
  type Endpoint,
  type EndpointGroup,
  type EventType,
  type ProxyGroup,
  updateEndpointGroup,
} from "@/lib/webhookApi";
import { getPublicApiUrl } from "@/lib/publicApi/utils";

type EndpointGroupFormState = {
  name: string;
  description: string;
  endpointIds: string[];
  eventTypes: string[];
  proxyGroupId: string;
  enabled: boolean;
  failureAlertsEnabled: boolean;
  failureAlertThreshold: number;
  failureAlertWindowMinutes: number;
  failureAlertChannelType: "webhook" | "slack";
  failureAlertDestinationUrl: string;
  failureAlertEndpointIds: string[];
};

const initialFormState: EndpointGroupFormState = {
  name: "",
  description: "",
  endpointIds: [],
  eventTypes: ["*"],
  proxyGroupId: "none",
  enabled: true,
  failureAlertsEnabled: false,
  failureAlertThreshold: 5,
  failureAlertWindowMinutes: 60,
  failureAlertChannelType: "webhook",
  failureAlertDestinationUrl: "",
  failureAlertEndpointIds: [],
};

function getEndpointTarget(endpoint: Endpoint) {
  return endpoint.destinationType === "webhook"
    ? endpoint.destination.url
    : endpoint.destinationType === "sqs"
      ? endpoint.destination.queueUrl
      : endpoint.destination.topicName;
}

export default function EndpointGroupsTab() {
  const [endpointGroups, setEndpointGroups] = useState<EndpointGroup[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EndpointGroup | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EndpointGroupFormState>(initialFormState);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [nextEndpointGroups, nextEndpoints, nextEventTypes, nextProxyGroups] = await Promise.all([
          fetchEndpointGroups(),
          fetchEndpoints(),
          fetchEventTypes(),
          fetchProxyGroups(),
        ]);
        if (!isMounted) return;
        setEndpointGroups(nextEndpointGroups);
        setEndpoints(nextEndpoints);
        setEventTypes(nextEventTypes);
        setProxyGroups(nextProxyGroups);
      } catch (nextError) {
        if (!isMounted) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load endpoint groups");
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
    setEditingGroup(null);
  }

  function openCreateDialog() {
    resetForm();
    setCreateDialogOpen(true);
  }

  function openEditDialog(group: EndpointGroup) {
    setFormData({
      name: group.name,
      description: group.description || "",
      endpointIds: group.endpointIds,
      eventTypes: group.eventTypes,
      proxyGroupId: group.proxyGroupId || "none",
      enabled: group.enabled,
      failureAlertsEnabled: group.failureAlerts.enabled,
      failureAlertThreshold: group.failureAlerts.threshold,
      failureAlertWindowMinutes: group.failureAlerts.windowMinutes,
      failureAlertChannelType: group.failureAlerts.channelType,
      failureAlertDestinationUrl: group.failureAlerts.destinationUrl || "",
      failureAlertEndpointIds: group.failureAlerts.endpointIds,
    });
    setEditingGroup(group);
    setCreateDialogOpen(true);
  }

  async function handleSubmit() {
    try {
      setError(null);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        endpointIds: formData.endpointIds,
        eventTypes: formData.eventTypes,
        proxyGroupId: formData.proxyGroupId === "none" ? null : formData.proxyGroupId,
        enabled: formData.enabled,
        failureAlerts: {
          enabled: formData.failureAlertsEnabled,
          threshold: formData.failureAlertThreshold,
          windowMinutes: formData.failureAlertWindowMinutes,
          channelType: formData.failureAlertChannelType,
          destinationUrl: formData.failureAlertDestinationUrl,
          endpointIds: formData.failureAlertEndpointIds,
        },
      };

      if (editingGroup) {
        const updatedGroup = await updateEndpointGroup(editingGroup.id, payload);
        setEndpointGroups(current => current.map(group => (group.id === editingGroup.id ? updatedGroup : group)));
      } else {
        const createdGroup = await createEndpointGroup(payload);
        setEndpointGroups(current => [...current, createdGroup]);
      }

      setCreateDialogOpen(false);
      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save endpoint group");
    }
  }

  async function handleToggleGroup(group: EndpointGroup) {
    try {
      setError(null);
      const updatedGroup = await updateEndpointGroup(group.id, { enabled: !group.enabled });
      setEndpointGroups(current => current.map(item => (item.id === group.id ? updatedGroup : item)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update endpoint group");
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Are you sure you want to delete this endpoint group?")) return;

    try {
      setError(null);
      await deleteEndpointGroup(id);
      setEndpointGroups(current => current.filter(group => group.id !== id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete endpoint group");
    }
  }

  function toggleEndpointSelection(endpointId: string) {
    setFormData(current => ({
      ...current,
      endpointIds: current.endpointIds.includes(endpointId)
        ? current.endpointIds.filter(id => id !== endpointId)
        : [...current.endpointIds, endpointId],
    }));
  }

  function toggleAlertEndpointSelection(endpointId: string) {
    setFormData(current => ({
      ...current,
      failureAlertEndpointIds: current.failureAlertEndpointIds.includes(endpointId)
        ? current.failureAlertEndpointIds.filter(id => id !== endpointId)
        : [...current.failureAlertEndpointIds, endpointId],
    }));
  }

  function getEndpointName(endpointId: string) {
    return endpoints.find(endpoint => endpoint.id === endpointId)?.name || endpointId;
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
          <h2 className="text-2xl font-bold">Endpoint Groups</h2>
          <p className="text-muted-foreground">Group endpoints together for batch notifications</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingGroup ? "Edit Endpoint Group" : "Create New Endpoint Group"}</DialogTitle>
              <DialogDescription>
                {editingGroup
                  ? "Update your endpoint group configuration"
                  : "Create a group of endpoints to receive notifications together"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="endpoint-group-name">Name *</Label>
                <Input
                  id="endpoint-group-name"
                  value={formData.name}
                  onChange={event => setFormData(current => ({ ...current, name: event.target.value }))}
                  placeholder="My Endpoint Group"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpoint-group-description">Description</Label>
                <Input
                  id="endpoint-group-description"
                  value={formData.description}
                  onChange={event => setFormData(current => ({ ...current, description: event.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              <div className="space-y-2">
                <Label>Select Endpoints</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border p-2">
                  {endpoints.length === 0 ? (
                    <div className="py-4 text-center text-sm text-gray-500">
                      No endpoints available. Create endpoints first.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {endpoints.map(endpoint => (
                        <label key={endpoint.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.endpointIds.includes(endpoint.id)}
                            onChange={() => toggleEndpointSelection(endpoint.id)}
                            className="rounded"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{endpoint.name}</div>
                            <div className="text-xs text-gray-500">{getEndpointTarget(endpoint)}</div>
                          </div>
                          <Badge variant={endpoint.enabled ? "default" : "secondary"}>
                            {endpoint.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-event-types">Subscribed Event Types</Label>
                <EventTypeSelector
                  eventTypes={eventTypes}
                  value={formData.eventTypes}
                  onChange={value => setFormData(current => ({ ...current, eventTypes: value }))}
                />
                <p className="text-sm text-muted-foreground">
                  Choose which event types this group accepts. “All event types” includes events sent without a type.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpoint-group-proxy-group">Proxy Group</Label>
                <select
                  id="endpoint-group-proxy-group"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.proxyGroupId}
                  onChange={event => setFormData(current => ({ ...current, proxyGroupId: event.target.value }))}
                >
                  <option value="none">No proxy override</option>
                  {proxyGroups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Webhook deliveries in this group will use this proxy group unless the individual endpoint already has
                  a proxy group assigned.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.failureAlertsEnabled}
                      onChange={event =>
                        setFormData(current => ({ ...current, failureAlertsEnabled: event.target.checked }))
                      }
                      className="rounded"
                    />
                    Enable failure alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Trigger Slack or webhook alerts when delivery failures cross the threshold.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-alert-url">Alert Destination URL</Label>
                  <Input
                    id="group-alert-url"
                    value={formData.failureAlertDestinationUrl}
                    onChange={event =>
                      setFormData(current => ({ ...current, failureAlertDestinationUrl: event.target.value }))
                    }
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-alert-threshold">Failure Threshold</Label>
                  <Input
                    id="group-alert-threshold"
                    type="number"
                    min={1}
                    value={formData.failureAlertThreshold}
                    onChange={event =>
                      setFormData(current => ({
                        ...current,
                        failureAlertThreshold: Number.parseInt(event.target.value || "1", 10),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-alert-window">Window (minutes)</Label>
                  <Input
                    id="group-alert-window"
                    type="number"
                    min={1}
                    value={formData.failureAlertWindowMinutes}
                    onChange={event =>
                      setFormData(current => ({
                        ...current,
                        failureAlertWindowMinutes: Number.parseInt(event.target.value || "1", 10),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Alerting Endpoints</Label>
                <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                  {formData.endpointIds.length === 0 ? (
                    <div className="py-4 text-center text-sm text-gray-500">
                      Select group endpoints first. Leaving this empty alerts on all endpoints in the group.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formData.endpointIds.map(endpointId => (
                        <label key={endpointId} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.failureAlertEndpointIds.includes(endpointId)}
                            onChange={() => toggleAlertEndpointSelection(endpointId)}
                            className="rounded"
                          />
                          <span className="text-sm">{getEndpointName(endpointId)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  If none are selected, the alert policy applies to every endpoint in the group.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>{editingGroup ? "Update" : "Create"} Group</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <ErrorStateCard message={error} />}

      {endpointGroups.length === 0 ? (
        <EmptyStateCard
          icon={Users}
          title="No Endpoint Groups"
          description="Create your first endpoint group to send notifications to multiple endpoints at once."
        >
          <code className="m-4 min-w-[500px] rounded-md bg-neutral-600 p-4 text-sm text-white dark:bg-neutral-800">
            <EditableTemplate
              template={`curl ${getPublicApiUrl("endpoint-groups", true)} \\
-H 'Content-Type: application/json' \\
-H 'Authorization: Bearer {{apiKey="API KEY"}}' \\
-d '{
  "name": "My First Endpoint Group"
}'`}
              className="whitespace-pre"
            />
          </code>
        </EmptyStateCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {endpointGroups.map(group => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-4 w-4" />
                      {group.name}
                    </CardTitle>
                    <CardDescription>{group.description || "No description"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(group)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(group.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-500">Group ID:</span>
                    <span className="flex items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-xs">
                      {group.id}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-gray-200"
                        onClick={() => copyToClipboard(group.id, `group-${group.id}`)}
                      >
                        {copiedId === `group-${group.id}` ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={group.enabled ? "default" : "secondary"}>
                        {group.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant="outline">
                        {group.endpointIds.length} endpoint{group.endpointIds.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline">
                        {group.eventTypes.includes("*") ? "All event types" : group.eventTypes.join(", ")}
                      </Badge>
                      {group.proxyGroupId && <Badge variant="outline">proxy</Badge>}
                      {group.failureAlerts.enabled && <Badge variant="outline">alerts</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleGroup(group)}>
                      {group.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  </div>

                  {group.endpointIds.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">Endpoints</h4>
                      <div className="space-y-1">
                        {group.endpointIds.slice(0, 3).map(endpointId => (
                          <div key={endpointId} className="flex items-center gap-2 text-sm">
                            <Globe className="h-3 w-3 text-gray-400" />
                            <span className="truncate">{getEndpointName(endpointId)}</span>
                          </div>
                        ))}
                        {group.endpointIds.length > 3 && (
                          <div className="text-xs text-gray-500">+{group.endpointIds.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}

                  {group.proxyGroupId && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-500">Proxy Group:</span>
                      <span className="rounded bg-muted px-2 py-1 font-mono text-xs">{group.proxyGroupId}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
