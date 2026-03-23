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
import { Copy, Edit, Hash, Plus, Server, Globe, Shield, Clock, Trash2, LoaderCircle, Computer } from "lucide-react";
import CopyableCode from "@/components/CopyableCode";
import { toast } from "sonner";

interface ProxyServer {
  id: string;
  environmentId: string;
  name: string;
  description?: string;
  url: string;
  isActive: boolean;
  region?: string;
  provider?: string;
  staticIp?: string;
  timeoutMs: number;
  hasSecret: boolean;
  health: {
    state: "healthy" | "unhealthy" | "unknown";
    checkedAt: string;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProxyServerCreateResponse {
  id: string;
  environmentId: string;
  name: string;
  description?: string;
  url: string;
  region?: string;
  provider?: string;
  staticIp?: string;
  timeoutMs: number;
  secret: string;
  configInstructions: {
    docker: { command: string; env: string };
    gcp: { env: string; command: string };
    aws: { env: string; command: string };
  };
  createdAt: string;
  updatedAt: string;
}

export default function ProxyServersTab() {
  const [proxyServers, setProxyServers] = useState<ProxyServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyServer | null>(null);
  const [secretDialogMode, setSecretDialogMode] = useState<"create" | "rotate">("create");
  const [newProxySecret, setNewProxySecret] = useState("");
  const [newProxyConfig, setNewProxyConfig] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    url: "",
    region: "",
    provider: "",
    staticIp: "",
    timeoutMs: 30000,
  });

  useEffect(() => {
    fetchProxyServers();
  }, []);

  const fetchProxyServers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/proxy-servers");
      if (!response.ok) throw new Error("Failed to fetch proxy servers");

