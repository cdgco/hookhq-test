"use client";

import ApiKeyManager from "@/components/ApiKeyManager";
import { useState, useEffect } from "react";
import authClient from "@/auth/authClient";
import { ApiKey } from "@/lib/apiKeys";

export default function ApiKeyTab() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    const { data, error } = await authClient.apiKey.list();

    if (error) {
      setError(error.message || "An error occurred");
    } else {
      setApiKeys(data as ApiKey[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleCreateKey = async (name: string, permissions: Record<string, string[]>, environment: string) => {
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, permissions, environment }),
      });

      if (!response.ok) {
        throw new Error("Failed to create API key");
      }

      const newKeyData = (await response.json()) as ApiKey;
      // Mark the new key to show raw key with warning
      setApiKeys(prev => [...prev, newKeyData]);

      // Auto-dismiss the warning after 30 seconds
      setTimeout(() => {
        handleDismissRawKey(newKeyData.id);
      }, 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
      throw err;
    }
  };

  const handleDeleteKey = async (id: string) => {
    const { data, error } = await authClient.apiKey.delete({
      keyId: id,
    });

    if (error) {
      setError(error.message || "An error occurred");
    } else {
      setApiKeys(prev => prev.filter(key => key.id !== id));
    }
  };

  const handleToggleKey = async (id: string, enabled: boolean) => {
    const { data, error } = await authClient.apiKey.update({
      keyId: id,
      enabled,
    });

    if (error) {
      setError(error.message || "An error occurred");
    } else {
      setApiKeys(prev => prev.map(key => (key.id === id ? { ...key, enabled } : key)));
    }
  };

  const handleDismissRawKey = (id: string) => {
    setApiKeys(prev => prev.map(key => (key.id === id ? { ...key, showRawKey: false } : key)));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Loading API keys...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <ApiKeyManager
      apiKeys={apiKeys}
      onCreateKey={handleCreateKey}
      onDeleteKey={handleDeleteKey}
      onToggleKey={handleToggleKey}
      onDismissRawKey={handleDismissRawKey}
    />
  );
}
