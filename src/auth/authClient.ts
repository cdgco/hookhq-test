import { cloudflareClient } from "better-auth-cloudflare/client";
import { createAuthClient } from "better-auth/react";
import { adminClient, apiKeyClient, twoFactorClient } from "better-auth/client/plugins"

const client = createAuthClient({
  plugins: [cloudflareClient(), apiKeyClient(), adminClient(), twoFactorClient()],
});

export default client;
