import type { SystemTemplate } from "./index";

export const PLACEMENT_SYSTEM: SystemTemplate = {
  name: "Grid-Based Placement & Building",
  category: "Building",
  description: "Bloxburg-style placement with grid snapping, rotation, collision detection, and save/load plots.",
  keywords: ["place", "build", "grid", "snap", "rotate", "placement", "plot", "house", "furniture", "building"],
  serverCode: `--[[
  Placement System — Shared ModuleScript
  Place in: ReplicatedStorage.Systems.PlacementSystem
  README: Config.GridSize controls snap resolution. Config.RotationStep sets rotation increment.
          Items are defined in Config.PlaceableItems with model references.
          Save/Load uses DataStore to persist player plot layouts.
]]
local PlacementSystem = {}
PlacementSystem.__index = PlacementSystem

local Config = {
  GridSize = 4,
  RotationStep = 90,
  MaxItemsPerPlot = 200,
  PlotSize = Vector3.new(100, 1, 100),
  PreviewTransparency = 0.5,
  PreviewColor = Color3.fromRGB(100, 255, 100),
  InvalidColor = Color3.fromRGB(255, 80, 80),
  PlaceableItems = {
    { Id = "wooden_wall", Name = "Wooden Wall", Category = "Walls", ModelName = "WoodenWall", Price = 50 },
    { Id = "stone_floor", Name = "Stone Floor", Category = "Floors", ModelName = "StoneFloor", Price = 30 },
    { Id = "table",       Name = "Table",       Category = "Furniture", ModelName = "Table", Price = 75 },
    { Id = "chair",       Name = "Chair",       Category = "Furniture", ModelName = "Chair", Price = 40 },
    { Id = "lamp",        Name = "Lamp",        Category = "Decor", ModelName = "Lamp", Price = 60 },
  },
}

function PlacementSystem.new()
  return setmetatable({ _placing = false, _rotation = 0, _preview = nil }, PlacementSystem)
end

function PlacementSystem:SnapToGrid(position)
  local g = Config.GridSize
  return Vector3.new(
    math.round(position.X / g) * g,
    math.round(position.Y / g) * g,
    math.round(position.Z / g) * g
  )
end

function PlacementSystem:Rotate()
  self._rotation = (self._rotation + Config.RotationStep) % 360
end

function PlacementSystem:CheckCollision(cframe, size, plotFolder)
  local params = OverlapParams.new()
  params.FilterType = Enum.RaycastFilterType.Include
  if plotFolder then params:AddToFilter(plotFolder) end
  local parts = workspace:GetPartBoundsInBox(cframe, size, params)
  return #parts > 0
end

function PlacementSystem:IsInsidePlot(position, plotCenter, plotSize)
  local half = plotSize / 2
  local rel = position - plotCenter
  return math.abs(rel.X) <= half.X and math.abs(rel.Z) <= half.Z
end

function PlacementSystem:PlaceItem(itemId, cframe, plotFolder)
  local item = nil
  for _, i in ipairs(Config.PlaceableItems) do
    if i.Id == itemId then item = i; break end
  end
  if not item then return nil end
  -- Clone model from ServerStorage
  local model = game:GetService("ServerStorage"):FindFirstChild("Placeables")
    and game:GetService("ServerStorage").Placeables:FindFirstChild(item.ModelName)
  if not model then return nil end
  local clone = model:Clone()
  clone:PivotTo(cframe * CFrame.Angles(0, math.rad(self._rotation), 0))
  clone.Parent = plotFolder
  return clone
end

function PlacementSystem:SerializePlot(plotFolder)
  local data = {}
  for _, child in ipairs(plotFolder:GetChildren()) do
    if child:IsA("Model") then
      local cf = child:GetPivot()
      table.insert(data, {
        name = child.Name,
        x = cf.X, y = cf.Y, z = cf.Z,
        rx = select(1, cf:ToEulerAnglesYXZ()),
        ry = select(2, cf:ToEulerAnglesYXZ()),
        rz = select(3, cf:ToEulerAnglesYXZ()),
      })
    end
  end
  return data
end

return PlacementSystem`,
  clientCode: `--[[ Placement Client — LocalScript in StarterPlayerScripts ]]
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local player = Players.LocalPlayer
local mouse = player:GetMouse()
local camera = workspace.CurrentCamera
local screen = UI.createScreenGui("BuildModeGui")

local Config = { GridSize = 4, RotationStep = 90 }
local buildMode = false
local rotation = 0
local previewModel = nil
local selectedItem = "wooden_wall"

local function snapToGrid(pos)
  local g = Config.GridSize
  return Vector3.new(math.round(pos.X / g) * g, math.round(pos.Y / g) * g, math.round(pos.Z / g) * g)
end

-- Build mode toggle button
local toggleBtn = UI.Button(screen, {
  Text = "🔨 Build Mode", Style = "Primary",
  Size = UDim2.new(0, 140, 0, 36),
  Position = UDim2.new(0, 20, 1, -60),
  OnClick = function()
    buildMode = not buildMode
    if not buildMode and previewModel then previewModel:Destroy(); previewModel = nil end
  end,
})

-- Rotation: R key
UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe or not buildMode then return end
  if input.KeyCode == Enum.KeyCode.R then
    rotation = (rotation + Config.RotationStep) % 360
  end
  if input.UserInputType == Enum.UserInputType.MouseButton1 then
    -- Place item
    if previewModel then
      local remote = ReplicatedStorage:FindFirstChild("PlaceItem")
      if remote then remote:FireServer(selectedItem, previewModel:GetPivot(), rotation) end
    end
  end
end)

-- Preview follows mouse
RunService.RenderStepped:Connect(function()
  if not buildMode then return end
  local ray = camera:ScreenPointToRay(mouse.X, mouse.Y)
  local result = workspace:Raycast(ray.Origin, ray.Direction * 500)
  if result then
    local snapped = snapToGrid(result.Position)
    if not previewModel then
      previewModel = Instance.new("Part")
      previewModel.Size = Vector3.new(4, 4, 4)
      previewModel.Anchored = true
      previewModel.CanCollide = false
      previewModel.Transparency = 0.5
      previewModel.Color = Color3.fromRGB(100, 255, 100)
      previewModel.Parent = workspace
    end
    previewModel.CFrame = CFrame.new(snapped) * CFrame.Angles(0, math.rad(rotation), 0)
  end
end)`,
};
