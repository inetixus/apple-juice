# 🧃 Apple Juice

### **The Next-Generation AI Infrastructure for Roblox Developers**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19+-blue?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0+-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**The first AI Code Tool for Roblox developers.** Turn dream ideas into working Luau prototypes — with instant Studio sync, from either a polished web dashboard or a Claude-Code-style terminal.

Apple Juice bridges the gap between powerful LLMs and Roblox Studio, providing a premium, developer-centric interface for generating, refining, and deploying scripts directly into your games — and, in MCP mode, letting an agent make live, interactive edits inside your Studio session.

![Apple Juice Preview](https://via.placeholder.com/1200x600/0a0c14/ccff00?text=Apple+Juice+Dashboard+Preview) *(Replace with actual screenshot)*

## ✨ Key Features

- **🚀 Instant Studio Sync**: Pair your session with the Roblox Studio plugin. Generate a script in the dashboard or CLI and it appears in your game instantly.
- **�️ Web + CLI**: Use the Next.js dashboard or the `aj` terminal app (slash commands, live activity feed, model picker, themes).
- **🤖 Agentic generation**: An autonomous loop writes → syncs → playtests → reads runtime errors → auto-fixes (bounded retries), so generated code actually runs.
- **🔌 True MCP mode (opt-in)**: A cloud agent makes live, interactive `studio_*` tool calls (read / write / create / playtest) into your Studio session over a custom MCP bridge — available in both the web app and the CLI via `/mcp`.
- **� UI library awareness**: For UI prompts, the agent uses the bundled AppleJuiceUI library and auto-deploys it when needed so `require("AppleJuiceUI")` resolves at runtime.
- **� Luau validation**: Generated code is sanity-checked (balanced brackets/strings, structure) before it reaches Studio.
- **🧮 Smart model routing**: On "Auto", prompts are routed by complexity (lightweight models for trivial edits, stronger models for architecture-level work).
- **🔑 Flexible credentials**: Use the shared-credit system out of the box, or bring your own key (BYOK) — your own keys stay in your browser and never touch our servers.
- **🎨 Premium UX**: Built with Next.js 15, React 19, Framer Motion, and Shadcn UI.

## 🧰 Plans & the mL of Juice system

Usage is metered in **mL of Juice**, a token-based unit (input tokens + 6× output tokens, scaled by a per-model multiplier). Allowances refill daily; Juice Box purchases add stackable bonus mL.

| Plan | Price | Daily mL | Projects | Models |
|------|-------|----------|----------|--------|
| Free | $0 | 1,000 | 2 | Efficient open-weight + Auto |
| Partner | Invite-only | 3,000 | 3 | Same as Free |
| Fresh Pro | $19/mo | 5,000 | 3 | + Sonnet family |
| Pure Ultra | $49/mo | 15,000 | 8 | + Opus family |

> **Priority speed**: higher tiers get faster service end-to-end — they skip (or
> minimize) the load-based generation queue *and* their Studio plugin polls on a
> tighter cadence (Ultra ~0.1s → Free ~0.4s), so generated code and live MCP edits
> land in Studio sooner under load.

> **Partner** is a non-purchasable tier for partnered creators/studios — granted via a private code (`PARTNER_CODE`), it sits between Free and Pro on allowance.
> BYOK users bypass mL entirely and pay their own provider directly.

## 🛠️ How It Works

1. **Connect**: Sign in and get your unique **Pairing Session Code** (or run `aj pair` in the CLI).
2. **Configure**: Use the shared-credit system, or add your own provider key.
3. **Generate**: Describe your script in natural language. The Studio plugin polls the server and injects the code directly into your project.
4. **(Optional) Go agentic / MCP**: Turn on Autonomous mode (web) or `/mcp on` (CLI) to let the agent edit, playtest, and self-correct live in Studio.

## 🚀 Getting Started

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/inetixus/apple-juice.git
   cd apple-juice
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Environment Variables**:
   Create a `.env.local` file in the root directory (see `.env.example` for the full list):
   ```env
   # Next Auth (Roblox Provider)
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_secret_here
   ROBLOX_CLIENT_ID=your_roblox_client_id
   ROBLOX_CLIENT_SECRET=your_roblox_client_secret

   # Storage / session management (KV)
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token

   # Shared-credit inference (optional)
   KIRO_API_KEY=your_kiro_api_key
   KIRO_API_URL=https://api.kiro.dev/v1

   # Optional agent paths (leave unset to disable; standard path still works)
   KIRO_AGENT_URL=   # Stage-2 snapshot/diff agent on the VPS proxy
   KIRO_MCP_URL=     # TRUE MCP bridge (live interactive studio_* tool calls)
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the dashboard**:
   Navigate to [http://localhost:3000](http://localhost:3000).

### CLI (`aj`)

```bash
# Build the bundled CLI
npm run build:cli

# Run it (dev, via tsx/strip-types)
npm run aj
```

Inside a session: `/pair`, `/model`, `/sync <file>`, `/mcp [on|off]`, `/status`, `/help`.

### Studio Plugin

Install the Apple Juice plugin (`plugin/AppleJuiceSync.lua`) in Roblox Studio, then run `/pair` (CLI) or grab the pairing code from the dashboard to link your session.

## 🏗️ Architecture

```
Web dashboard ─┐
               ├─> /api/chat ─> shared-credit inference (Kiro) ──> generated Luau
aj CLI ────────┘                │
                                ├─ Agent path (KIRO_AGENT_URL): snapshot -> edit -> diff
                                └─ MCP path  (KIRO_MCP_URL): live studio_* tool calls
                                                │  via custom poll bridge
                                                ▼
                                     Roblox Studio plugin (injects / playtests)
```

## 🧰 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4.0](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) / [Radix UI](https://www.radix-ui.com/)
- **Storage**: KV (Upstash Redis / Turso adapter)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **CLI**: TypeScript + esbuild bundle, packaged with `pkg`
- **Agent bridge**: Node MCP server (`@modelcontextprotocol/sdk`) on a VPS proxy

## 🤝 Contributing

Contributions are welcome! Whether it's fixing bugs, adding new features, or improving documentation, feel free to open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with 🧃 for the Roblox Community by [inetixus](https://github.com/inetixus)
