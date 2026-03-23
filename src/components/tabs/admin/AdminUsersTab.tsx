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
import {
  RefreshCw,
  Users,
  Mail,
  Calendar,
  Trash2,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";
import authClient from "@/auth/authClient";
import { UserWithRole } from "better-auth/plugins";

export default function AdminUsersTab() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit dialog states
  const [showEditEmailDialog, setShowEditEmailDialog] = useState(false);
  const [showEditPasswordDialog, setShowEditPasswordDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "user" as "admin" | "user",
    sendInviteEmail: true,
    password: "",
  });

  // Edit form states
  const [editEmailData, setEditEmailData] = useState({
    email: "",
  });

  const [editPasswordData, setEditPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await authClient.admin.listUsers({
      query: {
        searchValue: "some name",
        searchField: "name",
        searchOperator: "contains",
        limit: 100,
        offset: 100,
        sortBy: "name",
        sortDirection: "desc",
        filterField: "email",
        filterValue: "hello@example.com",
        filterOperator: "eq",
      },
    });

    if (error) {
      setError(error.message || "An error occurred");
    } else {
      setUsers(data.users);
    }

    setLoading(false);
  };

  const handleCreateUser = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);

    const { data: newUser, error } = await authClient.admin.createUser({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      role: formData.role,
    });

    if (error) {
      setError(error.message || "Failed to create user");
    } else {
      setUsers(prev => [...prev, newUser.user]);
      setShowCreateDialog(false);
      setFormData({
        email: "",
        name: "",
        role: "user",
        sendInviteEmail: true,
        password: "",
      });
      setSuccess("User created successfully!");
      setTimeout(() => setSuccess(null), 3000);
    }

    setCreating(false);
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    if (isActive) {
      await authClient.admin.unbanUser({
        userId: userId,
      });
    } else {
      await authClient.admin.banUser({
        userId: userId,
      });
    }

    setUsers(prev => prev.map(user => (user.id === userId ? { ...user, isActive } : user)));
    setSuccess(`User ${isActive ? "activated" : "deactivated"} successfully!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    const { data: deletedUser, error } = await authClient.admin.removeUser({
      userId: userId,
    });

    if (error) {
      setError(error.message || "Failed to delete user");
    } else {
      setUsers(prev => prev.filter(user => user.id !== userId));
      setSuccess("User deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleEditEmail = (user: UserWithRole) => {
    setEditingUser(user);
    setEditEmailData({ email: user.email });
    setShowEditEmailDialog(true);
  };

  const handleEditPassword = (user: UserWithRole) => {
    setEditingUser(user);
    setEditPasswordData({ newPassword: "", confirmPassword: "" });
    setShowEditPasswordDialog(true);
  };

  const handleUpdateEmail = async () => {
    if (!editingUser) return;

    if (!editEmailData.email.trim()) {
      setError("Email is required");
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccess(null);

    const { data, error } = await authClient.admin.updateUser({
      userId: editingUser.id,
      data: {
        email: editEmailData.email.trim(),
      },
    });

    if (error) {
      setError(error.message || "Failed to update email");
    } else {
      setUsers(prev =>
        prev.map(user => (user.id === editingUser.id ? { ...user, email: editEmailData.email.trim() } : user))
      );
      setShowEditEmailDialog(false);
      setEditingUser(null);
      setSuccess("Email updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    }

    setUpdating(false);
  };

  const handleUpdatePassword = async () => {
    if (!editingUser) return;

    if (!editPasswordData.newPassword.trim()) {
      setError("New password is required");
      return;
    }

    if (editPasswordData.newPassword !== editPasswordData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (editPasswordData.newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccess(null);

    const { data, error } = await authClient.admin.setUserPassword({
      newPassword: editPasswordData.newPassword,
      userId: editingUser.id,
    });

    if (error) {
      setError(error.message || "Failed to update password");
    } else {
      setShowEditPasswordDialog(false);
      setEditingUser(null);
      setEditPasswordData({ newPassword: "", confirmPassword: "" });
      setSuccess("Password updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    }

    setUpdating(false);
  };

  const handleCancelEdit = () => {
    setShowEditEmailDialog(false);
    setShowEditPasswordDialog(false);
    setEditingUser(null);
    setEditEmailData({ email: "" });
    setEditPasswordData({ newPassword: "", confirmPassword: "" });
    setError(null);
  };

  const getRoleBadge = (role: string) => {
    return <Badge variant={role === "admin" ? "default" : "secondary"}>{role === "admin" ? "Admin" : "User"}</Badge>;
  };

  const getStatusBadge = (isActive: boolean) => {
    return <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Inactive"}</Badge>;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900 dark:border-red-800">
          <CardContent className="flex items-center space-x-2 px-4">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
            <span className="text-red-800 dark:text-red-300">{error}</span>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center space-x-2 px-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800">{success}</span>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">User Management</h3>
          <p className="text-muted-foreground">Manage users and their permissions</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Create a new user account and send them an invitation email.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "admin" | "user") => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sendInviteEmail"
                  checked={formData.sendInviteEmail}
                  onChange={e => setFormData({ ...formData, sendInviteEmail: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="sendInviteEmail">Send invitation email</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={creating || !formData.email}>
                  {creating ? "Creating..." : "Create User"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users List */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Users</h3>
            <p className="text-muted-foreground text-center mb-4">Create your first user to get started.</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users.map(user => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{user.name || "Unnamed User"}</CardTitle>
                      <CardDescription className="flex items-center space-x-2">
                        <Mail className="h-4 w-4" />
                        <span>{user.email}</span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getRoleBadge(user.role || "user")}
                    {getStatusBadge(user.banned || false)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Created</div>
                      <div className="text-muted-foreground">{formatDate(user.createdAt)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditEmail(user)} title="Edit Email">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditPassword(user)} title="Change Password">
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggleUserStatus(user.id, !user.banned)}>
                    {user.banned ? "Activate" : "Deactivate"}
                  </Button>
                  {user.role !== "admin" && (
                    <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Email Dialog */}
      <Dialog open={showEditEmailDialog} onOpenChange={setShowEditEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Email</DialogTitle>
            <DialogDescription>
              Update the email address for {editingUser?.name || editingUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmailData.email}
                onChange={e => setEditEmailData({ email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button onClick={handleUpdateEmail} disabled={updating || !editEmailData.email.trim()}>
                {updating ? "Updating..." : "Update Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Password Dialog */}
      <Dialog open={showEditPasswordDialog} onOpenChange={setShowEditPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change User Password</DialogTitle>
            <DialogDescription>Set a new password for {editingUser?.name || editingUser?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={editPasswordData.newPassword}
                  onChange={e => setEditPasswordData({ ...editPasswordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={editPasswordData.confirmPassword}
                onChange={e => setEditPasswordData({ ...editPasswordData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                minLength={8}
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                  <div className="mt-1 text-sm text-yellow-700">
                    The user will need to use this new password to log in. Consider notifying them of this change.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdatePassword}
                disabled={updating || !editPasswordData.newPassword.trim() || !editPasswordData.confirmPassword.trim()}
              >
                {updating ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
