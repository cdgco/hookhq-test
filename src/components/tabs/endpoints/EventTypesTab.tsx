"use client";

import { useEffect, useState } from "react";
import { Code, Edit, Plus, Power, PowerOff, Trash2, Zap } from "lucide-react";
import EditableTemplate from "@/components/EditableTemplate";
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
import { Textarea } from "@/components/ui/textarea";
import { createEventType, deleteEventType, fetchEventTypes, type EventType, updateEventType } from "@/lib/webhookApi";
import { getPublicApiUrl } from "@/lib/publicApi/utils";

type EventTypeFormState = {
  name: string;
  description: string;
  schema: string;
  enabled: boolean;
};

const initialFormState: EventTypeFormState = {
  name: "",
  description: "",
  schema: "",
  enabled: true,
};

function parseSchema(schema: string) {
  if (!schema.trim()) {
    return null;
  }

  return JSON.parse(schema) as Record<string, unknown>;
}

export default function EventTypesTab() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEventType, setEditingEventType] = useState<EventType | null>(null);
  const [formData, setFormData] = useState<EventTypeFormState>(initialFormState);

  useEffect(() => {
    let isMounted = true;

    async function loadEventTypes() {
      try {
        const nextEventTypes = await fetchEventTypes();
        if (isMounted) {
          setEventTypes(nextEventTypes);
        }
      } catch (nextError) {
        if (isMounted) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load event types");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadEventTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  function resetForm() {
    setFormData(initialFormState);
    setEditingEventType(null);
  }

  function openCreateDialog() {
    resetForm();
    setCreateDialogOpen(true);
  }

  function openEditDialog(eventType: EventType) {
    setFormData({
      name: eventType.name,
      description: eventType.description || "",
      schema: eventType.schema ? JSON.stringify(eventType.schema, null, 2) : "",
      enabled: eventType.enabled,
    });
    setEditingEventType(eventType);
    setCreateDialogOpen(true);
  }

  async function handleSubmit() {
    try {
      setError(null);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        schema: parseSchema(formData.schema),
        enabled: formData.enabled,
      };

      if (editingEventType) {
        const updatedEventType = await updateEventType(editingEventType.id, payload);
        setEventTypes(current =>
          current.map(eventType => (eventType.id === editingEventType.id ? updatedEventType : eventType))
        );
      } else {
        const createdEventType = await createEventType(payload);
        setEventTypes(current => [...current, createdEventType]);
      }

      setCreateDialogOpen(false);
      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save event type");
    }
  }

  async function handleToggleEventType(eventType: EventType) {
    try {
      setError(null);
      const updatedEventType = await updateEventType(eventType.id, { enabled: !eventType.enabled });
      setEventTypes(current => current.map(item => (item.id === eventType.id ? updatedEventType : item)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update event type");
    }
  }

  async function handleDeleteEventType(id: string) {
    if (!confirm("Are you sure you want to delete this event type?")) return;

    try {
      setError(null);
      await deleteEventType(id);
      setEventTypes(current => current.filter(eventType => eventType.id !== id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete event type");
    }
  }

  if (loading) {
    return <LoadingStateCard />;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Event Types</h2>
          <p className="text-muted-foreground">Define event schemas for structured event notifications</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Event Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEventType ? "Edit Event Type" : "Create New Event Type"}</DialogTitle>
              <DialogDescription>
                {editingEventType
                  ? "Update your event type configuration"
                  : "Define a new event type with its payload schema"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="event-type-name">Name *</Label>
                <Input
                  id="event-type-name"
                  value={formData.name}
                  onChange={event => setFormData(current => ({ ...current, name: event.target.value }))}
                  placeholder="user.created"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-type-description">Description</Label>
                <Input
                  id="event-type-description"
                  value={formData.description}
                  onChange={event => setFormData(current => ({ ...current, description: event.target.value }))}
                  placeholder="Triggered when a new user is created"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-type-schema">JSON Schema (Optional)</Label>
                <Textarea
                  id="event-type-schema"
                  className="min-h-[200px] font-mono text-sm"
                  value={formData.schema}
                  onChange={event => setFormData(current => ({ ...current, schema: event.target.value }))}
                  placeholder={`{
  "type": "object",
  "properties": {
    "userId": {
      "type": "string"
    }
  },
  "required": ["userId"]
}`}
                />
                <p className="text-xs text-muted-foreground">
                  Define the structure of the event payload using JSON Schema.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>{editingEventType ? "Update" : "Create"} Event Type</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <ErrorStateCard message={error} />}

      {eventTypes.length === 0 ? (
        <EmptyStateCard
          icon={Zap}
          title="No Event Types"
          description="Create your first event type to define structured event notifications."
        >
          <code className="m-4 min-w-[500px] rounded-md bg-neutral-600 p-4 text-sm text-white dark:bg-neutral-800">
            <EditableTemplate
              template={`curl ${getPublicApiUrl("event-types", true)} \\
-H 'Content-Type: application/json' \\
-H 'Authorization: Bearer {{apiKey="API KEY"}}' \\
-d '{
  "name": "My First Event Type"
}'`}
              className="whitespace-pre"
            />
          </code>
        </EmptyStateCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {eventTypes.map(eventType => (
            <Card key={eventType.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Zap className="h-4 w-4" />
                      {eventType.name}
                    </CardTitle>
                    <CardDescription>{eventType.description || "No description"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(eventType)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEventType(eventType.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={eventType.enabled ? "default" : "secondary"}>
                        {eventType.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      {eventType.schema && (
                        <Badge variant="outline">
                          <Code className="mr-1 h-3 w-3" />
                          Schema
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleEventType(eventType)}>
                      {eventType.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  </div>

                  {eventType.schema && (
                    <div>
                      <h4 className="mb-1 text-sm font-medium">Schema Preview</h4>
                      <div className="max-h-20 overflow-y-auto rounded bg-gray-50 p-2 font-mono text-xs text-gray-600">
                        {JSON.stringify(eventType.schema, null, 2).slice(0, 180)}
                        {JSON.stringify(eventType.schema, null, 2).length > 180 && "..."}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Created {new Date(eventType.createdAt).toLocaleDateString()}
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
