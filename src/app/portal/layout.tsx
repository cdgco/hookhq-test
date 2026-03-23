"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import { PortalTokenPayload } from "@/lib/portalAuth";
import type React from "react";
import {
  X,
  LayoutDashboard,
  Webhook,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  MenuIcon,
  ArrowLeft,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createContext, useContext } from "react";

const navigation = [
  { name: "Dashboard", href: "/portal", current: false, icon: LayoutDashboard },
  { name: "Endpoints", href: "/portal/endpoints", current: false, icon: Webhook },
];

// Create Portal Context
interface PortalContextType {
  payload: PortalTokenPayload;
  token: string;
  theme: "light" | "dark";
  hasThemeParam: boolean;
  themeWasLocked: boolean;
  isEmbedded: boolean;
  breadcrumbTitle?: string;
  setBreadcrumbTitle?: (title: string | undefined) => void;
}

const PortalContext = createContext<PortalContextType | null>(null);

// Hook to use portal context
export function usePortalContext() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error("usePortalContext must be used within PortalProvider");
  }
  return context;
}

function PortalLayout({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hasThemeParam, setHasThemeParam] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [authState, setAuthState] = useState<{
    loading: boolean;
    authenticated: boolean;
    payload?: PortalTokenPayload;
    error?: string;
  }>({
    loading: true,
    authenticated: false,
  });

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionTheme, setSessionTheme] = useState<"light" | "dark">("light");
  const [themeWasLocked, setThemeWasLocked] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [breadcrumbTitle, setBreadcrumbTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Check for token in query params first, then session storage
    const urlToken = searchParams.get("token");
    const storedToken = sessionStorage.getItem("portal_token");
    const token = urlToken || storedToken;

    if (!token) {
      setAuthState({
        loading: false,
        authenticated: false,
        error: "No access token provided",
      });
      return;
    }

    // Store token in session if it came from URL
    if (urlToken && urlToken !== storedToken) {
      sessionStorage.setItem("portal_token", urlToken);
      setSessionToken(urlToken);
    } else if (storedToken) {
      setSessionToken(storedToken);
    }

    // Verify token on server side
    fetch(`/api/portal/verify?token=${encodeURIComponent(token)}`)
      .then(response => response.json())
      .then((data: any) => {
        if (data.valid) {
          setAuthState({
            loading: false,
            authenticated: true,
            payload: data.payload,
          });
        } else {
          setAuthState({
            loading: false,
            authenticated: false,
            error: data.error || "Token verification failed",
          });
          // Clear invalid token from session
          sessionStorage.removeItem("portal_token");
        }
      })
      .catch(error => {
        setAuthState({
          loading: false,
          authenticated: false,
          error: "Failed to verify token",
        });
        // Clear token from session on error
        sessionStorage.removeItem("portal_token");
      });
  }, [searchParams]);

  // Handle theme parameter
  useEffect(() => {
    const themeParam = searchParams.get("theme");
    const storedTheme = sessionStorage.getItem("portal_theme") as "light" | "dark" | null;
    const storedThemeWasLocked = sessionStorage.getItem("portal_theme_locked") === "true";
    const hasParam = themeParam !== null;

    // Only set hasThemeParam to true if it's a locking theme (not "default")
    setHasThemeParam(hasParam && themeParam !== "default");

    if (hasParam) {
      if (themeParam === "default") {
        // theme=default unlocks the theme and allows user control
        setThemeWasLocked(false);
        sessionStorage.removeItem("portal_theme_locked");
        // Keep current theme or use default
        const currentTheme = storedTheme || "light";
        setTheme(currentTheme);
        setSessionTheme(currentTheme);

        // Apply theme to document
        if (currentTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      } else {
        // Lock theme to the parameter value and store it
        const themeValue = themeParam as "light" | "dark";
        setTheme(themeValue);
        setSessionTheme(themeValue);
        setThemeWasLocked(true);
        sessionStorage.setItem("portal_theme", themeValue);
        sessionStorage.setItem("portal_theme_locked", "true");

        // Apply theme to document
        if (themeValue === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    } else {
      // No theme param, use stored theme or default
      const themeValue = storedTheme || "light";
      setTheme(themeValue);
      setSessionTheme(themeValue);
      setThemeWasLocked(storedThemeWasLocked);

      // Apply theme to document
      if (themeValue === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [searchParams]);

  // Handle embed parameter
  useEffect(() => {
    const embedParam = searchParams.get("embed");
    const storedEmbed = sessionStorage.getItem("portal_embed") === "true";
    const isEmbeddedValue = embedParam === "true" || storedEmbed;

    setIsEmbedded(isEmbeddedValue);

    // Store embed state in session if it came from URL
    if (embedParam === "true") {
      sessionStorage.setItem("portal_embed", "true");
    } else if (embedParam === "false") {
      sessionStorage.removeItem("portal_embed");
    }
  }, [searchParams]);

  // Cleanup session storage on unmount
  useEffect(() => {
    return () => {
      // Only clear session storage if we're leaving the portal entirely
      // This will be handled by the browser when the tab is closed
    };
  }, []);

  const toggleTheme = () => {
    // Only allow theme toggle when no theme parameter is present and theme wasn't originally locked
    if (!hasThemeParam && !themeWasLocked) {
      const newTheme = theme === "light" ? "dark" : "light";
      setTheme(newTheme);
      setSessionTheme(newTheme);
      sessionStorage.setItem("portal_theme", newTheme);
      // Clear the locked flag since user manually changed theme
      sessionStorage.removeItem("portal_theme_locked");
      document.documentElement.classList.toggle("dark");
    }
  };

  const handleBackClick = () => {
    // Clear session storage when leaving portal
    sessionStorage.removeItem("portal_token");
    sessionStorage.removeItem("portal_theme");
    sessionStorage.removeItem("portal_theme_locked");
    sessionStorage.removeItem("portal_embed");

    if (payload.returnUrl) {
      window.location.href = payload.returnUrl;
    } else {
      window.history.back();
    }
  };

  const currentPage = navigation.find(item => item.href === pathname);

  if (authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoaderCircle className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Portal...</p>
        </div>
      </div>
    );
  }

  if (!authState.authenticated || !authState.payload) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <Alert variant="destructive">
            <AlertDescription className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Invalid or expired token
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { payload } = authState;

  // If embedded, show only content with solid background
  if (isEmbedded) {
    return (
      <div className={`min-h-screen ${theme === "dark" ? "bg-black" : "bg-white"}`}>
        <main className="p-6">
          <PortalContext.Provider
            value={{
              payload: authState.payload!,
              token: sessionToken || searchParams.get("token")!,
              theme: theme,
              hasThemeParam: hasThemeParam,
              themeWasLocked: themeWasLocked,
              isEmbedded: isEmbedded,
            }}
          >
            {children}
          </PortalContext.Provider>
        </main>
      </div>
    );
  }

  return (
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
              <Button variant="ghost" size="icon" onClick={handleBackClick} className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {!collapsed && (
                <span className="text-lg">{payload.applicationName ? payload.applicationName : "Go Back"}</span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map(item => {
              const isActive = pathname === item.href;
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
          {!hasThemeParam && !themeWasLocked && (
            <div className="border-t border-border p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className={cn("w-full gap-2 bg-transparent", collapsed ? "justify-center px-0" : "justify-start")}
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
            </div>
          )}
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
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="h-9 w-9">
              {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
            <div className="h-6 w-px bg-border" />
          </div>

          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </Button>

          {/* Breadcrumb with Environment Selector */}
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbTitle ? (
              <span className="font-medium">{breadcrumbTitle}</span>
            ) : currentPage ? (
              <span className="font-medium">{currentPage.name}</span>
            ) : null}
          </div>
        </header>

        {/* Page content */}
        <main className="texture-overlay min-h-[calc(100vh-4rem)] p-6">
          <PortalContext.Provider
            value={{
              payload: authState.payload!,
              token: sessionToken || searchParams.get("token")!,
              theme: theme,
              hasThemeParam: hasThemeParam,
              themeWasLocked: themeWasLocked,
              isEmbedded: isEmbedded,
              breadcrumbTitle: breadcrumbTitle,
              setBreadcrumbTitle: setBreadcrumbTitle,
            }}
          >
            {children}
          </PortalContext.Provider>
        </main>
      </div>
    </div>
  );
}

export default function PortalPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <LoaderCircle className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <PortalLayout>{children}</PortalLayout>
    </Suspense>
  );
}
