import { AuthButton } from "@/components/AuthButton";
import Link from "next/link";
import { ArrowRight, Link2, WandSparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-transparent text-zinc-100">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/5 bg-surface-100/40 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-zinc-100">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-juice-400/20 bg-juice-900/30 shadow-inner">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-juice-400" fill="currentColor" aria-hidden>
                <path d="M14.5 3.2c.6-.8 1.4-1.3 2.2-1.5.2 1-.1 2-.7 2.7-.6.7-1.6 1.3-2.5 1.2-.1-.9.3-1.8 1-2.4Z" />
                <path d="M12.1 7.1c1.1 0 1.9.5 2.6.5.8 0 1.4-.5 2.4-.5 1 0 2 .4 2.8 1.2-2.5 1.5-2.1 5.2.4 6.4-.6 1.9-2 4.3-3.7 4.3-.8 0-1.4-.4-2.3-.4-.9 0-1.6.4-2.5.4-1.8 0-3-2.2-3.8-4.1-1.2-2.8-1.3-6.1 1-7.6.8-.5 1.8-.8 2.9-.8Z" />
              </svg>
            </span>
            <span>Apple Juice</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-zinc-400">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Link2 className="h-4 w-4" />
              GitHub
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Start Prototyping
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pt-32 pb-16">
        <div className="absolute inset-0 bg-glass-gradient opacity-40 pointer-events-none" />
        <div className="relative mx-auto grid min-h-[80vh] w-full max-w-6xl items-center gap-12 px-4 lg:grid-cols-[1fr_1.1fr] animate-fade-in">
          <div className="space-y-8 z-10">
            <p className="text-xs uppercase tracking-[0.3em] font-semibold text-juice-400">Open Source Roblox AI</p>
            <h1 className="text-5xl font-medium tracking-tight leading-[1.1] text-white md:text-7xl">
              Apple Juice <br/><span className="text-zinc-500">for Roblox.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-zinc-400">
              The open-source AI code tool for Roblox with BYOK Luau generation and instant Studio sync.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-juice-600 px-7 py-3.5 text-sm font-medium text-white shadow-lg shadow-juice-500/25 transition-all hover:-translate-y-0.5 hover:bg-juice-500 hover:shadow-juice-500/40"
              >
                Start Prototyping
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-medium text-zinc-300 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
              >
                View GitHub
              </a>
            </div>
          </div>

          <div className="relative w-full rounded-2xl border border-white/10 bg-surface-100/60 p-1 shadow-2xl backdrop-blur-xl animate-float">
            <div className="rounded-xl bg-surface-50/80 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-4 text-xs font-medium text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  apple-juice-assistant.lua
                </span>
                <span className="text-juice-400 flex items-center gap-1.5">
                  <WandSparkles className="h-3.5 w-3.5" /> Generating
                </span>
              </div>
              <pre className="overflow-x-auto text-sm leading-relaxed text-zinc-300">
                <code>{`local Door = script.Parent
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
end`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-4 pb-32 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="rounded-3xl border border-white/5 bg-surface-100/30 p-10 backdrop-blur-sm">
          <h2 className="text-center text-3xl font-medium tracking-tight text-white">From prompt to Studio in 3 seconds.</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              "Pair your session code and connect your Studio plugin.",
              "Paste your key locally. Apple Juice never stores it server-side.",
              "Generate Luau and sync the latest script through a single poll.",
            ].map((step, index) => (
              <div key={step} className="relative pl-6">
                <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-juice-500/80 to-transparent rounded-full" />
                <p className="text-xs uppercase tracking-widest font-semibold text-juice-400">Step {index + 1}</p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
