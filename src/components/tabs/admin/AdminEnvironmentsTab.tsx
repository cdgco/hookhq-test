"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Trash2, AlertTriangle, Calendar, Shield } from "lucide-react";
import { useEnvironment, Environment } from "@/components/providers/EnvironmentProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { publicApiFetch } from "@/lib/publicApi/utils";

export default function AdminEnvironmentsTab() {
  const { environments, loading, refreshEnvironments } = useEnvironment();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [environmentToDelete, setEnvironmentToDelete] = useState<Environment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (environment: Environment) => {
    setEnvironmentToDelete(environment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!environmentToDelete) return;

    setIsDeleting(true);
    try {
      const response = await publicApiFetch(`/environments/${environmentToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete environment");
      }

      // Refresh the environments list
      await refreshEnvironments();
      setDeleteDialogOpen(false);
      setEnvironmentToDelete(null);
    } catch (error) {
      console.error("Failed to delete environment:", error);
      alert("Failed to delete environment. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setEnvironmentToDelete(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-gray-600">Loading environments...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Environment Management
          </CardTitle>
          <CardDescription>
            Manage and delete environments. Be careful when deleting environments as this action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {environments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No environments found.</div>
            ) : (
              <div className="grid gap-4">
                {environments.map(environment => (
                  <div
                    key={environment.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Globe className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-medium text-foreground truncate">{environment.name}</h3>
                          {environment.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        {environment.description && (
                          <p className="text-sm text-muted-foreground mt-1">{environment.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Created {new Date(environment.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {environment.isDefault ? (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Shield className="h-3 w-3" />
                          <span>Protected</span>
                        </div>
                      ) : (
                        <Dialog
                          open={deleteDialogOpen && environmentToDelete?.id === environment.id}
                          onOpenChange={setDeleteDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(environment)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                Delete Environment
                              </DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete the environment "{environment.name}"? This action cannot
                                be undone and will permanently remove all associated data.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-4">
                                <div className="flex">
                                  <AlertTriangle className="h-5 w-5 text-red-400" />
                                  <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                                      Warning: This action is irreversible
                                    </h3>
                                    <div className="mt-2 text-sm text-red-700 dark:text-red-200">
                                      <ul className="list-disc list-inside space-y-1">
                                        <li>All webhook endpoints in this environment will be deleted</li>
                                        <li>All API keys in this environment will be deleted</li>
                                        <li>All webhook messages and logs will be deleted</li>
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={handleDeleteCancel}>
                                Cancel
                              </Button>
                              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                                {isDeleting ? "Deleting..." : "Delete Environment"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
