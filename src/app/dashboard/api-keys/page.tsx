import { initAuth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ApiKeyTab from "@/components/tabs/ApiKeyTab";

export default async function DashboardPage() {
  const authInstance = await initAuth();
  // Fetch session using next/headers per better-auth docs for server components
  const session = await authInstance.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/"); // Redirect to home if no session
  }

  return (
    <div className="flex flex-col min-h-screen font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col items-center justify-center">
        <ApiKeyTab />
      </main>
    </div>
  );
}
