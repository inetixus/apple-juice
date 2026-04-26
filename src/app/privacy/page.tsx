export const metadata = {
  title: "Privacy Policy — Apple Juice",
  description:
    "How Apple Juice collects, uses, and protects your data. We use the official Roblox OAuth 2.0 API for authentication and never store your AI provider API keys.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#05050a] text-white px-6 py-20 lg:py-32 font-sans">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-16">
          <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#ccff00] mb-4">
            Legal
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-[#8a8f98] text-sm">
            Last updated: April 2026 &nbsp;·&nbsp; Effective: April 2026
          </p>
        </div>

        {/* Disclaimer banner */}
        <div className="mb-12 p-5 rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/5">
          <p className="text-sm text-white/70 leading-relaxed">
            <strong className="text-white">Independent project disclosure:</strong>{" "}
            Apple Juice is an independent, open-source developer tool. It is not affiliated
            with, endorsed by, or operated by Roblox Corporation. Roblox® is a registered
            trademark of Roblox Corporation.
          </p>
        </div>

        <div className="space-y-14 text-white/70 leading-relaxed text-[15px]">

          {/* Introduction */}
          <section>
            <p>
              Apple Juice (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is an independent,
              open-source developer tool. This Privacy Policy explains what information we collect,
              how we use it, and the rights you have over that information.
            </p>
            <p className="mt-4">
              By using Apple Juice you agree to the practices described below. If you do not agree,
              please discontinue use of the service.
            </p>
          </section>

          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              1. Authentication &amp; Roblox OAuth 2.0
            </h2>
            <p>
              Apple Juice authenticates users through the{" "}
              <strong className="text-white">official Roblox OAuth 2.0 authorization flow</strong>
              —a publicly available developer program provided by Roblox Corporation. The authorization
              screen you see during sign-in is hosted at <code className="text-white/60 bg-white/5 px-1.5 py-0.5 rounded text-sm">roblox.com</code> and is operated entirely by Roblox.
            </p>
            <ul className="mt-5 space-y-3 list-none">
              {[
                "Roblox shares your User ID and public profile data with us, exactly as displayed on the OAuth consent screen.",
                "We store your User ID and display name in an encrypted server-side session to keep you logged in.",
                "We NEVER receive, store, or transmit your Roblox account password.",
                "We NEVER receive your Robux balance, purchase history, inventory, or any financial data.",
                "You may revoke Apple Juice's access at any time from your Roblox account settings under "Connected Apps". Revocation immediately invalidates your Apple Juice session.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-[#ccff00] font-bold mt-0.5 flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5">
              OAuth tokens are held in encrypted, short-lived server-side sessions and are never
              exposed to third parties.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              2. AI Provider API Keys
            </h2>
            <p>
              Apple Juice supports user-supplied API keys for OpenAI and Google AI Studio.
            </p>
            <ul className="mt-5 space-y-3 list-none">
              {[
                "Your API keys are stored exclusively in your browser's localStorage on your own device.",
                "When you send a prompt, your browser transmits the key directly to the respective AI provider. Our servers are not in this data path.",
                "We never log, store, or have access to your personal API keys.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-[#ccff00] font-bold mt-0.5 flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5">
              If you use the platform&apos;s shared credit pool, your prompts are processed via
              our server-side integration. In this case, prompt text is transmitted to the AI
              provider through our server but is <strong className="text-white">not stored or
              logged</strong> beyond the duration of the request.
            </p>
          </section>

          {/* ── Data Flow Architecture Diagram ── */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-2">
              How Your Data Actually Flows
            </h2>
            <p className="mb-6 text-sm">
              Two separate paths exist. Your <strong className="text-white">API key</strong> never crosses the server boundary.
              Only your <strong className="text-white">prompt context</strong> is proxied — and only when using the shared credit pool.
            </p>

            {/* Diagram */}
            <div className="rounded-2xl border border-white/10 bg-[#080809] p-6 sm:p-8 font-mono text-sm overflow-x-auto">

              {/* Path A — Personal API Key (direct) */}
              <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#ccff00] mb-4">Path A — Personal API Key (Your Key)</p>
              <div className="flex items-center flex-wrap gap-0">
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-xs font-semibold whitespace-nowrap">Your Browser</div>
                  <p className="text-[10px] text-[#ccff00] mt-1">API Key in localStorage</p>
                </div>
                <div className="flex flex-col items-center mx-1">
                  <div className="flex items-center gap-0.5">
                    <div className="h-px w-8 bg-[#ccff00]" />
                    <span className="text-[#ccff00] text-xs">▶</span>
                  </div>
                  <p className="text-[10px] text-[#ccff00] mt-1 opacity-0">x</p>
                </div>

                {/* Server — crossed out */}
                <div className="flex flex-col items-center mx-1 relative">
                  <div className="px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-500/5 text-red-400/60 text-xs font-semibold whitespace-nowrap line-through">
                    Apple Juice Server
                  </div>
                  {/* Red X */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-red-500 font-black text-base">✕</span>
                  </div>
                  <p className="text-[10px] text-red-500 mt-1">Key never crosses here</p>
                </div>

                <div className="flex flex-col items-center mx-1">
                  <div className="flex items-center gap-0.5">
                    <div className="h-px w-8 bg-[#ccff00]" />
                    <span className="text-[#ccff00] text-xs">▶</span>
                  </div>
                  <p className="text-[10px] text-[#ccff00] mt-1 opacity-0">x</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2.5 rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/5 text-[#ccff00] text-xs font-semibold whitespace-nowrap">OpenAI / Google</div>
                  <p className="text-[10px] text-[#8a8f98] mt-1">Direct request</p>
                </div>

                <div className="flex flex-col items-center mx-1">
                  <div className="flex items-center gap-0.5">
                    <div className="h-px w-8 bg-white/20" />
                    <span className="text-white/20 text-xs">▶</span>
                  </div>
                  <p className="text-[10px] text-[#8a8f98] mt-1">Code back</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-xs font-semibold whitespace-nowrap">Studio Plugin</div>
                  <p className="text-[10px] text-[#8a8f98] mt-1">via WebSocket</p>
                </div>
              </div>

              {/* Divider */}
              <div className="my-6 border-t border-white/5" />

              {/* Path B — Shared Credit Pool (proxied) */}
              <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-blue-400 mb-4">Path B — Shared Credit Pool (No Personal Key)</p>
              <div className="flex items-center flex-wrap gap-0">
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-xs font-semibold whitespace-nowrap">Your Browser</div>
                  <p className="text-[10px] text-[#8a8f98] mt-1">Prompt text only</p>
                </div>
                <div className="flex flex-col items-center mx-1">
                  <div className="flex items-center gap-0.5">
                    <div className="h-px w-8 bg-blue-400/60" />
                    <span className="text-blue-400/60 text-xs">▶</span>
                  </div>
                  <p className="text-[10px] text-[#8a8f98] mt-1 opacity-0">x</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 text-blue-300 text-xs font-semibold whitespace-nowrap">Apple Juice Server</div>
                  <p className="text-[10px] text-blue-400 mt-1">Proxies request, no key stored</p>
                </div>
                <div className="flex flex-col items-center mx-1">
                  <div className="flex items-center gap-0.5">
                    <div className="h-px w-8 bg-blue-400/60" />
                    <span className="text-blue-400/60 text-xs">▶</span>
                  </div>
                  <p className="text-[10px] text-[#8a8f98] mt-1 opacity-0">x</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2.5 rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/5 text-[#ccff00] text-xs font-semibold whitespace-nowrap">OpenAI / Google</div>
                  <p className="text-[10px] text-[#8a8f98] mt-1">Platform key used</p>
                </div>
                <div className="flex flex-col items-center mx-1">
                  <div className="flex items-center gap-0.5">
                    <div className="h-px w-8 bg-white/20" />
                    <span className="text-white/20 text-xs">▶</span>
                  </div>
                  <p className="text-[10px] text-[#8a8f98] mt-1">Code back</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-xs font-semibold whitespace-nowrap">Studio Plugin</div>
                  <p className="text-[10px] text-[#8a8f98] mt-1">via WebSocket</p>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-6 pt-5 border-t border-white/5 flex flex-wrap gap-5 text-[11px] text-[#8a8f98]">
                <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-[#ccff00]/20 border border-[#ccff00]/40"></span> Key never leaves your device</span>
                <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/40"></span> Prompt proxied, not stored</span>
                <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40"></span> Server cannot see your key</span>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              3. Usage Data &amp; Telemetry
            </h2>
            <p>We collect minimal operational data to run the service:</p>
            <ul className="mt-5 space-y-3 list-none">
              {[
                "Session identifiers to maintain your login state.",
                "Credit balance and consumption counts (if using the shared credit pool).",
                "Timestamps of dashboard activity for rate-limiting and abuse prevention.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-[#ccff00] font-bold mt-0.5 flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5">
              We do <strong className="text-white">not</strong> collect keystroke data, the content
              of scripts you generate, or any file contents from your Roblox Studio project.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              4. The Roblox Studio Plugin
            </h2>
            <p>
              The Apple Juice plugin for Roblox Studio operates entirely within the Studio
              sandbox environment. Specifically, it:
            </p>
            <ul className="mt-5 space-y-3 list-none">
              {[
                "Establishes a WebSocket connection to your active dashboard session via a user-generated pairing token.",
                "Reads your Explorer tree structure (folder names and script types) and sends that metadata to your dashboard so the AI can place generated code in the correct locations.",
                "Creates and modifies scripts in your place file only when explicitly triggered by you.",
                "Does NOT access your Roblox account credentials, game analytics, player data, or any data outside the currently open Studio place file.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-[#ccff00] font-bold mt-0.5 flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5">
              The pairing token is a short-lived random string generated per session. It is
              invalidated when you close your dashboard tab.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              5. Data Storage &amp; Security
            </h2>
            <ul className="space-y-3 list-none">
              {[
                "Session data is stored in Redis with TTL-based expiration and deleted automatically after a period of inactivity.",
                "All data in transit is protected by TLS (HTTPS and WSS).",
                "We do not use third-party analytics platforms such as Google Analytics or Mixpanel.",
                "We do not sell your data to third parties under any circumstances.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-[#ccff00] font-bold mt-0.5 flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              6. Data Retention &amp; Deletion
            </h2>
            <p>
              Session data is automatically deleted when your session expires. Credit balance
              records are retained for operational reconciliation. If you would like your data
              permanently deleted, contact us via the GitHub repository or Discord server and we
              will process your request within 30 days.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              7. Children&apos;s Privacy
            </h2>
            <p>
              Apple Juice is not directed at children under 13. We do not knowingly collect
              personal information from children under 13. If you believe a child under 13 has
              provided us with personal information, please contact us and we will delete it promptly.
            </p>
            <p className="mt-4">
              Roblox operates its own age-verification and parental consent mechanisms as part of
              its OAuth flow. We rely on Roblox&apos;s authorization system and do not
              independently verify user age beyond what Roblox provides.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically. When we do, we will update the
              &ldquo;Last updated&rdquo; date at the top of this page. Continued use of Apple Juice
              after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              9. Contact
            </h2>
            <p>
              If you have questions about this Privacy Policy or wish to request data deletion,
              please reach out via the GitHub repository or Discord server linked in the footer
              of the Apple Juice website.
            </p>
          </section>

        </div>

        {/* Back link */}
        <div className="pt-16 border-t border-white/5 mt-16 flex items-center justify-between">
          <a href="/" className="text-[#ccff00] hover:underline font-medium text-sm">
            ← Back to Home
          </a>
          <div className="flex gap-6">
            <a href="/tos" className="text-[#8a8f98] hover:text-white text-sm transition-colors">Terms of Service</a>
            <a href="/eula" className="text-[#8a8f98] hover:text-white text-sm transition-colors">EULA</a>
          </div>
        </div>

      </div>
    </div>
  );
}
