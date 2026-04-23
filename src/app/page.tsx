import { AuthButton } from "@/components/AuthButton";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ArrowRight, Code2, Shield, RefreshCw, Zap, Sparkles } from "lucide-react";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#111318] via-[#030303] to-[#000000] text-white">
      {/* ── Navbar ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#030303]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-[120rem] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#ccff00]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v3" />
                <rect x="5" y="5" width="14" height="17" rx="2" />
                <path d="M5 10h14" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-white tracking-tight">Apple Juice</span>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#8a8f98] md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it Works</a>
            <a href="https://github.com/inetixus/apple-juice" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">GitHub</a>
          </nav>

          <div className="flex items-center gap-3">
            <AuthButton />
            {session ? (
              <a
                href="/api/auth/signout"
                className="hidden bg-white/10 text-white hover:bg-white/20 font-semibold transition-colors rounded-lg px-4 py-2 text-sm sm:inline-flex"
              >
                Log out
              </a>
            ) : (
              <Link
                href="/dashboard"
                className="hidden bg-[#ccff00] text-black hover:bg-[#bbf000] font-semibold transition-colors rounded-lg px-4 py-2 text-sm sm:inline-flex"
              >
                Sign up
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="mx-auto grid w-full max-w-[120rem] items-center gap-16 px-6 lg:px-12 lg:grid-cols-[1fr_1.15fr] relative">
          <div className="absolute -top-40 -left-20 w-[800px] h-[600px] bg-[#ccff00]/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
            <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-emerald-500/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />
            <div className="relative z-10">
            <h1 className="text-[4rem] font-extrabold leading-[1.05] tracking-tight text-white lg:text-[6.5rem] animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both delay-100">
              The first{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] to-emerald-400">AI Code Tool</span>
              <br />
              for Roblox.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[#8a8f98] animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both delay-200">
              Join creators using Apple Juice to quickly turn dream ideas into working Luau prototypes — with instant Studio sync.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both delay-300">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-[#ccff00] text-black hover:bg-[#bbf000] font-semibold transition-colors rounded-lg px-5 py-2.5 text-sm"
              >
                Start Prototyping
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/inetixus/apple-juice"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-transparent border border-white/10 text-white hover:bg-white/5 transition-colors rounded-lg px-5 py-2.5 text-sm font-medium"
              >
                Watch Demo
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Code editor mockup */}
          <div className="relative animate-in fade-in zoom-in-95 duration-1000 fill-mode-both delay-500">
            <div className="absolute -left-3 -top-3 h-full w-full rounded-xl border border-white/[0.03] bg-[#080808]" />
            <div className="absolute -left-1.5 -top-1.5 h-full w-full rounded-xl border border-white/[0.03] bg-[#0a0a0a]" />

            <div className="relative bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs font-medium text-[#8a8f98]">apple-juice-assistant.lua</span>
              </div>

              <pre className="font-mono text-[13px] bg-[#050505] p-5 text-[#d1d5db] overflow-x-auto">
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

              <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-[#ccff00] animate-pulse" />
                <span className="text-sm text-[#8a8f98]">Create a door that tweens open and closed...</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              {["Door System", "NPC AI", "Shop UI", "Inventory"].map((label, i) => (
                <span
                  key={label}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    i === 0
                      ? "bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.5)]"
                      : "bg-[#1c1d22] text-white border border-white/10 hover:border-[#ccff00]/50 hover:text-[#ccff00]"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[120rem] px-6">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ccff00] bg-[#ccff00]/10 border border-[#ccff00]/20 px-2 py-1 rounded-md">
              <Zap className="h-3 w-3" /> Features
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Everything you need to build faster.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-[#8a8f98]">
              From generating Luau scripts to syncing them live with Studio — all powered by your own API keys.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
            {[
              { icon: Code2, title: "AI Code Generation", desc: "Generate production-ready Luau scripts from natural language prompts using GPT-4 or Gemini." },
              { icon: RefreshCw, title: "Instant Studio Sync", desc: "Your generated code is instantly available to your Roblox Studio plugin via a simple poll endpoint." },
              { icon: Shield, title: "BYOK — Your Keys, Your Data", desc: "Apple Juice never stores your API keys server-side. They live in your browser, always." },
              { icon: Zap, title: "Multi-Provider Support", desc: "Switch between OpenAI and Google AI Studio with one click. Use whatever models you prefer." },
              { icon: Sparkles, title: "Conversation Memory", desc: "Full conversation history is sent with each request, so the AI remembers context across prompts." },
              { icon: ArrowRight, title: "Open Source", desc: "Fork it, self-host it, extend it. Apple Juice is 100% open source under the MIT license." },
            ].map((feature) => (
              <div key={feature.title} className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6 transition-colors hover:border-white/10">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111111] border border-white/5 text-[#ccff00]">
                  <feature.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8a8f98]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              From prompt to Studio in 3 steps.
            </h2>
          </div>

          <div className="relative mt-14 grid gap-0 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-white/5 md:block" />

            {[
              { step: "1", title: "Connect", desc: "Pair your session code and connect your Studio plugin in seconds." },
              { step: "2", title: "Configure", desc: "Add your API key locally. We never store it — it stays in your browser." },
              { step: "3", title: "Generate", desc: "Describe what you want. Get working Luau code synced to Studio instantly." },
            ].map((item) => (
              <div key={item.step} className="relative flex flex-col items-center text-center px-6 py-4">
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#0a0a0a] border border-white/5 text-lg font-bold text-[#ccff00]">
                  {item.step}
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8a8f98]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl px-8 py-14 sm:px-14">
            <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Ready to build faster?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-[#8a8f98]">
              Join the open-source community and start prototyping Roblox experiences with AI today.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-[#ccff00] text-black hover:bg-[#bbf000] font-semibold transition-colors rounded-lg px-6 py-2.5 text-sm"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex w-full max-w-[120rem] flex-wrap items-center justify-between gap-4 px-6 text-sm text-[#8a8f98]">
          <p>&copy; {new Date().getFullYear()} Apple Juice. Open source under MIT.</p>
          <div className="flex gap-6">
            <a href="https://github.com/inetixus/apple-juice" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">GitHub</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
