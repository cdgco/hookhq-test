"use client";

import authClient from "@/auth/authClient"; // Assuming default export from your authClient setup
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { usePathname } from "next/navigation";
import EnvironmentDropdown from "@/components/EnvironmentDropdown";
import { EnvironmentProvider } from "@/components/providers/EnvironmentProvider";
import EnvironmentGate from "@/components/EnvironmentGate";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { useTheme } from "next-themes";
import type React from "react";
import { useState } from "react";
import {
  X,
  LayoutDashboard,
  Webhook,
  BarChart3,
  Settings,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  MenuIcon,
  Server,
  History,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Image from "next/image";

const handleSignOut = async (router: AppRouterInstance) => {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        startTransition(() => {
          router.replace("/"); // Redirect to home page on sign out
        });
      },
      onError: err => {
        console.error("Sign out error:", err);
        router.replace("/");
      },
    },
  });
};

const user = {
  name: "Tom Cook",
  email: "tom@example.com",
  imageUrl:
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
};

const navigation = [
  { name: "Dashboard", href: "/dashboard", current: false, icon: LayoutDashboard },
  { name: "Endpoints", href: "/dashboard/endpoints", current: false, icon: Webhook, prefix: true },
  { name: "Proxy", href: "/dashboard/proxy", current: false, icon: Server, prefix: true },
  { name: "Log", href: "/dashboard/log", current: false, icon: History },
  { name: "Metrics", href: "/dashboard/metrics", current: false, icon: BarChart3 },
  { name: "Admin", href: "/dashboard/admin", current: false, adminOnly: true, icon: Settings, prefix: true },
] as const;
const userNavigation = (router: AppRouterInstance) => [
  { name: "Account", href: "/dashboard/account", current: false },
  { name: "API Keys", href: "/dashboard/api-keys", current: false },
  { name: "Sign out", href: "#", onClick: () => handleSignOut(router) },
];

function DashboardContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const currentPathName = [...navigation, ...userNavigation(router)]
    .map(item => {
      const isCurrent = (item as any).prefix ? pathname.startsWith(item.href) : item.href === pathname;

      return { ...item, current: isCurrent };
    })
    .find(item => item.current)?.name;

  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <EnvironmentProvider>
      <EnvironmentGate>
        <div className="min-h-screen bg-background">
          {/* Sidebar */}
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 border-r border-border bg-card transition-all duration-200 lg:translate-x-0",
              collapsed ? "w-16" : "w-64",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center border-b border-border px-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-black flex items-center justify-center dark:border-border dark:border">
                    <Image src="/logo.svg" alt="HookHQ" width={32} height={32} className="text-primary-foreground" />
                  </div>
                  {!collapsed && <span className="ml-1 font-mono text-2xl font-semibold">HookHQ</span>}
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 p-4">
                {navigation.map(item => {
                  const isActive = (item as any).prefix ? pathname.startsWith(item.href) : pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 border border-transparent px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "border-border bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        collapsed && "justify-center"
                      )}
                      onClick={() => setSidebarOpen(false)}
                      title={collapsed ? item.name : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* Theme Toggle */}
              <div className="border-t border-border p-4 flex flex-col gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTheme}
                  className={cn("w-full gap-2 bg-transparent justify-center rounded-none", collapsed ? "px-0" : "")}
                  title={collapsed ? (theme === "light" ? "Dark Mode" : "Light Mode") : undefined}
                >
                  {theme === "light" ? (
                    <>
                      <Moon className="h-4 w-4" />
                      {!collapsed && "Dark Mode"}
                    </>
                  ) : (
                    <>
                      <Sun className="h-4 w-4" />
                      {!collapsed && "Light Mode"}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSignOut(router)}
                  className={cn("w-full gap-2 bg-transparent justify-center rounded-none", collapsed ? "px-0" : "")}
                  title={collapsed ? "Sign Out" : undefined}
                >
                  <LogOut className="h-4 w-4" />
                  {!collapsed && "Sign Out"}
                </Button>
              </div>
            </div>
          </aside>

          {/* Mobile sidebar backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main content */}
          <div className={cn(collapsed ? "lg:pl-16" : "lg:pl-64", "transition-all duration-200")}>
            {/* Top bar */}
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-6">
              <div className="hidden lg:flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(!collapsed)}
                  className="h-9 w-9 rounded-none"
                >
                  {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
                <div className="h-6 w-px bg-border" />
              </div>

              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </Button>

              {/* Breadcrumb with Environment Selector */}
              <div className="flex items-center gap-2 text-sm">
                <EnvironmentDropdown />
                {currentPathName && (
                  <>
                    <span className="text-muted-foreground mr-3 font-medium">/</span>
                    <span className="font-medium">{currentPathName}</span>
                  </>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="h-8 w-8 border border-border dark:border-neutral-700 bg-muted flex items-center justify-center cursor-pointer">
                      <User className="h-5 w-5" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="mx-3 rounded-none">
                    {userNavigation(router).map(item =>
                      item.onClick ? (
                        <DropdownMenuItem
                          key={item.name}
                          onClick={item.onClick}
                          className="cursor-pointer rounded-none"
                        >
                          {item.name}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem key={item.name} className="cursor-pointer rounded-none">
                          <Link href={item.href}>{item.name}</Link>
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {/* Page content */}
            <main className="texture-overlay min-h-[calc(100vh-4rem)] p-6">{children}</main>
          </div>
        </div>
      </EnvironmentGate>
    </EnvironmentProvider>
  );
}

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="hookhq-theme"
    >
      <DashboardContent>{children}</DashboardContent>
    </ThemeProvider>
  );
}
