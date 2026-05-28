// @ts-nocheck
"use client";

import {
  ArrowRight,
  ChevronDown,
  Sparkles,
  Plus,
  Folder,
  FileCode,
  Layers,
  Bot,
  CheckCircle2,
  History,
  ShieldCheck,
  Maximize2,
  ChevronRight,
  RotateCcw,
  MousePointer2,
  Box,
  LayoutGrid,
  Crown,
  FolderTree
} from "lucide-react";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence, useScroll, useSpring, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import dashboardImg from "../icons/dashboard.png";
import ideImg from "../icons/IDE.png";
import { DashboardClient } from "./dashboard-client";
import { Highlight, themes, type PrismTheme } from "prism-react-renderer";
import { Medusae } from "./medusae-effect";
import { StripeWave } from "./stripe-wave";

function LazySpline({ sceneUrl }: { sceneUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}spline-viewer{width:100%;height:100%;display:block}</style><script type="module" src="https://unpkg.com/@splinetool/viewer@1.12.94/build/spline-viewer.js"><\/script></head><body><spline-viewer url="${sceneUrl}" events-target="none"></spline-viewer></body></html>`;

  return (
    <div ref={containerRef} className="w-full h-full">
      {isVisible && (
        <iframe
          srcDoc={srcDoc}
          frameBorder="0"
          width="100%"
          height="100%"
          style={{ background: "transparent", border: "none" }}
          className="w-full h-full pointer-events-none select-none"
        />
      )}
    </div>
  );
}

const luauTheme: PrismTheme = {
  ...themes.github,
  plain: {
    color: "#cbd5e1",
    backgroundColor: "transparent",
  },
  styles: [
    ...themes.github.styles,
    {
      types: ["keyword", "operator"],
      style: {
        color: "#f43f5e",
        fontWeight: "bold",
      },
    },
    {
      types: ["string", "char"],
      style: {
        color: "#10b981",
      },
    },
    {
      types: ["function"],
      style: {
        color: "#3b82f6",
      },
    },
    {
      types: ["comment"],
      style: {
        color: "#64748b",
        fontStyle: "italic",
      },
    },
  ],
};

/* ─── FAQ data ─── */
const FAQ_ITEMS = [
  {
    question: "Is Apple Juice affiliated with Roblox Corporation?",
    answer:
      "No. Apple Juice is an independent, open-source project. It is not affiliated with, endorsed by, or sponsored by Roblox Corporation. Sign-in is performed through the official Roblox OAuth 2.0 API — a publicly available developer program — so the authorization screen you see is hosted and operated by Roblox, not us.",
  },
  {
    question: "Is Apple Juice free to use?",
    answer:
      "Yes. Apple Juice is free and open-source (MIT License). You only pay for AI inference — either through your own OpenAI or Google AI Studio API key, or by using the platform's shared credit pool.",
  },
  {
    question: "What data do you receive when I sign in?",
    answer:
      "If you authorize via Roblox, we receive only your User ID and public profile. If you use Google, we receive your email and basic profile. We NEVER receive your password, Robux balance, purchase history, or inventory. You can revoke access at any time from your account settings.",
  },
  {
    question: "Do you store my AI provider API keys?",
    answer:
      "Never. Your API keys are stored exclusively in your browser's localStorage. They are sent directly from your browser to OpenAI or Google AI Studio — our servers are not in that data path.",
  },
  {
    question: "How does the Studio plugin work?",
    answer:
      "You install a lightweight plugin from the Roblox Creator Store. It opens a persistent WebSocket connection to your dashboard using a short-lived pairing token. When the AI generates code, scripts are pushed through this connection and created in Studio automatically. The plugin operates only within the Studio sandbox and has no access to your account or game data outside the open place.",
  },
  {
    question: "Which AI models are supported?",
    answer:
      "We support the world's most advanced reasoning models including DeepSeek R1, OpenAI o1, GPT-4o, Claude 3.5 Sonnet, and Google Gemini 2.0/1.5. You can switch between them at any time in your dashboard settings.",
  },
];

/* ─── FAQ Accordion Item ─── */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-neutral-100/60 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-6 text-left group"
      >
        <span className="text-base font-semibold text-neutral-800 group-hover:text-black transition-colors tracking-tight">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 ml-6"
        >
          <ChevronDown className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className="overflow-hidden"
      >
        <p className="pb-6 text-sm leading-relaxed text-neutral-500 max-w-3xl font-medium">
          {answer}
        </p>
      </motion.div>
    </div>
  );
}

/* ─── Code snippets for terminal mockup ─── */
const MULTI_SCRIPTS = [
  {
    name: "WeaponSystem.lua",
    type: "ModuleScript",
    parent: "ReplicatedStorage",
    lines: 34,
    code: `-- 🟢 Generated by Apple Juice AI\nlocal ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal Players = game:GetService("Players")\n\nlocal WeaponSystem = {}\nWeaponSystem.__index = WeaponSystem\n\nfunction WeaponSystem.new(config)\n    local self = setmetatable({}, WeaponSystem)\n    self.Damage = config.Damage or 25\n    self.FireRate = config.FireRate or 0.15\n    self.MaxAmmo = config.MaxAmmo or 30\n    self.CurrentAmmo = self.MaxAmmo\n    return self\nend\n\nfunction WeaponSystem:Fire(origin, direction)\n    if self.CurrentAmmo <= 0 then return end\n    self.CurrentAmmo -= 1\n\n    local raycast = workspace:Raycast(origin, direction * 200)\n    if raycast and raycast.Instance then\n        local hit = raycast.Instance\n        local humanoid = hit.Parent:FindFirstChild("Humanoid")\n        if humanoid then\n            humanoid:TakeDamage(self.Damage)\n        end\n    end\nend\n\nreturn WeaponSystem`,
  },
  {
    name: "WeaponHandler.lua",
    type: "LocalScript",
    parent: "StarterPlayerScripts",
    lines: 28,
    code: `-- 🟢 Generated by Apple Juice AI\nlocal Players = game:GetService("Players")\nlocal ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal UserInputService = game:GetService("UserInputService")\n\nlocal WeaponSystem = require(ReplicatedStorage:WaitForChild("WeaponSystem"))\nlocal player = Players.LocalPlayer\n\nlocal currentWeapon = WeaponSystem.new({\n    Damage = 30,\n    FireRate = 0.1,\n    MaxAmmo = 50\n})\n\nUserInputService.InputBegan:Connect(function(input, gameProcessed)\n    if gameProcessed then return end\n    \n    if input.UserInputType == Enum.UserInputType.MouseButton1 then\n        local mouseLocation = UserInputService:GetMouseLocation()\n        local ray = workspace.CurrentCamera:ViewportPointToRay(mouseLocation.X, mouseLocation.Y)\n        currentWeapon:Fire(ray.Origin, ray.Direction)\n    end\nend)`,
  },
  {
    name: "AmmoUI.lua",
    type: "LocalScript",
    parent: "StarterGui",
    lines: 21,
    code: `-- 🟢 Generated by Apple Juice AI\nlocal Players = game:GetService("Players")\nlocal player = Players.LocalPlayer\nlocal playerGui = player:WaitForChild("PlayerGui")\n\nlocal screenGui = Instance.new("ScreenGui")\nscreenGui.Name = "AmmoDisplay"\nscreenGui.Parent = playerGui\n\nlocal ammoLabel = Instance.new("TextLabel")\nammoLabel.Size = UDim2.new(0, 200, 0, 50)\nammoLabel.Position = UDim2.new(1, -220, 1, -70)\nammoLabel.BackgroundTransparency = 0.5\nammoLabel.BackgroundColor3 = Color3.new(0, 0, 0)\nammoLabel.TextColor3 = Color3.new(1, 1, 1)\nammoLabel.TextScaled = true\nammoLabel.Font = Enum.Font.Code\nammoLabel.Parent = screenGui`,
  },
];

/* ─── Scroll Responsive Line Animation ─── */
function ScrollLine() {
  const { scrollYProgress } = useScroll();
  const pathLength = useSpring(scrollYProgress, {
    stiffness: 20,
    damping: 15,
    restDelta: 0.001
  });

  const yHead = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      <svg
        className="w-full h-full opacity-[0.06]"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M 20 0 C 40 200 80 400 50 600 C 20 800 60 900 40 1050"
          fill="none"
          stroke="#4285f5"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pathLength }}
        />
        <motion.path
          d="M 20 0 C 40 200 80 400 50 600 C 20 800 60 900 40 1050"
          fill="none"
          stroke="#4285f5"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pathLength, opacity: 0.2 }}
        />
      </svg>

      <motion.div
        style={{ top: yHead, left: "50%", x: "-50%" }}
        className="absolute w-[800px] h-[800px] bg-blue-500/[0.01] rounded-full blur-[180px]"
      />
    </div>
  );
}

/* ─── Bento Preset Catalog ─── */
const QUERY_PRESETS = [
  {
    title: "Double Jump",
    prompt: "Construct a complete double-jump script that applies a physical upward impulse, sets up a server validation remote, and deploys a circular wind shockwave trail.",
    target: "@StarterPlayerScripts",
    model: "o1-reasoning"
  },
  {
    title: "Round Matchmaker",
    prompt: "Create a modular round matchmaker system that listens to player entry, runs a countdown loop, teleports players to random spawn points in server workspace, and tracks active session status.",
    target: "@ServerScriptService",
    model: "gemini-2.0-pro"
  },
  {
    title: "Safe Coin Shop",
    prompt: "Write a server-side cash transactional processor that safely verifies inventory purchases using Roblox DataStores, preventing negative value purchases and currency exploit attempts.",
    target: "@ServerScriptService",
    model: "o1-reasoning"
  }
];

// Spline scenes are loaded dynamically via isolated iframe containers for 100% lag-free scrolling

/* ─── Main Landing Component ─── */
export function LandingContent({
  session,
  avatarUrl: _avatarUrl,
}: {
  session: any;
  avatarUrl?: string;
}) {
  const [activeScriptIndex, setActiveScriptIndex] = useState(0);
  const [showAuthGuide, setShowAuthGuide] = useState(false);
  const [scrolled, setScrolled] = useState(false);


  // Explore Bento Grid interactive states
  const [bentoQueryIndex, setBentoQueryIndex] = useState(0);
  const [simulatedStep, setSimulatedStep] = useState(4);
  const [isSimulating, setIsSimulating] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({
    replicatedStorage: true,
    serverScriptService: false,
    starterPlayer: true
  });
  const [selectedExplorerItem, setSelectedExplorerItem] = useState("WeaponSystem");
  const [showExplorerMenu, setShowExplorerMenu] = useState(false);
  const [visualScale, setVisualScale] = useState(1.0);
  const [visualCoordX, setVisualCoordX] = useState(0);
  const [visualCoordY, setVisualCoordY] = useState(0);

  // Spotlight coordinates for interactive mouse-coordinate glows
  const [coordsA, setCoordsA] = useState({ x: 0, y: 0 });
  const [coordsB, setCoordsB] = useState({ x: 0, y: 0 });
  const [coordsC, setCoordsC] = useState({ x: 0, y: 0 });
  const [coordsD, setCoordsD] = useState({ x: 0, y: 0 });

  const startSimulation = () => {
    setIsSimulating(true);
    setSimulatedStep(0);
    const intervals = [600, 1400, 2200, 3000];
    intervals.forEach((delay, index) => {
      setTimeout(() => {
        setSimulatedStep(index + 1);
        if (index === intervals.length - 1) {
          setIsSimulating(false);
        }
      }, delay);
    });
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveScriptIndex((prev) => (prev + 1) % MULTI_SCRIPTS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[#050508] text-white/90 selection:bg-[#ccff00]/20 selection:text-white relative font-sans overflow-x-hidden antialiased">

      {/* ━━━ GOOGLE ANTIGRAVITY REAL-TIME MEDUSAE BACKGROUND ━━━ */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-45">
        <Medusae
          config={{
            background: { color: "#050508" },
            particles: {
              colorBase: "#ffffff",
              colorOne: "#3b82f6",
              colorTwo: "#8b5cf6",
              colorThree: "#ccff00",
              baseSize: 0.015,
              activeSize: 0.042,
              cursorFollowStrength: 0.85,
              rotationSpeed: 0.06,
            },
            halo: {
              radiusBase: 2.2,
              radiusAmplitude: 0.4,
              shapeAmplitude: 0.75,
              rimWidth: 1.6,
            }
          }}
        />
      </div>

      {/* ━━━ STRIPE SIGNATURE HERO ANIMATED TWISTED WAVE LINES ━━━ */}
      <StripeWave />

      {/* Stripe animated grid pattern & ambient neon highlights */}
      <div className="fixed inset-0 stripe-grid pointer-events-none z-0 opacity-40" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(204,255,0,0.08),transparent_70%)] pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_40%,rgba(59,130,246,0.05),transparent_60%)] pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_80%_60%,rgba(139,92,246,0.05),transparent_60%)] pointer-events-none z-0" />

      {/* ━━━ NAVBAR ━━━ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 flex justify-center py-0 px-0`}>
        <div
          className={`w-full max-w-[1400px] transition-all duration-300 flex items-center justify-between mx-auto ${scrolled
              ? "h-14 px-6 md:px-12 glossy-panel-dark border-b border-white/5 shadow-2xl"
              : "h-20 px-6 md:px-10 bg-transparent border-b border-transparent"
            }`}
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-transform hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5 text-black font-black"
                fill="currentColor"
              >
                <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
                <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
                <path
                  d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-sm font-black tracking-widest text-white uppercase font-mono">
              APPLE JUICE
            </span>
          </div>

          <div className="hidden md:flex items-center gap-10">
            <a
              href="#explore"
              className="text-[11px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors duration-200"
            >
              Explore
            </a>
            <a
              href="#features"
              className="text-[11px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors duration-200"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-[11px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors duration-200"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="text-[11px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors duration-200"
            >
              FAQ
            </a>
          </div>

          <button
            onClick={() =>
              session
                ? (window.location.href = "/dashboard")
                : setShowAuthGuide(true)
            }
            className="h-9 px-6 rounded-full bg-[#ccff00] text-black text-[11px] font-black uppercase tracking-wider hover:bg-[#d4ff33] shadow-[0_0_15px_rgba(204,255,0,0.25)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5"
          >
            {session ? "Enter Studio" : "Get Started"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* ━━━ HERO & DEMO PANEL ━━━ */}
      <section className="relative pt-36 pb-24 px-6 md:px-12 xl:px-20 z-10 flex flex-col items-center">
        <div className="w-full max-w-[1300px] mx-auto text-center flex flex-col items-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-4.5 py-1.5 rounded-full glossy-pill-dark border border-white/5 shadow-sm mb-6"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#ccff00]" />
            <span className="text-[10px] tracking-wider uppercase font-bold text-white/40 font-mono">
              Next-Gen Roblox Companion · Secure WebSocket Link
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[44px] sm:text-[68px] md:text-[84px] font-black leading-[1.05] tracking-[-0.04em] mb-8 text-slate-400 max-w-5xl"
            style={{ mixBlendMode: "color-dodge" }}
          >
            Roblox Studio, <br />
            <span className="text-white">
              elevated by weightless AI.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-[620px] text-lg md:text-xl text-slate-400 mb-10 leading-relaxed font-medium"
            style={{ mixBlendMode: "color-dodge" }}
          >
            Describe the game elements you want to engineer. Apple Juice generates high-quality Luau code and injects it dynamically into your active Roblox Studio session.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <button
              onClick={() =>
                session
                  ? (window.location.href = "/dashboard")
                  : setShowAuthGuide(true)
              }
              className="h-12 w-full sm:w-auto px-8 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-[#d4ff33] shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-105 active:scale-95 transition-all duration-300"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#explore"
              className="h-12 w-full sm:w-auto px-8 rounded-full bg-white/5 border border-white/10 text-white/80 font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              Explore Features
            </a>
          </motion.div>
        </div>

        {/* ━━━ HIGH-FIDELITY IDE DEMO PLAYER ━━━ */}
        <div className="w-full max-w-[1000px] mx-auto px-2">
          <div className="rounded-2xl border border-neutral-800 bg-[#0f1115] overflow-hidden relative shadow-[0_30px_70px_rgba(0,0,0,0.15)] flex flex-col h-[460px] md:h-[400px]">
            {/* Soft Blue Back-Glow */}
            <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/[0.07] rounded-full blur-[100px] pointer-events-none" />

            {/* Window bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800/80 bg-[#14161b] flex-shrink-0 h-[48px] relative z-10">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="ml-4 text-[10px] uppercase font-bold tracking-widest text-neutral-400 font-mono">
                  Apple Juice IDE — Connected
                </span>
              </div>
              <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800 shadow-inner">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold font-mono">
                  Active Pairing
                </span>
              </div>
            </div>

            {/* Split Panel */}
            <div className="flex flex-col md:flex-row flex-1 h-[calc(100%-48px)] relative z-10">
              {/* Active script viewer */}
              <div className="flex-1 border-b md:border-b-0 md:border-r border-neutral-800/80 bg-[#0c0d10] relative overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto p-6 scrollbar-thin">
                  <AnimatePresence mode="wait">
                    <motion.pre
                      key={activeScriptIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="font-mono text-[11px] md:text-[12px] leading-relaxed text-neutral-300"
                    >
                      <Highlight
                        theme={luauTheme}
                        code={MULTI_SCRIPTS[activeScriptIndex].code}
                        language="lua"
                      >
                        {({ tokens, getTokenProps }) => (
                          <code>
                            {tokens.map((line, i) => (
                              <div key={i} className="table-row">
                                <span className="table-cell text-right pr-5 text-neutral-600 select-none text-[10px] w-8">{i + 1}</span>
                                <span className="table-cell">
                                  {line.map((token, key) => (
                                    <span
                                      key={key}
                                      {...getTokenProps({ token })}
                                    />
                                  ))}
                                </span>
                              </div>
                            ))}
                          </code>
                        )}
                      </Highlight>
                    </motion.pre>
                  </AnimatePresence>
                </div>
              </div>

              {/* Sidebar File Explorer */}
              <div className="w-full md:w-64 p-4 bg-[#111317] flex-shrink-0 flex flex-row md:flex-col gap-2.5 overflow-x-auto md:overflow-y-auto no-scrollbar border-t border-neutral-800 md:border-none">
                <p className="hidden md:block text-[9px] tracking-widest uppercase font-bold text-neutral-500 mb-2 ml-1 font-mono">
                  Workspace Files
                </p>
                {MULTI_SCRIPTS.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveScriptIndex(i)}
                    className={`flex flex-shrink-0 min-w-[180px] md:min-w-0 items-center justify-between p-3 rounded-xl border transition-all duration-300 cursor-pointer ${activeScriptIndex === i
                        ? "bg-[#1f232b] text-white border-neutral-700/80 shadow-md"
                        : "bg-white/[0.01] border-transparent text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
                      }`}
                  >
                    <div className="truncate pr-2">
                      <div className="flex items-center gap-2">
                        <FileCode className={`w-3.5 h-3.5 ${activeScriptIndex === i ? "text-[#4285f5]" : "text-neutral-500"}`} />
                        <p className={`text-xs font-bold truncate tracking-tight ${activeScriptIndex === i ? "text-white" : "text-neutral-300"}`}>
                          {s.name}
                        </p>
                      </div>
                      <p className="text-[10px] mt-1 truncate text-neutral-500 font-mono ml-5.5">
                        {s.parent}
                      </p>
                    </div>
                    <span className="text-[9px] font-mono flex-shrink-0 text-neutral-400 bg-neutral-900/80 px-2 py-0.5 rounded-full border border-neutral-800">
                      {s.lines}L
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ "EXPLORE THE PRODUCT" HIGH-FIDELITY INTERACTIVE BENTO GRID ━━━ */}
      <section id="explore" className="relative overflow-visible min-h-screen pb-24 md:pb-32">

        {/* 3D Spline Keyboard Backdrop (lazy-mounted: only runs when visible, unmounts when scrolled away) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] z-0 pointer-events-none flex items-center justify-center">
          <script type="module" src="https://unpkg.com/@splinetool/viewer@1.12.94/build/spline-viewer.js"></script>
          <spline-viewer className="w-full h-full" style={{ transform: "scale(2)", transformOrigin: "center" }} url="https://prod.spline.design/EaWp7XtmihBtmdVX/scene.splinecode"></spline-viewer>
        </div>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-5 uppercase">
              Explore the product
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto font-medium leading-relaxed">
              We engineered a beautifully streamlined developer interface, letting you author mechanics, simulate workflows, and inspect coordinates interactively.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

            {/* CARD A: DYNAMIC AI PROMPT COMPOSER - GRID: 7 COL */}
            <div
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCoordsA({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              className="md:col-span-7 rounded-3xl glossy-card-dark raycast-shine-dark p-8 flex flex-col relative overflow-hidden group"
            >
              <div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition duration-300 z-10"
                style={{
                  background: `radial-gradient(400px circle at ${coordsA.x}px ${coordsA.y}px, rgba(204, 255, 0, 0.08), transparent 40%)`
                }}
              />
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[60px] opacity-40 pointer-events-none" />

              <div className="flex items-center justify-between mb-6 relative z-20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-sm">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Prompt Composer
                    </h3>
                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Active Workspace Scans</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  v1.8
                </span>
              </div>

              {/* Preset Selector Tabs */}
              <div className="flex flex-wrap gap-2 mb-4 relative z-20">
                {QUERY_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setBentoQueryIndex(idx)}
                    className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider transition-all border ${bentoQueryIndex === idx
                        ? "bg-[#ccff00] text-black border-transparent font-black shadow-[0_0_15px_rgba(204,255,0,0.3)] scale-105"
                        : "bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white"
                      }`}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>

              {/* Pulsing Gradient AI Card Mockup */}
              <div className="relative w-full rounded-2xl bg-[#08090c]/70 border border-white/5 p-5 shadow-2xl mb-6 z-20">
                {/* Active Neon Border Highlight */}
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent bg-gradient-to-r from-[#ccff00] via-[#52ff75] to-[#00f0ff] opacity-25 animate-pulse pointer-events-none" />

                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Active Workspace Query</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Pairing Ready</span>
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>
                </div>

                <p className="text-white/90 font-mono text-xs md:text-sm leading-relaxed mb-6 font-medium min-h-[64px]">
                  &quot;{QUERY_PRESETS[bentoQueryIndex].prompt}&quot;
                </p>

                {/* Sub-parameters HUD preview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/5 pt-4 mb-4 text-[10px] font-mono text-white/40">
                  <div>
                    <p className="text-white/20 uppercase text-[8px] font-bold">Target Path</p>
                    <p className="text-white font-bold mt-0.5">{QUERY_PRESETS[bentoQueryIndex].target}</p>
                  </div>
                  <div>
                    <p className="text-white/20 uppercase text-[8px] font-bold">Model Engine</p>
                    <p className="text-white font-bold mt-0.5">{QUERY_PRESETS[bentoQueryIndex].model}</p>
                  </div>
                  <div>
                    <p className="text-white/20 uppercase text-[8px] font-bold">Temperature</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-[70%]" />
                      </div>
                      <span className="text-white">0.7</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/20 uppercase text-[8px] font-bold">Max Tokens</p>
                    <p className="text-white font-bold mt-0.5">4,096</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-4 flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                    <span className="text-[10px] text-white/40 font-mono">Synced to Roblox Studio pairing session</span>
                  </div>
                  <button className="h-8 px-4 bg-[#ccff00] text-black text-[10px] uppercase font-black tracking-wider rounded-lg shadow-[0_0_12px_rgba(204,255,0,0.2)] hover:bg-[#d4ff33] transition-all">
                    Sync to Studio
                  </button>
                </div>
              </div>

              <div className="mt-auto relative z-20">
                <h4 className="text-base font-black text-white mb-2 uppercase tracking-tight">
                  Dynamic Prompt Orchestrator
                </h4>
                <p className="text-sm text-white/60 leading-relaxed font-medium">
                  Reference scripts, workspace parts, and structural directories inside your query. The AI automatically compiles, handles scope declarations, and saves to files.
                </p>
              </div>
            </div>

            {/* CARD B: AUTONOMOUS THOUGHT LOGS - GRID: 5 COL */}
            <div
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCoordsB({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              className="md:col-span-5 rounded-3xl glossy-card-dark raycast-shine-dark p-8 flex flex-col relative overflow-hidden group"
            >
              <div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition duration-300 z-10"
                style={{
                  background: `radial-gradient(400px circle at ${coordsB.x}px ${coordsB.y}px, rgba(204, 255, 0, 0.08), transparent 40%)`
                }}
              />
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] opacity-40 pointer-events-none" />

              <div className="flex items-center justify-between mb-6 relative z-20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-sm">
                    <Bot className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Thought Agent
                    </h3>
                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Dynamic Trace Log</p>
                  </div>
                </div>

                <button
                  onClick={startSimulation}
                  disabled={isSimulating}
                  className="h-8 px-3 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all text-[9px] uppercase tracking-wider font-bold font-mono flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isSimulating ? "animate-spin text-emerald-400" : ""}`} />
                  {isSimulating ? "Analyzing..." : "Simulate"}
                </button>
              </div>

              {/* Steps Mockup Grid */}
              <div className="bg-black/35 rounded-2xl border border-white/5 p-5 font-mono text-[11px] text-white/70 leading-relaxed mb-6 space-y-4 shadow-inner min-h-[220px] relative z-20">

                {/* Step 1 */}
                <div className={`flex items-start gap-3 transition-opacity duration-300 ${simulatedStep >= 1 ? "opacity-100" : "opacity-40"}`}>
                  {simulatedStep >= 1 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : simulatedStep === 0 ? (
                    <div className="h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/10 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold text-white">Scanned Roblox Workspace tree</p>
                    <p className="text-[10px] text-white/40 font-medium">Found 18 elements in active hierarchy</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className={`flex items-start gap-3 transition-opacity duration-300 ${simulatedStep >= 2 ? "opacity-100" : "opacity-40"}`}>
                  {simulatedStep >= 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : simulatedStep === 1 ? (
                    <div className="h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/10 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold text-white">Verified active pairing session</p>
                    <p className="text-[10px] text-white/40 font-medium">AppleJuiceSync connection verified (Port 9223)</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className={`flex items-start gap-3 transition-opacity duration-300 ${simulatedStep >= 3 ? "opacity-100" : "opacity-40"}`}>
                  {simulatedStep >= 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : simulatedStep === 2 ? (
                    <div className="h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/10 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold text-white">Synthesizing script templates</p>
                    <p className="text-[10px] text-[#ccff00] font-black">Completed in 0.9s ({QUERY_PRESETS[bentoQueryIndex].model})</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className={`flex items-start gap-3 transition-opacity duration-300 ${simulatedStep >= 4 ? "opacity-100" : "opacity-40"}`}>
                  {simulatedStep >= 4 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : simulatedStep === 3 ? (
                    <div className="h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/10 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold text-white">Injected scripts to Roblox Studio</p>
                    <p className="text-[10px] text-white/40 font-medium">Saved 2 objects to {QUERY_PRESETS[bentoQueryIndex].target}</p>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-[#0a0c10]/95 backdrop-blur-xl border border-white/10 text-white rounded-xl px-4 py-3 flex items-center justify-between font-mono text-[10px] relative z-20">
                <span>Status:</span>
                {simulatedStep === 4 ? (
                  <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Synced (2.4s total)
                  </span>
                ) : (
                  <span className="text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Computing steps...
                  </span>
                )}
              </div>

              <div className="mt-auto pt-6 relative z-20">
                <h4 className="text-base font-black text-white mb-2 uppercase tracking-tight">
                  Reasoning Diagnostics
                </h4>
                <p className="text-sm text-white/60 leading-relaxed font-medium">
                  Watch the agent assemble full step-by-step thinking processes. Apple Juice automatically identifies bugs, reports validation errors, and rewrites script parts instantly.
                </p>
              </div>
            </div>

            {/* CARD C: ROBLOX EXPLORER HIERARCHY - GRID: 5 COL */}
            <div
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCoordsC({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              className="md:col-span-5 rounded-3xl glossy-card-dark raycast-shine-dark p-8 flex flex-col relative overflow-hidden group"
            >
              <div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition duration-300 z-10"
                style={{
                  background: `radial-gradient(400px circle at ${coordsC.x}px ${coordsC.y}px, rgba(204, 255, 0, 0.08), transparent 40%)`
                }}
              />
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[60px] opacity-40 pointer-events-none" />

              <div className="flex items-center justify-between mb-8 relative z-20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-sm">
                    <Folder className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Workspace Explorer
                    </h3>
                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Studio Sync Map</p>
                  </div>
                </div>
              </div>

              {/* Hierarchy Tree representation */}
              <div className="bg-black/35 rounded-2xl border border-white/5 p-5 font-mono text-xs text-neutral-300 mb-6 space-y-3.5 shadow-lg select-none relative min-h-[220px] z-20">

                {/* ReplicatedStorage Folder */}
                <div className="space-y-1">
                  <div
                    onClick={() => setExpandedFolders(prev => ({ ...prev, replicatedStorage: !prev.replicatedStorage }))}
                    className="flex items-center gap-2 text-white/40 hover:text-white cursor-pointer select-none py-0.5 transition-colors"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${expandedFolders.replicatedStorage ? "rotate-90" : ""}`} />
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>ReplicatedStorage</span>
                  </div>

                  {expandedFolders.replicatedStorage && (
                    <div className="pl-6 space-y-1.5">
                      <div
                        onClick={() => {
                          setSelectedExplorerItem("WeaponSystem");
                          setShowExplorerMenu(true);
                        }}
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-all ${selectedExplorerItem === "WeaponSystem"
                            ? "bg-blue-500/20 border border-blue-500/35 text-white"
                            : "hover:bg-white/[0.04] text-neutral-300"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-bold">WeaponSystem</span>
                        </div>
                        <span className="text-[8px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Module</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ServerScriptService Folder */}
                <div className="space-y-1">
                  <div
                    onClick={() => setExpandedFolders(prev => ({ ...prev, serverScriptService: !prev.serverScriptService }))}
                    className="flex items-center gap-2 text-white/40 hover:text-white cursor-pointer select-none py-0.5 transition-colors"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${expandedFolders.serverScriptService ? "rotate-90" : ""}`} />
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>ServerScriptService</span>
                  </div>

                  {expandedFolders.serverScriptService && (
                    <div className="pl-6 space-y-1.5">
                      <div
                        onClick={() => {
                          setSelectedExplorerItem("DamageProcessor");
                          setShowExplorerMenu(true);
                        }}
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-all ${selectedExplorerItem === "DamageProcessor"
                            ? "bg-blue-500/20 border border-blue-500/35 text-white"
                            : "hover:bg-white/[0.04] text-neutral-300"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-bold">DamageProcessor</span>
                        </div>
                        <span className="text-[8px] bg-emerald-505 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Script</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* StarterPlayerScripts Folder */}
                <div className="space-y-1">
                  <div
                    onClick={() => setExpandedFolders(prev => ({ ...prev, starterPlayer: !prev.starterPlayer }))}
                    className="flex items-center gap-2 text-white/40 hover:text-white cursor-pointer select-none py-0.5 transition-colors"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${expandedFolders.starterPlayer ? "rotate-90" : ""}`} />
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>StarterPlayerScripts</span>
                  </div>

                  {expandedFolders.starterPlayer && (
                    <div className="pl-6 space-y-1.5">
                      <div
                        onClick={() => {
                          setSelectedExplorerItem("WeaponHandler");
                          setShowExplorerMenu(true);
                        }}
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-all ${selectedExplorerItem === "WeaponHandler"
                            ? "bg-blue-500/20 border border-blue-500/35 text-white"
                            : "hover:bg-white/[0.04] text-neutral-300"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-bold">WeaponHandler</span>
                        </div>
                        <span className="text-[8px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Local</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Interactive Simulated Right-Click Context Actions Popup Menu */}
                {showExplorerMenu && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#0c0e12]/95 border border-white/10 rounded-xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.65)] z-20 w-48 font-mono text-[10px] space-y-1 animate-in zoom-in-95 duration-150 text-left backdrop-blur-xl">
                    <div className="flex items-center justify-between px-1.5 py-1 text-white/30 border-b border-white/5 mb-1.5 uppercase font-bold text-[8px] tracking-wider">
                      <span>Actions</span>
                      <button onClick={(e) => { e.stopPropagation(); setShowExplorerMenu(false); }} className="hover:text-white transition-colors text-[9px] font-bold">X</button>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-white/[0.05] rounded-lg cursor-pointer text-white transition-colors" onClick={() => setShowExplorerMenu(false)}>
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Pair with Apple Juice</span>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-white/[0.05] rounded-lg cursor-pointer text-white/70 transition-colors" onClick={() => setShowExplorerMenu(false)}>
                      <Bot className="w-3 h-3 text-emerald-400" />
                      <span>Analyze Debug Logs</span>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-white/[0.05] rounded-lg cursor-pointer text-white/70 transition-colors" onClick={() => setShowExplorerMenu(false)}>
                      <Plus className="w-3 h-3 text-white/30" />
                      <span>Add to Context Scope</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto relative z-20">
                <h4 className="text-base font-black text-white mb-2 uppercase tracking-tight">
                  Seamless Hierarchy Maps
                </h4>
                <p className="text-sm text-white/60 leading-relaxed font-medium">
                  Understand your environment. Apple Juice maps local structures, scripts, and parent classes so that the model understands precisely where to sync components.
                </p>
              </div>
            </div>

            {/* PRODUCT SHOWCASE 1: DASHBOARD (col-span-12) */}
            <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 items-center my-10 relative z-20 font-sans">
              
              {/* Left Content: Text */}
              <div className="md:col-span-5 flex flex-col items-start order-2 md:order-1">
                 <h3 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4 drop-shadow-2xl">
                   Organized & Efficient
                 </h3>
                 <p className="text-white/60 font-medium text-base md:text-lg leading-relaxed">
                   Experience a beautifully streamlined dashboard that keeps your entire workflow perfectly organized. Navigate your projects effortlessly, drop into a chat, and let Apple Juice handle the heavy lifting.
                 </p>
              </div>

              {/* Right Content: Image & Floating UI */}
              <div className="md:col-span-7 relative h-[450px] md:h-[600px] w-full rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden group order-1 md:order-2">
                 <div className="absolute top-0 left-0 w-[150%] h-[150%] origin-top-left scale-[0.666] pointer-events-none overflow-hidden">
                    <DashboardClient username="Creator" isDemoMode="lobby" />
                 </div>
              </div>
            </div>

            {/* PRODUCT SHOWCASE 2: IDE (col-span-12) */}
            <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 items-center my-10 relative z-20 font-sans">
              
              {/* Left Content: Image & Floating UI */}
              <div className="md:col-span-7 relative h-[450px] md:h-[600px] w-full rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden group order-1 md:order-1">
                 <div className="absolute top-0 left-0 w-[150%] h-[150%] origin-top-left scale-[0.666] pointer-events-none overflow-hidden">
                    <DashboardClient username="Creator" initialProjectId="showcase" isDemoMode="ide" />
                 </div>
              </div>

              {/* Right Content: Text */}
              <div className="md:col-span-5 flex flex-col items-start order-2 md:order-2 md:pl-8">
                 <h3 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4 drop-shadow-2xl">
                   Professional IDE Style
                 </h3>
                 <p className="text-white/60 font-medium text-base md:text-lg leading-relaxed">
                   Develop within a fully integrated IDE-style workspace. The interface mirrors the professional tools you already know, offering a seamless, intuitive, and highly capable environment.
                 </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ CORE FEATURES (THREE COLUMNS ROW) ━━━ */}
      <section id="features" className="px-6 py-24 md:py-32 relative">
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
              We handle the hard stuff
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto font-medium leading-relaxed">
              Autonomously synchronize code files, run diagnostics, and roll back configurations instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

            {/* COLUMN 1 */}
            <div className="flex flex-col items-start bg-[#08090c]/40 border border-white/5 rounded-3xl p-8 shadow-2xl hover:border-white/10 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-sm">
                <Layers className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-3 tracking-tight uppercase">
                No More Copy-Pasting
              </h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                Our lightweight Roblox Creator Store plugin creates script and module instances automatically. Any files synthesized by the AI dashboard write instantly to your workspace.
              </p>
            </div>

            {/* COLUMN 2 */}
            <div className="flex flex-col items-start bg-[#08090c]/40 border border-white/5 rounded-3xl p-8 shadow-2xl hover:border-white/10 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-3 tracking-tight uppercase">
                Diagnostics & Playtests
              </h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                Apple Juice runs real-time playtest checks, parses client output lines, and catches runtime issues or compiler warnings in your Luau script blocks, rolling out immediate fixes.
              </p>
            </div>

            {/* COLUMN 3 */}
            <div className="flex flex-col items-start bg-[#08090c]/40 border border-white/5 rounded-3xl p-8 shadow-2xl hover:border-white/10 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-sm">
                <History className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-3 tracking-tight uppercase">
                Version Rollbacks
              </h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                Accidents happen. Review execution logs, scan previous code blocks, and roll back components to clean states in one click. Every file adjustment is archived safely on your dashboard.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ━━━ PRICING (Sleek fully rounded cards with gorgeous video backdrop) ━━━ */}
      <section id="pricing" className="px-6 py-24 md:py-32 relative overflow-visible bg-transparent">
        
        <div className="max-w-[1200px] mx-auto relative z-10">
          
          {/* Removed Hard Container Box; using relative wrapper */}
          <div className="relative py-20 px-6 md:px-0 mb-16">

            
            {/* Lively Ambient Pulsating Glow */}
            <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden flex items-center justify-center">
              <div className="absolute w-[800px] h-[800px] rounded-full bg-[#ff5a00]/5 blur-[120px] animate-pulse duration-[8000ms] mix-blend-screen" />
            </div>

            {/* Seamless Video Backdrop */}
            <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center bg-transparent">
              <div className="w-[2200px] h-[1300px] max-w-none flex-shrink-0 select-none flex items-center justify-center bg-transparent translate-y-[180px] md:-translate-x-[150px]">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-100 select-none pointer-events-none"
                  style={{
                    mixBlendMode: "screen",
                    filter: "contrast(1.3) brightness(0.8)",
                    maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 30%, transparent 80%)",
                    WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 30%, transparent 80%)",
                  }}
                  src="/0517.mp4"
                />
              </div>
            </div>

            {/* Header Content */}
            <div className="text-center mb-20 relative z-10">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
                Pick your squeeze
              </h2>
              <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto font-medium leading-relaxed">
                Flexible credit tiers billed securely in Robux, or connect your personal API key to build completely free forever.
              </p>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">

            {/* TIER 1: FREE */}
            <div className="bg-[#08090c]/45 border border-white/5 rounded-[2.5rem] p-10 flex flex-col hover:border-white/10 hover:shadow-2xl transition-all duration-500 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px] opacity-30 group-hover:scale-125 transition-transform" />
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3 font-mono">
                Free Sip
              </div>
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                0 R$
                <span className="text-xs text-white/40 font-bold ml-1">/ forever</span>
              </div>
              <p className="text-xs text-white/40 mb-8 border-b border-white/5 pb-6 font-medium">
                Perfect for hobbyists and learning Luau.
              </p>

              <ul className="flex flex-col gap-4 mb-10 text-[13px] text-white/70 font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>1.0 Credit Allowance</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>Gemini Flash & GPT-4o-mini</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>Roblox Studio Plugin Sync</span>
                </li>
              </ul>

              <button
                onClick={() => setShowAuthGuide(true)}
                className="mt-auto w-full h-12 rounded-full border border-white/10 text-white font-bold py-3 hover:bg-white/5 transition-all uppercase tracking-wider text-[11px] shadow-sm"
              >
                Sign Up Free
              </button>
            </div>

            {/* TIER 2: PRO (Solid Accent) */}
            <div className="bg-[#08090c]/70 border-2 border-[#ccff00] rounded-[2.5rem] p-10 flex flex-col relative transform md:-translate-y-4 shadow-[0_0_35px_rgba(204,255,0,0.12)] z-20 hover:scale-[1.02] transition-transform duration-300">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#ccff00] text-black text-[9px] font-black uppercase tracking-wider py-1.5 px-6 rounded-full shadow-md">
                Highly Recommended
              </div>
              <div className="text-[#ccff00] text-xs font-bold uppercase tracking-wider mb-3 font-mono">
                Fresh Pro
              </div>
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                600 R$
                <span className="text-xs text-white/40 font-bold ml-1">/ month</span>
              </div>
              <p className="text-xs text-white/40 mb-8 border-b border-white/5 pb-6 font-medium">
                Engineered for serious studio builders.
              </p>

              <ul className="flex flex-col gap-4 mb-10 text-[13px] text-white/80 font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#ccff00] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Plus className="w-3.5 h-3.5 text-black" />
                  </div>
                  <span className="text-white font-black">5.0 Credits Allowance</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>DeepSeek V3 & Gemini Pro</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>Full Studio Context Scans</span>
                </li>
              </ul>

              <button
                onClick={() =>
                  window.open(
                    "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                    "_blank"
                  )
                }
                className="mt-auto w-full h-12 rounded-full bg-[#ccff00] text-black font-black py-3 hover:bg-[#d4ff33] transition-all uppercase tracking-wider text-[11px] shadow-sm flex items-center justify-center gap-1.5"
              >
                Upgrade to Pro
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TIER 3: ULTRA */}
            <div className="bg-[#08090c]/45 border border-white/5 rounded-[2.5rem] p-10 flex flex-col hover:border-white/10 hover:shadow-2xl transition-all duration-500 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px] opacity-30 group-hover:scale-125 transition-transform" />
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3 font-mono">
                Pure Ultra
              </div>
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                1,500 R$
                <span className="text-xs text-white/40 font-bold ml-1">/ month</span>
              </div>
              <p className="text-xs text-white/40 mb-8 border-b border-white/5 pb-6 font-medium">
                Uncompromising agent-first performance.
              </p>

              <ul className="flex flex-col gap-4 mb-10 text-[13px] text-white/70 font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>15.0 Credits Allowance</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>DeepSeek R1 & OpenAI o1</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>8 Parallel Studio Workspace Tasks</span>
                </li>
              </ul>

              <button
                onClick={() =>
                  window.open(
                    "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                    "_blank"
                  )
                }
                className="mt-auto w-full h-12 rounded-full border border-white/10 text-white font-bold py-3 hover:bg-white/5 transition-all uppercase tracking-wider text-[11px] shadow-sm"
              >
                Get Ultra Pack
              </button>
            </div>

          </div>
          </div> {/* Close Unified Shop Container Box */}

          {/* MODEL COMPARISON TABLE */}
          <div className="bg-[#08090c]/45 border border-white/5 rounded-[2.5rem] p-8 md:p-10 mb-16 overflow-x-auto shadow-2xl relative z-20">
            <h4 className="text-xs font-black uppercase tracking-wider text-white/40 mb-8 text-center font-mono">
              Compare Tiers
            </h4>
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-4 text-white/40 font-bold px-4 uppercase tracking-wider text-[10px] font-mono">
                    Tier
                  </th>
                  <th className="text-left py-4 text-white/40 font-bold px-4 uppercase tracking-wider text-[10px] font-mono">
                    Primary Model
                  </th>
                  <th className="text-left py-4 text-white/40 font-bold px-4 uppercase tracking-wider text-[10px] font-mono">
                    Context Window
                  </th>
                  <th className="text-left py-4 text-white/40 font-bold px-4 uppercase tracking-wider text-[10px] font-mono">
                    Speed
                  </th>
                </tr>
              </thead>
              <tbody className="text-white/80 font-medium">
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-5 px-4 text-white font-bold">Free</td>
                  <td className="py-5 px-4">DeepSeek V3 / Gemini Flash</td>
                  <td className="py-5 px-4 text-white/40">Standard (128k)</td>
                  <td className="py-5 px-4 text-[#ccff00] font-black uppercase text-xs tracking-wider">Lightning</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-5 px-4 text-[#ccff00] font-black">Pro</td>
                  <td className="py-5 px-4">GPT-4o / Claude 3.5 Sonnet</td>
                  <td className="py-5 px-4 text-white/40">Enhanced (200k)</td>
                  <td className="py-5 px-4 text-emerald-400 font-bold uppercase text-xs tracking-wider">Instant</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-5 px-4 text-[#00f0ff] font-bold">Ultra</td>
                  <td className="py-5 px-4">DeepSeek R1 / OpenAI o1</td>
                  <td className="py-5 px-4 text-white/40">Deep Window (1M+)</td>
                  <td className="py-5 px-4 text-blue-400 font-bold uppercase text-xs tracking-wider">Priority Queue</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* JUICE REFILL PACKS */}
          <div className="bg-[#08090c]/45 border border-white/5 rounded-[2.5rem] p-10 md:p-12 shadow-2xl text-center relative overflow-hidden z-20">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3">
              Need a quick squeeze?
            </h3>
            <p className="text-white/60 text-sm mb-10 max-w-md mx-auto font-medium">
              Refill your workspace credits instantly using safe, secure one-off Robux packs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Refill 1 */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">Small Sip</span>
                <div className="text-2xl font-black text-white mb-1">350 R$</div>
                <div className="text-xs text-[#ccff00] font-black uppercase tracking-wide mb-6">5.0 Credits Refill</div>
                <button
                  onClick={() =>
                    window.open(
                      "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                      "_blank"
                    )
                  }
                  className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all uppercase tracking-wider"
                >
                  Buy Pack
                </button>
              </div>

              {/* Refill 2 */}
              <div className="bg-[#08090c]/70 border-2 border-[#ccff00] rounded-2xl p-6 flex flex-col items-center relative shadow-[0_0_20px_rgba(204,255,0,0.1)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ccff00] text-black text-[8px] font-black uppercase tracking-wider py-1 px-4 rounded-full">
                  Best Value
                </div>
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 mt-1 font-mono">Juice Box</span>
                <div className="text-2xl font-black text-white mb-1">950 R$</div>
                <div className="text-xs text-[#ccff00] font-black uppercase tracking-wide mb-6">20.0 Credits Refill</div>
                <button
                  onClick={() =>
                    window.open(
                      "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                      "_blank"
                    )
                  }
                  className="w-full h-10 rounded-xl bg-[#ccff00] text-black font-black text-xs hover:bg-[#d4ff33] transition-all uppercase tracking-wider"
                >
                  Buy Pack
                </button>
              </div>

              {/* Refill 3 */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">Mega Jug</span>
                <div className="text-2xl font-black text-white mb-1">3,000 R$</div>
                <div className="text-xs text-[#ccff00] font-black uppercase tracking-wide mb-6">80.0 Credits Refill</div>
                <button
                  onClick={() =>
                    window.open(
                      "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                      "_blank"
                    )
                  }
                  className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all uppercase tracking-wider"
                >
                  Buy Pack
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ━━━ FAQ (Light Accents Accordion) ━━━ */}
      <section id="faq" className="px-6 py-24 md:py-32 relative">
        <div className="max-w-[850px] mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white">
              Questions?
            </h2>
            <p className="text-white/40 text-sm mt-3 font-medium">
              Everything you need to know about setting up Apple Juice.
            </p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-[#08090c]/45 backdrop-blur-md px-8 py-4 shadow-2xl">
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={i} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ BOTTOM CALL-TO-ACTION ━━━ */}
      <section className="px-6 pb-28">
        <div className="max-w-[1000px] mx-auto text-center p-12 md:p-24 rounded-[3rem] bg-[#08090c]/85 border border-white/10 backdrop-blur-2xl text-white relative overflow-hidden shadow-2xl">
          {/* Soft backlights */}
          <div className="absolute -top-36 left-1/4 w-[400px] h-[400px] bg-blue-500/[0.08] rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-36 right-1/4 w-[400px] h-[400px] bg-[#ccff00]/[0.04] rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tight mb-8 leading-none">
              Ship your next <br /> mechanic <span className="text-[#ccff00]">tonight.</span>
            </h2>
            <p className="text-base text-white/60 mb-12 max-w-lg mx-auto font-medium leading-relaxed">
              Join developers building Roblox games at weightless speeds. Completely independent, MIT licensed, and fully secure.
            </p>

            <button
              onClick={() =>
                session
                  ? (window.location.href = "/dashboard")
                  : setShowAuthGuide(true)
              }
              className="h-14 px-10 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-[#d4ff33] transition-all mx-auto shadow-[0_0_20px_rgba(204,255,0,0.35)] hover:scale-105 active:scale-95"
            >
              Start Engineering Free
              <ArrowRight className="h-4 w-4 text-black font-black" />
            </button>
          </div>
        </div>
      </section>

      {/* ━━━ FOOTER with stark black Antigravity-style typography ━━━ */}
      <footer className="px-6 md:px-12 xl:px-20 py-24 bg-[#050508] border-t border-white/5 relative z-10 flex flex-col items-center">

        {/* Top footer row: Title and Link Columns */}
        <div className="w-full max-w-[1400px] flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
          <div className="text-xl md:text-2xl font-black tracking-tight text-white">
            Experience weightless coding.
          </div>

          <div className="flex gap-16 md:gap-28">
            <div className="flex flex-col gap-3.5">
              <span className="text-[10px] uppercase font-bold text-white/40 font-mono tracking-wider">Product</span>
              <a href="#explore" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Explore</a>
              <a href="#features" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Pricing</a>
            </div>

            <div className="flex flex-col gap-3.5">
              <span className="text-[10px] uppercase font-bold text-white/40 font-mono tracking-wider">Connect</span>
              <a href="#" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">GitHub</a>
              <a href="#" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Discord</a>
              <a href="#" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Support</a>
            </div>
          </div>
        </div>

        {/* Stark, fully visible, massive glowing premium branding signature text */}
        <div className="w-full select-none py-10 relative overflow-hidden">
          {/* Background glow behind text */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(204,255,0,0.05),transparent_60%)] pointer-events-none" />
          <h2 className="text-[13vw] font-black tracking-[-0.04em] text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/10 leading-[0.85] text-center select-none font-sans filter drop-shadow-[0_0_30px_rgba(255,255,255,0.08)]">
            Apple Juice
          </h2>
        </div>

        {/* Bottom footer metadata row */}
        <div className="w-full max-w-[1400px] border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#ccff00] flex items-center justify-center text-black text-[10px] font-black shadow-[0_0_10px_rgba(204,255,0,0.3)] font-mono">
              +
            </div>
            <span className="text-xs font-black tracking-wider text-white uppercase font-mono">
              Apple Juice
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-[11px] text-white/40 font-semibold">
            <a href="/tos" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <span className="text-[10px] text-white/30 font-medium">Not affiliated with Roblox Corporation.</span>
          </div>
        </div>
      </footer>

      {/* ━━━ OAUTH GUIDE DIALOG MODAL ━━━ */}
      {showAuthGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthGuide(false);
          }}
        >
          <div className="w-full max-w-2xl bg-[#08090c]/90 border border-white/10 rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200 backdrop-blur-2xl">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-transparent">
              <span className="font-bold text-xs tracking-widest uppercase text-white/40 font-mono">
                Secure Client Identification
              </span>
              <button
                onClick={() => setShowAuthGuide(false)}
                className="text-white/40 hover:text-white p-2 transition-colors rounded-full"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto max-h-[70vh]">
              <p className="text-white/60 text-sm leading-relaxed mb-8 font-medium">
                Entering Apple Juice opens an official Roblox or Google OAuth 2.0 authorization screen. Here is a secure overview of the scope parameters:
              </p>

              <div className="space-y-6">

                {/* Section 1 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="h-8 w-8 rounded-full bg-[#ccff00] text-black flex items-center justify-center font-black text-xs shadow-sm font-mono">
                      1
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Roblox Identity Verification
                    </h3>
                  </div>
                  <p className="text-xs text-white/60 mb-4 leading-relaxed font-medium">
                    Roblox shares only your public User ID and public username/avatar.
                  </p>
                  <ul className="text-xs text-white/70 space-y-2 list-disc pl-5 leading-relaxed font-medium">
                    <li>We utilize credentials only to coordinate active game projects.</li>
                    <li><span className="font-semibold text-white">We never receive passwords, emails, or recovery states.</span></li>
                    <li><span className="font-semibold text-white">We cannot view Robux balances, inventories, or transactions.</span></li>
                  </ul>
                </div>

                {/* Section 2 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="h-8 w-8 rounded-full bg-[#ccff00] text-black flex items-center justify-center font-black text-xs shadow-sm font-mono">
                      2
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      WebSocket pairing tokens
                    </h3>
                  </div>
                  <p className="text-xs text-white/60 mb-4 leading-relaxed font-medium">
                    Our Roblox Creator Store plugin pairs workspace structures safely.
                  </p>
                  <ul className="text-xs text-white/70 space-y-2 leading-relaxed font-medium list-disc pl-5">
                    <li><span className="font-semibold text-white">Writes Scripts:</span> Appends or syncs generated codes to open projects.</li>
                    <li><span className="font-semibold text-white">Workspace Outline:</span> Maps folders and local layouts so the model spots parent instances.</li>
                  </ul>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-white/5 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest font-mono text-center sm:text-left">
                Independent Roblox utility
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAuthGuide(false)}
                  className="px-6 py-2.5 rounded-full border border-white/10 text-white/60 hover:bg-white/5 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    signIn("google", { callbackUrl: "/dashboard" })
                  }
                  className="px-6 py-2.5 rounded-full bg-white/5 text-white border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </button>
                <button
                  onClick={() =>
                    signIn("roblox", { callbackUrl: "/dashboard" })
                  }
                  className="px-6 py-2.5 rounded-full bg-[#ccff00] text-black font-black hover:bg-[#d4ff33] text-xs uppercase tracking-wider transition-all shadow-sm"
                >
                  Roblox
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ScrollLine />
    </div>
  );
}
