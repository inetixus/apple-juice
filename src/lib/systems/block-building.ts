import type { SystemTemplate } from "./index";

export const BLOCK_BUILDING_SYSTEM: SystemTemplate = {
  name: "Block Building System",
  category: "Building",
  description: "Minecraft-style block placement and breaking system with multiple block types, grid snapping, ghost preview, break animation, block palette UI, and server-authoritative validation. Supports per-player build limits, block breaking with particle effects, and hotbar selection.",
  keywords: ["block", "blocks", "break", "breaking", "mine", "mining", "sandbox", "minecraft", "voxel", "dig", "destroy block", "place block", "block type", "build block", "building blocks", "creative", "survival build"],
  serverCode: `--[[
  Block Building System — Server Script
  Place in: ServerScriptService.Systems.BlockBuildingSystem
  README: Config.BlockTypes defines all available blocks with Color, Material, and optional Transparency.
          Config.GridSize controls block size (default 4 studs).
          Config.MaxBlocksPerPlayer limits how many blocks each player can place.
          Config.BreakTime controls how long it takes to break a block (0 = instant).
          Config.BuildRadius limits how far from the player blocks can be placed/broken.
          
          The system is server-authoritative: all placement and breaking is validated server-side.
          Blocks are stored in per-player folders under workspace.PlayerBlocks.
          
  INTEGRATION:
    local BlockBuilding = require(ServerScriptService.Systems.BlockBuildingSystem)
    BlockBuilding:Init()
    -- That's it! The system handles everything via RemoteEvents.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")

local BlockBuilding = {}

local Config = {
  GridSize = 4,
  MaxBlocksPerPlayer = 500,
  BreakTime = 0.3,
  BuildRadius = 60,
  BaseplateName = "Baseplate",
  BlockTypes = {
    { Id = "grass",    Name = "Grass",     Color = Color3.fromRGB(76, 153, 0),    Material = Enum.Material.Grass },
    { Id = "dirt",     Name = "Dirt",      Color = Color3.fromRGB(120, 85, 60),   Material = Enum.Material.Slate },
    { Id = "stone",    Name = "Stone",     Color = Color3.fromRGB(140, 140, 140), Material = Enum.Material.Slate },
    { Id = "cobble",   Name = "Cobblestone", Color = Color3.fromRGB(110, 110, 110), Material = Enum.Material.Cobblestone },
    { Id = "wood",     Name = "Wood Planks", Color = Color3.fromRGB(160, 120, 70), Material = Enum.Material.WoodPlanks },
    { Id = "log",      Name = "Wood Log",  Color = Color3.fromRGB(100, 70, 40),   Material = Enum.Material.Wood },
    { Id = "brick",    Name = "Brick",     Color = Color3.fromRGB(170, 75, 60),   Material = Enum.Material.Brick },
    { Id = "sand",     Name = "Sand",      Color = Color3.fromRGB(220, 200, 130), Material = Enum.Material.Sand },
    { Id = "snow",     Name = "Snow",      Color = Color3.fromRGB(240, 240, 250), Material = Enum.Material.Snow },
    { Id = "glass",    Name = "Glass",     Color = Color3.fromRGB(200, 220, 255), Material = Enum.Material.Glass, Transparency = 0.5 },
    { Id = "iron",     Name = "Iron Block", Color = Color3.fromRGB(200, 200, 210), Material = Enum.Material.Metal },
    { Id = "gold",     Name = "Gold Block", Color = Color3.fromRGB(255, 200, 50),  Material = Enum.Material.Metal },
    { Id = "leaf",     Name = "Leaves",    Color = Color3.fromRGB(50, 130, 30),   Material = Enum.Material.LeafyGrass, Transparency = 0.1 },
    { Id = "water",    Name = "Water",     Color = Color3.fromRGB(50, 120, 200),  Material = Enum.Material.Glass, Transparency = 0.4 },
    { Id = "lava",     Name = "Lava",      Color = Color3.fromRGB(255, 80, 20),   Material = Enum.Material.Neon },
    { Id = "obsidian", Name = "Obsidian",  Color = Color3.fromRGB(30, 20, 40),    Material = Enum.Material.Basalt },
  },
}

local playerBlockCounts = {}
local blockTypeMap = {}
for _, bt in ipairs(Config.BlockTypes) do
  blockTypeMap[bt.Id] = bt
end

local function getPlayerFolder(player)
  local folder = workspace:FindFirstChild("PlayerBlocks")
  if not folder then
    folder = Instance.new("Folder")
    folder.Name = "PlayerBlocks"
    folder.Parent = workspace
  end
  local pFolder = folder:FindFirstChild(player.Name)
  if not pFolder then
    pFolder = Instance.new("Folder")
    pFolder.Name = player.Name
    pFolder.Parent = folder
  end
  return pFolder
end

local function snapToGrid(position)
  local g = Config.GridSize
  local half = g / 2
  return Vector3.new(
    math.round(position.X / g) * g,
    math.round(position.Y / g) * g + half,
    math.round(position.Z / g) * g
  )
end

local function isWithinRange(player, position)
  local char = player.Character
  if not char then return false end
  local root = char:FindFirstChild("HumanoidRootPart")
  if not root then return false end
  return (root.Position - position).Magnitude <= Config.BuildRadius
end

local function isPositionOccupied(position)
  local g = Config.GridSize
  local params = OverlapParams.new()
  params.FilterType = Enum.RaycastFilterType.Include
  local blocksFolder = workspace:FindFirstChild("PlayerBlocks")
  if blocksFolder then params:AddToFilter(blocksFolder) end
  local parts = workspace:GetPartBoundsInBox(CFrame.new(position), Vector3.new(g * 0.9, g * 0.9, g * 0.9), params)
  return #parts > 0
end

local function createBreakEffect(position, color)
  for i = 1, 8 do
    local particle = Instance.new("Part")
    particle.Size = Vector3.new(0.6, 0.6, 0.6)
    particle.Color = color
    particle.Position = position + Vector3.new(math.random(-2, 2), math.random(0, 3), math.random(-2, 2))
    particle.Anchored = false
    particle.CanCollide = true
    particle.Parent = workspace
    particle.Velocity = Vector3.new(math.random(-15, 15), math.random(10, 25), math.random(-15, 15))
    Debris:AddItem(particle, 2)
  end
end

function BlockBuilding:Init()
  -- Create RemoteEvents
  local placeRemote = Instance.new("RemoteEvent")
  placeRemote.Name = "PlaceBlock"
  placeRemote.Parent = ReplicatedStorage

  local breakRemote = Instance.new("RemoteEvent")
  breakRemote.Name = "BreakBlock"
  breakRemote.Parent = ReplicatedStorage

  local blockListRemote = Instance.new("RemoteFunction")
  blockListRemote.Name = "GetBlockTypes"
  blockListRemote.Parent = ReplicatedStorage

  -- Return block type list to clients
  blockListRemote.OnServerInvoke = function(_player)
    local list = {}
    for _, bt in ipairs(Config.BlockTypes) do
      table.insert(list, { Id = bt.Id, Name = bt.Name })
    end
    return list
  end

  -- Handle block placement
  placeRemote.OnServerEvent:Connect(function(player, blockId, position)
    -- Validate block type
    local blockType = blockTypeMap[blockId]
    if not blockType then
      warn(string.format("[BlockBuilding] Invalid block type '%s' from %s", tostring(blockId), player.Name))
      return
    end

    -- Snap position
    local snapped = snapToGrid(position)

    -- Validate range
    if not isWithinRange(player, snapped) then return end

    -- Check build limit
    local count = playerBlockCounts[player.UserId] or 0
    if count >= Config.MaxBlocksPerPlayer then
      -- Notify client they've hit the limit
      return
    end

    -- Check if position is already occupied
    if isPositionOccupied(snapped) then return end

    -- Create the block
    local block = Instance.new("Part")
    block.Size = Vector3.new(Config.GridSize, Config.GridSize, Config.GridSize)
    block.Position = snapped
    block.Anchored = true
    block.Color = blockType.Color
    block.Material = blockType.Material
    block.Transparency = blockType.Transparency or 0
    block.Name = blockType.Id
    block:SetAttribute("BlockType", blockType.Id)
    block:SetAttribute("PlacedBy", player.UserId)
    block.Parent = getPlayerFolder(player)

    playerBlockCounts[player.UserId] = count + 1
    print(string.format("[BlockBuilding] %s placed %s at %s (%d/%d)", player.Name, blockType.Name, tostring(snapped), count + 1, Config.MaxBlocksPerPlayer))
  end)

  -- Handle block breaking
  breakRemote.OnServerEvent:Connect(function(player, blockPart)
    if not blockPart or not blockPart:IsA("BasePart") then return end
    if not blockPart:GetAttribute("BlockType") then return end -- Not a placed block
    if not isWithinRange(player, blockPart.Position) then return end

    -- Only allow breaking your own blocks (or enable for all)
    local placedBy = blockPart:GetAttribute("PlacedBy")
    -- Allow breaking anyone's blocks (for collaborative building):
    -- if placedBy ~= player.UserId then return end

    -- Break effect
    createBreakEffect(blockPart.Position, blockPart.Color)

    -- Update count for the original placer
    if placedBy then
      playerBlockCounts[placedBy] = math.max(0, (playerBlockCounts[placedBy] or 0) - 1)
    end

    -- Destroy
    blockPart:Destroy()
    print(string.format("[BlockBuilding] %s broke a block", player.Name))
  end)

  -- Cleanup on player leave
  Players.PlayerRemoving:Connect(function(player)
    -- Optional: keep blocks or destroy them
    -- To destroy: getPlayerFolder(player):Destroy()
    -- To keep: do nothing (blocks persist until server restart)
  end)

  print("[AppleJuice] BlockBuildingSystem initialized — " .. #Config.BlockTypes .. " block types loaded")
end

return BlockBuilding`,
  clientCode: `--[[ Block Building Client — LocalScript in StarterPlayerScripts ]]
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local player = Players.LocalPlayer
local mouse = player:GetMouse()
local camera = workspace.CurrentCamera

local placeRemote = ReplicatedStorage:WaitForChild("PlaceBlock")
local breakRemote = ReplicatedStorage:WaitForChild("BreakBlock")

local screen = UI.createScreenGui("BlockBuildingUI")

-- ══════════════════════════════════════════════════════════════════
-- CONFIG
-- ══════════════════════════════════════════════════════════════════
local GRID = 4
local BUILD_MODE = false
local BREAK_MODE = false
local selectedBlockIndex = 1

local BLOCKS = {
  { Id = "grass",    Name = "Grass",       Color = Color3.fromRGB(76, 153, 0),    Material = Enum.Material.Grass },
  { Id = "dirt",     Name = "Dirt",        Color = Color3.fromRGB(120, 85, 60),   Material = Enum.Material.Slate },
  { Id = "stone",    Name = "Stone",       Color = Color3.fromRGB(140, 140, 140), Material = Enum.Material.Slate },
  { Id = "cobble",   Name = "Cobblestone", Color = Color3.fromRGB(110, 110, 110), Material = Enum.Material.Cobblestone },
  { Id = "wood",     Name = "Wood Planks", Color = Color3.fromRGB(160, 120, 70),  Material = Enum.Material.WoodPlanks },
  { Id = "log",      Name = "Wood Log",    Color = Color3.fromRGB(100, 70, 40),   Material = Enum.Material.Wood },
  { Id = "brick",    Name = "Brick",       Color = Color3.fromRGB(170, 75, 60),   Material = Enum.Material.Brick },
  { Id = "sand",     Name = "Sand",        Color = Color3.fromRGB(220, 200, 130), Material = Enum.Material.Sand },
  { Id = "snow",     Name = "Snow",        Color = Color3.fromRGB(240, 240, 250), Material = Enum.Material.Snow },
  { Id = "glass",    Name = "Glass",       Color = Color3.fromRGB(200, 220, 255), Material = Enum.Material.Glass },
  { Id = "iron",     Name = "Iron Block",  Color = Color3.fromRGB(200, 200, 210), Material = Enum.Material.Metal },
  { Id = "gold",     Name = "Gold Block",  Color = Color3.fromRGB(255, 200, 50),  Material = Enum.Material.Metal },
  { Id = "leaf",     Name = "Leaves",      Color = Color3.fromRGB(50, 130, 30),   Material = Enum.Material.LeafyGrass },
  { Id = "water",    Name = "Water",       Color = Color3.fromRGB(50, 120, 200),  Material = Enum.Material.Glass },
  { Id = "lava",     Name = "Lava",        Color = Color3.fromRGB(255, 80, 20),   Material = Enum.Material.Neon },
  { Id = "obsidian", Name = "Obsidian",    Color = Color3.fromRGB(30, 20, 40),    Material = Enum.Material.Basalt },
}

-- ══════════════════════════════════════════════════════════════════
-- GHOST PREVIEW
-- ══════════════════════════════════════════════════════════════════
local ghostBlock = Instance.new("Part")
ghostBlock.Size = Vector3.new(GRID, GRID, GRID)
ghostBlock.Anchored = true
ghostBlock.CanCollide = false
ghostBlock.Transparency = 0.5
ghostBlock.Color = BLOCKS[1].Color
ghostBlock.Material = BLOCKS[1].Material
ghostBlock.Name = "GhostPreview"
ghostBlock.Parent = nil -- Hidden by default

local selectionBox = Instance.new("SelectionBox")
selectionBox.Color3 = Color3.fromRGB(255, 60, 60)
selectionBox.LineThickness = 0.06
selectionBox.SurfaceTransparency = 0.85
selectionBox.SurfaceColor3 = Color3.fromRGB(255, 0, 0)
selectionBox.Parent = screen

local function snapToGrid(pos)
  local half = GRID / 2
  return Vector3.new(
    math.round(pos.X / GRID) * GRID,
    math.round(pos.Y / GRID) * GRID + half,
    math.round(pos.Z / GRID) * GRID
  )
end

local function getAdjacentPosition(hitPos, hitNormal)
  return snapToGrid(hitPos + hitNormal * (GRID / 2))
end

-- ══════════════════════════════════════════════════════════════════
-- HOTBAR UI
-- ══════════════════════════════════════════════════════════════════
local HOTBAR_SLOTS = 9
local hotbarFrame = Instance.new("Frame")
hotbarFrame.Name = "Hotbar"
hotbarFrame.Size = UDim2.new(0, HOTBAR_SLOTS * 56 + 16, 0, 72)
hotbarFrame.Position = UDim2.new(0.5, -(HOTBAR_SLOTS * 56 + 16) / 2, 1, -84)
hotbarFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
hotbarFrame.BackgroundTransparency = 0.2
hotbarFrame.BorderSizePixel = 0
hotbarFrame.Parent = screen

local hotbarCorner = Instance.new("UICorner")
hotbarCorner.CornerRadius = UDim.new(0, 14)
hotbarCorner.Parent = hotbarFrame

local hotbarStroke = Instance.new("UIStroke")
hotbarStroke.Color = Color3.fromRGB(204, 255, 0)
hotbarStroke.Transparency = 0.7
hotbarStroke.Thickness = 1.5
hotbarStroke.Parent = hotbarFrame

local hotbarSlots = {}
for i = 1, HOTBAR_SLOTS do
  local block = BLOCKS[i]
  if not block then break end

  local slot = Instance.new("Frame")
  slot.Name = "Slot_" .. i
  slot.Size = UDim2.new(0, 48, 0, 48)
  slot.Position = UDim2.new(0, 8 + (i - 1) * 56, 0, 8)
  slot.BackgroundColor3 = block.Color
  slot.BorderSizePixel = 0
  slot.Parent = hotbarFrame

  local slotCorner = Instance.new("UICorner")
  slotCorner.CornerRadius = UDim.new(0, 8)
  slotCorner.Parent = slot

  local slotStroke = Instance.new("UIStroke")
  slotStroke.Color = i == 1 and Color3.fromRGB(204, 255, 0) or Color3.fromRGB(60, 60, 60)
  slotStroke.Thickness = i == 1 and 2.5 or 1
  slotStroke.Parent = slot

  -- Number label
  local numLabel = Instance.new("TextLabel")
  numLabel.Size = UDim2.new(0, 16, 0, 16)
  numLabel.Position = UDim2.new(0, 2, 0, 1)
  numLabel.BackgroundTransparency = 1
  numLabel.Text = tostring(i)
  numLabel.TextColor3 = Color3.new(1, 1, 1)
  numLabel.TextSize = 10
  numLabel.Font = Enum.Font.GothamBold
  numLabel.Parent = slot

  -- Name tooltip on hover
  local nameLabel = Instance.new("TextLabel")
  nameLabel.Size = UDim2.new(0, 100, 0, 18)
  nameLabel.Position = UDim2.new(0.5, -50, 0, -22)
  nameLabel.BackgroundColor3 = Color3.fromRGB(20, 20, 25)
  nameLabel.BackgroundTransparency = 0.1
  nameLabel.Text = block.Name
  nameLabel.TextColor3 = Color3.new(1, 1, 1)
  nameLabel.TextSize = 10
  nameLabel.Font = Enum.Font.GothamBold
  nameLabel.Visible = false
  nameLabel.Parent = slot
  local nameLabelCorner = Instance.new("UICorner")
  nameLabelCorner.CornerRadius = UDim.new(0, 6)
  nameLabelCorner.Parent = nameLabel

  slot.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseMovement then
      nameLabel.Visible = true
    end
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
      selectedBlockIndex = i
    end
  end)
  slot.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseMovement then
      nameLabel.Visible = false
    end
  end)

  table.insert(hotbarSlots, { frame = slot, stroke = slotStroke })
end

-- Mode indicator
local modeLabel = UI.Text(screen, {
  Text = "",
  Bold = true,
  TextSize = 14,
  Size = UDim2.new(0, 200, 0, 28),
  Position = UDim2.new(0.5, -100, 1, -100),
  Align = "Center",
})

-- ══════════════════════════════════════════════════════════════════
-- BLOCK PALETTE (full list, opened with Tab)
-- ══════════════════════════════════════════════════════════════════
local showPalette = false
local paletteFrame = UI.Card(screen, {
  Size = UDim2.new(0, 400, 0, 340),
  Position = UDim2.new(0.5, -200, 0.5, -170),
})
paletteFrame.Visible = false

UI.TitleBar(paletteFrame, {
  Title = "Block Palette",
  OnClose = function() paletteFrame.Visible = false; showPalette = false end,
})

local paletteScroll = UI.ScrollList(paletteFrame, {
  Grid = true,
  CellSize = UDim2.new(0, 64, 0, 76),
  Spacing = UDim2.new(0, 8, 0, 8),
  Size = UDim2.new(1, -20, 1, -60),
  Position = UDim2.new(0, 10, 0, 50),
})

for i, block in ipairs(BLOCKS) do
  local card = Instance.new("Frame")
  card.Size = UDim2.new(0, 64, 0, 76)
  card.BackgroundColor3 = Color3.fromRGB(30, 30, 35)
  card.BorderSizePixel = 0
  card.Parent = paletteScroll

  local cardCorner = Instance.new("UICorner")
  cardCorner.CornerRadius = UDim.new(0, 8)
  cardCorner.Parent = card

  -- Color swatch
  local swatch = Instance.new("Frame")
  swatch.Size = UDim2.new(0, 40, 0, 40)
  swatch.Position = UDim2.new(0.5, -20, 0, 6)
  swatch.BackgroundColor3 = block.Color
  swatch.BorderSizePixel = 0
  swatch.Parent = card
  local swatchCorner = Instance.new("UICorner")
  swatchCorner.CornerRadius = UDim.new(0, 6)
  swatchCorner.Parent = swatch

  -- Name
  local label = Instance.new("TextLabel")
  label.Size = UDim2.new(1, -4, 0, 22)
  label.Position = UDim2.new(0, 2, 1, -24)
  label.BackgroundTransparency = 1
  label.Text = block.Name
  label.TextColor3 = Color3.new(1, 1, 1)
  label.TextSize = 9
  label.Font = Enum.Font.GothamBold
  label.TextTruncate = Enum.TextTruncate.AtEnd
  label.Parent = card

  -- Click to select
  local btn = Instance.new("TextButton")
  btn.Size = UDim2.new(1, 0, 1, 0)
  btn.BackgroundTransparency = 1
  btn.Text = ""
  btn.Parent = card
  btn.MouseButton1Click:Connect(function()
    selectedBlockIndex = i
    paletteFrame.Visible = false
    showPalette = false
  end)
end

-- ══════════════════════════════════════════════════════════════════
-- UPDATE LOOP
-- ══════════════════════════════════════════════════════════════════
local function updateHotbar()
  for i, slot in ipairs(hotbarSlots) do
    if i == selectedBlockIndex then
      slot.stroke.Color = Color3.fromRGB(204, 255, 0)
      slot.stroke.Thickness = 2.5
    else
      slot.stroke.Color = Color3.fromRGB(60, 60, 60)
      slot.stroke.Thickness = 1
    end
  end
  local block = BLOCKS[selectedBlockIndex]
  if block then
    ghostBlock.Color = block.Color
    ghostBlock.Material = block.Material
  end
end

local function updateModeLabel()
  if BUILD_MODE then
    modeLabel.Text = "🔨 BUILD MODE — " .. (BLOCKS[selectedBlockIndex] and BLOCKS[selectedBlockIndex].Name or "")
    modeLabel.TextColor3 = Color3.fromRGB(204, 255, 0)
  elseif BREAK_MODE then
    modeLabel.Text = "⛏️ BREAK MODE"
    modeLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
  else
    modeLabel.Text = ""
  end
end

-- ══════════════════════════════════════════════════════════════════
-- INPUT HANDLING
-- ══════════════════════════════════════════════════════════════════
UserInputService.InputBegan:Connect(function(input, gameProcessed)
  if gameProcessed then return end

  -- B = Toggle Build Mode
  if input.KeyCode == Enum.KeyCode.B then
    BUILD_MODE = not BUILD_MODE
    BREAK_MODE = false
    ghostBlock.Parent = BUILD_MODE and workspace or nil
    selectionBox.Adornee = nil
    updateModeLabel()
  end

  -- X = Toggle Break Mode
  if input.KeyCode == Enum.KeyCode.X then
    BREAK_MODE = not BREAK_MODE
    BUILD_MODE = false
    ghostBlock.Parent = nil
    if not BREAK_MODE then selectionBox.Adornee = nil end
    updateModeLabel()
  end

  -- Tab = Open palette
  if input.KeyCode == Enum.KeyCode.Tab then
    showPalette = not showPalette
    paletteFrame.Visible = showPalette
  end

  -- Number keys 1-9 for hotbar
  local num = tonumber(input.KeyCode.Name)
  if num and num >= 1 and num <= HOTBAR_SLOTS and num <= #BLOCKS then
    selectedBlockIndex = num
    updateHotbar()
    updateModeLabel()
  end

  -- Scroll wheel to cycle blocks
  if input.UserInputType == Enum.UserInputType.MouseButton1 then
    if BUILD_MODE and ghostBlock.Parent then
      placeRemote:FireServer(BLOCKS[selectedBlockIndex].Id, ghostBlock.Position)
    elseif BREAK_MODE and selectionBox.Adornee then
      local target = selectionBox.Adornee
      if target:GetAttribute("BlockType") then
        breakRemote:FireServer(target)
      end
    end
  end
end)

-- Mouse scroll to cycle through blocks
UserInputService.InputChanged:Connect(function(input)
  if input.UserInputType == Enum.UserInputType.MouseWheel then
    local dir = input.Position.Z > 0 and -1 or 1
    selectedBlockIndex = ((selectedBlockIndex - 1 + dir) % #BLOCKS) + 1
    updateHotbar()
    updateModeLabel()
  end
end)

-- ══════════════════════════════════════════════════════════════════
-- RENDER LOOP
-- ══════════════════════════════════════════════════════════════════
RunService.RenderStepped:Connect(function()
  local ray = camera:ScreenPointToRay(mouse.X, mouse.Y)
  local params = RaycastParams.new()
  params.FilterType = Enum.RaycastFilterType.Exclude
  params.FilterDescendantsInstances = { ghostBlock, player.Character }

  local result = workspace:Raycast(ray.Origin, ray.Direction * 200, params)

  if BUILD_MODE then
    selectionBox.Adornee = nil
    if result then
      local placePos = getAdjacentPosition(result.Position, result.Normal)
      ghostBlock.Position = placePos
      ghostBlock.Parent = workspace
    else
      ghostBlock.Parent = nil
    end
  elseif BREAK_MODE then
    ghostBlock.Parent = nil
    if result and result.Instance and result.Instance:GetAttribute("BlockType") then
      selectionBox.Adornee = result.Instance
    else
      selectionBox.Adornee = nil
    end
  else
    ghostBlock.Parent = nil
    selectionBox.Adornee = nil
  end
end)

-- Initial state
updateHotbar()
updateModeLabel()
print("[AppleJuice] BlockBuilding client loaded — B=Build, X=Break, Tab=Palette, Scroll=Cycle, 1-9=Hotbar")`,
};
