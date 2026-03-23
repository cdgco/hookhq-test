"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ExternalLink, LoaderCircle, Trash2 } from "lucide-react";
import CopyableCode from "@/components/CopyableCode";

interface Endpoint {
  id: string;
  name: string;
  url: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EndpointsListProps {
  endpointGroupId: string;
  environmentId: string;
  token: string;
  theme?: "light" | "dark";
}

export default function EndpointsList({ endpointGroupId, environmentId, token, theme = "light" }: EndpointsListProps) {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({
    name: "",
    url: "",
    description: "",
  });

  useEffect(() => {
    fetchEndpoints();
  }, [token]);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portal/endpoints?token=${encodeURIComponent(token)}`);

      if (!response.ok) {
        throw new Error("Failed to fetch endpoints");
      }

      const data = (await response.json()) as { endpoints: Endpoint[] };
      setEndpoints(data.endpoints || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch endpoints");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEndpoint = async () => {
    if (!newEndpoint.name.trim() || !newEndpoint.url.trim()) {
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch(`/api/portal/endpoints?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newEndpoint.name,
          url: newEndpoint.url,
          description: newEndpoint.description || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create endpoint");
      }

      const createdEndpoint = (await response.json()) as Endpoint;
      setEndpoints(prev => [...prev, createdEndpoint]);
      setNewEndpoint({ name: "", url: "", description: "" });
      setIsCreateDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create endpoint");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (!confirm("Are you sure you want to delete this endpoint?")) {
      return;
    }

    try {
      const response = await fetch(`/api/portal/endpoints/${endpointId}?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete endpoint");
      }

      setEndpoints(prev => prev.filter(endpoint => endpoint.id !== endpointId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete endpoint");
    }
  };

  const handleEndpointClick = (endpointId: string) => {
    const url = new URL(`/portal/endpoint/${endpointId}`, window.location.origin);
    url.searchParams.set("token", token);
    if (theme !== "light") {
      url.searchParams.set("theme", theme);
    }
    router.push(url.toString());
  };

  // Theme-based styling
  const cardClasses =
    theme === "dark" ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";

  const tableClasses = theme === "dark" ? "border-gray-700 divide-gray-700" : "border-gray-200 divide-gray-200";

  const headerClasses = theme === "dark" ? "border-gray-700 text-gray-100" : "border-gray-200 text-gray-900";

  const rowClasses = theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-50";

  const textClasses = theme === "dark" ? "text-gray-300" : "text-gray-600";

  const iconClasses = theme === "dark" ? "text-gray-400" : "text-gray-400";

  const filteredEndpoints = endpoints.filter(
    endpoint =>
      endpoint.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={fetchEndpoints}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with search and add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Filter by name or URL"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add event destination
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Event Destination</DialogTitle>
              <DialogDescription>Create a new webhook endpoint to receive events.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newEndpoint.name}
                  onChange={e => setNewEndpoint(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Webhook Endpoint"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={newEndpoint.url}
                  onChange={e => setNewEndpoint(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://myapp.com/webhook"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newEndpoint.description}
                  onChange={e => setNewEndpoint(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description of this endpoint"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateEndpoint}
                disabled={!newEndpoint.name.trim() || !newEndpoint.url.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Destination"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Endpoints Table */}
      {filteredEndpoints.length === 0 ? (
        <Card className={cardClasses}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ExternalLink className={`h-12 w-12 ${iconClasses} mb-4`} />
            <h3 className="text-lg font-semibold mb-2">No Event Destinations</h3>
            <p className={`${textClasses} text-center mb-4`}>
              Create your first event destination to start receiving webhook events.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Event Destination
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className={cardClasses}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${headerClasses}`}>
                  <tr className="text-left">
                    <th className={`px-6 py-4 font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                      Type
                    </th>
                    <th className={`px-6 py-4 font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                      Target
                    </th>
                    <th className={`px-6 py-4 font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                      Topics
                    </th>
                    <th className={`px-6 py-4 font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                      Success Rate
                    </th>
                    <th className={`px-6 py-4 font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                      Status
                    </th>
                    <th className={`px-6 py-4 font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                      Events 24h · 14d
                    </th>
                    <th
                      className={`px-6 py-4 font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}
                    ></th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${tableClasses}`}>
                  {filteredEndpoints.map(endpoint => (
                    <tr
                      key={endpoint.id}
                      className={`${rowClasses} cursor-pointer`}
                      onClick={() => handleEndpointClick(endpoint.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"} rounded-full flex items-center justify-center`}
                          >
                            <ExternalLink className={`h-4 w-4 ${iconClasses}`} />
                          </div>
                          <span className="font-medium">Webhook</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm ${textClasses} font-mono`}>
                            {endpoint.url.length > 50 ? `${endpoint.url.substring(0, 50)}...` : endpoint.url}
                          </span>
                          <CopyableCode
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            copyText={endpoint.url}
                          >
                            <ExternalLink className={`h-3 w-3 ${iconClasses}`} />
                          </CopyableCode>
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-sm ${textClasses}`}>{Math.floor(Math.random() * 5) + 1}</td>
                      <td className={`px-6 py-4 text-sm ${textClasses}`}>{(Math.random() * 5 + 95).toFixed(1)}%</td>
                      <td className="px-6 py-4">
                        <Badge variant={endpoint.isActive ? "default" : "secondary"}>
                          {endpoint.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 ${theme === "dark" ? "bg-gray-600" : "bg-gray-300"} rounded-full`}
                                style={{ height: `${Math.random() * 12 + 4}px` }}
                              />
                            ))}
                          </div>
                          <span className={`text-sm ${textClasses}`}>
                            {Math.floor(Math.random() * 5 + 1)}.{Math.floor(Math.random() * 10)}k
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteEndpoint(endpoint.id);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className={`flex items-center justify-between text-sm ${textClasses}`}>
        <span>
          {filteredEndpoints.length} event destination{filteredEndpoints.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" disabled>
            <span>&lt;</span>
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <span>&gt;</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
