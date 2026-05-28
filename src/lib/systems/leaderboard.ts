import type { SystemTemplate } from "./index";

export const LEADERBOARD_SYSTEM: SystemTemplate = {
  name: "Leaderboard & Global Events",
  category: "Social",
  description: "Real-time leaderboards with OrderedDataStore, live event triggers, and global announcements.",
  keywords: ["leaderboard", "rank", "top", "score", "leader", "global", "event", "announcement", "live"],
  serverCode: `--[[
  Leaderboard & Events — Server ModuleScript
  Place in: ServerScriptService.Systems.LeaderboardSystem
  README: Config.Boards defines stat boards (Kills, Gold, etc.). Auto-updates every RefreshInterval.
          Config.GlobalEvents defines timed events with multipliers and announcements.
]]
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LeaderboardSystem = {}
LeaderboardSystem.__index = LeaderboardSystem

local Config = {
  Boards = {
    { Name = "Top Kills", Stat = "Kills", MaxEntries = 50 },
    { Name = "Richest Players", Stat = "Gold", MaxEntries = 50 },
    { Name = "Highest Level", Stat = "Level", MaxEntries = 50 },
  },
  RefreshInterval = 30,
  GlobalEvents = {
    DoubleXP  = { Duration = 3600, Multiplier = 2.0, Message = "DOUBLE XP is now ACTIVE!" },
    GoldRush  = { Duration = 1800, Multiplier = 3.0, Message = "GOLD RUSH! 3x Gold for 30 minutes!" },
    BossRaid  = { Duration = 600, Multiplier = 1.0, Message = "A BOSS has appeared in the arena!" },
  },
}

local cachedBoards = {}
local activeEvents = {}

function LeaderboardSystem.new()
  return setmetatable({}, LeaderboardSystem)
end

function LeaderboardSystem:UpdateStat(player, stat, value)
  local store = DataStoreService:GetOrderedDataStore("Leaderboard_" .. stat)
  pcall(function() store:SetAsync("player_" .. player.UserId, value) end)
  -- Update leaderstats
  local ls = player:FindFirstChild("leaderstats")
  if ls then
    local sv = ls:FindFirstChild(stat)
    if sv then sv.Value = value end
  end
end

function LeaderboardSystem:FetchBoard(stat, maxEntries)
  local store = DataStoreService:GetOrderedDataStore("Leaderboard_" .. stat)
  local success, pages = pcall(function()
    return store:GetSortedAsync(false, maxEntries)
  end)
  if not success then return {} end
  local entries = {}
  local page = pages:GetCurrentPage()
  for rank, entry in ipairs(page) do
    table.insert(entries, {
      rank = rank,
      userId = tonumber(entry.key:gsub("player_", "")),
      value = entry.value,
    })
  end
  return entries
end

function LeaderboardSystem:TriggerGlobalEvent(eventName)
  local ev = Config.GlobalEvents[eventName]
  if not ev or activeEvents[eventName] then return false end
  activeEvents[eventName] = true
  local remote = ReplicatedStorage:FindFirstChild("GlobalEventNotify")
  if remote then remote:FireAllClients("start", eventName, ev) end
  task.delay(ev.Duration, function()
    activeEvents[eventName] = nil
    if remote then remote:FireAllClients("end", eventName) end
  end)
  return true
end

function LeaderboardSystem:GetActiveMultiplier(stat)
  local mult = 1.0
  for name, _ in pairs(activeEvents) do
    local ev = Config.GlobalEvents[name]
    if ev then mult *= ev.Multiplier end
  end
  return mult
end

function LeaderboardSystem:SetupLeaderstats(player)
  local ls = Instance.new("Folder")
  ls.Name = "leaderstats"
  ls.Parent = player
  for _, board in ipairs(Config.Boards) do
    local val = Instance.new("IntValue")
    val.Name = board.Stat
    val.Value = 0
    val.Parent = ls
  end
end

function LeaderboardSystem:Init()
  local remote = Instance.new("RemoteEvent")
  remote.Name = "GlobalEventNotify"
  remote.Parent = ReplicatedStorage
  local boardRemote = Instance.new("RemoteFunction")
  boardRemote.Name = "GetLeaderboard"
  boardRemote.Parent = ReplicatedStorage
  boardRemote.OnServerInvoke = function(_, stat)
    return cachedBoards[stat] or {}
  end
  Players.PlayerAdded:Connect(function(p) self:SetupLeaderstats(p) end)
  -- Periodic board refresh
  task.spawn(function()
    while true do
      for _, board in ipairs(Config.Boards) do
        cachedBoards[board.Stat] = self:FetchBoard(board.Stat, board.MaxEntries)
      end
      task.wait(Config.RefreshInterval)
    end
  end)
end

return LeaderboardSystem`,
  clientCode: `--[[ Leaderboard Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local boardRemote = ReplicatedStorage:WaitForChild("GetLeaderboard")
local eventRemote = ReplicatedStorage:WaitForChild("GlobalEventNotify")
local screen = UI.createScreenGui("LeaderboardGui")

local panel = UI.Card(screen, {
  Size = UDim2.new(0, 350, 0, 450),
  Position = UDim2.new(0.5, -175, 0.5, -225),
})
panel.Visible = false

UI.Text(panel, {
  Text = "🏆 Leaderboard", Bold = true, TextSize = 22,
  Size = UDim2.new(1, 0, 0, 40), Position = UDim2.new(0, 0, 0, 5),
  Align = Enum.TextXAlignment.Center,
})

UI.Button(panel, {
  Text = "✕", Style = "Danger",
  Size = UDim2.new(0, 30, 0, 30), Position = UDim2.new(1, -38, 0, 8),
  OnClick = function() panel.Visible = false end,
})

local scroll = Instance.new("ScrollingFrame")
scroll.Size = UDim2.new(0.9, 0, 0, 370)
scroll.Position = UDim2.new(0.05, 0, 0, 50)
scroll.BackgroundTransparency = 1
scroll.ScrollBarThickness = 3
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
scroll.Parent = panel

local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 4)
layout.Parent = scroll

local function loadBoard(stat)
  for _, c in ipairs(scroll:GetChildren()) do if c:IsA("Frame") then c:Destroy() end end
  local entries = boardRemote:InvokeServer(stat)
  if not entries then return end
  for _, entry in ipairs(entries) do
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 32)
    row.BackgroundColor3 = entry.rank <= 3 and Color3.fromRGB(255, 200, 50) or Color3.fromRGB(40, 40, 50)
    row.BackgroundTransparency = entry.rank <= 3 and 0.7 or 0.5
    row.Parent = scroll
    Instance.new("UICorner", row).CornerRadius = UDim.new(0, 6)
    local rankLabel = Instance.new("TextLabel")
    rankLabel.Text = "#" .. entry.rank
    rankLabel.Size = UDim2.new(0, 40, 1, 0)
    rankLabel.BackgroundTransparency = 1
    rankLabel.TextColor3 = Color3.new(1, 1, 1)
    rankLabel.Font = Enum.Font.GothamBold
    rankLabel.TextSize = 14
    rankLabel.Parent = row
    local nameLabel = Instance.new("TextLabel")
    nameLabel.Text = "Player " .. entry.userId
    nameLabel.Size = UDim2.new(0.5, 0, 1, 0)
    nameLabel.Position = UDim2.new(0, 45, 0, 0)
    nameLabel.BackgroundTransparency = 1
    nameLabel.TextColor3 = Color3.new(1, 1, 1)
    nameLabel.Font = Enum.Font.Gotham
    nameLabel.TextSize = 13
    nameLabel.TextXAlignment = Enum.TextXAlignment.Left
    nameLabel.Parent = row
    local valLabel = Instance.new("TextLabel")
    valLabel.Text = tostring(entry.value)
    valLabel.Size = UDim2.new(0.3, 0, 1, 0)
    valLabel.Position = UDim2.new(0.7, 0, 0, 0)
    valLabel.BackgroundTransparency = 1
    valLabel.TextColor3 = Color3.fromRGB(200, 255, 100)
    valLabel.Font = Enum.Font.GothamBold
    valLabel.TextSize = 14
    valLabel.Parent = row
    -- Try to get real username
    task.spawn(function()
      local ok, name = pcall(function() return Players:GetNameFromUserIdAsync(entry.userId) end)
      if ok then nameLabel.Text = name end
    end)
  end
end

-- Global event banner
eventRemote.OnClientEvent:Connect(function(action, eventName, eventData)
  if action == "start" and eventData then
    UI.Toast(screen, { Text = eventData.Message, Type = "success" })
  end
end)

UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.L then
    panel.Visible = not panel.Visible
    if panel.Visible then loadBoard("Kills") end
  end
end)`,
};
