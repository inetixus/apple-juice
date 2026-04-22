import { AuthButton } from "@/components/AuthButton";
import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#03050b] text-zinc-100">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-black/45 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-zinc-100">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-red-400/40 bg-red-950/70">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-red-300" fill="currentColor" aria-hidden>
                <path d="M14.5 3.2c.6-.8 1.4-1.3 2.2-1.5.2 1-.1 2-.7 2.7-.6.7-1.6 1.3-2.5 1.2-.1-.9.3-1.8 1-2.4Z" />
                <path d="M12.1 7.1c1.1 0 1.9.5 2.6.5.8 0 1.4-.5 2.4-.5 1 0 2 .4 2.8 1.2-2.5 1.5-2.1 5.2.4 6.4-.6 1.9-2 4.3-3.7 4.3-.8 0-1.4-.4-2.3-.4-.9 0-1.6.4-2.5.4-1.8 0-3-2.2-3.8-4.1-1.2-2.8-1.3-6.1 1-7.6.8-.5 1.8-.8 2.9-.8Z" />
              </svg>
            </span>
            <span>Apple Juice</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-zinc-300">
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <Link2 className="h-4 w-4" />
              GitHub
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-500"
            >
              Start Prototyping
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(185,28,28,0.3),transparent_35%)]" />
        <div className="relative mx-auto grid min-h-[88vh] w-full max-w-6xl items-center gap-12 px-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.28em] text-red-300">Open Source Roblox AI</p>
            <h1 className="text-5xl font-semibold leading-[1.05] text-white md:text-7xl">Apple Juice for Roblox.</h1>
            <p className="max-w-lg text-lg text-zinc-300">
              The open-source AI code tool for Roblox with BYOK Luau generation and instant Studio sync.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2.5 font-medium text-white hover:bg-red-500"
              >
                Start Prototyping
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="rounded border border-white/20 px-4 py-2.5 text-sm text-zinc-200 hover:border-white/40"
              >
                View GitHub
              </a>
            </div>
          </div>

          <div className="w-full rounded-xl border border-white/10 bg-zinc-950/80 p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3 text-xs text-zinc-400">
              <span>apple-juice-assistant.lua</span>
              <span className="text-red-300">Generating</span>
            </div>
            <pre className="overflow-x-auto text-sm leading-7 text-zinc-200">
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
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-4 pb-24">
        <h2 className="text-center text-3xl font-semibold text-white">From prompt to Studio in 3 seconds.</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            "Pair your session code and connect your Studio plugin.",
            "Paste your key locally. Apple Juice never stores it server-side.",
            "Generate Luau and sync the latest script through a single poll.",
          ].map((step, index) => (
            <div key={step} className="border-l border-red-400/60 pl-4 text-zinc-300">
              <p className="text-sm uppercase tracking-wide text-red-200">Step {index + 1}</p>
              <p className="mt-2 leading-7">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
