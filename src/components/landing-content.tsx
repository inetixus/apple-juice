"use client";

import Link from "next/link";
import { ArrowRight, Code2, Shield, RefreshCw, Zap, Sparkles, ChevronDown } from "lucide-react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "Is Apple Juice free to use?",
    answer: "Yes, Apple Juice is 100% free and open-source. You only pay for your own API usage through OpenAI or Google AI Studio.",
  },
  {
    question: "How does it connect to Roblox Studio?",
    answer: "You run a simple plugin in Studio that polls the Apple Juice server using your unique pairing session code. When you generate a script here, it instantly appears in your game.",
  },
  {
    question: "Do you store my API keys?",
    answer: "Never. Your API keys are stored strictly in your browser's local storage. They are sent directly to the AI providers when you make a request.",
  },
  {
    question: "Which AI models are supported?",
    answer: "Currently we support OpenAI models (like GPT-4o) and Google Gemini models. You can easily switch between them in the dashboard settings.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left py-5 text-[15px] font-medium text-white/90 transition-colors hover:text-white"
      >
        {question}
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-white/30 flex-shrink-0 ml-4" />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-sm leading-relaxed text-white/50">{answer}</p>
      </motion.div>
    </div>
  );
}

export function LandingContent({ session, avatarUrl }: { session: any, avatarUrl?: string }) {
  const [activeTab, setActiveTab] = useState("Door System");

  const codeSnippets: Record<string, { code: string; desc: string }> = {
    "Door System": {
      code: `local Door = script.Parent
local TweenService = game:GetService("TweenService")

local openTween = TweenService:Create(Door, TweenInfo.new(0.35), { Transparency = 0.7, CanCollide = false })
local closeTween = TweenService:Create(Door, TweenInfo.new(0.35), { Transparency = 0, CanCollide = true })

return function(open)
  if open then openTween:Play() else closeTween:Play() end
end`,
      desc: "Smooth door system with tweening",
    },
    "NPC AI": {
      code: `local NPC = script.Parent
local PathfindingService = game:GetService("PathfindingService")

local function moveToTarget(targetPos)
  local path = PathfindingService:CreatePath()
  path:ComputeAsync(NPC.HumanoidRootPart.Position, targetPos)
  
  for _, waypoint in pairs(path:GetWaypoints()) do
    NPC.Humanoid:MoveTo(waypoint.Position)
    NPC.Humanoid.MoveToFinished:Wait()
  end
end`,
      desc: "Pathfinding NPC with waypoint movement",
    },
    "Shop UI": {
      code: `local Player = game.Players.LocalPlayer
local Button = script.Parent

Button.MouseButton1Click:Connect(function()
  local gui = Player.PlayerGui:FindFirstChild("ShopMenu")
  if gui then
    gui.Enabled = not gui.Enabled
  end
end)`,
      desc: "Toggle shop menu on click",
    },
    "Inventory": {
      code: `local Inventory = {}

function Inventory.new()
  local self = setmetatable({}, {__index = Inventory})
  self.Items = {}
  return self
end

function Inventory:AddItem(itemName)
  table.insert(self.Items, itemName)
  print(itemName .. " added!")
end`,
      desc: "OOP inventory module",
    },
  };

  return (
    <main className="min-h-screen bg-[#0c0d10] text-white">
      {/* ── Navbar ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#0c0d10]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ccff00]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v3" />
                <rect x="5" y="5" width="14" height="17" rx="3" />
                <path d="M5 10h14" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Apple Juice</span>
          </div>

          <nav className="hidden items-center gap-6 text-[13px] text-white/50 md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it Works</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
            <a href="https://github.com/inetixus/apple-juice" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">GitHub</a>
          </nav>

          <div className="flex items-center gap-2">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 bg-[#ccff00] text-black font-semibold transition-opacity hover:opacity-90 rounded-lg px-4 py-2 text-[13px]"
                >
                  Dashboard
                </Link>
                <a
                  href="/api/auth/signout"
                  className="inline-flex items-center bg-white/[0.06] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.08] font-medium transition-colors rounded-lg px-4 py-2 text-[13px]"
                >
                  Log out
                </a>
              </>
            ) : (
              <button
                onClick={() => signIn("roblox", { callbackUrl: "/dashboard" })}
                className="inline-flex items-center gap-1.5 bg-[#ccff00] text-black font-semibold transition-opacity hover:opacity-90 rounded-lg px-4 py-2 text-[13px]"
              >
                Sign in with Roblox
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {session ? (
                <>
                  <div className="flex items-center gap-4 mb-5">
                    {avatarUrl ? (
                      <div className="h-16 w-16 rounded-full overflow-hidden ring-2 ring-white/10">
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-white/[0.06] flex items-center justify-center text-xl font-semibold text-white/40">
                        {session.user?.name?.charAt(0) || "U"}
                      </div>
                    )}
                    <div>
                      <p className="text-[13px] font-medium text-[#ccff00]">Welcome back</p>
                      <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
                        {session.user?.name}
                      </h1>
                    </div>
                  </div>
                  <p className="max-w-md text-[15px] leading-relaxed text-white/50">
                    Jump back into your dashboard to generate more Luau scripts and sync them instantly to Studio.
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-5">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#ccff00] bg-[#ccff00]/[0.08] border border-[#ccff00]/[0.12] px-2.5 py-1 rounded-md">
                      <Zap className="h-3 w-3" /> Open Source
                    </span>
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-white lg:text-[3.5rem] lg:leading-[1.1]">
                    The AI code tool<br />
                    <span className="text-[#ccff00]">for Roblox.</span>
                  </h1>
                  <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/50">
                    Turn ideas into working Luau scripts with AI — then sync them directly to Roblox Studio in real time.
                  </p>
                </>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {session ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 bg-[#ccff00] text-black font-semibold transition-opacity hover:opacity-90 rounded-lg px-5 py-2.5 text-sm"
                  >
                    Open Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    onClick={() => signIn("roblox", { callbackUrl: "/dashboard" })}
                    className="inline-flex items-center gap-2 bg-[#ccff00] text-black font-semibold transition-opacity hover:opacity-90 rounded-lg px-5 py-2.5 text-sm"
                  >
                    Start Prototyping
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <a
                  href="https://github.com/inetixus/apple-juice"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors rounded-lg px-5 py-2.5 text-sm font-medium"
                >
                  View on GitHub
                </a>
              </div>
            </motion.div>

            {/* Code editor */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <div className="bg-[#141518] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="ml-2 text-[11px] text-white/30">generated.lua</span>
                </div>

                <motion.pre 
                  key={activeTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-[13px] p-5 text-white/70 overflow-x-auto min-h-[220px] leading-relaxed"
                >
                  <code>{codeSnippets[activeTab].code}</code>
                </motion.pre>

                <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00]" />
                  <span className="text-[12px] text-white/40">{codeSnippets[activeTab].desc}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {Object.keys(codeSnippets).map((label) => {
                  const isActive = activeTab === label;
                  return (
                    <button
                      key={label}
                      onClick={() => setActiveTab(label)}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        isActive
                          ? "bg-[#ccff00]/[0.1] text-[#ccff00] border border-[#ccff00]/[0.15]"
                          : "bg-white/[0.04] text-white/40 border border-transparent hover:text-white/60"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-5xl px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Everything you need to build faster
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] text-white/40">
              Generate Luau scripts and sync them live with Studio — all powered by your own API keys.
            </p>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Code2, title: "AI Code Generation", desc: "Generate production-ready Luau scripts from natural language prompts using GPT-4 or Gemini." },
              { icon: RefreshCw, title: "Instant Studio Sync", desc: "Your generated code is instantly available to your Roblox Studio plugin via a simple poll endpoint." },
              { icon: Shield, title: "BYOK — Your Keys", desc: "Apple Juice never stores your API keys server-side. They live in your browser, always." },
              { icon: Zap, title: "Multi-Provider", desc: "Switch between OpenAI and Google AI Studio with one click. Use whatever models you prefer." },
              { icon: Sparkles, title: "Conversation Memory", desc: "Full conversation history is sent with each request, so the AI remembers context across prompts." },
              { icon: ArrowRight, title: "Open Source", desc: "Fork it, self-host it, extend it. Apple Juice is 100% open source under the MIT license." },
            ].map((feature, i) => (
              <motion.div 
                key={feature.title} 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-white/50">
                  <feature.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/40">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-5xl px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              From prompt to Studio in 3 steps
            </h2>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "1", title: "Connect", desc: "Pair your session code and connect your Studio plugin in seconds." },
              { step: "2", title: "Configure", desc: "Add your API key locally. We never store it — it stays in your browser." },
              { step: "3", title: "Generate", desc: "Describe what you want. Get working Luau code synced to Studio instantly." },
            ].map((item, i) => (
              <motion.div 
                key={item.step} 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ccff00]/[0.08] border border-[#ccff00]/[0.12] text-sm font-bold text-[#ccff00]">
                  {item.step}
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/40 max-w-xs mx-auto">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-2xl px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              FAQ
            </h2>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-6"
          >
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={i} question={item.question} answer={item.answer} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-8 py-16 sm:px-16"
          >
            <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Ready to build faster?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-white/40">
              Join the open-source community and start prototyping Roblox experiences with AI today.
            </p>
            <div className="mt-8">
              {session ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 bg-[#ccff00] text-black font-semibold transition-opacity hover:opacity-90 rounded-lg px-6 py-3 text-sm"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  onClick={() => signIn("roblox", { callbackUrl: "/dashboard" })}
                  className="inline-flex items-center gap-2 bg-[#ccff00] text-black font-semibold transition-opacity hover:opacity-90 rounded-lg px-6 py-3 text-sm"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-[13px] text-white/30">
          <p>&copy; {new Date().getFullYear()} Apple Juice. Open source under MIT.</p>
          <div className="flex gap-6">
            <a href="https://github.com/inetixus/apple-juice" target="_blank" rel="noreferrer" className="transition-colors hover:text-white/60">GitHub</a>
            <a href="#features" className="transition-colors hover:text-white/60">Features</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
