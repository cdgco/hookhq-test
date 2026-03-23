import { initAuth } from "@/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardOverview } from "@/components/DashboardOverview";
import { isApiDocsEnabled } from "@/lib/publicApi/docs";

export default async function DashboardPage() {
  const authInstance = await initAuth();
  // Fetch session using next/headers per better-auth docs for server components
  const session = await authInstance.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/"); // Redirect to home if no session
  }

  const { env } = await getCloudflareContext({ async: true });

  return (
    <div className="flex flex-col min-h-screen font-[family-name:var(--font-geist-sans)]">
      <DashboardOverview apiDocsEnabled={isApiDocsEnabled(env.NEXT_PUBLIC_API_DOCS_ENABLED)} />
    </div>
  );
}
