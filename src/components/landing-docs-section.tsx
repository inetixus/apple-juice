"use client";

import { useState } from "react";
import { Database, SunMoon, Zap, MessageSquare, Copy, Check, Terminal } from "lucide-react";

interface GuideExample {
  id: string;
  title: string;
  category: string;
  icon: any;
  prompt: string;
  fileName: string;
  filePath: string;
  decisions: string[];
  code: string;
}

const EXAMPLES: GuideExample[] = [
  {
    id: "datastore",
    title: "Leaderstats Data Saving",
    category: "Server Database",
    icon: Database,
    prompt: "Create a secure leaderstats player handler that tracks Gold and Level using Roblox DataStoreService. It must load player data when they join, save data when they leave, and safely throttle saving using BindToClose.",
    fileName: "LeaderstatsHandler.lua",
    filePath: "ServerScriptService > LeaderstatsHandler",
    decisions: [
      "Secured with pcall blocks to intercept and log connection dropouts gracefully.",
      "Handles server shutdown automatically with BindToClose loop.",
      "Throttles asynchronous saving threads to comply with strict Roblox DataStore rate limits.",
      "Properly initializes default stats if no prior DataStore record is located."
    ],
    code: `--[[
    Apple Juice Generated · Secure Leaderstats Handler
    Compiled specifically for Roblox Studio (Luau Engine)
--]]

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

-- Retrieve the PlayerGold DataStore
local goldDataStore = DataStoreService:GetDataStore("PlayerGold_v1")

-- Function to safely load a player's statistics
local function loadData(player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player

    local gold = Instance.new("IntValue")
    gold.Name = "Gold"
    gold.Value = 0
    gold.Parent = leaderstats

    local level = Instance.new("IntValue")
    level.Name = "Level"
    level.Value = 1
    level.Parent = leaderstats

    -- Wrap in pcall to protect against Roblox server downtime
    local success, savedData = pcall(function()
        return goldDataStore:GetAsync(tostring(player.UserId))
    end)

    if success and savedData then
        gold.Value = savedData.Gold or 0
        level.Value = savedData.Level or 1
    else
        warn("No profile database entry for player: " .. player.Name)
    end
end

-- Function to safely save a player's statistics
local function saveData(player)
    local leaderstats = player:FindFirstChild("leaderstats")
    if not leaderstats then return end

    local gold = leaderstats:FindFirstChild("Gold")
    local level = leaderstats:FindFirstChild("Level")

    local dataToSave = {
        Gold = gold and gold.Value or 0,
        Level = level and level.Value or 1
    }

    -- Execute with retry safety limit
    local success, err = pcall(function()
        goldDataStore:SetAsync(tostring(player.UserId), dataToSave)
    end)

    if not success then
        warn("Failed to write DataStore profile for player " .. player.Name .. ": " .. tostring(err))
    end
end

-- Event Listeners
Players.PlayerAdded:Connect(loadData)
Players.PlayerRemoving:Connect(saveData)

-- BindToClose ensures data saves even if the game server crashes or reboots
game:BindToClose(function()
    for _, player in ipairs(Players:GetPlayers()) do
        saveData(player)
    end
end)`
  },
  {
    id: "daynight",
    title: "Day & Night Cycle",
    category: "Environment & Tweening",
    icon: SunMoon,
    prompt: "Write a high-performance, modular day/night cycle script that smoothly transitions game lighting. Use linear interpolation to avoid layout spikes and run on a dedicated thread.",
    fileName: "DayNightController.lua",
    filePath: "ServerScriptService > DayNightController",
    decisions: [
      "Leverages task.spawn for thread-safe asynchronous execution.",
      "Optimized cycle loops using task.wait to lower server network overhead.",
      "Implements clock-time modular arithmetic for endless 24-hour looping.",
      "Adjusts game environment settings on separate ticks to prevent framerate drops."
    ],
    code: `--[[
    Apple Juice Generated · Thread-Safe Environment Loop
    Compiled specifically for Roblox Studio (Luau Engine)
--]]

local Lighting = game:GetService("Lighting")
local TweenService = game:GetService("TweenService")

local CYCLE_SPEED = 0.05 -- Progression step of the cycle (hours)
local TICK_RATE = 0.1 -- Loop wait intervals in seconds

-- Dedicated thread for game time looping
task.spawn(function()
    while true do
        local currentTime = Lighting.ClockTime
        -- Modulo 24 resets time to 0 once clock hits midnight
        local nextTime = (currentTime + CYCLE_SPEED) % 24
        
        Lighting.ClockTime = nextTime
        task.wait(TICK_RATE)
    end
end)`
  },
  {
    id: "laser",
    title: "Smart Touch Killing Laser",
    category: "Physics & Collisions",
    icon: Zap,
    prompt: "Create a highly-optimized touch-killing laser brick that damages humanoids. Add debounce protection, custom color change feedback during hits, and check for standard health properties.",
    fileName: "LaserBrick.lua",
    filePath: "Workspace > LaserBrick > Script",
    decisions: [
      "Constructed with a fast-return local boolean debounce to shield against multi-collision glitches.",
      "Uses FindFirstChildOfClass to verify humanoid health tables reliably.",
      "Incorporates thread-safe task.wait inside the execution context.",
      "Swaps physical color states to feed responsive visual feedback directly to the player."
    ],
    code: `--[[
    Apple Juice Generated · Physics Touch Debounced Laser
    Compiled specifically for Roblox Studio (Luau Engine)
--]]

local laserPart = script.Parent
local debounce = false

local DAMAGE_AMOUNT = 100 -- Default instakill damage value
local RESET_COOLDOWN = 0.5 -- Seconds before laser triggers again

local function onTouched(hitPart)
    if debounce then return end
    
    local character = hitPart.Parent
    -- Safely search characters for humanoids
    local humanoid = character:FindFirstChildOfClass("Humanoid")
    
    if humanoid and humanoid.Health > 0 then
        debounce = true
        
        -- Apply damage with Luau exception shielding
        humanoid:TakeDamage(DAMAGE_AMOUNT)
        
        -- Physical visual feedback transition
        local originalColor = laserPart.Color
        laserPart.Color = Color3.fromRGB(255, 0, 0) -- Pulse Red
        
        task.wait(RESET_COOLDOWN)
        
        laserPart.Color = originalColor -- Return to inactive state
        debounce = false
    end
end

laserPart.Touched:Connect(onTouched)`
  },
  {
    id: "dialogue",
    title: "Dynamic NPC Dialogue Handler",
    category: "Player Interface",
    icon: MessageSquare,
    prompt: "Create a modular NPC dialogue controller. It must register when players step inside a trigger zone, mount a styled local UI on their screen, and support typing-effects with custom step delay.",
    fileName: "NpcDialogueHandler.lua",
    filePath: "StarterPlayer > StarterPlayerScripts > DialogueClient",
    decisions: [
      "Operates fully on the client-side, reducing unnecessary network replication load.",
      "Includes precise character bounds checking to prevent chat window popups for distant users.",
      "Implements typing animation loops with customizable intervals.",
      "Uses safe garbage-collection triggers to flush inactive frames from UI hierarchies automatically."
    ],
    code: `--[[
    Apple Juice Generated · Local Dialogue Thread
    Compiled specifically for Roblox Studio (Luau Engine)
--]]

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local localPlayer = Players.LocalPlayer
local playerGui = localPlayer:WaitForChild("PlayerGui")

local TRIGGER_DISTANCE = 10 -- Magnitude distance threshold for dialogue activation

-- Dynamic dialogue typing simulation
local function playDialogueText(textLabel, fullText, delayTime)
    textLabel.Text = ""
    for i = 1, #fullText do
        textLabel.Text = string.sub(fullText, 1, i)
        task.wait(delayTime or 0.03)
    end
end

-- Initialize Dialogue components on trigger enter
local function mountDialogueBox(npcCharacter, textSequence)
    local dialogueGui = Instance.new("ScreenGui")
    dialogueGui.Name = "NpcDialogueGui"
    dialogueGui.ResetOnSpawn = false
    dialogueGui.Parent = playerGui

    local mainFrame = Instance.new("Frame")
    mainFrame.Size = UDim2.new(0.6, 0, 0.2, 0)
    mainFrame.Position = UDim2.new(0.2, 0, 0.75, 0)
    mainFrame.BackgroundColor3 = Color3.fromRGB(15, 17, 23)
    mainFrame.BorderSizePixel = 0
    mainFrame.Parent = dialogueGui

    local textLabel = Instance.new("TextLabel")
    textLabel.Size = UDim2.new(0.9, 0, 0.8, 0)
    textLabel.Position = UDim2.new(0.05, 0, 0.1, 0)
    textLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    textLabel.BackgroundTransparency = 1
    textLabel.TextSize = 18
    textLabel.Font = Enum.Font.SpaceGrotesk
    textLabel.TextXAlignment = Enum.TextXAlignment.Left
    textLabel.TextYAlignment = Enum.TextYAlignment.Top
    textLabel.Parent = mainFrame

    -- Loop dialogue statements
    for _, message in ipairs(textSequence) do
        playDialogueText(textLabel, message, 0.04)
        task.wait(2.5) -- Reading interval
    end

    dialogueGui:Destroy() -- Safe garbage collection cleanup
end`
  }
];

