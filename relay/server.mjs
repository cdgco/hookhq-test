import { createServer } from "node:http";
import { createProxyRelayHandler } from "./handler.mjs";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const handler = createProxyRelayHandler();

createServer((request, response) => {
  void handler(request, response);
}).listen(PORT, () => {
  console.log(`HookHQ proxy relay listening on ${PORT}`);
});