      const data = (await response.json()) as { proxyServers: ProxyServer[] };
      setProxyServers(data.proxyServers || []);
    } catch (error) {
      console.error("Error fetching proxy servers:", error);
      toast.error("Failed to fetch proxy servers");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProxy = async () => {
    try {
      setCreating(true);
      const response = await fetch(editingProxy ? `/api/proxy-servers/${editingProxy.id}` : "/api/proxy-servers", {
        method: editingProxy ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error(`Failed to ${editingProxy ? "update" : "create"} proxy server`);

      if (!editingProxy) {
        const newProxy: ProxyServerCreateResponse = await response.json();

        setSecretDialogMode("create");
        setNewProxySecret(newProxy.secret);
        setNewProxyConfig(newProxy.configInstructions);
        setShowSecretDialog(true);
      }

      setFormData({
        name: "",
        description: "",
        url: "",
        region: "",
        provider: "",
        staticIp: "",
        timeoutMs: 30000,
      });
      setEditingProxy(null);
      setShowCreateDialog(false);
      fetchProxyServers();
    } catch (error) {
      console.error("Error saving proxy server:", error);
      toast.error("Failed to save proxy server");
    } finally {
      setCreating(false);
    }
  };

  const openCreateDialog = () => {
    setEditingProxy(null);
    setFormData({
      name: "",
      description: "",
      url: "",
      region: "",
      provider: "",
      staticIp: "",
      timeoutMs: 30000,
    });
    setShowCreateDialog(true);
  };

  const openEditDialog = (proxy: ProxyServer) => {
    setEditingProxy(proxy);
    setFormData({
      name: proxy.name,
      description: proxy.description || "",
      url: proxy.url,
      region: proxy.region || "",
      provider: proxy.provider || "",
      staticIp: proxy.staticIp || "",
      timeoutMs: proxy.timeoutMs,
    });
    setShowCreateDialog(true);
  };

  const handleDeleteProxy = async (proxy: ProxyServer) => {
    if (!confirm(`Delete proxy server "${proxy.name}"?`)) return;

    try {
      const response = await fetch(`/api/proxy-servers/${proxy.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete proxy server");
      fetchProxyServers();
    } catch (error) {
      console.error("Error deleting proxy server:", error);
      toast.error("Failed to delete proxy server");
    }
  };

  const handleRotateSecret = async (proxy: ProxyServer) => {
    const confirmed = confirm(
      `Rotate the secret for "${proxy.name}"?\n\nThe proxy server will stop working until the new secret is configured on the relay.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/proxy-servers/${proxy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotateSecret: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to rotate proxy secret");
      }

      const data = (await response.json()) as { rotatedSecret?: string };
      if (!data.rotatedSecret) {
        throw new Error("Proxy secret rotation did not return a new secret");
      }

      setSecretDialogMode("rotate");
      setNewProxySecret(data.rotatedSecret);
      setNewProxyConfig(null);
      setShowSecretDialog(true);
      await fetchProxyServers();
    } catch (error) {
      console.error("Error rotating proxy secret:", error);
      toast.error("Failed to rotate proxy secret");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Proxy Servers</h2>
          <p className="text-muted-foreground">Manage proxy servers for webhook delivery with static IPs</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Proxy Server
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProxy ? "Edit Proxy Server" : "Create Proxy Server"}</DialogTitle>
              <DialogDescription>
                Add or update a proxy relay for webhook delivery with static IP support.
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
                    placeholder="US-East Proxy"
                  />
                </div>
                <div>
                  <Label htmlFor="url">URL *</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://proxy-us-east.example.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Proxy server for US East region webhook delivery"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={value => setFormData({ ...formData, provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">AWS</SelectItem>
                      <SelectItem value="gcp">Google Cloud</SelectItem>
                      <SelectItem value="azure">Azure</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={e => setFormData({ ...formData, region: e.target.value })}
                    placeholder="us-east-1"
                  />
                </div>
                <div>
                  <Label htmlFor="staticIp">Static IP</Label>
                  <Input
                    id="staticIp"
                    value={formData.staticIp}
                    onChange={e => setFormData({ ...formData, staticIp: e.target.value })}
                    placeholder="203.0.113.1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="timeoutMs">Timeout (ms)</Label>
                  <Input
                    id="timeoutMs"
                    type="number"
                    value={formData.timeoutMs}
                    onChange={e => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProxy} disabled={creating || !formData.name || !formData.url}>
                  {creating
                    ? editingProxy
                      ? "Saving..."
                      : "Creating..."
                    : editingProxy
                      ? "Save Changes"
                      : "Create Proxy Server"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LoaderCircle className="h-12 w-12 mb-4 animate-spin text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Loading...</h3>
          </CardContent>
        </Card>
      )}

      {!loading && proxyServers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No proxy servers</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first proxy server to enable static IP webhook delivery.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Proxy Server
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {proxyServers.map(proxy => (
            <Card key={proxy.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getProviderIcon(proxy.provider)}</span>
                    <div>
                      <CardTitle className="text-lg">{proxy.name}</CardTitle>
                      <CardDescription>{proxy.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {proxy.health.state
                        ? proxy.health.state.charAt(0).toUpperCase() + proxy.health.state.slice(1)
                        : "Unknown"}
                    </Badge>
                    {getStatusBadge(proxy.isActive)}
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(proxy)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRotateSecret(proxy)}>
                      <Shield className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteProxy(proxy)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="rounded bg-muted px-2 py-1 font-mono text-xs">{proxy.id}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">URL</div>
                      <div className="text-muted-foreground truncate">{proxy.url}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Region</div>
                      <div className="text-muted-foreground">{proxy.region || "N/A"}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Timeout</div>
                      <div className="text-muted-foreground">{proxy.timeoutMs}ms</div>
                    </div>
                  </div>
                </div>
                {proxy.staticIp && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">Static IP</div>
                        <div className="text-muted-foreground font-mono">{proxy.staticIp}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(proxy.staticIp!)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Secret Display Dialog */}
      <Dialog open={showSecretDialog} onOpenChange={setShowSecretDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto block">
          <DialogHeader>
            <DialogTitle>
              {secretDialogMode === "rotate" ? "Proxy Secret Rotated" : "Proxy Server Created Successfully!"}
            </DialogTitle>
            <DialogDescription>
              {secretDialogMode === "rotate"
                ? "Save the replacement secret now. The relay will not work again until it is updated with this new value."
                : "Your proxy server has been created. Save the secret and configuration instructions below."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/40">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold text-amber-900 dark:text-amber-200">Important: Save Your Secret</span>
              </div>
              <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">
                {secretDialogMode === "rotate"
                  ? "This new secret is shown only once. Update the relay before sending traffic through this proxy again."
                  : "This secret will only be shown once. Copy it now and store it securely."}
              </p>
              <div className="flex items-center space-x-2">
                <code className="flex-1 overflow-x-auto rounded-sm  border bg-background px-2 py-1 font-mono text-sm">
                  {newProxySecret}
                </code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(newProxySecret)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {secretDialogMode === "create" && newProxyConfig && (
              <div className="space-y-4">
                <h4 className="font-semibold">Deployment Instructions</h4>

                <div>
                  <h5 className="font-medium mb-2">Docker</h5>
                  <div className="p-3 bg-muted rounded-lg break-all">
                    {newProxyConfig.docker.commands.map((command: string) => (
                      <CopyableCode className="text-sm my-1" copyText={command}>
                        {command}
                      </CopyableCode>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-medium mb-2">Google Cloud Platform</h5>
                  <div className="p-3 bg-muted rounded-lg break-all">
                    {newProxyConfig.gcp.commands.map((command: string) => (
                      <CopyableCode className="text-sm my-1" copyText={command}>
                        {command}
                      </CopyableCode>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-medium mb-2">Railway</h5>
                  <div className="p-3 bg-muted rounded-lg break-all">
                    {newProxyConfig.railway.commands.map((command: string) => (
                      <CopyableCode className="text-sm my-1" copyText={command}>
                        {command}
                      </CopyableCode>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setShowSecretDialog(false)}>Got it!</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
