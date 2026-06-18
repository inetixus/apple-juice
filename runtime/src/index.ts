/**
 * Apple Juice Runtime — entrypoint.
 *
 * Starts the loopback bridge that wraps the OFFICIAL Roblox Studio MCP server
 * and exposes it (securely, loopback-only) to the Apple Juice web dashboard.
 * Print the pair code for the user to enter on the dashboard.
 */

import { startBridgeServer } from "./bridge-server.ts";

const ALLOWED_ORIGINS = (process.env.AJ_ALLOWED_ORIGINS ||
  "https://apple-juice.online")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// The runtime's agent loop proxies LLM turns to the website's runtime inference
// route (src/app/api/runtime/v1/chat/completions). inference.ts appends
// "/v1/chat/completions", so the base must be the ".../api/runtime" prefix.
// That route authenticates the session key, meters credits, and forwards to the
// Kiro VPS server-to-server. Override with AJ_INFERENCE_URL for local testing
// (e.g. http://localhost:3000/api/runtime).
const INFERENCE_BASE_URL =
  process.env.AJ_INFERENCE_URL || "https://apple-juice.online/api/runtime";

// The dashboard discovers the Runtime by probing a small set of fixed loopback
// ports (see src/lib/runtime-client.ts DEFAULT_CANDIDATE_PORTS). Default to the
// first of those so detection works out of the box; override with AJ_RUNTIME_PORT.
const DEFAULT_RUNTIME_PORT = 48_321;

async function main() {
  const handle = await startBridgeServer({
    port: Number(process.env.AJ_RUNTIME_PORT || DEFAULT_RUNTIME_PORT),
    allowedOrigins: ALLOWED_ORIGINS,
    inferenceBaseUrl: INFERENCE_BASE_URL,
    log: (msg) => console.error(`[apple-juice-runtime] ${msg}`),
  });

  // Human-facing banner (stdout) with the pair code.
  console.log("");
  console.log("  🍎 Apple Juice Runtime");
  console.log(`  Local bridge: http://127.0.0.1:${handle.port}`);
  console.log(`  Pair code:    ${handle.pairCode}`);
  console.log("  Enter this code at https://apple-juice.online/connect");
  console.log("");

  const shutdown = () => {
    void handle.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[apple-juice-runtime] fatal:", err);
  process.exit(1);
});
