"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, RefreshCw, Database, AlertTriangle, CheckCircle, Settings, Cloud, HelpCircle } from "lucide-react";

interface ServerConfig {
  id: string;
  cloudflareApiKey?: string;
  cloudflareAccountId?: string;
  cloudflareQueueId?: string;
  logRetentionDays: number;
  payloadRetentionDays: number;
  defaultMaxRetries: number;
  defaultTimeoutMs: number;
  defaultBackoffStrategy: string;
  defaultAutoDisableConfig?: string;
  queueManagementEnabled: boolean;
  jwtExpiration: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminConfigTabProps {
  onConfigUpdate?: () => void;
}

export default function AdminConfigTab({ onConfigUpdate }: AdminConfigTabProps) {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showApiTokenHelp, setShowApiTokenHelp] = useState(false);
  const [showAccountIdHelp, setShowAccountIdHelp] = useState(false);
  const [showQueueIdHelp, setShowQueueIdHelp] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    cloudflareApiKey: "",
    cloudflareAccountId: "",
    cloudflareQueueId: "",
    logRetentionDays: 30,
    payloadRetentionDays: 7,
    defaultMaxRetries: 3,
    defaultTimeoutMs: 30000,
    defaultBackoffStrategy: "exponential",
    autoDisableEnabled: false,
    autoDisableThreshold: 10,
    queueManagementEnabled: false,
    jwtExpirationValue: 1,
    jwtExpirationUnit: "day",
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/config");
      if (!response.ok) {
        if (response.status === 404) {
          // No config exists yet, use defaults
          setConfig(null);
        } else {
          throw new Error("Failed to fetch server configuration");
        }
      } else {
        const data = (await response.json()) as { config: ServerConfig };
        setConfig(data.config);

        // Parse JWT expiration (e.g., "1day" -> { value: 1, unit: "day" })
        const jwtExpiration = data.config.jwtExpiration || "1day";
        const jwtMatch = jwtExpiration.match(/^(\d+)(hour|day|week|month)$/);
        const jwtValue = jwtMatch ? parseInt(jwtMatch[1]) : 1;
        const jwtUnit = jwtMatch ? jwtMatch[2] : "day";

        setFormData({
          cloudflareApiKey: data.config.cloudflareApiKey || "",
          cloudflareAccountId: data.config.cloudflareAccountId || "",
          cloudflareQueueId: data.config.cloudflareQueueId || "",
          logRetentionDays: data.config.logRetentionDays || 30,
          payloadRetentionDays: data.config.payloadRetentionDays || 7,
          defaultMaxRetries: data.config.defaultMaxRetries || 3,
          defaultTimeoutMs: data.config.defaultTimeoutMs || 30000,
          defaultBackoffStrategy: data.config.defaultBackoffStrategy || "exponential",
          autoDisableEnabled: data.config.defaultAutoDisableConfig
            ? (JSON.parse(data.config.defaultAutoDisableConfig).enabled ?? false)
            : false,
          autoDisableThreshold: data.config.defaultAutoDisableConfig
            ? (JSON.parse(data.config.defaultAutoDisableConfig).threshold ?? 10)
            : 10,
          queueManagementEnabled: data.config.queueManagementEnabled || false,
          jwtExpirationValue: jwtValue,
          jwtExpirationUnit: jwtUnit,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Format JWT expiration (e.g., { value: 1, unit: "day" } -> "1day")
      const jwtExpiration = `${formData.jwtExpirationValue}${formData.jwtExpirationUnit}`;

      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          defaultAutoDisableConfig: JSON.stringify({
            enabled: formData.autoDisableEnabled,
            threshold: formData.autoDisableThreshold,
          }),
          jwtExpiration: jwtExpiration,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save server configuration");
      }

      const updatedConfig = (await response.json()) as { config: ServerConfig };
      setConfig(updatedConfig.config);
      setSuccess("Server configuration saved successfully!");

      // Notify parent component of config update
      if (onConfigUpdate) {
        onConfigUpdate();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading server configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center space-x-2 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center space-x-2 p-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800">{success}</span>
          </CardContent>
        </Card>
      )}

      {/* Cloudflare Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Cloudflare Configuration</CardTitle>
          </div>
          <CardDescription>Configure Cloudflare credentials for queue metrics and monitoring</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="cloudflareApiKey">Cloudflare API Token</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowApiTokenHelp(!showApiTokenHelp)}
                className="h-6 w-6 p-0"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
            <Input
              id="cloudflareApiKey"
              type="password"
              placeholder="Enter your Cloudflare API token"
              value={formData.cloudflareApiKey}
              onChange={e => setFormData({ ...formData, cloudflareApiKey: e.target.value })}
            />
            <p className="text-sm text-muted-foreground mt-1">Required for accessing Cloudflare Queue metrics API</p>
            {showApiTokenHelp && (
              <div className="mt-2 p-3 bg-muted rounded-md text-sm space-y-2">
                <p className="font-medium">How to create an API token:</p>
                <ol className="list-decimal list-inside ml-2 space-y-1">
                  <li>Go to your Cloudflare dashboard → My Profile → API Tokens</li>
                  <li>Click "Create Token" → "Get started" under Custom token</li>
                  <li>
                    Set permissions:{" "}
                    <span className="font-mono bg-background px-1 rounded">Account → Account Analytics → Read</span>
                  </li>
                  <li>Set Account Resources to "Include - All accounts" or your specific account</li>
                  <li>Create token and copy it securely</li>
                </ol>
                <p className="text-xs">
                  <a
                    href="https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Detailed API token instructions →
                  </a>
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="cloudflareAccountId">Cloudflare Account ID</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAccountIdHelp(!showAccountIdHelp)}
                className="h-6 w-6 p-0"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
            <Input
              id="cloudflareAccountId"
              type="text"
              placeholder="Enter your Cloudflare Account ID"
              value={formData.cloudflareAccountId}
              onChange={e => setFormData({ ...formData, cloudflareAccountId: e.target.value })}
            />
            <p className="text-sm text-muted-foreground mt-1">Your Cloudflare account identifier</p>
            {showAccountIdHelp && (
              <div className="mt-2 p-3 bg-muted rounded-md text-sm space-y-2">
                <p className="font-medium">How to find your Account ID:</p>
                <ol className="list-decimal list-inside ml-2 space-y-1">
                  <li>Go to your Cloudflare dashboard → Account Home</li>
                  <li>Click the menu button next to your account name</li>
                  <li>Select "Copy account ID"</li>
                </ol>
                <p className="text-xs">
                  <a
                    href="https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Detailed instructions →
                  </a>
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="cloudflareQueueId">Cloudflare Queue ID</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowQueueIdHelp(!showQueueIdHelp)}
                className="h-6 w-6 p-0"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
            <Input
              id="cloudflareQueueId"
              type="text"
              placeholder="Enter your Cloudflare Queue ID"
              value={formData.cloudflareQueueId}
              onChange={e => setFormData({ ...formData, cloudflareQueueId: e.target.value })}
            />
            <p className="text-sm text-muted-foreground mt-1">The specific queue to monitor for metrics</p>
            {showQueueIdHelp && (
              <div className="mt-2 p-3 bg-muted rounded-md text-sm space-y-2">
                <p className="font-medium">How to find your Queue ID:</p>
                <ol className="list-decimal list-inside ml-2 space-y-1">
                  <li>
                    Go to your Cloudflare dashboard →
                    <a
                      href="https://dash.cloudflare.com/?to=/:account/workers/queues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline ml-1"
                    >
                      Queues
                    </a>
                  </li>
                  <li>
                    Find the queue that matches the one in your{" "}
                    <span className="font-mono bg-background px-1 rounded">wrangler.jsonc</span> file
                  </li>
                  <li>Copy the Queue ID from the queue details</li>
                </ol>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* JWT Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Portal Token Configuration</CardTitle>
          </div>
          <CardDescription>Configure how long portal access tokens remain valid</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="jwtExpirationValue" className="mb-2">
                Token Expiration
              </Label>
              <Input
                id="jwtExpirationValue"
                type="number"
                min="1"
                max="999"
                value={formData.jwtExpirationValue}
                onChange={e => setFormData({ ...formData, jwtExpirationValue: parseInt(e.target.value) || 1 })}
                className="text-right"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="jwtExpirationUnit" className="mb-2">
                Time Unit
              </Label>
              <Select
                value={formData.jwtExpirationUnit}
                onValueChange={value => setFormData({ ...formData, jwtExpirationUnit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">Hours</SelectItem>
                  <SelectItem value="day">Days</SelectItem>
                  <SelectItem value="week">Weeks</SelectItem>
                  <SelectItem value="month">Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Portal access tokens will be valid for {formData.jwtExpirationValue} {formData.jwtExpirationUnit}
            {formData.jwtExpirationValue !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Data Retention</CardTitle>
          </div>
          <CardDescription>Configure how long to retain logs and payloads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="logRetentionDays" className="mb-2">
                Log Retention (days)
              </Label>
              <Input
                id="logRetentionDays"
                type="number"
                value={formData.logRetentionDays}
                onChange={e => setFormData({ ...formData, logRetentionDays: parseInt(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground mt-1">How long to keep webhook delivery logs</p>
            </div>
            <div>
              <Label htmlFor="payloadRetentionDays" className="mb-2">
                Payload Retention (days)
              </Label>
              <Input
                id="payloadRetentionDays"
                type="number"
                value={formData.payloadRetentionDays}
                onChange={e => setFormData({ ...formData, payloadRetentionDays: parseInt(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground mt-1">How long to keep webhook payloads</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Destination Safety</CardTitle>
          </div>
          <CardDescription>Default behavior for automatically disabling failing destinations</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="autoDisableEnabled" className="mb-2">
              Auto Disable
            </Label>
            <Select
              value={formData.autoDisableEnabled ? "enabled" : "disabled"}
              onValueChange={value => setFormData({ ...formData, autoDisableEnabled: value === "enabled" })}
            >
              <SelectTrigger id="autoDisableEnabled">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">Applied by default unless an endpoint overrides it</p>
          </div>
          <div>
            <Label htmlFor="autoDisableThreshold" className="mb-2">
              Consecutive Failure Threshold
            </Label>
            <Input
              id="autoDisableThreshold"
              type="number"
              min="1"
              value={formData.autoDisableThreshold}
              disabled={!formData.autoDisableEnabled}
              onChange={e => setFormData({ ...formData, autoDisableThreshold: parseInt(e.target.value) || 1 })}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Disable an endpoint after this many permanent failures in a row
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
