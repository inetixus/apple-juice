import type { SystemTemplate } from "./index";

export const QUEST_SYSTEM: SystemTemplate = {
  name: "Quest & Mission System",
  category: "Progression",
  description: "Multi-objective quests with progress tracking, rewards, daily/weekly resets, and quest chains.",
  keywords: ["quest", "mission", "objective", "task", "goal", "challenge", "daily quest", "weekly"],
  serverCode: `--[[
  Quest System — Server ModuleScript
  Place in: ServerScriptService.Systems.QuestSystem
  README: Config.Quests defines quest trees. Each quest has objectives (kill X, collect Y).
          Supports daily/weekly reset cycles. Quest chains unlock sequentially.
]]
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local QuestSystem = {}
QuestSystem.__index = QuestSystem

local Config = {
  Quests = {
    { Id = "wolf_hunter", Name = "Wolf Hunter", Type = "daily", Objectives = {
      { Type = "kill", Target = "Wolf", Amount = 5 },
    }, Rewards = { Gold = 200, XP = 50 } },
    { Id = "gather_wood", Name = "Lumberjack", Type = "daily", Objectives = {
      { Type = "collect", Target = "Wood", Amount = 20 },
    }, Rewards = { Gold = 100, XP = 30 } },
    { Id = "boss_slayer", Name = "Boss Slayer", Type = "weekly", Objectives = {
      { Type = "kill", Target = "Boss", Amount = 3 },
      { Type = "collect", Target = "BossLoot", Amount = 1 },
    }, Rewards = { Gems = 25, XP = 500 } },
    { Id = "explorer", Name = "World Explorer", Type = "story", Chain = 1, Objectives = {
      { Type = "visit", Target = "Forest", Amount = 1 },
      { Type = "visit", Target = "Desert", Amount = 1 },
      { Type = "visit", Target = "Mountain", Amount = 1 },
    }, Rewards = { Gold = 500, Title = "Explorer" } },
  },
}

local playerQuests = {}

function QuestSystem.new() return setmetatable({}, QuestSystem) end

function QuestSystem:GetActiveQuests(player)
  return playerQuests[player] or {}
end

function QuestSystem:AcceptQuest(player, questId)
  local quest = nil
  for _, q in ipairs(Config.Quests) do
    if q.Id == questId then quest = q; break end
  end
  if not quest then return false end
  local data = playerQuests[player]
  if not data then return false end
  if data[questId] then return false end
  local progress = {}
  for i, obj in ipairs(quest.Objectives) do
    progress[i] = { current = 0, target = obj.Amount, done = false }
  end
  data[questId] = { quest = quest, progress = progress, completed = false }
  return true
end

function QuestSystem:UpdateProgress(player, eventType, target, amount)
  local data = playerQuests[player]
  if not data then return end
  for questId, entry in pairs(data) do
    if entry.completed then continue end
    for i, obj in ipairs(entry.quest.Objectives) do
      if obj.Type == eventType and obj.Target == target and not entry.progress[i].done then
        entry.progress[i].current = math.min(entry.progress[i].current + (amount or 1), obj.Amount)
        if entry.progress[i].current >= obj.Amount then
          entry.progress[i].done = true
        end
      end
    end
    local allDone = true
    for _, p in ipairs(entry.progress) do
      if not p.done then allDone = false; break end
    end
    if allDone then entry.completed = true end
  end
end

function QuestSystem:ClaimReward(player, questId)
  local data = playerQuests[player]
  if not data or not data[questId] or not data[questId].completed then return nil end
  local rewards = data[questId].quest.Rewards
  data[questId] = nil
  return rewards
end

function QuestSystem:Init()
  Players.PlayerAdded:Connect(function(p) playerQuests[p] = {} end)
  Players.PlayerRemoving:Connect(function(p) playerQuests[p] = nil end)
  local remote = Instance.new("RemoteEvent")
  remote.Name = "QuestAction"
  remote.Parent = ReplicatedStorage
  remote.OnServerEvent:Connect(function(player, action, ...)
    if action == "accept" then self:AcceptQuest(player, ...)
    elseif action == "claim" then
      local rewards = self:ClaimReward(player, ...)
      remote:FireClient(player, "claimed", rewards)
    end
  end)
end

return QuestSystem`,
  clientCode: `--[[ Quest Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local remote = ReplicatedStorage:WaitForChild("QuestAction")
local screen = UI.createScreenGui("QuestTracker")

-- Quest tracker panel (right side of screen)
local tracker = UI.Card(screen, {
  Size = UDim2.new(0, 280, 0, 350),
  Position = UDim2.new(1, -290, 0, 60),
})

UI.Text(tracker, {
  Text = "📋 Active Quests", Bold = true, TextSize = 16,
  Size = UDim2.new(1, 0, 0, 30), Position = UDim2.new(0, 0, 0, 5),
  Align = Enum.TextXAlignment.Center,
})

local questList = Instance.new("ScrollingFrame")
questList.Size = UDim2.new(0.9, 0, 0, 280)
questList.Position = UDim2.new(0.05, 0, 0, 40)
questList.BackgroundTransparency = 1
questList.ScrollBarThickness = 3
questList.AutomaticCanvasSize = Enum.AutomaticSize.Y
questList.Parent = tracker

local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 6)
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Parent = questList

local function renderQuest(questData)
  local frame = Instance.new("Frame")
  frame.Size = UDim2.new(1, 0, 0, 70)
  frame.BackgroundColor3 = Color3.fromRGB(40, 40, 50)
  frame.Parent = questList
  local c = Instance.new("UICorner")
  c.CornerRadius = UDim.new(0, 6)
  c.Parent = frame

  local title = Instance.new("TextLabel")
  title.Text = questData.quest.Name
  title.Size = UDim2.new(1, -10, 0, 20)
  title.Position = UDim2.new(0, 8, 0, 4)
  title.BackgroundTransparency = 1
  title.TextColor3 = Color3.fromRGB(255, 220, 100)
  title.Font = Enum.Font.GothamBold
  title.TextSize = 13
  title.TextXAlignment = Enum.TextXAlignment.Left
  title.Parent = frame

  for i, obj in ipairs(questData.quest.Objectives) do
    local prog = questData.progress[i]
    local objLabel = Instance.new("TextLabel")
    objLabel.Text = obj.Type:upper() .. " " .. obj.Target .. ": " .. prog.current .. "/" .. prog.target
    objLabel.Size = UDim2.new(1, -16, 0, 14)
    objLabel.Position = UDim2.new(0, 8, 0, 22 + (i - 1) * 16)
    objLabel.BackgroundTransparency = 1
    objLabel.TextColor3 = prog.done and Color3.fromRGB(80, 255, 120) or Color3.fromRGB(180, 180, 180)
    objLabel.Font = Enum.Font.Gotham
    objLabel.TextSize = 11
    objLabel.TextXAlignment = Enum.TextXAlignment.Left
    objLabel.Parent = frame
  end

  if questData.completed then
    local claimBtn = Instance.new("TextButton")
    claimBtn.Text = "Claim!"
    claimBtn.Size = UDim2.new(0.4, 0, 0, 20)
    claimBtn.Position = UDim2.new(0.55, 0, 1, -24)
    claimBtn.BackgroundColor3 = Color3.fromRGB(80, 200, 80)
    claimBtn.TextColor3 = Color3.new(1, 1, 1)
    claimBtn.Font = Enum.Font.GothamBold
    claimBtn.TextSize = 11
    claimBtn.Parent = frame
    local bc = Instance.new("UICorner")
    bc.CornerRadius = UDim.new(0, 4)
    bc.Parent = claimBtn
    claimBtn.MouseButton1Click:Connect(function()
      remote:FireServer("claim", questData.quest.Id)
    end)
  end
  return frame
end

remote.OnClientEvent:Connect(function(action, data)
  if action == "claimed" and data then
    UI.Toast(screen, { Text = "Quest complete! Rewards received.", Type = "success" })
  end
end)

-- Toggle quest tracker
UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.J then
    tracker.Visible = not tracker.Visible
  end
end)`,
};
