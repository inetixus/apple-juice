import type { SystemTemplate } from "./index";

export const VEHICLE_SYSTEM: SystemTemplate = {
  name: "Vehicle System",
  category: "Vehicles",
  description: "Physics-based driving with chassis customization, speed tiers, and fuel management.",
  keywords: ["vehicle", "car", "drive", "speed", "racing", "boat", "fly", "mount", "ride"],
  serverCode: `--[[
  Vehicle System — Server ModuleScript
  Place in: ServerScriptService.Systems.VehicleSystem
  README: Config.Vehicles defines stats per vehicle. Uses VehicleSeat + BodyThrust/BodyGyro.
          Supports fuel consumption, speed tiers, and customization (color, wheels).
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local VehicleSystem = {}
VehicleSystem.__index = VehicleSystem

local Config = {
  Vehicles = {
    Sedan    = { MaxSpeed = 80,  Accel = 20, TurnSpeed = 2.5, Fuel = 100, FuelRate = 0.5 },
    SportsCar = { MaxSpeed = 140, Accel = 35, TurnSpeed = 2.0, Fuel = 80,  FuelRate = 1.0 },
    Truck    = { MaxSpeed = 60,  Accel = 15, TurnSpeed = 1.5, Fuel = 200, FuelRate = 0.8 },
    Boat     = { MaxSpeed = 50,  Accel = 12, TurnSpeed = 1.8, Fuel = 150, FuelRate = 0.6 },
  },
  RefuelCost = 50,
  SpawnPadTag = "VehicleSpawn",
}

local activeVehicles = {}

function VehicleSystem.new()
  return setmetatable({}, VehicleSystem)
end

function VehicleSystem:SpawnVehicle(player, vehicleName)
  local vConfig = Config.Vehicles[vehicleName]
  if not vConfig then return nil end
  if activeVehicles[player] then self:DespawnVehicle(player) end

  local template = game:GetService("ServerStorage"):FindFirstChild("Vehicles")
    and game:GetService("ServerStorage").Vehicles:FindFirstChild(vehicleName)
  if not template then return nil end

  local model = template:Clone()
  local seat = model:FindFirstChildOfClass("VehicleSeat")
  if seat then
    seat.MaxSpeed = vConfig.MaxSpeed
    seat.Torque = vConfig.Accel * 100
    seat.TurnSpeed = vConfig.TurnSpeed
  end
  model.Parent = workspace
  activeVehicles[player] = { model = model, fuel = vConfig.Fuel, config = vConfig }

  -- Fuel consumption loop
  task.spawn(function()
    while activeVehicles[player] and activeVehicles[player].model.Parent do
      local data = activeVehicles[player]
      if seat and seat.Occupant then
        data.fuel = math.max(0, data.fuel - vConfig.FuelRate)
        if data.fuel <= 0 then seat.MaxSpeed = 0 end
      end
      task.wait(1)
    end
  end)

  return model
end

function VehicleSystem:DespawnVehicle(player)
  local data = activeVehicles[player]
  if data and data.model then data.model:Destroy() end
  activeVehicles[player] = nil
end

function VehicleSystem:Refuel(player)
  local data = activeVehicles[player]
  if not data then return false end
  data.fuel = data.config.Fuel
  local seat = data.model:FindFirstChildOfClass("VehicleSeat")
  if seat then seat.MaxSpeed = data.config.MaxSpeed end
  return true
end

function VehicleSystem:Init()
  local remote = Instance.new("RemoteEvent")
  remote.Name = "VehicleAction"
  remote.Parent = ReplicatedStorage
  remote.OnServerEvent:Connect(function(player, action, vehicleName)
    if action == "spawn" then self:SpawnVehicle(player, vehicleName)
    elseif action == "despawn" then self:DespawnVehicle(player)
    elseif action == "refuel" then self:Refuel(player)
    end
  end)
  Players.PlayerRemoving:Connect(function(p) self:DespawnVehicle(p) end)
end

return VehicleSystem`,
  clientCode: `--[[ Vehicle Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local player = Players.LocalPlayer
local remote = ReplicatedStorage:WaitForChild("VehicleAction")
local screen = UI.createScreenGui("VehicleGui")

-- Spawn menu (V key toggle)
local spawnPanel = UI.Card(screen, {
  Size = UDim2.new(0, 300, 0, 200),
  Position = UDim2.new(0.5, -150, 0.5, -100),
})
spawnPanel.Visible = false

UI.Text(spawnPanel, {
  Text = "🚗 Vehicle Garage", Bold = true, TextSize = 20,
  Size = UDim2.new(1, 0, 0, 35), Position = UDim2.new(0, 0, 0, 5),
  Align = Enum.TextXAlignment.Center,
})

local vehicles = {"Sedan", "SportsCar", "Truck", "Boat"}
for i, name in ipairs(vehicles) do
  UI.Button(spawnPanel, {
    Text = name, Style = "Secondary",
    Size = UDim2.new(0.9, 0, 0, 30),
    Position = UDim2.new(0.05, 0, 0, 35 + (i - 1) * 36),
    OnClick = function()
      remote:FireServer("spawn", name)
      spawnPanel.Visible = false
    end,
  })
end

-- Speedometer HUD
local speedLabel = UI.Text(screen, {
  Text = "0 mph", Bold = true, TextSize = 28,
  Size = UDim2.new(0, 150, 0, 40),
  Position = UDim2.new(1, -170, 1, -60),
})
speedLabel.Visible = false

RunService.Heartbeat:Connect(function()
  local char = player.Character
  local hrp = char and char:FindFirstChild("HumanoidRootPart")
  local seat = char and char:FindFirstChildOfClass("Humanoid") and char.Humanoid.SeatPart
  if seat and seat:IsA("VehicleSeat") then
    local speed = math.floor(seat.Velocity.Magnitude)
    speedLabel.Text = speed .. " mph"
    speedLabel.Visible = true
  else
    speedLabel.Visible = false
  end
end)

UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.KeyCode == Enum.KeyCode.V then spawnPanel.Visible = not spawnPanel.Visible end
end)`,
};
