import { type ReactNode } from "react";
import { Code2, KeyRound, Link2, Radio, Sparkles, Users } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import AuthControls from "../components/auth-controls";

type LinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

function Link({ href, className, children }: LinkProps) {
  return (
    <RouterLink to={href} className={className}>
      {children}
    </RouterLink>
  );
}

function AppleOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" fill="none" aria-hidden="true" className={className}>
      <path
        d="M20 14c-7.5 0-12 5.5-12 13.2C8 36.1 13.4 42 20 42s12-5.9 12-14.8C32 19.5 27.5 14 20 14Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M23.8 9.2c-.8 2.7-2.7 4.6-5.4 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M23 8.2c2.7-2.5 5.7-2.9 8-1.9-1.1 2.2-3.2 3.8-6 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(127,29,29,0.18),transparent_38%),radial-gradient(circle_at_80%_0%,rgba(113,63,18,0.08),transparent_35%)]" />

      <header className="relative z-10 border-b border-zinc-800/90 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-white">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-red-700/50 bg-red-900/30 text-red-300">
              <Code2 size={14} />
            </span>
            Apple Juice
          </Link>
          <nav className="flex items-center gap-6 text-sm text-zinc-300">
            <a href="#features" className="hover:bg-zinc-900 px-2 py-1">
              Features
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-2 py-1 hover:bg-zinc-900"
            >
              <Link2 size={14} />
              GitHub
            </a>
            <Link
              href="/app"
              className="rounded-md border border-red-700 bg-red-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              Start Prototyping
            </Link>
            <AuthControls callbackUrl="/app" />
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-6">
        <section className="grid w-full items-center gap-12 py-32 lg:grid-cols-[1.05fr_0.95fr] xl:py-40">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Open Source Roblox AI</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-tight tracking-tighter text-white md:text-7xl">
              The Open-Source AI Code Tool for Roblox.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-zinc-300">
              Bring your own API key. Sync directly to Studio. 100% Free.
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/app"
                className="rounded-md border border-red-700 bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                Start Prototyping
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-red-800 bg-zinc-900/70 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-zinc-800 hover:text-red-100"
              >
                View GitHub
              </a>
            </div>
          </div>

          <div className="relative editor-mockup rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/30">
            <div className="pointer-events-none absolute -right-5 -top-6 text-red-500/80">
              <AppleOutline className="h-14 w-14" />
            </div>
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <Sparkles size={15} className="text-red-300" />
                apple-juice-assistant.lua
              </div>
              <span className="font-mono text-xs text-zinc-500">Generating</span>
            </div>
            <pre className="overflow-x-auto font-mono text-[13px] leading-6 text-zinc-200">
{`local Door = script.Parent
local TweenService = game:GetService("TweenService")

local openTween = TweenService:Create(Door, TweenInfo.new(0.35), {
    Transparency = 0.7,
    CanCollide = false,
})

local closeTween = TweenService:Create(Door, TweenInfo.new(0.35), {
    Transparency = 0,
    CanCollide = true,
})

return function(open)
    if open then openTween:Play() else closeTween:Play() end
end`}
            </pre>
          </div>
        </section>

        <section id="features" className="mt-12 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:bg-zinc-900">
            <KeyRound size={16} className="text-zinc-200" />
            <h3 className="mt-4 text-base font-semibold text-white">Bring Your Own Key (BYOK)</h3>
            <p className="mt-2 text-sm text-zinc-400">Store your key locally and keep infrastructure under your control.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:bg-zinc-900">
            <Radio size={16} className="text-zinc-200" />
            <h3 className="mt-4 text-base font-semibold text-white">Zero-Lag Studio Sync</h3>
            <p className="mt-2 text-sm text-zinc-400">Pair once and pull generated Luau scripts directly in your plugin flow.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:bg-zinc-900">
            <Users size={16} className="text-zinc-200" />
            <h3 className="mt-4 text-base font-semibold text-white">Community Driven</h3>
            <p className="mt-2 text-sm text-zinc-400">Open issues, add templates, and ship fixes with the open-source community.</p>
          </div>
        </section>

        <section className="mt-24 pb-4">
          <h2 className="text-center text-4xl font-semibold tracking-tight text-white">From prompt to Studio in 3 seconds.</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">1. Pair your session.</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Generate a 6-digit code on the web dashboard and enter it into your Studio plugin.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">2. Bring your key.</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Paste your OpenAI or Anthropic API key. It stays safe in your browser&apos;s local storage.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">3. Watch it write.</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Type your request. The Apple Juice engine generates the Luau and beams it directly into your active script.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Powered by the best. Paid for by you (at cost).
          </h2>
          <div className="mt-8 rounded-xl border border-red-900/50 bg-red-950/20 px-6 py-6">
            <p className="text-center text-sm leading-7 text-zinc-300 md:text-base">
              Apple Juice is BYOK by design, so you are not locked into proprietary models or monthly credits. Plug in your own
              provider key and run exactly what you trust: GPT-4o, Claude 3.5 Sonnet, and DeepSeek Coder.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <span className="rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 font-mono text-xs text-zinc-200">GPT-4o</span>
              <span className="rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 font-mono text-xs text-zinc-200">Claude 3.5 Sonnet</span>
              <span className="rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 font-mono text-xs text-zinc-200">DeepSeek Coder</span>
            </div>
          </div>
        </section>

        <section className="mt-20 pb-24">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Ready to ditch the credits?</h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/app"
                className="rounded-md border border-red-700 bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                Start Prototyping
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
              >
                Read the Docs
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
