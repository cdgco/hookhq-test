"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Hash, Plus, Settings, Server, LoaderCircle, Computer, Boxes, Trash2 } from "lucide-react";
import { toast } from "sonner"

interface ProxyServer {
  id: string;
  name: string;
  url: string;
  region?: string;
  provider?: string;
  isActive: boolean;
}

interface ProxyGroup {
  id: string;
  environmentId: string;
  name: string;
  description?: string;
  proxyIds: string[];
  proxies: ProxyServer[];
  loadBalancingStrategy: "random" | "round_robin";
  isDefault?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProxyGroupsTab() {
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([]);
  const [availableProxies, setAvailableProxies] = useState<ProxyServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProxyGroup | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    proxyIds: [] as string[],
    loadBalancingStrategy: "random" as "random" | "round_robin",
    isDefault: false,
  });

  useEffect(() => {
    fetchProxyGroups();
    fetchAvailableProxies();
  }, []);

  const fetchProxyGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/proxy-groups");
      if (!response.ok) throw new Error("Failed to fetch proxy groups");

      const data = (await response.json()) as { proxyGroups: ProxyGroup[] };
      setProxyGroups(data.proxyGroups || []);
    } catch (error) {
      console.error("Error fetching proxy groups:", error);
      toast.error("Failed to fetch proxy groups");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProxies = async () => {
    try {
      const response = await fetch("/api/proxy-servers?active=true");
      if (!response.ok) throw new Error("Failed to fetch proxy servers");

      const data = (await response.json()) as { proxyServers: ProxyServer[] };
      setAvailableProxies(data.proxyServers || []);
    } catch (error) {
      console.error("Error fetching proxy servers:", error);
      toast.error("Failed to fetch proxy servers");
    }
  };

  const handleSaveGroup = async () => {
    try {
      setCreating(true);
      const response = await fetch(editingGroup ? `/api/proxy-groups/${editingGroup.id}` : "/api/proxy-groups", {
        method: editingGroup ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error(`Failed to ${editingGroup ? "update" : "create"} proxy group`);

      setFormData({
        name: "",
        description: "",
        proxyIds: [],
        loadBalancingStrategy: "random",
        isDefault: false,
      });
      setEditingGroup(null);
      setShowCreateDialog(false);
      fetchProxyGroups();
    } catch (error) {
      console.error("Error saving proxy group:", error);
      toast.error("Failed to save proxy group");
    } finally {
      setCreating(false);
    }
  };

  const openCreateDialog = () => {
    setEditingGroup(null);
    setFormData({
      name: "",
      description: "",
      proxyIds: [],
      loadBalancingStrategy: "random",
      isDefault: false,
    });
    setShowCreateDialog(true);
  };

  const openEditDialog = (group: ProxyGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      proxyIds: group.proxyIds,
      loadBalancingStrategy: group.loadBalancingStrategy,
      isDefault: Boolean(group.isDefault),
    });
    setShowCreateDialog(true);
  };

  const handleDeleteGroup = async (group: ProxyGroup) => {
    if (!confirm(`Delete proxy group "${group.name}"?`)) return;

    try {
      const response = await fetch(`/api/proxy-groups/${group.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete proxy group");
      fetchProxyGroups();
    } catch (error) {
      console.error("Error deleting proxy group:", error);
      toast.error("Failed to delete proxy group");
    }
  };

  const handleProxyToggle = (proxyId: string) => {
    setFormData(prev => ({
      ...prev,
      proxyIds: prev.proxyIds.includes(proxyId)
        ? prev.proxyIds.filter(id => id !== proxyId)
        : [...prev.proxyIds, proxyId],
    }));
  };

  const getProviderIcon = (provider?: string) => {
    switch (provider?.toLowerCase()) {
      // case "aws": return "☁️";
      // case "gcp": return "🌐";
      // case "azure": return "🔷";
      default:
        return <Computer className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Inactive"}</Badge>;
  };

  const getStrategyBadge = (strategy: string) => {
    return <Badge variant="outline">{strategy === "round_robin" ? "Round Robin" : "Random"}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Proxy Groups</h2>
          <p className="text-muted-foreground">Group proxy servers for load balancing and regional distribution</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Proxy Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingGroup ? "Edit Proxy Group" : "Create Proxy Group"}</DialogTitle>
              <DialogDescription>
                Create a group of proxy servers for load balancing webhook delivery.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="US-East Group"
                  />
                </div>
                <div>
                  <Label htmlFor="strategy">Load Balancing Strategy</Label>
                  <Select
                    value={formData.loadBalancingStrategy}
                    onValueChange={(value: "random" | "round_robin") =>
                      setFormData({ ...formData, loadBalancingStrategy: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Random Selection</SelectItem>
                      <SelectItem value="round_robin">Round Robin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Proxy group for US East region with multiple servers"
                />
              </div>

              <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <Checkbox
                  checked={formData.isDefault}
                  onCheckedChange={checked => setFormData({ ...formData, isDefault: checked === true })}
                />
                Set this as the default proxy group for webhook deliveries without a more specific proxy assignment
              </label>

              <div>
                <Label>Select Proxy Servers</Label>
                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                  {availableProxies.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 text-center">
                      No active proxy servers available. Create proxy servers first.
                    </div>
                  ) : (
                    availableProxies.map(proxy => (
                      <div key={proxy.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <Checkbox
                          id={proxy.id}
                          checked={formData.proxyIds.includes(proxy.id)}
                          onCheckedChange={() => handleProxyToggle(proxy.id)}
                        />
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="text-lg">{getProviderIcon(proxy.provider)}</span>
                          <div>
                            <div className="font-medium">{proxy.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {proxy.url} {proxy.region && `• ${proxy.region}`}
                            </div>
                          </div>
                        </div>
                        <Badge variant={proxy.isActive ? "default" : "secondary"}>
                          {proxy.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveGroup}
                  disabled={creating || !formData.name}
                >
                  {creating
                    ? editingGroup
                      ? "Saving..."
                      : "Creating..."
                    : editingGroup
                      ? "Save Changes"
                      : "Create Proxy Group"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LoaderCircle className="h-12 w-12 mb-4 animate-spin text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Loading...</h3>
          </CardContent>
        </Card>
      )}

      {!loading && proxyGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No proxy groups</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create proxy groups to organize and load balance your proxy servers.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Proxy Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {proxyGroups.map(group => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Boxes className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription>{group.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {group.isDefault && <Badge variant="outline">Default</Badge>}
                    {getStrategyBadge(group.loadBalancingStrategy)}
                    {getStatusBadge(group.isActive)}
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(group)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(group)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="rounded bg-muted px-2 py-1 font-mono text-xs">{group.id}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {group.proxies.length} proxy server{group.proxies.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {group.proxies.length > 0 ? (
                    <div className="grid gap-2">
                      {group.proxies.map(proxy => (
                        <div key={proxy.id} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                          <span className="text-lg">{getProviderIcon(proxy.provider)}</span>
                          <div className="flex-1">
                            <div className="font-medium">{proxy.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {proxy.url} {proxy.region && `• ${proxy.region}`}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <Badge variant={proxy.isActive ? "default" : "secondary"}>
                              {proxy.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-4 text-center">No proxy servers in this group</div>
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
