import { AuthButton } from "@/components/AuthButton";
import Link from "next/link";
import { ArrowRight, Zap, Shield, RefreshCw, Code2, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden text-zinc-100">
      {/* ── Ambient glow blobs ── */}
      <div className="glow-blob w-[600px] h-[600px] bg-indigo-600/20 top-[-200px] left-[10%]" />
      <div className="glow-blob w-[500px] h-[500px] bg-violet-600/15 top-[100px] right-[-100px]" />
      <div className="glow-blob w-[400px] h-[400px] bg-indigo-500/10 bottom-[200px] left-[-100px]" />

      {/* ── Navbar ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 backdrop-blur-xl bg-[#09090b]/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="currentColor" aria-hidden>
                <path d="M14.5 3.2c.6-.8 1.4-1.3 2.2-1.5.2 1-.1 2-.7 2.7-.6.7-1.6 1.3-2.5 1.2-.1-.9.3-1.8 1-2.4Z" />
                <path d="M12.1 7.1c1.1 0 1.9.5 2.6.5.8 0 1.4-.5 2.4-.5 1 0 2 .4 2.8 1.2-2.5 1.5-2.1 5.2.4 6.4-.6 1.9-2 4.3-3.7 4.3-.8 0-1.4-.4-2.3-.4-.9 0-1.6.4-2.5.4-1.8 0-3-2.2-3.8-4.1-1.2-2.8-1.3-6.1 1-7.6.8-.5 1.8-.8 2.9-.8Z" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold text-white tracking-tight">Apple Juice</span>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it Works</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">GitHub</a>
          </nav>

          <div className="flex items-center gap-3">
            <AuthButton />
            <Link
              href="/dashboard"
              className="hidden rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-indigo-500/40 sm:inline-flex"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative pt-36 pb-24 lg:pt-44 lg:pb-32">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-6 lg:grid-cols-[1fr_1.15fr]">
          {/* Left — copy */}
          <div className="animate-fade-up">
            <h1 className="text-[3.25rem] font-bold leading-[1.1] tracking-tight text-white lg:text-[4.25rem]">
              The first{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                AI Code Tool
              </span>
              <br />
              for Roblox.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-400">
              Join creators using Apple Juice to quickly turn dream ideas into working Luau prototypes — with instant Studio sync.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-indigo-500/40"
              >
                Start Prototyping
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-zinc-300 transition-all hover:bg-white/[0.08] hover:text-white"
              >
                Watch Demo
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Right — code editor mockup */}
          <div className="animate-fade-up-lg relative">
            {/* Stacked card shadows behind */}
            <div className="absolute -left-3 -top-3 h-full w-full rounded-2xl border border-white/[0.04] bg-white/[0.02]" />
            <div className="absolute -left-1.5 -top-1.5 h-full w-full rounded-2xl border border-white/[0.04] bg-white/[0.02]" />

            {/* Main card */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/80 to-zinc-950/90 shadow-2xl shadow-black/40 animate-float">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
                <span className="h-3 w-3 rounded-full bg-red-500/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <span className="h-3 w-3 rounded-full bg-green-500/70" />
                <span className="ml-4 text-xs font-medium text-zinc-500">apple-juice-assistant.lua</span>
              </div>

              {/* Code content */}
              <div className="p-5">
                <pre className="overflow-x-auto text-[13px] leading-relaxed text-zinc-300">
                  <code>{`local Door = script.Parent
local TweenService = game:GetService("TweenService")

local openTween = TweenService:Create(
  Door, TweenInfo.new(0.35), {
    Transparency = 0.7,
    CanCollide = false,
  }
)

local closeTween = TweenService:Create(
  Door, TweenInfo.new(0.35), {
    Transparency = 0,
    CanCollide = true,
  }
)

return function(open)
  if open then openTween:Play()
  else closeTween:Play() end
end`}</code>
                </pre>
              </div>

              {/* Prompt bar at bottom */}
              <div className="flex items-center gap-3 border-t border-white/[0.06] px-5 py-3">
                <Sparkles className="h-4 w-4 text-indigo-400 animate-glow" />
                <span className="text-sm text-zinc-400">Create a door that tweens open and closed...</span>
              </div>
            </div>

            {/* Floating feature tabs under the card */}
            <div className="mt-5 flex items-center justify-center gap-2">
              {["Door System", "NPC AI", "Shop UI", "Inventory"].map((label, i) => (
                <span
                  key={label}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    i === 0
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="relative py-24 lg:py-32">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="text-center animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300">
              <Zap className="h-3.5 w-3.5" /> Features
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-white lg:text-4xl">
              Everything you need to build faster.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-zinc-400">
              From generating Luau scripts to syncing them live with Studio — all powered by your own API keys.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Code2,
                title: "AI Code Generation",
                desc: "Generate production-ready Luau scripts from natural language prompts using GPT-4 or Gemini.",
              },
              {
                icon: RefreshCw,
                title: "Instant Studio Sync",
                desc: "Your generated code is instantly available to your Roblox Studio plugin via a simple poll endpoint.",
              },
              {
                icon: Shield,
                title: "BYOK — Your Keys, Your Data",
                desc: "Apple Juice never stores your API keys server-side. They live in your browser, always.",
              },
              {
                icon: Zap,
                title: "Multi-Provider Support",
                desc: "Switch between OpenAI and Google AI Studio with one click. Use whatever models you prefer.",
              },
              {
                icon: Sparkles,
                title: "Conversation Memory",
                desc: "Full conversation history is sent with each request, so the AI remembers context across prompts.",
              },
              {
                icon: ArrowRight,
                title: "Open Source",
                desc: "Fork it, self-host it, extend it. Apple Juice is 100% open source under the MIT license.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="glass-card group rounded-2xl p-6 transition-all hover:border-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/15 text-indigo-400 transition-colors group-hover:bg-indigo-600/25">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative py-24 lg:py-32">
        <div className="mx-auto w-full max-w-4xl px-6">
          <div className="text-center animate-fade-up">
            <h2 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
              From prompt to Studio in 3 steps.
            </h2>
          </div>

          <div className="relative mt-16 grid gap-0 md:grid-cols-3">
            {/* Connector line */}
            <div className="absolute left-0 right-0 top-8 hidden h-[2px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent md:block" />

            {[
              { step: "1", title: "Connect", desc: "Pair your session code and connect your Studio plugin in seconds." },
              { step: "2", title: "Configure", desc: "Add your API key locally. We never store it — it stays in your browser." },
              { step: "3", title: "Generate", desc: "Describe what you want. Get working Luau code synced to Studio instantly." },
            ].map((item) => (
              <div key={item.step} className="relative flex flex-col items-center text-center px-6 py-4">
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 border-indigo-500/40 bg-zinc-900 text-xl font-bold text-indigo-400 shadow-lg shadow-indigo-500/10">
                  {item.step}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="glass-card rounded-3xl px-8 py-16 sm:px-16">
            <h2 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
              Ready to build faster?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-zinc-400">
              Join the open-source community and start prototyping Roblox experiences with AI today.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-indigo-500/40"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-zinc-500">
          <p>&copy; {new Date().getFullYear()} Apple Juice. Open source under MIT.</p>
          <div className="flex gap-6">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">GitHub</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
