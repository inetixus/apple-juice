import type { SystemTemplate } from "./index";

export const NPC_SYSTEM: SystemTemplate = {
  name: "NPC & Dialogue System",
  category: "NPCs",
  description: "Branching dialogue trees with ProximityPrompts, quest-giving, and overhead nametags.",
  keywords: ["npc", "dialogue", "conversation", "quest", "talk", "branching", "proximity", "interact"],
  serverCode: `--[[
  NPC & Dialogue System — Server ModuleScript
  Place in: ServerScriptService.Systems.NPCSystem
  README: Config.NPCs defines NPC dialogue trees. Each node has text + choices.
          Choices can trigger functions, give quests, or advance to other nodes.
          NPCs use ProximityPrompts for interaction radius.
]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local NPCSystem = {}
NPCSystem.__index = NPCSystem

local Config = {
  InteractDistance = 12,
  NPCs = {
    ShopKeeper = {
      DisplayName = "Merchant Bob",
      DialogueTree = {
        start = {
          Text = "Welcome, traveler! What can I help you with?",
          Choices = {
            { Label = "Show me your wares", Next = "shop" },
            { Label = "Any quests?", Next = "quest_offer" },
            { Label = "Goodbye", Action = "close" },
          },
        },
        shop = {
          Text = "Take a look at my finest goods!",
          Action = "open_shop",
          Choices = { { Label = "Back", Next = "start" } },
        },
        quest_offer = {
          Text = "I need 5 wolf pelts. Bring them to me for 200 gold!",
          Choices = {
            { Label = "Accept quest", Action = "accept_quest", QuestId = "wolf_pelts" },
            { Label = "No thanks", Next = "start" },
          },
        },
      },
    },
  },
}

function NPCSystem.new()
  return setmetatable({}, NPCSystem)
end

function NPCSystem:SetupNPC(npcModel, npcConfig)
  local prompt = Instance.new("ProximityPrompt")
  prompt.ActionText = "Talk"
  prompt.ObjectText = npcConfig.DisplayName
  prompt.MaxActivationDistance = Config.InteractDistance
  prompt.Parent = npcModel.PrimaryPart or npcModel:FindFirstChild("HumanoidRootPart")

  -- Overhead name
  local billboard = Instance.new("BillboardGui")
  billboard.Size = UDim2.new(0, 200, 0, 40)
  billboard.StudsOffset = Vector3.new(0, 3, 0)
  billboard.AlwaysOnTop = true
  billboard.Parent = npcModel:FindFirstChild("Head") or npcModel.PrimaryPart
  local label = Instance.new("TextLabel")
  label.Size = UDim2.new(1, 0, 1, 0)
  label.BackgroundTransparency = 1
  label.Text = npcConfig.DisplayName
  label.TextColor3 = Color3.fromRGB(255, 255, 100)
  label.Font = Enum.Font.GothamBold
  label.TextSize = 16
  label.Parent = billboard

  local remote = ReplicatedStorage:FindFirstChild("DialogueEvent")
  prompt.Triggered:Connect(function(player)
    remote:FireClient(player, "open", npcConfig.DisplayName, npcConfig.DialogueTree, "start")
  end)
end

function NPCSystem:Init()
  local remote = Instance.new("RemoteEvent")
  remote.Name = "DialogueEvent"
  remote.Parent = ReplicatedStorage
  remote.OnServerEvent:Connect(function(player, action, ...)
    if action == "accept_quest" then
      -- Hook into quest system
    elseif action == "open_shop" then
      -- Hook into economy system
    end
  end)
end

return NPCSystem`,
  clientCode: `--[[ NPC Dialogue Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local remote = ReplicatedStorage:WaitForChild("DialogueEvent")
local screen = UI.createScreenGui("DialogueGui")
screen.Enabled = false

local currentPanel = nil
local currentTree = nil

local function showNode(npcName, tree, nodeId)
  if currentPanel then currentPanel:Destroy() end
  local node = tree[nodeId]
  if not node then screen.Enabled = false; return end
  if node.Action == "close" then screen.Enabled = false; return end

  currentPanel = UI.Card(screen, {
    Size = UDim2.new(0, 500, 0, 250),
    Position = UDim2.new(0.5, -250, 1, -270),
  })

  -- NPC name
  UI.Text(currentPanel, {
    Text = npcName, Bold = true, TextSize = 18,
    Size = UDim2.new(1, 0, 0, 30), Position = UDim2.new(0, 10, 0, 8),
    Align = Enum.TextXAlignment.Left,
  })

  -- Dialogue text with typewriter effect
  local textLabel = UI.Text(currentPanel, {
    Text = "", TextSize = 15, Wrapped = true,
    Size = UDim2.new(1, -20, 0, 60), Position = UDim2.new(0, 10, 0, 40),
    Align = Enum.TextXAlignment.Left,
  })

  -- Typewriter
  task.spawn(function()
    for i = 1, #node.Text do
      textLabel.Text = string.sub(node.Text, 1, i)
      task.wait(0.02)
    end
  end)

  -- Choices
  if node.Choices then
    for i, choice in ipairs(node.Choices) do
      UI.Button(currentPanel, {
        Text = choice.Label, Style = i == 1 and "Primary" or "Secondary",
        Size = UDim2.new(0.45, 0, 0, 35),
        Position = UDim2.new(i % 2 == 1 and 0.02 or 0.52, 0, 0, 110 + math.floor((i - 1) / 2) * 42),
        OnClick = function()
          if choice.Action == "close" then
            screen.Enabled = false
            if currentPanel then currentPanel:Destroy() end
          elseif choice.Action then
            remote:FireServer(choice.Action, choice.QuestId)
            if choice.Next then showNode(npcName, tree, choice.Next)
            else screen.Enabled = false; currentPanel:Destroy() end
          elseif choice.Next then
            showNode(npcName, tree, choice.Next)
          end
        end,
      })
    end
  end
end

remote.OnClientEvent:Connect(function(action, npcName, tree, startNode)
  if action == "open" then
    currentTree = tree
    screen.Enabled = true
    showNode(npcName, tree, startNode)
  end
end)`,
};
