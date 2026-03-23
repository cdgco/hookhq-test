"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  LoaderCircle,
  CircleX,
} from "lucide-react";
import { useState, useEffect } from "react";

interface WebhookMessage {
  id: string;
  eventId?: string;
  eventType: string;
  environmentId: string;
  endpointIds: string[];
  endpointGroupIds: string[];
  retryableEndpointIds: string[];
  payload: any;
  payloadSize?: number;
  status: "pending" | "processing" | "delivered" | "failed" | "retrying";
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  queuedAt?: string;
  processingStartedAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  lastError?: string;
  lastErrorAt?: string;
  responseStatus?: number;
  responseTimeMs?: number;
  responseBody?: string;
  idempotencyKey?: string;
  metadata?: any;
}

export default function MessagesTab() {
  const [messages, setMessages] = useState<WebhookMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [retryingIds, setRetryingIds] = useState<string[]>([]);
  const [dialogContent, setDialogContent] = useState<{ title: string; value: unknown } | null>(null);

  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      params.append("limit", "50");

      const response = await fetch(`/api/webhooks/messages?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = (await response.json()) as { messages: WebhookMessage[] };
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const handleRetry = async (messageId: string, endpointId: string) => {
    const retryKey = `${messageId}:${endpointId}`;

    try {
      setRetryingIds(current => [...current, retryKey]);
      const response = await fetch(`/api/v1/messages/${messageId}/${endpointId}/retry`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
        throw new Error(errorBody?.message || errorBody?.error || "Failed to retry message");
      }

      await fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry message");
    } finally {
      setRetryingIds(current => current.filter(id => id !== retryKey));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "retrying":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      processing: "default",
      delivered: "default",
      failed: "destructive",
      retrying: "secondary",
    } as const;

    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      delivered: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      retrying: "bg-orange-100 text-orange-800",
    };

    return (
      <span className={`text-xs px-2 py-1 rounded ${colors[status as keyof typeof colors]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;

    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  const formatJson = (value: unknown) => {
    if (typeof value === "string") {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }

    return JSON.stringify(value, null, 2);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Message Log</h2>
          <p className="text-muted-foreground">View and monitor your webhook delivery status</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="retrying">Retrying</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <LoaderCircle className="h-12 w-12 mb-4 animate-spin text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Loading...</h3>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <CircleX className="h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error</h3>
            <p className="text-red-600 text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Messages</h3>
            <p className="text-muted-foreground text-center">
              {statusFilter === "all"
                ? "No webhook messages have been sent yet."
                : `No messages with status "${statusFilter}" found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {messages.map(message => (
            <Card key={message.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2 mb-1">
                      {getStatusIcon(message.status)}
                      {message.eventType}
                      {message.eventId && (
                        <span className="text-sm font-normal text-gray-500">({message.eventId})</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Created {formatTimestamp(message.createdAt)}</span>
                        {message.processingStartedAt && (
                          <span>Processing: {formatDuration(message.createdAt, message.processingStartedAt)}</span>
                        )}
                        {message.deliveredAt && (
                          <span>Delivered: {formatDuration(message.createdAt, message.deliveredAt)}</span>
                        )}
                        {message.responseTimeMs && <span>Response: {message.responseTimeMs}ms</span>}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(message.status)}
                    <Badge variant="outline">
                      {message.attempts}/{message.maxAttempts} attempts
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Targets</h4>
                    <div className="flex flex-wrap gap-1">
                      {message.endpointIds.map(id => (
                        <div key={id} className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Endpoint: {id}
                          </Badge>
                          {message.retryableEndpointIds.includes(id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleRetry(message.id, id)}
                              disabled={retryingIds.includes(`${message.id}:${id}`)}
                            >
                              <RefreshCw
                                className={`mr-1 h-3 w-3 ${
                                  retryingIds.includes(`${message.id}:${id}`) ? "animate-spin" : ""
                                }`}
                              />
                              Retry
                            </Button>
                          )}
                        </div>
                      ))}
                      {message.endpointGroupIds.map(id => (
                        <Badge key={id} variant="outline" className="text-xs">
                          Group: {id}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {message.payloadSize && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Payload</h4>
                      <div className="text-sm text-gray-600">
                        Size: {message.payloadSize} bytes
                        {message.payload && (
                          <span className="ml-2">
                            •{" "}
                            <button
                              className="text-blue-600 hover:underline"
                              onClick={() => setDialogContent({ title: "Payload", value: message.payload })}
                            >
                              View payload
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {message.lastError && (
                    <div>
                      <h4 className="text-sm font-medium mb-1 text-red-600">Last Error</h4>
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {message.lastError}
                        {message.lastErrorAt && (
                          <div className="text-xs text-red-500 mt-1">{formatTimestamp(message.lastErrorAt)}</div>
                        )}
                      </div>
                      {message.retryableEndpointIds.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Manual retry is available for retained failed deliveries. Retries are not dependent on payload
                          logging, but they do require the failed delivery record to still exist.
                        </p>
                      )}
                    </div>
                  )}

                  {message.responseStatus && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Response</h4>
                      <div className="text-sm">
                        Status:{" "}
                        <Badge variant={message.responseStatus < 400 ? "default" : "destructive"}>
                          {message.responseStatus}
                        </Badge>
                        {message.responseBody && (
                          <span className="ml-2">
                            •{" "}
                            <button
                              className="text-blue-600 hover:underline"
                              onClick={() => setDialogContent({ title: "Response Body", value: message.responseBody })}
                            >
                              View response
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {message.idempotencyKey && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Idempotency</h4>
                      <div className="text-sm text-gray-600 font-mono">{message.idempotencyKey}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogContent !== null} onOpenChange={open => !open && setDialogContent(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{dialogContent?.title}</DialogTitle>
            <DialogDescription>Logged content for this message.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-xs">
            {dialogContent ? formatJson(dialogContent.value) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
