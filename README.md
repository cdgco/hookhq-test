# HookHQ - Cloudflare Workers Webhooks-as-a-service

## About HookHQ

HookHQ is a Webhooks-as-a-service application built with Cloudflare Workers, allowing you to easily send webhooks from your application to your end users.

- Web based dashboard and API endpoints for managing webhooks
- API key based authentication for sending webhooks
- Webhook endpoint groups for batch operations
- Endpoint groups and event types for dispatching bulk webhooks
- External proxy support for static IP delivery
- Backoff, retry, and auto-disable policies

HookHQ is built on top of Cloudflare Workers, D1, and Queues running entirely on a single Cloudflare worker in Cloudflare's global network.

It utilizes Queues to dispatch webhooks, D1 for storing application/authentication data, and KV for caching and payload storage.

## Getting Started

### One Click Deploy

To deploy HookHQ to Cloudflare, click the button below.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/NuovarDev/HookHQ)

This will automatically setup the worker, D1 database, and Queue for you.

When prompted, enter a `AUTH_SECRET` value. You can generate one using `openssl rand -base64 32`.

### Manual Deployment

To deploy HookHQ manually, follow the steps below.

1. Install dependencies
   - `pnpm install`
2. Create the D1 database
   - `npx wrangler d1 create webhooks-db`
3. Create the KV namespace
   - `npx wrangler kv namespace create webhooks-kv`
4. Create the Queues
   - `npx wrangler queues create webhooks-queue`
   - `npx wrangler queues create webhooks-dlq`
5. Build the project
   - `pnpm build`
6. Deploy the project
   - `pnpm run deploy`
7. Set the `DESTINATION_ENCRYPTION_KEY` environment variable
   - `openssl rand -base64 32 | npx wrangler secret put DESTINATION_ENCRYPTION_KEY`
8. Set the `AUTH_SECRET` environment variable
   - `openssl rand -base64 32 | npx wrangler secret put AUTH_SECRET`

## API Documentation

The API documentation is available at `/api/v1/ui`.

To disable the API documentation, set the `NEXT_PUBLIC_API_DOCS_ENABLED` environment variable to `false`.

The public API reference is served directly by Hono at `/api/v1`, with the OpenAPI document available at `/api/v1/spec`.