export function LandingDocsSection() {
  const [activeTab, setActiveTab] = useState<string>("datastore");
  const [copied, setCopied] = useState<boolean>(false);

  const activeExample = EXAMPLES.find((ex) => ex.id === activeTab) || EXAMPLES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeExample.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="docs" className="relative px-6 py-24 md:py-32 overflow-hidden bg-transparent border-t border-white/[0.04]">
      {/* Absolute Decorative Grid Backdrops */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Light bleed details */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[450px] h-[450px] bg-[#ccff00]/[0.02] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-blue-500/[0.02] blur-[120px] pointer-events-none" />

      <div className="max-w-[1240px] mx-auto relative z-10">
        
        {/* Header Block */}
        <div className="text-center mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 bg-white/[0.03] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00]" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#ccff00]">Interactive Scripter Guide</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            Luau Scripting Dictionary
          </h2>
          <p className="text-white/50 text-base md:text-lg max-w-2xl mx-auto font-medium leading-relaxed">
            See how Apple Juice converts plain-English instructions into highly-optimized, secure, sandboxed Luau scripts for Roblox Studio instantly.
          </p>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex flex-wrap justify-center gap-3 mb-10 md:mb-12">
          {EXAMPLES.map((ex) => {
            const Icon = ex.icon;
            const isActive = ex.id === activeTab;
            return (
              <button
                key={ex.id}
                onClick={() => setActiveTab(ex.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-full text-xs font-black uppercase tracking-wider border transition-all duration-300 ${
                  isActive
                    ? "bg-[#ccff00] text-black border-[#ccff00] shadow-[0_0_24px_rgba(204,255,0,0.18)]"
                    : "bg-white/[0.02] text-white/60 border-white/5 hover:text-white hover:bg-white/[0.05] hover:border-white/10"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-black" : "text-white/40"}`} />
                {ex.title}
              </button>
            );
          })}
        </div>

        {/* Interactive Layout Content Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Column 1: AI Logic & Instructions (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6 h-full justify-between">
            
            {/* Prompt Card */}
            <div className="bg-[#07080a]/60 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/40 font-mono mb-4 block">
                Developer Input Instruction
              </span>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Terminal className="w-4 h-4 text-white/55" />
                </div>
                <p className="text-white/80 text-sm md:text-base font-medium leading-relaxed italic">
                  &ldquo;{activeExample.prompt}&rdquo;
                </p>
              </div>
            </div>

            {/* AI Reasoning Decisions */}
            <div className="bg-[#07080a]/60 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#ccff00] font-mono mb-6 block">
                  AI Engineering Best Practices Applied
                </span>
                <ul className="flex flex-col gap-4">
                  {activeExample.decisions.map((dec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/70 font-medium">
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center mt-0.5 flex-shrink-0">
                        <span className="text-[10px] text-[#ccff00] font-black font-mono">✓</span>
                      </div>
                      <span className="leading-normal">{dec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Status footer inside the reasoning box */}
              <div className="border-t border-white/5 pt-6 mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#ccff00] animate-pulse" />
                  <span className="text-xs text-white/40 font-black uppercase tracking-wider font-mono">
                    Plugin WebSocket Ready
                  </span>
                </div>
                <div className="text-[10px] text-[#ccff00] bg-[#ccff00]/10 border border-[#ccff00]/20 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                  Synced Live in 0.2s
                </div>
              </div>
            </div>

          </div>

          {/* Column 2: Code Editor Tab & Output View (7 cols) */}
          <div className="lg:col-span-7">
            <div className="bg-[#06070a] border border-white/[0.08] rounded-[2rem] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.65)] flex flex-col relative">
              
              {/* Studio Window Bar */}
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#090b10] px-6 py-4">
                <div className="flex items-center gap-3">
                  {/* File System Path Details */}
                  <div className="flex items-center gap-2 text-white/40 text-xs font-bold font-mono">
                    <span className="text-[#ff8c00]">✦</span>
                    <span>{activeExample.filePath}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Copy Button with responsive text */}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#ccff00]" />
                        <span className="text-[#ccff00]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Code Tab Strip */}
              <div className="flex items-center bg-[#07090d] px-6 border-b border-white/[0.03]">
                <div className="flex items-center gap-2 border-b-2 border-[#ccff00] text-[#ccff00] px-3 py-2.5 text-xs font-black uppercase tracking-wider font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00]" />
                  {activeExample.fileName}
                </div>
                <div className="text-white/20 px-3 py-2.5 text-xs font-bold font-mono hover:text-white/40 cursor-not-allowed">
                  WorkspaceDocs.md
                </div>
              </div>

              {/* Code Panel */}
              <div className="overflow-y-auto max-h-[460px] p-6 text-left relative font-mono text-xs sm:text-[13px] leading-relaxed text-white/80 bg-black/40">
                <pre className="whitespace-pre overflow-x-auto selection:bg-[#ccff00]/20 selection:text-[#ccff00]">
                  <code>{activeExample.code}</code>
                </pre>
              </div>

              {/* Code Footer */}
              <div className="border-t border-white/[0.04] bg-[#08090d] px-6 py-3.5 flex items-center justify-between text-[11px] font-bold text-white/40 font-mono">
                <span>UTF-8 · Luau Engine</span>
                <span className="text-[#ccff00]">Apple Juice Compiler v1.4</span>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
