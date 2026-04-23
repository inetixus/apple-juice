"use client";

import Link from "next/link";
import { ArrowRight, Code2, Shield, RefreshCw, Zap, Sparkles, ChevronDown } from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
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
    <div className="border-b border-white/10 py-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left text-lg font-semibold text-white transition-colors hover:text-[#ccff00]"
      >
        {question}
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown className="h-5 w-5 text-[#8a8f98]" />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        className="overflow-hidden"
      >
        <p className="pt-4 text-base leading-relaxed text-[#a0a5b0]">{answer}</p>
      </motion.div>
    </div>
  );
}

export function LandingContent({ session }: { session: any }) {
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
      desc: "Create a door that tweens open and closed...",
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
      desc: "Basic pathfinding for an NPC character...",
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
      desc: "Toggle a shop menu GUI on click...",
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
      desc: "Simple object-oriented inventory module...",
    },
  };

  return (
    <main className="min-h-screen bg-[#0a0c14] text-white relative overflow-hidden">
      {/* ── Colorful Ambient Background ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[800px] h-[800px] bg-[#ccff00]/15 blur-[160px] rounded-full mix-blend-screen" />
        <div className="absolute top-20 -right-40 w-[900px] h-[900px] bg-[#6366f1]/20 blur-[180px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#0ea5e9]/15 blur-[180px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10">
        {/* ── Navbar ── */}
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0a0c14]/60 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-[120rem] items-center justify-between px-6 lg:px-12">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ccff00] to-emerald-400 shadow-lg shadow-[#ccff00]/20">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v3" />
                  <rect x="5" y="5" width="14" height="17" rx="3" />
                  <path d="M5 10h14" />
                </svg>
              </span>
              <span className="text-lg font-bold text-white tracking-tight">Apple Juice</span>
            </div>

            <nav className="hidden items-center gap-8 text-sm font-semibold text-[#a0a5b0] md:flex">
              <a href="#features" className="transition-colors hover:text-white">Features</a>
              <a href="#how-it-works" className="transition-colors hover:text-white">How it Works</a>
              <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
              <a href="https://github.com/inetixus/apple-juice" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">GitHub</a>
            </nav>

            <div className="flex items-center gap-3">
              <AuthButton />
              {session ? (
                <a
                  href="/api/auth/signout"
                  className="hidden bg-white/10 text-white hover:bg-white/20 font-semibold transition-colors rounded-lg px-5 py-2.5 text-sm sm:inline-flex"
                >
                  Log out
                </a>
              ) : (
                <Link
                  href="/dashboard"
                  className="hidden bg-[#ccff00] text-black hover:bg-[#bbf000] shadow-[0_0_20px_rgba(204,255,0,0.3)] font-semibold transition-colors rounded-lg px-5 py-2.5 text-sm sm:inline-flex"
                >
                  Sign up
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <section className="pt-36 pb-20 lg:pt-48 lg:pb-32">
          <div className="mx-auto grid w-full max-w-[120rem] items-center gap-16 px-6 lg:px-12 lg:grid-cols-[1.2fr_1fr]">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="text-[4rem] font-extrabold leading-[1.05] tracking-tight text-white lg:text-[6.5rem]">
                The first{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] via-emerald-400 to-cyan-400 drop-shadow-sm">
                  AI Code Tool
                </span>
                <br />
                for Roblox.
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#a0a5b0]">
                Join creators using Apple Juice to quickly turn dream ideas into working Luau prototypes — with instant Studio sync.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 bg-[#ccff00] text-black hover:bg-[#bbf000] shadow-[0_0_30px_rgba(204,255,0,0.4)] font-bold transition-all hover:scale-105 rounded-xl px-8 py-4 text-base"
                >
                  Start Prototyping
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="https://github.com/inetixus/apple-juice"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 backdrop-blur-sm transition-all hover:scale-105 rounded-xl px-8 py-4 text-base font-semibold"
                >
                  Watch Demo
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>
            </motion.div>

            {/* Code editor mockup */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              className="relative"
            >
              <div className="absolute -left-4 -top-4 h-full w-full rounded-2xl border border-white/5 bg-[#0a0c14]/40 backdrop-blur-xl" />
              <div className="absolute -left-2 -top-2 h-full w-full rounded-2xl border border-white/5 bg-[#12141d]/60 backdrop-blur-xl" />

              <div className="relative bg-[#161822] shadow-2xl shadow-black/50 border border-white/10 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 border-b border-white/5 bg-[#1e212b] px-5 py-4">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-xs font-semibold text-[#a0a5b0]">apple-juice-assistant.lua</span>
                </div>

                <motion.pre 
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="font-mono text-sm bg-[#0c0d12] p-6 text-[#d1d5db] overflow-x-auto min-h-[250px]"
                >
                  <code>{codeSnippets[activeTab].code}</code>
                </motion.pre>

                <div className="flex items-center gap-3 border-t border-white/5 bg-[#1e212b] px-5 py-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ccff00] animate-pulse shadow-[0_0_10px_rgba(204,255,0,0.8)]" />
                  <motion.span 
                    key={activeTab + "desc"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-medium text-[#a0a5b0]"
                  >
                    {codeSnippets[activeTab].desc}
                  </motion.span>
                </div>
              </div>

              {/* Interactive Tabs */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {Object.keys(codeSnippets).map((label) => {
                  const isActive = activeTab === label;
                  return (
                    <motion.button
                      key={label}
                      onClick={() => setActiveTab(label)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                        isActive
                          ? "bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.4)] border border-[#ccff00]"
                          : "bg-[#1e212b] text-[#a0a5b0] border border-white/10 hover:border-[#ccff00]/50 hover:text-white"
                      }`}
                    >
                      {label}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-24 lg:py-32 relative">
          <div className="mx-auto w-full max-w-[120rem] px-6 lg:px-12">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#ccff00] bg-[#ccff00]/10 border border-[#ccff00]/20 px-3 py-1.5 rounded-lg shadow-[0_0_15px_rgba(204,255,0,0.15)]">
                <Zap className="h-4 w-4" /> Features
              </span>
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white lg:text-5xl">
                Everything you need to build faster.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-[#a0a5b0]">
                From generating Luau scripts to syncing them live with Studio — all powered by your own API keys.
              </p>
            </motion.div>

            <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Code2, title: "AI Code Generation", desc: "Generate production-ready Luau scripts from natural language prompts using GPT-4 or Gemini." },
                { icon: RefreshCw, title: "Instant Studio Sync", desc: "Your generated code is instantly available to your Roblox Studio plugin via a simple poll endpoint." },
                { icon: Shield, title: "BYOK — Your Keys, Your Data", desc: "Apple Juice never stores your API keys server-side. They live in your browser, always." },
                { icon: Zap, title: "Multi-Provider Support", desc: "Switch between OpenAI and Google AI Studio with one click. Use whatever models you prefer." },
                { icon: Sparkles, title: "Conversation Memory", desc: "Full conversation history is sent with each request, so the AI remembers context across prompts." },
                { icon: ArrowRight, title: "Open Source", desc: "Fork it, self-host it, extend it. Apple Juice is 100% open source under the MIT license." },
              ].map((feature, i) => (
                <motion.div 
                  key={feature.title} 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="bg-[#12141d]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-8 transition-colors hover:border-[#ccff00]/30 hover:shadow-[0_0_30px_rgba(204,255,0,0.05)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e212b] to-[#12141d] border border-white/5 text-[#ccff00] shadow-inner">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-white">{feature.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-[#a0a5b0]">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-24 lg:py-32">
          <div className="mx-auto w-full max-w-[120rem] px-6 lg:px-12">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <h2 className="text-3xl font-extrabold tracking-tight text-white lg:text-5xl">
                From prompt to Studio in 3 steps.
              </h2>
            </motion.div>

            <div className="relative mt-20 grid gap-10 md:gap-0 md:grid-cols-3">
              <div className="absolute left-1/6 right-1/6 top-10 hidden h-0.5 bg-gradient-to-r from-transparent via-[#ccff00]/20 to-transparent md:block" />

              {[
                { step: "1", title: "Connect", desc: "Pair your session code and connect your Studio plugin in seconds." },
                { step: "2", title: "Configure", desc: "Add your API key locally. We never store it — it stays in your browser." },
                { step: "3", title: "Generate", desc: "Describe what you want. Get working Luau code synced to Studio instantly." },
              ].map((item, i) => (
                <motion.div 
                  key={item.step} 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.2 }}
                  className="relative flex flex-col items-center text-center px-6"
                >
                  <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-[#12141d] border-2 border-[#ccff00]/30 text-3xl font-black text-[#ccff00] shadow-[0_0_30px_rgba(204,255,0,0.15)]">
                    {item.step}
                  </div>
                  <h3 className="mt-8 text-2xl font-bold text-white">{item.title}</h3>
                  <p className="mt-4 text-base leading-relaxed text-[#a0a5b0] max-w-sm">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-24 lg:py-32">
          <div className="mx-auto w-full max-w-3xl px-6">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-extrabold tracking-tight text-white lg:text-5xl">
                Frequently Asked Questions
              </h2>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="space-y-2"
            >
              {FAQ_ITEMS.map((item, i) => (
                <FaqItem key={i} question={item.question} answer={item.answer} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-24 lg:py-32">
          <div className="mx-auto max-w-[120rem] px-6 lg:px-12 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-gradient-to-br from-[#12141d] to-[#0a0c14] border border-[#ccff00]/20 rounded-3xl px-8 py-20 sm:px-16 relative overflow-hidden shadow-[0_0_50px_rgba(204,255,0,0.05)]"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#ccff00]/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0ea5e9]/10 blur-[100px] rounded-full pointer-events-none" />
              
              <div className="relative z-10">
                <h2 className="text-3xl font-extrabold tracking-tight text-white lg:text-5xl">
                  Ready to build faster?
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg text-[#a0a5b0]">
                  Join the open-source community and start prototyping Roblox experiences with AI today.
                </p>
                <div className="mt-10">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-3 bg-[#ccff00] text-black hover:bg-[#bbf000] shadow-[0_0_30px_rgba(204,255,0,0.3)] font-bold transition-all hover:scale-105 rounded-xl px-10 py-5 text-lg"
                  >
                    Get Started Free
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/5 py-12 bg-[#05060a]">
          <div className="mx-auto flex w-full max-w-[120rem] flex-wrap items-center justify-between gap-6 px-6 lg:px-12 text-sm text-[#a0a5b0]">
            <p className="font-medium">&copy; {new Date().getFullYear()} Apple Juice. Open source under MIT.</p>
            <div className="flex gap-8 font-semibold">
              <a href="https://github.com/inetixus/apple-juice" target="_blank" rel="noreferrer" className="transition-colors hover:text-[#ccff00]">GitHub</a>
              <a href="#features" className="transition-colors hover:text-[#ccff00]">Features</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
