import type { SystemTemplate } from "./index";

export const WEATHER_SYSTEM: SystemTemplate = {
  name: "Dynamic Weather & Day/Night Cycle",
  category: "Environment",
  description: "Procedural weather transitions (rain, fog, storm, snow), day/night cycle with Lighting control.",
  keywords: ["weather", "rain", "snow", "storm", "fog", "day", "night", "cycle", "time", "sky", "atmosphere"],
  serverCode: `--[[
  Weather System — Server ModuleScript
  Place in: ServerScriptService.Systems.WeatherSystem
  README: Config.DayCycleDuration sets full day length. Config.WeatherTypes defines
          weather presets with Lighting/Atmosphere properties.
          Weather changes randomly or can be triggered via TriggerWeather().
]]
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local WeatherSystem = {}
WeatherSystem.__index = WeatherSystem

local Config = {
  DayCycleDuration = 720,
  WeatherChangeInterval = {120, 300},
  TransitionTime = 5,
  WeatherTypes = {
    Clear = {
      Atmosphere = { Density = 0.3, Offset = 0, Color = Color3.fromRGB(199, 207, 213), Decay = Color3.fromRGB(92, 100, 106), Glare = 0, Haze = 0 },
      Brightness = 2, Ambient = Color3.fromRGB(140, 140, 140),
    },
    Cloudy = {
      Atmosphere = { Density = 0.5, Offset = 0.2, Color = Color3.fromRGB(150, 155, 160), Decay = Color3.fromRGB(70, 70, 80), Glare = 0, Haze = 2 },
      Brightness = 1.5, Ambient = Color3.fromRGB(100, 100, 110),
    },
    Rain = {
      Atmosphere = { Density = 0.6, Offset = 0.3, Color = Color3.fromRGB(120, 130, 140), Decay = Color3.fromRGB(50, 55, 65), Glare = 0, Haze = 5 },
      Brightness = 1, Ambient = Color3.fromRGB(80, 80, 90),
      ParticleEffect = "RainEmitter",
    },
    Storm = {
      Atmosphere = { Density = 0.8, Offset = 0.5, Color = Color3.fromRGB(80, 85, 100), Decay = Color3.fromRGB(30, 30, 40), Glare = 0, Haze = 8 },
      Brightness = 0.5, Ambient = Color3.fromRGB(50, 50, 60),
      ParticleEffect = "StormEmitter", Lightning = true,
    },
    Snow = {
      Atmosphere = { Density = 0.4, Offset = 0.1, Color = Color3.fromRGB(220, 225, 235), Decay = Color3.fromRGB(180, 185, 195), Glare = 0.5, Haze = 3 },
      Brightness = 2, Ambient = Color3.fromRGB(180, 185, 200),
      ParticleEffect = "SnowEmitter",
    },
    Fog = {
      Atmosphere = { Density = 0.95, Offset = 0, Color = Color3.fromRGB(200, 200, 200), Decay = Color3.fromRGB(150, 150, 150), Glare = 0, Haze = 10 },
      Brightness = 1.2, Ambient = Color3.fromRGB(120, 120, 120),
    },
  },
}

local currentWeather = "Clear"

function WeatherSystem.new() return setmetatable({}, WeatherSystem) end

function WeatherSystem:TransitionTo(weatherName)
  local preset = Config.WeatherTypes[weatherName]
  if not preset then return end
  currentWeather = weatherName
  local atmo = Lighting:FindFirstChildOfClass("Atmosphere")
  if atmo and preset.Atmosphere then
    TweenService:Create(atmo, TweenInfo.new(Config.TransitionTime), preset.Atmosphere):Play()
  end
  TweenService:Create(Lighting, TweenInfo.new(Config.TransitionTime), {
    Brightness = preset.Brightness,
    Ambient = preset.Ambient,
  }):Play()
  local remote = ReplicatedStorage:FindFirstChild("WeatherSync")
  if remote then remote:FireAllClients(weatherName, preset) end
end

function WeatherSystem:TriggerWeather(weatherName)
  self:TransitionTo(weatherName)
end

function WeatherSystem:RandomWeather()
  local names = {}
  for name in pairs(Config.WeatherTypes) do table.insert(names, name) end
  local pick = names[math.random(#names)]
  self:TransitionTo(pick)
end

function WeatherSystem:StartDayCycle()
  task.spawn(function()
    while true do
      for t = 0, Config.DayCycleDuration, 0.5 do
        local timeOfDay = (t / Config.DayCycleDuration) * 24
        Lighting.ClockTime = timeOfDay
        task.wait(0.5)
      end
    end
  end)
end

function WeatherSystem:Init()
  local remote = Instance.new("RemoteEvent")
  remote.Name = "WeatherSync"
  remote.Parent = ReplicatedStorage
  if not Lighting:FindFirstChildOfClass("Atmosphere") then
    Instance.new("Atmosphere", Lighting)
  end
  self:StartDayCycle()
  task.spawn(function()
    while true do
      local interval = math.random(Config.WeatherChangeInterval[1], Config.WeatherChangeInterval[2])
      task.wait(interval)
      self:RandomWeather()
    end
  end)
end

return WeatherSystem`,
  clientCode: `--[[ Weather Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local remote = ReplicatedStorage:WaitForChild("WeatherSync")
local player = Players.LocalPlayer
local screen = UI.createScreenGui("WeatherGui")

-- Weather indicator (top right)
local weatherLabel = UI.Text(screen, {
  Text = "☀️ Clear", Bold = true, TextSize = 14,
  Size = UDim2.new(0, 140, 0, 28),
  Position = UDim2.new(1, -155, 0, 15),
})

local WeatherIcons = {
  Clear = "☀️", Cloudy = "☁️", Rain = "🌧️",
  Storm = "⛈️", Snow = "❄️", Fog = "🌫️",
}

-- Rain/snow particle attachment
local rainEmitter = nil
local function createRainEmitter()
  local cam = workspace.CurrentCamera
  local attachment = Instance.new("Attachment")
  attachment.Parent = cam
  local emitter = Instance.new("ParticleEmitter")
  emitter.Rate = 200
  emitter.Lifetime = NumberRange.new(1, 2)
  emitter.Speed = NumberRange.new(40, 60)
  emitter.SpreadAngle = Vector2.new(10, 10)
  emitter.Size = NumberSequence.new(0.05)
  emitter.Color = ColorSequence.new(Color3.fromRGB(180, 200, 220))
  emitter.Transparency = NumberSequence.new(0.3)
  emitter.Enabled = false
  emitter.Parent = attachment
  return emitter
end

remote.OnClientEvent:Connect(function(weatherName, preset)
  local icon = WeatherIcons[weatherName] or "🌍"
  weatherLabel.Text = icon .. " " .. weatherName

  -- Handle particle effects
  if not rainEmitter then rainEmitter = createRainEmitter() end
  if weatherName == "Rain" then
    rainEmitter.Rate = 200
    rainEmitter.Speed = NumberRange.new(40, 60)
    rainEmitter.Size = NumberSequence.new(0.05)
    rainEmitter.Color = ColorSequence.new(Color3.fromRGB(150, 180, 220))
    rainEmitter.Enabled = true
  elseif weatherName == "Snow" then
    rainEmitter.Rate = 100
    rainEmitter.Speed = NumberRange.new(5, 15)
    rainEmitter.Size = NumberSequence.new(0.15)
    rainEmitter.Color = ColorSequence.new(Color3.fromRGB(240, 245, 255))
    rainEmitter.Enabled = true
  elseif weatherName == "Storm" then
    rainEmitter.Rate = 400
    rainEmitter.Speed = NumberRange.new(60, 80)
    rainEmitter.Size = NumberSequence.new(0.06)
    rainEmitter.Color = ColorSequence.new(Color3.fromRGB(100, 110, 130))
    rainEmitter.Enabled = true
  else
    rainEmitter.Enabled = false
  end
end)`,
};
