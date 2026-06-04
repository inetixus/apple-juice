export const metadata = {
  title: "Support — Apple Juice",
  description:
    "Get help with Apple Juice. Email our team at info@apple-juice.online, or reach out through our Discord community and GitHub repository.",
};

const SUPPORT_EMAIL = "info@apple-juice.online";
const DISCORD_URL = "https://discord.gg/EV5QSefDKc";
const GITHUB_URL = "https://github.com/inetixus/apple-juice";

const MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  "Apple Juice Support Request",
)}&body=${encodeURIComponent(
  "Hi Apple Juice team,\n\nI need help with the following:\n\n\n---\nPlease describe your issue above. Include your browser, the model you were using, and any error messages if relevant.",
)}`;

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#05050a] text-white px-6 py-20 lg:py-32 font-sans">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-14">
          <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#ccff00] mb-4">
            Help &amp; Support
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            How can we help?
          </h1>
          <p className="text-[#8a8f98] text-sm sm:text-base leading-relaxed max-w-xl">
            Run into a bug, have a billing question, or want to suggest a
            feature? Pick the channel that suits you best — we read everything.
          </p>
        </div>

        {/* Primary: Email support card */}
        <div className="rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/[0.04] p-7 sm:p-9 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#ccff00] text-black">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white mb-1.5">
                Email our team
              </h2>
              <p className="text-sm text-white/65 leading-relaxed mb-5">
                The fastest way to reach us for account, billing, or technical
                issues. We typically reply within 1–2 business days.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <a
                  href={MAILTO}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ccff00] px-6 py-3 text-[11px] font-black uppercase tracking-wider text-black transition-all hover:bg-[#d4ff33] hover:scale-[1.02] active:scale-95 shadow-[0_8px_24px_rgba(204,255,0,0.25)]"
                >
                  Send a support email
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-sm font-mono text-white/55 hover:text-white transition-colors"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          {/* Discord */}
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#9aa4ff] mb-4">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.6-.717 1.385-.98 2.001a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.997-2.001.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.533 7.55.954 10.65 1.238 13.71a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-3.487-.838-6.56-2.549-9.314a.061.061 0 0 0-.031-.028ZM8.02 12.97c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-1.5">
              Discord community
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </h3>
            <p className="text-sm text-white/55 leading-relaxed">
              Chat with the team and other Roblox developers in real time.
            </p>
          </a>

          {/* GitHub */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white mb-4">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-1.5">
              GitHub issues
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </h3>
            <p className="text-sm text-white/55 leading-relaxed">
              Report bugs or request features on the open-source repository.
            </p>
          </a>
        </div>

        {/* Tips for a faster response */}
        <div className="rounded-2xl border border-white/10 bg-[#080809] p-6 sm:p-7 mb-4">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
            For a faster response, include:
          </h2>
          <ul className="space-y-2.5">
            {[
              "What you were trying to do and what happened instead",
              "Your browser and operating system",
              "The AI model you were using (if relevant)",
              "Any error messages, exactly as they appeared",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/65">
                <span className="text-[#ccff00] font-bold mt-0.5 flex-shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[#8a8f98] leading-relaxed">
          Apple Juice is an independent, open-source developer tool. It is not
          affiliated with, endorsed by, or operated by Roblox Corporation.
        </p>

        {/* Back link */}
        <div className="pt-12 border-t border-white/5 mt-12 flex items-center justify-between">
          <a href="/" className="text-[#ccff00] hover:underline font-medium text-sm">
            ← Back to Home
          </a>
          <div className="flex gap-6">
            <a href="/privacy" className="text-[#8a8f98] hover:text-white text-sm transition-colors">
              Privacy Policy
            </a>
            <a href="/tos" className="text-[#8a8f98] hover:text-white text-sm transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
