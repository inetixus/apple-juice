import type { SystemTemplate } from "./index";

export const PET_SYSTEM: SystemTemplate = {
  name: "Pet System",
  category: "Pets",
  description: "Pet hatching, following, stats, equipping, and animated egg-opening with rarity tiers.",
  keywords: ["pet", "hatch", "egg", "follow", "companion", "equip", "rarity", "legendary", "epic", "rare"],
  serverCode: `--[[
  Pet System — Server ModuleScript
  Place in: ServerScriptService.Systems.PetSystem
  README: Config.Eggs defines egg types and their loot tables with rarity weights.
          Config.MaxEquipped limits how many pets follow the player at once.
          Pets follow via BodyPosition + AlignOrientation for smooth movement.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local PetSystem = {}
PetSystem.__index = PetSystem

local Config = {
  MaxEquipped = 3,
  FollowDistance = 5,
  FollowSpeed = 16,
  BobHeight = 2,
  Eggs = {
    BasicEgg = {
      Price = 100, Currency = "Gold",
      Pets = {
        { Name = "Puppy",    Rarity = "Common",    Weight = 50, Model = "Puppy" },
        { Name = "Kitten",   Rarity = "Uncommon",  Weight = 30, Model = "Kitten" },
        { Name = "Dragon",   Rarity = "Rare",      Weight = 15, Model = "Dragon" },
        { Name = "Phoenix",  Rarity = "Legendary", Weight = 4,  Model = "Phoenix" },
        { Name = "Cosmic",   Rarity = "Mythic",    Weight = 1,  Model = "CosmicPet" },
      },
    },
  },
  RarityColors = {
    Common = Color3.fromRGB(200, 200, 200),
    Uncommon = Color3.fromRGB(80, 200, 80),
    Rare = Color3.fromRGB(50, 120, 255),
    Epic = Color3.fromRGB(180, 50, 255),
    Legendary = Color3.fromRGB(255, 200, 0),
    Mythic = Color3.fromRGB(255, 50, 100),
  },
}

local playerPets = {} -- { [player] = { inventory = {}, equipped = {} } }

function PetSystem.new()
  local self = setmetatable({}, PetSystem)
  return self
end

function PetSystem:RollPet(eggName)
  local egg = Config.Eggs[eggName]
  if not egg then return nil end
  local totalWeight = 0
  for _, pet in ipairs(egg.Pets) do totalWeight += pet.Weight end
  local roll = math.random() * totalWeight
  local cumulative = 0
  for _, pet in ipairs(egg.Pets) do
    cumulative += pet.Weight
    if roll <= cumulative then return pet end
  end
  return egg.Pets[#egg.Pets]
end

function PetSystem:HatchEgg(player, eggName)
  local pet = self:RollPet(eggName)
  if not pet then return nil end
  local data = playerPets[player]
  if not data then return nil end
  local petInstance = { id = #data.inventory + 1, name = pet.Name, rarity = pet.Rarity, model = pet.Model }
  table.insert(data.inventory, petInstance)
  return petInstance
end

function PetSystem:EquipPet(player, petId)
  local data = playerPets[player]
  if not data then return false end
  if #data.equipped >= Config.MaxEquipped then return false end
  for _, pet in ipairs(data.inventory) do
    if pet.id == petId then
      table.insert(data.equipped, pet)
      self:SpawnPetModel(player, pet)
      return true
    end
  end
  return false
end

function PetSystem:UnequipPet(player, petId)
  local data = playerPets[player]
  if not data then return end
  for i, pet in ipairs(data.equipped) do
    if pet.id == petId then
      table.remove(data.equipped, i)
      self:DespawnPetModel(player, petId)
      break
    end
  end
end

function PetSystem:SpawnPetModel(player, pet)
  local char = player.Character
  if not char then return end
  local template = ServerStorage:FindFirstChild("Pets") and ServerStorage.Pets:FindFirstChild(pet.model)
  if not template then return end
  local model = template:Clone()
  model.Name = "Pet_" .. pet.id
  local root = model:FindFirstChild("HumanoidRootPart") or model.PrimaryPart
  if root then
    local bp = Instance.new("BodyPosition")
    bp.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
    bp.D = 800
    bp.P = 5000
    bp.Parent = root
    root.Anchored = false
  end
  model.Parent = char
  -- Follow loop
  task.spawn(function()
    local hrp = char:WaitForChild("HumanoidRootPart", 5)
    if not hrp or not root then return end
    local offset = Vector3.new(
      math.random(-1, 1) * Config.FollowDistance,
      Config.BobHeight,
      math.random(-1, 1) * Config.FollowDistance
    )
    while model.Parent and char.Parent do
      local target = hrp.Position + offset + Vector3.new(0, math.sin(tick() * 2) * 0.5, 0)
      local bp = root:FindFirstChildOfClass("BodyPosition")
      if bp then bp.Position = target end
      task.wait(0.1)
    end
  end)
end

function PetSystem:DespawnPetModel(player, petId)
  local char = player.Character
  if not char then return end
  local model = char:FindFirstChild("Pet_" .. petId)
  if model then model:Destroy() end
end

function PetSystem:Init()
  Players.PlayerAdded:Connect(function(p)
    playerPets[p] = { inventory = {}, equipped = {} }
  end)
  Players.PlayerRemoving:Connect(function(p) playerPets[p] = nil end)

  local remote = Instance.new("RemoteEvent")
  remote.Name = "PetAction"
  remote.Parent = ReplicatedStorage
  remote.OnServerEvent:Connect(function(player, action, ...)
    if action == "hatch" then
      local pet = self:HatchEgg(player, ...)
      remote:FireClient(player, "hatched", pet)
    elseif action == "equip" then
      self:EquipPet(player, ...)
    elseif action == "unequip" then
      self:UnequipPet(player, ...)
    end
  end)
end

return PetSystem`,
  clientCode: `--[[ Pet Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local player = Players.LocalPlayer
local remote = ReplicatedStorage:WaitForChild("PetAction")
local screen = UI.createScreenGui("PetGui")
screen.Enabled = false

local RarityColors = {
  Common = Color3.fromRGB(200, 200, 200),
  Uncommon = Color3.fromRGB(80, 200, 80),
  Rare = Color3.fromRGB(50, 120, 255),
  Epic = Color3.fromRGB(180, 50, 255),
  Legendary = Color3.fromRGB(255, 200, 0),
  Mythic = Color3.fromRGB(255, 50, 100),
}

-- Main panel
local panel = UI.Card(screen, {
  Size = UDim2.new(0, 500, 0, 400),
  Position = UDim2.new(0.5, -250, 0.5, -200),
})

UI.Text(panel, {
  Text = "🐾 My Pets", Bold = true, TextSize = 24,
  Size = UDim2.new(1, 0, 0, 40), Position = UDim2.new(0, 0, 0, 5),
  Align = Enum.TextXAlignment.Center,
})

-- Close button
UI.Button(panel, {
  Text = "✕", Style = "Danger",
  Size = UDim2.new(0, 32, 0, 32),
  Position = UDim2.new(1, -40, 0, 8),
  OnClick = function() screen.Enabled = false end,
})

-- Hatch button
UI.Button(panel, {
  Text = "🥚 Hatch Basic Egg (100 Gold)", Style = "Primary",
  Size = UDim2.new(0.9, 0, 0, 40),
  Position = UDim2.new(0.05, 0, 0, 50),
  OnClick = function() remote:FireServer("hatch", "BasicEgg") end,
})

-- Inventory scroll frame
local scroll = Instance.new("ScrollingFrame")
scroll.Size = UDim2.new(0.9, 0, 0, 270)
scroll.Position = UDim2.new(0.05, 0, 0, 100)
scroll.BackgroundTransparency = 1
scroll.ScrollBarThickness = 4
scroll.CanvasSize = UDim2.new(0, 0, 0, 0)
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
scroll.Parent = panel

local grid = Instance.new("UIGridLayout")
grid.CellSize = UDim2.new(0, 100, 0, 110)
grid.CellPadding = UDim2.new(0, 8, 0, 8)
grid.SortOrder = Enum.SortOrder.LayoutOrder
grid.Parent = scroll

local inventory = {}

local function refreshInventory(pets)
  for _, child in ipairs(scroll:GetChildren()) do
    if child:IsA("Frame") then child:Destroy() end
  end
  for i, pet in ipairs(pets) do
    local card = Instance.new("Frame")
    card.BackgroundColor3 = RarityColors[pet.rarity] or Color3.new(0.5, 0.5, 0.5)
    card.BackgroundTransparency = 0.7
    card.Parent = scroll
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 8)
    corner.Parent = card
    local nameLabel = Instance.new("TextLabel")
    nameLabel.Text = pet.name
    nameLabel.Size = UDim2.new(1, 0, 0, 20)
    nameLabel.Position = UDim2.new(0, 0, 0, 5)
    nameLabel.BackgroundTransparency = 1
    nameLabel.TextColor3 = Color3.new(1, 1, 1)
    nameLabel.Font = Enum.Font.GothamBold
    nameLabel.TextSize = 12
    nameLabel.Parent = card
    local rarityLabel = Instance.new("TextLabel")
    rarityLabel.Text = pet.rarity
    rarityLabel.Size = UDim2.new(1, 0, 0, 16)
    rarityLabel.Position = UDim2.new(0, 0, 0, 25)
    rarityLabel.BackgroundTransparency = 1
    rarityLabel.TextColor3 = RarityColors[pet.rarity] or Color3.new(1, 1, 1)
    rarityLabel.Font = Enum.Font.GothamBold
    rarityLabel.TextSize = 10
    rarityLabel.Parent = card
    local equipBtn = Instance.new("TextButton")
    equipBtn.Text = "Equip"
    equipBtn.Size = UDim2.new(0.8, 0, 0, 24)
    equipBtn.Position = UDim2.new(0.1, 0, 1, -30)
    equipBtn.BackgroundColor3 = Color3.fromRGB(80, 200, 120)
    equipBtn.TextColor3 = Color3.new(1, 1, 1)
    equipBtn.Font = Enum.Font.GothamBold
    equipBtn.TextSize = 11
    equipBtn.Parent = card
    local btnCorner = Instance.new("UICorner")
    btnCorner.CornerRadius = UDim.new(0, 6)
    btnCorner.Parent = equipBtn
    equipBtn.MouseButton1Click:Connect(function()
      remote:FireServer("equip", pet.id)
    end)
  end
end

-- Hatch result popup
remote.OnClientEvent:Connect(function(action, data)
  if action == "hatched" and data then
    table.insert(inventory, data)
    refreshInventory(inventory)
    -- Show hatch animation
    local popup = UI.Card(screen, {
      Size = UDim2.new(0, 300, 0, 200),
      Position = UDim2.new(0.5, -150, 0.5, -100),
    })
    UI.Text(popup, {
      Text = "You hatched a " .. data.rarity .. " " .. data.name .. "!",
      Bold = true, TextSize = 18, Wrapped = true,
      Size = UDim2.new(0.8, 0, 0.5, 0), Position = UDim2.new(0.1, 0, 0.1, 0),
      Align = Enum.TextXAlignment.Center,
    })
    task.delay(3, function() popup:Destroy() end)
  end
end)

-- Toggle with P key
UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.P then screen.Enabled = not screen.Enabled end
end)`,
};
