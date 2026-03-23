// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as Next } from "./.open-next/worker.js";
import { default as Api } from "@/lib/publicApi";
import { reconcileProxyHealth } from "@/lib/proxyHealth";
import { reconcileStalePendingMessages } from "@/lib/queue/reconcile";
import { DestinationConsumer } from "@/lib/queue/DestinationConsumer";

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;

    if (pathname.startsWith("/api/v1")) {
      return Api.fetch(request, env, ctx);
    }

    return Next.fetch(request, env, ctx);
  },
  async queue(batch, env) {
    await new DestinationConsumer(env).processBatch(batch);
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(reconcileStalePendingMessages(env));
    ctx.waitUntil(reconcileProxyHealth(env));
  },
} satisfies ExportedHandler<CloudflareEnv>;

// @ts-ignore `.open-next/worker.js` is generated at build time
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
