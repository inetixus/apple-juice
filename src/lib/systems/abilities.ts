import type { SystemTemplate } from "./index";

export const ABILITIES_SYSTEM: SystemTemplate = {
  name: "Abilities & Skill Tree",
  category: "RPG",
  description: "Cooldown-based abilities with skill trees, mana costs, level requirements, and VFX triggers.",
  keywords: ["ability", "skill", "spell", "power", "magic", "cooldown", "mana", "class", "talent", "ultimate"],
  serverCode: `--[[
  Abilities System — Server ModuleScript
  Place in: ServerScriptService.Systems.AbilitiesSystem
  README: Config.Abilities defines each ability with cooldown, mana cost, damage, and effects.
          Config.SkillTree defines unlock paths. Players spend skill points to unlock abilities.
          VFX events are fired to clients via RemoteEvent for visual feedback.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local AbilitiesSystem = {}
AbilitiesSystem.__index = AbilitiesSystem

local Config = {
  MaxMana = 100,
  ManaRegenRate = 2,
  ManaRegenInterval = 1,
  Abilities = {
    Fireball = {
      Cooldown = 3, ManaCost = 20, Damage = 35, Range = 50,
      Type = "projectile", Level = 1, VFX = "FireballVFX",
      Description = "Launch a fireball that explodes on impact",
    },
    HealingAura = {
      Cooldown = 10, ManaCost = 30, HealAmount = 50, Radius = 20,
      Type = "aoe_heal", Level = 3, VFX = "HealAuraVFX",
      Description = "Heal yourself and nearby allies",
    },
    Dash = {
      Cooldown = 5, ManaCost = 15, Distance = 30, IFrames = 0.5,
      Type = "movement", Level = 1, VFX = "DashVFX",
      Description = "Dash forward quickly with brief invulnerability",
    },
    ThunderStrike = {
      Cooldown = 15, ManaCost = 50, Damage = 80, Radius = 15,
      Type = "aoe_damage", Level = 5, VFX = "ThunderVFX",
      Description = "Call down lightning in an area",
    },
    Shield = {
      Cooldown = 20, ManaCost = 40, Duration = 5, DamageReduction = 0.8,
      Type = "buff", Level = 4, VFX = "ShieldVFX",
      Description = "Absorb 80% of incoming damage for 5 seconds",
    },
    Teleport = {
      Cooldown = 8, ManaCost = 25, Range = 60,
      Type = "blink", Level = 6, VFX = "TeleportVFX",
      Description = "Teleport to where you're looking",
    },
  },
  SkillTree = {
    { Tier = 1, Abilities = {"Fireball", "Dash"}, PointCost = 1 },
    { Tier = 2, Abilities = {"HealingAura"}, PointCost = 2, Requires = {"Fireball"} },
    { Tier = 3, Abilities = {"Shield"}, PointCost = 2, Requires = {"HealingAura"} },
    { Tier = 4, Abilities = {"ThunderStrike"}, PointCost = 3, Requires = {"Fireball", "Dash"} },
    { Tier = 5, Abilities = {"Teleport"}, PointCost = 3, Requires = {"Dash"} },
  },
}

local playerState = {}

function AbilitiesSystem.new() return setmetatable({}, AbilitiesSystem) end

function AbilitiesSystem:GetState(player)
  if not playerState[player] then
    playerState[player] = {
      mana = Config.MaxMana, maxMana = Config.MaxMana,
      cooldowns = {}, unlocked = {}, skillPoints = 3,
      buffs = {},
    }
  end
  return playerState[player]
end

function AbilitiesSystem:CanUseAbility(player, abilityName)
  local state = self:GetState(player)
  local ability = Config.Abilities[abilityName]
  if not ability then return false, "Unknown ability" end
  if not state.unlocked[abilityName] then return false, "Not unlocked" end
  if state.mana < ability.ManaCost then return false, "Not enough mana" end
  local cd = state.cooldowns[abilityName]
  if cd and os.clock() - cd < ability.Cooldown then return false, "On cooldown" end
  return true
end

function AbilitiesSystem:UseAbility(player, abilityName)
  local ok, reason = self:CanUseAbility(player, abilityName)
  if not ok then return false, reason end
  local state = self:GetState(player)
  local ability = Config.Abilities[abilityName]
  state.mana -= ability.ManaCost
  state.cooldowns[abilityName] = os.clock()
  -- Execute ability effect based on type
  local char = player.Character
  if not char then return false end
  local hrp = char:FindFirstChild("HumanoidRootPart")
  if not hrp then return false end

  if ability.Type == "projectile" then
    -- Create projectile moving forward
  elseif ability.Type == "aoe_damage" then
    -- Damage all enemies in radius
  elseif ability.Type == "aoe_heal" then
    local hum = char:FindFirstChildOfClass("Humanoid")
    if hum then hum.Health = math.min(hum.Health + ability.HealAmount, hum.MaxHealth) end
  elseif ability.Type == "movement" then
    hrp.CFrame = hrp.CFrame + hrp.CFrame.LookVector * ability.Distance
  elseif ability.Type == "buff" then
    state.buffs[abilityName] = { until_time = os.clock() + ability.Duration, effect = ability }
  elseif ability.Type == "blink" then
    -- Raycast to target and teleport
  end

  -- Fire VFX to all clients
  local vfxRemote = ReplicatedStorage:FindFirstChild("AbilityVFX")
  if vfxRemote then vfxRemote:FireAllClients(player, abilityName, ability.VFX, hrp.Position) end
  return true
end

function AbilitiesSystem:UnlockAbility(player, abilityName)
  local state = self:GetState(player)
  if state.unlocked[abilityName] then return false end
  for _, tier in ipairs(Config.SkillTree) do
    for _, name in ipairs(tier.Abilities) do
      if name == abilityName then
        if state.skillPoints < tier.PointCost then return false end
        if tier.Requires then
          for _, req in ipairs(tier.Requires) do
            if not state.unlocked[req] then return false end
          end
        end
        state.skillPoints -= tier.PointCost
        state.unlocked[abilityName] = true
        return true
      end
    end
  end
  return false
end

function AbilitiesSystem:Init()
  local remote = Instance.new("RemoteEvent")
  remote.Name = "AbilityAction"
  remote.Parent = ReplicatedStorage
  local vfxRemote = Instance.new("RemoteEvent")
  vfxRemote.Name = "AbilityVFX"
  vfxRemote.Parent = ReplicatedStorage

  remote.OnServerEvent:Connect(function(player, action, abilityName)
    if action == "use" then self:UseAbility(player, abilityName)
    elseif action == "unlock" then self:UnlockAbility(player, abilityName)
    end
  end)

  Players.PlayerAdded:Connect(function(p) self:GetState(p) end)
  Players.PlayerRemoving:Connect(function(p) playerState[p] = nil end)

  -- Mana regen loop
  task.spawn(function()
    while true do
      task.wait(Config.ManaRegenInterval)
      for _, p in ipairs(Players:GetPlayers()) do
        local state = playerState[p]
        if state then state.mana = math.min(state.mana + Config.ManaRegenRate, state.maxMana) end
      end
    end
  end)
end

return AbilitiesSystem`,
  clientCode: `--[[ Abilities Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local remote = ReplicatedStorage:WaitForChild("AbilityAction")
local vfxRemote = ReplicatedStorage:WaitForChild("AbilityVFX")
local screen = UI.createScreenGui("AbilityBar")

-- Ability hotbar (bottom center)
local hotbar = Instance.new("Frame")
hotbar.Size = UDim2.new(0, 330, 0, 60)
hotbar.Position = UDim2.new(0.5, -165, 1, -75)
hotbar.BackgroundTransparency = 1
hotbar.Parent = screen

local abilitySlots = {"Fireball", "Dash", "HealingAura", "Shield", "ThunderStrike", "Teleport"}
local hotkeys = {Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three, Enum.KeyCode.Four, Enum.KeyCode.Five, Enum.KeyCode.Six}
local slotFrames = {}

for i, abilityName in ipairs(abilitySlots) do
  local slot = Instance.new("Frame")
  slot.Size = UDim2.new(0, 50, 0, 50)
  slot.Position = UDim2.new(0, (i - 1) * 55, 0, 0)
  slot.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
  slot.BorderSizePixel = 0
  slot.Parent = hotbar
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 8)
  corner.Parent = slot
  local stroke = Instance.new("UIStroke")
  stroke.Color = Color3.fromRGB(80, 80, 100)
  stroke.Thickness = 1.5
  stroke.Parent = slot
  -- Ability name
  local label = Instance.new("TextLabel")
  label.Text = abilityName:sub(1, 4)
  label.Size = UDim2.new(1, 0, 0.6, 0)
  label.Position = UDim2.new(0, 0, 0, 2)
  label.BackgroundTransparency = 1
  label.TextColor3 = Color3.new(1, 1, 1)
  label.Font = Enum.Font.GothamBold
  label.TextSize = 10
  label.Parent = slot
  -- Hotkey label
  local hkLabel = Instance.new("TextLabel")
  hkLabel.Text = tostring(i)
  hkLabel.Size = UDim2.new(0, 16, 0, 14)
  hkLabel.Position = UDim2.new(0, 2, 1, -16)
  hkLabel.BackgroundTransparency = 1
  hkLabel.TextColor3 = Color3.fromRGB(150, 150, 150)
  hkLabel.Font = Enum.Font.GothamBold
  hkLabel.TextSize = 9
  hkLabel.Parent = slot
  -- Cooldown overlay
  local cdOverlay = Instance.new("Frame")
  cdOverlay.Size = UDim2.new(1, 0, 0, 0)
  cdOverlay.Position = UDim2.new(0, 0, 1, 0)
  cdOverlay.AnchorPoint = Vector2.new(0, 1)
  cdOverlay.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
  cdOverlay.BackgroundTransparency = 0.4
  cdOverlay.ZIndex = 2
  cdOverlay.Parent = slot
  local cdCorner = Instance.new("UICorner")
  cdCorner.CornerRadius = UDim.new(0, 8)
  cdCorner.Parent = cdOverlay

  slotFrames[i] = { frame = slot, overlay = cdOverlay, stroke = stroke }
end

-- Mana bar
local manaBar = UI.ProgressBar(screen, {
  Size = UDim2.new(0, 200, 0, 16),
  Position = UDim2.new(0.5, -100, 1, -90),
  Value = 1, Label = "100/100 MP",
  FillColor = Color3.fromRGB(80, 120, 255),
})

-- Input handler
UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  for i, key in ipairs(hotkeys) do
    if input.KeyCode == key then
      remote:FireServer("use", abilitySlots[i])
      -- Animate cooldown
      local slot = slotFrames[i]
      slot.overlay.Size = UDim2.new(1, 0, 1, 0)
      TweenService:Create(slot.overlay, TweenInfo.new(2), { Size = UDim2.new(1, 0, 0, 0) }):Play()
      break
    end
  end
end)

-- VFX handler
vfxRemote.OnClientEvent:Connect(function(sourcePlayer, abilityName, vfxId, position)
  -- Spawn VFX at position (particles, beams, etc.)
end)`,
};
