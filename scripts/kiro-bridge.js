import localtunnel from 'localtunnel';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROXY_PORT = 3001; // The port your Kiro proxy runs on

console.log("\n========================================================");
console.log("🚀 Starting Apple Juice Kiro Bridge");
console.log("========================================================\n");

// 1. Start the local Kiro proxy
console.log("⏳ Starting local kiro-proxy...");
const proxyProcess = spawn('node', ['--experimental-strip-types', 'kiro-proxy/server.ts'], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, PORT: String(PROXY_PORT) },
  stdio: 'pipe',
  shell: process.platform === 'win32'
});

proxyProcess.stdout.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`[Proxy]: ${msg}`);
});

proxyProcess.stderr.on('data', (data) => {
  console.error(`[Proxy Error]: ${data.toString().trim()}`);
});

// 2. Wait a moment and then start the tunnel
setTimeout(async () => {
  try {
    console.log(`\n⏳ Opening secure tunnel to port ${PROXY_PORT}...`);
    const tunnel = await localtunnel({ port: PROXY_PORT });
    
    console.log("\n========================================================");
    console.log("✅ Kiro Bridge is LIVE!");
    console.log("========================================================");
    console.log(`\n🔗 Your Public Kiro API URL:\n\n   ${tunnel.url}/v1\n`);
    console.log("👉 INSTRUCTIONS:");
    console.log("1. Copy the URL above.");
    console.log("2. Go to your Vercel Dashboard for apple-juice.");
    console.log("3. Navigate to Settings -> Environment Variables.");
    console.log("4. Set KIRO_API_URL to the URL above and hit Save.");
    console.log("5. Vercel will now perfectly communicate with your local CLI!");
    console.log("\n(Keep this window open while you are developing)");
    console.log("========================================================\n");

    tunnel.on('close', () => {
      console.log("Tunnel closed.");
      proxyProcess.kill();
      process.exit(0);
    });

  } catch (err) {
    console.error("Failed to start tunnel:", err);
    proxyProcess.kill();
    process.exit(1);
  }
}, 3000);

// Cleanup on exit
process.on('SIGINT', () => {
  console.log("\nShutting down bridge...");
  proxyProcess.kill();
  process.exit(0);
});
