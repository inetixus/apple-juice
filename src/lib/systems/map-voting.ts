import type { SystemTemplate } from "./index";

export const MAP_VOTING_SYSTEM: SystemTemplate = {
  name: "Map Voting System",
  category: "Gameloop",
  description: "Complete map voting system with animated UI, thumbnail previews, vote tracking, tiebreakers, and automatic map loading. Supports configurable vote duration, random map pool selection, and per-player single-vote enforcement.",
  keywords: ["vote", "voting", "map vote", "map voting", "map selection", "map pick", "choose map", "select map", "map pool", "ballot", "poll"],
  serverCode: `--[[
  Map Voting System — Server Script
  Place in: ServerScriptService.Systems.MapVotingSystem
  README: Config.MapPool defines all available maps (model names in ServerStorage.Maps).
          Each map entry has a Name, ImageId (for thumbnail preview), and optional Description.
          Config.ChoicesPerRound controls how many maps appear per vote (default 3).
          Config.VoteDuration sets voting time in seconds.
          The system picks random maps from the pool each round, tracks votes per player,
          prevents double-voting, handles tiebreakers, and fires the winning map to clients.
          
  INTEGRATION:
    local MapVoting = require(ServerScriptService.Systems.MapVotingSystem)
    local system = MapVoting.new()
    system:Init()
    
    -- When you want to start a vote:
    local winningMap = system:RunVote()
    -- winningMap = { Name = "Desert Arena", ImageId = "rbxassetid://123", Description = "..." }
    
    -- Load the winning map:
    system:LoadMap(winningMap.Name)
]]
local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local MapVoting = {}
MapVoting.__index = MapVoting

local Config = {
  MapPool = {
    { Name = "Grasslands",    ImageId = "rbxassetid://6023426926", Description = "A peaceful meadow with rolling hills" },
    { Name = "Desert Arena",  ImageId = "rbxassetid://6023426926", Description = "Scorching sands and ancient ruins" },
    { Name = "Snowfield",     ImageId = "rbxassetid://6023426926", Description = "Frozen tundra with ice caves" },
    { Name = "Volcano Island", ImageId = "rbxassetid://6023426926", Description = "Lava flows and volcanic craters" },
    { Name = "Neon City",     ImageId = "rbxassetid://6023426926", Description = "Futuristic cityscape at night" },
    { Name = "Sky Fortress",  ImageId = "rbxassetid://6023426926", Description = "Floating islands above the clouds" },
  },
  ChoicesPerRound = 3,
  VoteDuration = 15,
  MinPlayersToVote = 1,
  TiebreakerMode = "random", -- "random" | "first" (first = first map in list wins ties)
}

function MapVoting.new()
  local self = setmetatable({}, MapVoting)
  self._currentChoices = {}
  self._votes = {}         -- [mapName] = count
  self._playerVotes = {}   -- [player] = mapName (tracks what each player voted for)
  self._isVoting = false
  self._winner = nil
  self._timeLeft = 0

  -- Create RemoteEvents
  self._voteRemote = Instance.new("RemoteEvent")
  self._voteRemote.Name = "MapVote"
  self._voteRemote.Parent = ReplicatedStorage

  self._stateRemote = Instance.new("RemoteEvent")
  self._stateRemote.Name = "MapVoteState"
  self._stateRemote.Parent = ReplicatedStorage

  self._resultRemote = Instance.new("RemoteEvent")
  self._resultRemote.Name = "MapVoteResult"
  self._resultRemote.Parent = ReplicatedStorage

  return self
end

-- Pick N random maps from the pool (no duplicates)
function MapVoting:PickRandomMaps(count)
  local pool = table.clone(Config.MapPool)
  local picks = {}
  local n = math.min(count, #pool)
  for i = 1, n do
    local idx = math.random(#pool)
    table.insert(picks, table.remove(pool, idx))
  end
  return picks
end

-- Broadcast current vote state to all clients
function MapVoting:BroadcastState()
  local state = {
    isVoting = self._isVoting,
    choices = self._currentChoices,
    votes = self._votes,
    timeLeft = self._timeLeft,
    winner = self._winner,
  }
  self._stateRemote:FireAllClients(state)
end

-- Handle a player's vote
function MapVoting:HandleVote(player, mapName)
  if not self._isVoting then return end
  if not self._votes[mapName] then return end -- Invalid map

  -- If player already voted, remove their old vote first (allows changing vote)
  local oldVote = self._playerVotes[player]
  if oldVote and self._votes[oldVote] then
    self._votes[oldVote] = math.max(0, self._votes[oldVote] - 1)
  end

  -- Apply new vote
  self._playerVotes[player] = mapName
  self._votes[mapName] = self._votes[mapName] + 1
  print(string.format("[MapVoting] %s voted for %s", player.Name, mapName))
  self:BroadcastState()
end

-- Tally votes and return the winning map entry
function MapVoting:TallyVotes()
  local bestMaps = {}
  local bestCount = -1

  for _, mapEntry in ipairs(self._currentChoices) do
    local count = self._votes[mapEntry.Name] or 0
    if count > bestCount then
      bestCount = count
      bestMaps = { mapEntry }
    elseif count == bestCount then
      table.insert(bestMaps, mapEntry)
    end
  end

  -- Tiebreaker
  if #bestMaps == 0 then
    return self._currentChoices[1] -- Fallback
  elseif #bestMaps == 1 then
    return bestMaps[1]
  else
    if Config.TiebreakerMode == "random" then
      return bestMaps[math.random(#bestMaps)]
    else
      return bestMaps[1]
    end
  end
end

-- Run a complete voting round. Returns the winning map entry.
function MapVoting:RunVote()
  -- Reset state
  self._currentChoices = self:PickRandomMaps(Config.ChoicesPerRound)
  self._votes = {}
  self._playerVotes = {}
  self._winner = nil
  self._isVoting = true

  -- Initialize vote counts
  for _, mapEntry in ipairs(self._currentChoices) do
    self._votes[mapEntry.Name] = 0
  end

  -- Listen for votes
  local conn = self._voteRemote.OnServerEvent:Connect(function(player, mapName)
    self:HandleVote(player, mapName)
  end)

  -- Broadcast initial state
  self:BroadcastState()
  print(string.format("[MapVoting] Voting started! %d maps available for %ds", #self._currentChoices, Config.VoteDuration))

  -- Countdown timer
  for i = Config.VoteDuration, 0, -1 do
    self._timeLeft = i
    self:BroadcastState()
    if i > 0 then task.wait(1) end
  end

  -- Stop voting
  conn:Disconnect()
  self._isVoting = false

  -- Tally and announce winner
  local winner = self:TallyVotes()
  self._winner = winner
  print(string.format("[MapVoting] Winner: %s with %d votes!", winner.Name, self._votes[winner.Name] or 0))

  -- Broadcast result
  self._resultRemote:FireAllClients({
    winner = winner,
    votes = self._votes,
    totalVoters = #Players:GetPlayers(),
  })
  self:BroadcastState()

  -- Brief pause to let clients show the result
  task.wait(3)

  return winner
end

-- Load a map from ServerStorage.Maps
function MapVoting:LoadMap(mapName)
  -- Cleanup previous map
  local existing = workspace:FindFirstChild("ActiveMap")
  if existing then existing:Destroy() end

  local mapsFolder = ServerStorage:FindFirstChild("Maps")
  if not mapsFolder then
    warn("[MapVoting] ServerStorage.Maps folder not found!")
    return false
  end

  local template = mapsFolder:FindFirstChild(mapName)
  if not template then
    warn(string.format("[MapVoting] Map '%s' not found in ServerStorage.Maps!", mapName))
    return false
  end

  local clone = template:Clone()
  clone.Name = "ActiveMap"
  clone.Parent = workspace
  print(string.format("[MapVoting] Loaded map: %s", mapName))
  return true
end

-- Cleanup the active map
function MapVoting:UnloadMap()
  local existing = workspace:FindFirstChild("ActiveMap")
  if existing then
    existing:Destroy()
    print("[MapVoting] Map unloaded")
  end
end

-- Cleanup RemoteEvents on shutdown
function MapVoting:Destroy()
  if self._voteRemote then self._voteRemote:Destroy() end
  if self._stateRemote then self._stateRemote:Destroy() end
  if self._resultRemote then self._resultRemote:Destroy() end
end

function MapVoting:Init()
  -- Handle players leaving during vote (remove their vote)
  Players.PlayerRemoving:Connect(function(player)
    if not self._isVoting then return end
    local oldVote = self._playerVotes[player]
    if oldVote and self._votes[oldVote] then
      self._votes[oldVote] = math.max(0, self._votes[oldVote] - 1)
      self._playerVotes[player] = nil
      self:BroadcastState()
    end
  end)

  print("[AppleJuice] MapVotingSystem initialized")
end

return MapVoting`,
  clientCode: `--[[ Map Voting Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local voteRemote = ReplicatedStorage:WaitForChild("MapVote")
local stateRemote = ReplicatedStorage:WaitForChild("MapVoteState")
local resultRemote = ReplicatedStorage:WaitForChild("MapVoteResult")

-- State
local screen = UI.createScreenGui("MapVotingUI")
local votingFrame = nil
local mapCards = {}
local timerLabel = nil
local titleLabel = nil
local myVote = nil
local isShowing = false

-- Create the voting UI
local function buildVotingUI(choices)
  -- Cleanup old UI
  if votingFrame then votingFrame:Destroy() end
  mapCards = {}
  myVote = nil
  
  -- Main container with glassmorphic backdrop
  votingFrame = UI.Card(screen, {
    Size = UDim2.new(0, 700, 0, 420),
    Position = UDim2.new(0.5, -350, 0.5, -210),
  })
  votingFrame.BackgroundTransparency = 0.1

  -- Title
  titleLabel = UI.Text(votingFrame, {
    Text = "⚔️  VOTE FOR THE NEXT MAP  ⚔️",
    Bold = true,
    TextSize = 24,
    Size = UDim2.new(1, 0, 0, 40),
    Position = UDim2.new(0, 0, 0, 15),
    Align = "Center",
  })

  -- Timer
  timerLabel = UI.Text(votingFrame, {
    Text = "15",
    Bold = true,
    TextSize = 48,
    Size = UDim2.new(1, 0, 0, 60),
    Position = UDim2.new(0, 0, 0, 50),
    Align = "Center",
  })

  -- Map cards container
  local cardWidth = 180
  local cardSpacing = 20
  local totalWidth = (#choices * cardWidth) + ((#choices - 1) * cardSpacing)
  local startX = (700 - totalWidth) / 2

  for i, mapEntry in ipairs(choices) do
    local xPos = startX + (i - 1) * (cardWidth + cardSpacing)

    -- Card wrapper
    local card = UI.ElevatedCard(votingFrame, {
      Size = UDim2.new(0, cardWidth, 0, 260),
      Position = UDim2.new(0, xPos, 0, 120),
    })

    -- Map thumbnail
    local thumb = UI.Image(card, {
      Image = mapEntry.ImageId or "",
      Size = UDim2.new(1, -16, 0, 120),
      Position = UDim2.new(0, 8, 0, 8),
      ScaleType = Enum.ScaleType.Crop,
    })
    if thumb then
      local corner = Instance.new("UICorner")
      corner.CornerRadius = UDim.new(0, 8)
      corner.Parent = thumb
    end

    -- Map name
    UI.Text(card, {
      Text = mapEntry.Name,
      Bold = true,
      TextSize = 16,
      Size = UDim2.new(1, -16, 0, 24),
      Position = UDim2.new(0, 8, 0, 134),
    })

    -- Map description
    if mapEntry.Description then
      UI.Text(card, {
        Text = mapEntry.Description,
        TextSize = 11,
        Size = UDim2.new(1, -16, 0, 30),
        Position = UDim2.new(0, 8, 0, 158),
        Wrapped = true,
      })
    end

    -- Vote count badge
    local voteBadge = UI.Badge(card, {
      Text = "0 votes",
      Color = "Accent",
    })
    voteBadge.Size = UDim2.new(0, 70, 0, 22)
    voteBadge.Position = UDim2.new(0.5, -35, 0, 192)

    -- Vote button
    local voteBtn = UI.Button(card, {
      Text = "VOTE",
      Style = "Primary",
      OnClick = function()
        myVote = mapEntry.Name
        voteRemote:FireServer(mapEntry.Name)
        -- Visual feedback: highlight selected card
        for _, mc in ipairs(mapCards) do
          if mc.card then
            mc.card.BackgroundTransparency = mc.mapName == mapEntry.Name and 0 or 0.5
          end
        end
      end,
    })
    voteBtn.Size = UDim2.new(1, -24, 0, 32)
    voteBtn.Position = UDim2.new(0, 12, 0, 220)

    table.insert(mapCards, {
      card = card,
      mapName = mapEntry.Name,
      voteBadge = voteBadge,
      voteBtn = voteBtn,
    })
  end

  -- Animate entrance
  votingFrame.Position = UDim2.new(0.5, -350, 1.5, 0)
  TweenService:Create(votingFrame, TweenInfo.new(0.6, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
    Position = UDim2.new(0.5, -350, 0.5, -210)
  }):Play()

  isShowing = true
end

-- Update vote counts on cards
local function updateVoteCounts(votes)
  for _, mc in ipairs(mapCards) do
    local count = votes[mc.mapName] or 0
    if mc.voteBadge then
      mc.voteBadge.Text = count .. (count == 1 and " vote" or " votes")
    end
  end
end

-- Hide voting UI with animation
local function hideVotingUI()
  if not votingFrame or not isShowing then return end
  isShowing = false
  TweenService:Create(votingFrame, TweenInfo.new(0.4, Enum.EasingStyle.Back, Enum.EasingDirection.In), {
    Position = UDim2.new(0.5, -350, -1, 0)
  }):Play()
  task.delay(0.5, function()
    if votingFrame then votingFrame:Destroy() end
  end)
end

-- Listen for state updates
stateRemote.OnClientEvent:Connect(function(state)
  if state.isVoting and not isShowing then
    buildVotingUI(state.choices)
  end

  if state.isVoting and isShowing then
    -- Update timer
    if timerLabel then
      timerLabel.Text = tostring(state.timeLeft or 0)
      -- Pulse effect on low time
      if state.timeLeft and state.timeLeft <= 5 then
        TweenService:Create(timerLabel, TweenInfo.new(0.15), {
          TextSize = 56,
        }):Play()
        task.delay(0.15, function()
          if timerLabel then
            TweenService:Create(timerLabel, TweenInfo.new(0.15), {
              TextSize = 48,
            }):Play()
          end
        end)
      end
    end
    -- Update vote counts
    if state.votes then
      updateVoteCounts(state.votes)
    end
  end

  if not state.isVoting and isShowing and state.winner then
    -- Show winner briefly then hide
    if titleLabel then
      titleLabel.Text = "🏆  " .. state.winner.Name .. " WINS!  🏆"
    end
    if timerLabel then
      timerLabel.Text = ""
    end
    -- Highlight winning card
    for _, mc in ipairs(mapCards) do
      if mc.mapName == state.winner.Name then
        TweenService:Create(mc.card, TweenInfo.new(0.3), {
          BackgroundTransparency = 0,
          Size = UDim2.new(0, 200, 0, 280),
        }):Play()
      else
        TweenService:Create(mc.card, TweenInfo.new(0.3), {
          BackgroundTransparency = 0.8,
        }):Play()
      end
    end
    task.delay(3, hideVotingUI)
  end
end)

-- Listen for final result (for toast notification)
resultRemote.OnClientEvent:Connect(function(result)
  if result.winner then
    UI.Toast(screen, {
      Text = "Map selected: " .. result.winner.Name,
      Type = "success",
    })
  end
end)

print("[AppleJuice] MapVoting client loaded")`,
};
