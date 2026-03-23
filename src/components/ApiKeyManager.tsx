"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Key, Plus, Trash2, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { getCurrentEnvironment } from "@/lib/environments";
import { ApiKey } from "@/lib/apiKeys";
import { useEnvironment } from "@/components/providers/EnvironmentProvider";
import CopyableCode from "./CopyableCode";

const fullPermission = {
  endpoints: ["create", "read", "update", "delete"],
  endpointGroups: ["create", "read", "update", "delete"],
  eventTypes: ["create", "read", "update", "delete"],
  messages: ["create", "read", "update", "delete"],
};

interface ApiKeyManagerProps {
  apiKeys: ApiKey[];
  onCreateKey: (name: string, permissions: Record<string, string[]>, environment: string) => Promise<void>;
  onDeleteKey: (id: string) => Promise<void>;
  onToggleKey: (id: string, enabled: boolean) => Promise<void>;
  onDismissRawKey?: (id: string) => void;
}

export default function ApiKeyManager({
  apiKeys,
  onCreateKey,
  onDeleteKey,
  onToggleKey,
  onDismissRawKey,
}: ApiKeyManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>(fullPermission);
  const [isCreating, setIsCreating] = useState(false);
  const [currentEnvironment, setCurrentEnvironment] = useState<string | null>(null);
  const [currentEnvironmentName, setCurrentEnvironmentName] = useState<string | null>(null);
  const [environmentValidationError, setEnvironmentValidationError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  const { environments, environmentError, validateCurrentEnvironment } = useEnvironment();

  // Load current environment on component mount and when dialog opens
  useEffect(() => {
    const loadCurrentEnvironment = async () => {
      const env = await getCurrentEnvironment();
      setCurrentEnvironment(env);
      setEnvironmentValidationError(null);

      // Validate environment exists
      if (env) {
        const isValid = await validateCurrentEnvironment();
        if (!isValid) {
          setEnvironmentValidationError(environmentError || "Environment validation failed");
          return;
        }

        // Find environment name from the environments list
        const environment = environments.find(e => e.id === env);
        if (environment) {
          setCurrentEnvironmentName(environment.name);
        } else {
          setEnvironmentValidationError(`Environment "${env}" not found`);
        }
      }
    };
    loadCurrentEnvironment();
  }, [environments, environmentError, validateCurrentEnvironment]);

  // Refresh environment when dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      const refreshEnvironment = async () => {
        const env = await getCurrentEnvironment();
        setCurrentEnvironment(env);
        setEnvironmentValidationError(null);

        // Validate environment exists
        if (env) {
          const isValid = await validateCurrentEnvironment();
          if (!isValid) {
            setEnvironmentValidationError(environmentError || "Environment validation failed");
            return;
          }

          // Find environment name from the environments list
          const environment = environments.find(e => e.id === env);
          if (environment) {
            setCurrentEnvironmentName(environment.name);
          } else {
            setEnvironmentValidationError(`Environment "${env}" not found`);
          }
        }
      };
      refreshEnvironment();
    }
  }, [isCreateDialogOpen, environments, environmentError, validateCurrentEnvironment]);

  const handleDeleteKey = (keyId: string) => {
    setKeyToDelete(keyId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (keyToDelete) {
      onDeleteKey(keyToDelete);
      setDeleteConfirmOpen(false);
      setKeyToDelete(null);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || !currentEnvironment) return;

    // Validate environment before creating API key
    const isValid = await validateCurrentEnvironment();
    if (!isValid) {
      setEnvironmentValidationError(environmentError || "Environment validation failed");
      return;
    }

    setIsCreating(true);
    try {
      await onCreateKey(newKeyName.trim(), selectedPermissions, currentEnvironment);
      setNewKeyName("");
      setSelectedPermissions(fullPermission);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create API key:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string | undefined | null) => {
    if (!text) {
      console.error("No key to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const formatKey = (key: string | undefined | null, start?: string | null) => {
    if (key) {
      return key;
    }

    if (start) {
      return `${start}${"*".repeat(20)}`; // Show start + 20 asterisks
    }

    return "No key available";
  };

  const handlePermissionChange = (permission: string, operation: string, checked: boolean) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [permission]: checked ? [...prev[permission], operation] : prev[permission].filter(op => op !== operation),
    }));
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground">Manage your API keys for accessing the webhook service</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key with specific permissions for your application.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., Production App, Development"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                />
              </div>
              {currentEnvironment && (
                <div className="space-y-2">
                  <Label>Environment</Label>
                  {environmentValidationError ? (
                    <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Environment Error</h3>
                          <div className="mt-1 text-sm text-red-700">
                            <p>{environmentValidationError}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
                      <span className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                        {currentEnvironmentName || currentEnvironment}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This API key will be scoped to the current environment
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Custom Permissions</Label>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Endpoints</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {["create", "read", "update", "delete"].map(op => (
                          <div key={`endpoints:${op}`} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`endpoints:${op}`}
                              checked={selectedPermissions.endpoints.includes(op)}
                              onChange={e => handlePermissionChange("endpoints", op, e.target.checked)}
                              className="rounded"
                            />
                            <Label htmlFor={`endpoints:${op}`} className="text-sm capitalize">
                              {op}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Endpoint Groups</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {["create", "read", "update", "delete"].map(op => (
                          <div key={`endpointGroups:${op}`} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`endpointGroups:${op}`}
                              checked={selectedPermissions.endpointGroups.includes(op)}
                              onChange={e => handlePermissionChange("endpointGroups", op, e.target.checked)}
                              className="rounded"
                            />
                            <Label htmlFor={`endpointGroups:${op}`} className="text-sm capitalize">
                              {op}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Event Types</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {["create", "read", "update", "delete"].map(op => (
                          <div key={`eventTypes:${op}`} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`eventTypes:${op}`}
                              checked={selectedPermissions.eventTypes.includes(op)}
                              onChange={e => handlePermissionChange("eventTypes", op, e.target.checked)}
                              className="rounded"
                            />
                            <Label htmlFor={`eventTypes:${op}`} className="text-sm capitalize">
                              {op}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Messages</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {["create", "read", "update", "delete"].map(op => (
                          <div key={`messages:${op}`} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`messages:${op}`}
                              checked={selectedPermissions.messages.includes(op)}
                              onChange={e => handlePermissionChange("messages", op, e.target.checked)}
                              className="rounded"
                            />
                            <Label htmlFor={`messages:${op}`} className="text-sm capitalize">
                              {op}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || !currentEnvironment || isCreating || !!environmentValidationError}
              >
                {isCreating ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first API key to start using the webhook service.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {apiKeys.map(apiKey => (
            <Card key={apiKey.id} className="gap-2">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 mb-1">
                      {apiKey.name}
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          apiKey.enabled
                            ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200"
                            : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200"
                        }`}
                      >
                        {apiKey.enabled ? "Active" : "Disabled"}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Created {new Date(apiKey.createdAt).toLocaleDateString()}
                      <span>
                        {" "}
                        •{" "}
                        {apiKey.lastRequest
                          ? `Last used ${new Date(apiKey.lastRequest!).toLocaleDateString()}`
                          : "Never Used"}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={apiKey.enabled ? "outline" : "default"}
                      size="sm"
                      onClick={() => onToggleKey(apiKey.id, !apiKey.enabled)}
                    >
                      {apiKey.enabled ? "Disable" : "Enable"}
                    </Button>
                    {apiKey.key && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(apiKey.key)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteKey(apiKey.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {apiKey.key && (
                    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            Important: Save this key now
                          </h3>
                          <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-200">
                            <p>
                              This is the only time you'll be able to see the full API key. Make sure to copy and save
                              it securely.
                            </p>
                          </div>
                        </div>
                        {onDismissRawKey && (
                          <div className="ml-3 flex-shrink-0">
                            <button
                              onClick={() => onDismissRawKey(apiKey.id)}
                              className="text-yellow-400 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-600"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">API Key</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <CopyableCode
                        className="bg-muted px-2 py-1 rounded text-sm font-mono flex-1"
                        copyText={apiKey.key || ""}
                      >
                        {formatKey(apiKey.key, apiKey.start)}
                      </CopyableCode>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Permissions</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {!apiKey.permissions ? (
                        <span className="bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded">
                          No permissions
                        </span>
                      ) : JSON.stringify(apiKey.permissions) === JSON.stringify(fullPermission) ? (
                        <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded">
                          Full Access
                        </span>
                      ) : (
                        Object.keys(apiKey.permissions || {})
                          .map(permission => {
                            const operations = apiKey.permissions?.[permission];
                            // Check if operations is an array before mapping
                            if (!Array.isArray(operations)) {
                              return null;
                            }

                            // Check if all CRUD operations are present
                            const crudOps = ["create", "read", "update", "delete"];
                            const hasAllCrud = crudOps.every(op => operations.includes(op));

                            if (hasAllCrud) {
                              return (
                                <span
                                  key={`${permission}:all`}
                                  className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded"
                                >
                                  {permission.charAt(0).toUpperCase() + permission.slice(1)} - All
                                </span>
                              );
                            }

                            return operations.map(operation => (
                              <span
                                key={`${permission}:${operation}`}
                                className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded"
                              >
                                {permission.charAt(0).toUpperCase() + permission.slice(1)} -{" "}
                                {operation.charAt(0).toUpperCase() + operation.slice(1)}
                              </span>
                            ));
                          })
                          .filter(Boolean)
                          .flat()
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone and will immediately revoke
              access for any applications using this key.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
