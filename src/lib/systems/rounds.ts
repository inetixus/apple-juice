import type { SystemTemplate } from "./index";

export const ROUND_SYSTEM: SystemTemplate = {
  name: "Round-Based Matchmaking",
  category: "Gameloop",
  description: "State-driven game loop: Waiting → Intermission → Game → End → Restart. Map voting, teleportation, winner detection.",
  keywords: ["round", "match", "game loop", "intermission", "voting", "map", "timer", "countdown", "start", "winner", "lobby"],
  serverCode: `--[[
  Round-Based Matchmaking — Server ModuleScript
  Place in: ServerScriptService.Systems.RoundSystem
  README: Config.Maps defines available maps (model names in ServerStorage.Maps).
          Config.RoundDuration sets game length. Config.IntermissionTime sets lobby wait.
          The system fires state changes via RemoteEvent so clients can update UI.
]]
local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RoundSystem = {}
RoundSystem.__index = RoundSystem

local Config = {
  Maps = { "Grasslands", "Desert", "Snowfield", "Volcano" },
  MinPlayers = 2,
  IntermissionTime = 15,
  VotingTime = 10,
  RoundDuration = 120,
  EndScreenTime = 8,
  SpawnHeight = 5,
}

local State = { phase = "Waiting", timeLeft = 0, currentMap = nil, votes = {} }

function RoundSystem.new()
  local self = setmetatable({}, RoundSystem)
  self._stateRemote = Instance.new("RemoteEvent")
  self._stateRemote.Name = "RoundState"
  self._stateRemote.Parent = ReplicatedStorage
  self._voteRemote = Instance.new("RemoteEvent")
  self._voteRemote.Name = "RoundVote"
  self._voteRemote.Parent = ReplicatedStorage
  return self
end

function RoundSystem:BroadcastState()
  self._stateRemote:FireAllClients(State)
end

function RoundSystem:SetPhase(phase, duration)
  State.phase = phase
  State.timeLeft = duration or 0
  self:BroadcastState()
end

function RoundSystem:Countdown(seconds)
  for i = seconds, 0, -1 do
    State.timeLeft = i
    self:BroadcastState()
    if i > 0 then task.wait(1) end
  end
end

function RoundSystem:StartVoting()
  -- Pick 3 random maps for voting
  local pool = table.clone(Config.Maps)
  local choices = {}
  for i = 1, math.min(3, #pool) do
    local idx = math.random(#pool)
    table.insert(choices, table.remove(pool, idx))
  end
  State.votes = {}
  for _, m in ipairs(choices) do State.votes[m] = 0 end
  self:SetPhase("Voting", Config.VotingTime)

  local voted = {}
  local conn = self._voteRemote.OnServerEvent:Connect(function(player, mapName)
    if voted[player] or not State.votes[mapName] then return end
    voted[player] = true
    State.votes[mapName] += 1
    self:BroadcastState()
  end)

  self:Countdown(Config.VotingTime)
  conn:Disconnect()

  -- Tally votes
  local best, bestCount = choices[1], 0
  for name, count in pairs(State.votes) do
    if count > bestCount then best = name; bestCount = count end
  end
  return best
end

function RoundSystem:LoadMap(mapName)
  -- Cleanup previous
  local existing = workspace:FindFirstChild("ActiveMap")
  if existing then existing:Destroy() end

  local template = ServerStorage:FindFirstChild("Maps") and ServerStorage.Maps:FindFirstChild(mapName)
  if template then
    local clone = template:Clone()
    clone.Name = "ActiveMap"
    clone.Parent = workspace
  end
  State.currentMap = mapName
end

function RoundSystem:TeleportPlayers(toLobby)
  for _, player in ipairs(Players:GetPlayers()) do
    local char = player.Character
    if char and char:FindFirstChild("HumanoidRootPart") then
      if toLobby then
        char.HumanoidRootPart.CFrame = CFrame.new(0, Config.SpawnHeight, 0)
      else
        local offset = Vector3.new(math.random(-20, 20), Config.SpawnHeight, math.random(-20, 20))
        char.HumanoidRootPart.CFrame = CFrame.new(offset)
      end
    end
  end
end

function RoundSystem:DetectWinner()
  local alive = {}
  for _, p in ipairs(Players:GetPlayers()) do
    local char = p.Character
    local hum = char and char:FindFirstChildOfClass("Humanoid")
    if hum and hum.Health > 0 then table.insert(alive, p) end
  end
  if #alive <= 1 then return alive[1] end
  return nil
end

function RoundSystem:GameLoop()
  while true do
    -- Wait for minimum players
    self:SetPhase("Waiting", 0)
    while #Players:GetPlayers() < Config.MinPlayers do task.wait(1) end

    -- Intermission
    self:SetPhase("Intermission", Config.IntermissionTime)
    self:Countdown(Config.IntermissionTime)

    -- Voting
    local chosenMap = self:StartVoting()

    -- Load map and start round
    self:LoadMap(chosenMap)
    self:TeleportPlayers(false)
    self:SetPhase("Playing", Config.RoundDuration)
    self:Countdown(Config.RoundDuration)

    -- End round
    local winner = self:DetectWinner()
    State.winner = winner and winner.Name or "Nobody"
    self:SetPhase("Ended", Config.EndScreenTime)
    self:Countdown(Config.EndScreenTime)

    -- Cleanup
    self:TeleportPlayers(true)
    local map = workspace:FindFirstChild("ActiveMap")
    if map then map:Destroy() end
    State.winner = nil
  end
end

function RoundSystem:Init()
  task.spawn(function() self:GameLoop() end)
end

return RoundSystem`,
  clientCode: `--[[ Round Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local screen = UI.createScreenGui("RoundHUD")
local stateRemote = ReplicatedStorage:WaitForChild("RoundState")
local voteRemote = ReplicatedStorage:WaitForChild("RoundVote")

local statusLabel = UI.Text(screen, {
  Text = "Waiting for players...",
  Bold = true, TextSize = 22,
  Size = UDim2.new(0, 400, 0, 50),
  Position = UDim2.new(0.5, -200, 0, 20),
})

local timerLabel = UI.Text(screen, {
  Text = "", TextSize = 48, Bold = true,
  Size = UDim2.new(0, 200, 0, 60),
  Position = UDim2.new(0.5, -100, 0, 70),
})

stateRemote.OnClientEvent:Connect(function(state)
  timerLabel.Text = tostring(state.timeLeft or "")
  if state.phase == "Waiting" then
    statusLabel.Text = "Waiting for players..."
  elseif state.phase == "Intermission" then
    statusLabel.Text = "Intermission"
  elseif state.phase == "Voting" then
    statusLabel.Text = "Vote for a map!"
  elseif state.phase == "Playing" then
    statusLabel.Text = "Round in progress — " .. (state.currentMap or "")
  elseif state.phase == "Ended" then
    statusLabel.Text = "Winner: " .. (state.winner or "Nobody")
  end
end)`,
};
