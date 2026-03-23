# HookHQ Relay

This package exports `createProxyRelayHandler()` so you can wrap it in the runtime you want.

## Google Cloud Functions

```js
import { http } from "@google-cloud/functions-framework";
import { createProxyRelayHandler } from "hookhq-relay";

http("relay", createProxyRelayHandler());
```

## Long-Lived Node Server

```js
import { createServer } from "node:http";
import { createProxyRelayHandler } from "hookhq-relay";

const handler = createProxyRelayHandler();

createServer((request, response) => {
  void handler(request, response);
}).listen(process.env.PORT || 3000);
```

Reference wrappers are also included in `examples/`.

## Endpoints

- `GET /health`
- `POST /proxy`

## Environment

- `PROXY_SECRET`
- `PORT` for the long-lived server variant

## Cloud Run

Use the included Dockerfile and set `PROXY_SECRET`.

## Cloud Run Functions

Deploy a tiny wrapper that imports `createProxyRelayHandler()` and registers it with your function platform.

## Release Workflow

The release workflow is tag-driven for versioned releases.
- First update `relay/package.json` and change the version there.
- Commit that version bump and push the commit to `main`.
- Then create a tag like `relay-v0.1.2` on that already-pushed commit.
- Push the tag by itself.

Example:
```bash
git add relay/package.json
git commit -m "Release relay 0.1.2"
git push origin main

git tag relay-v0.1.2
git push origin relay-v0.1.2
```