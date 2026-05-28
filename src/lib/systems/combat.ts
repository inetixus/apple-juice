import type { SystemTemplate } from "./index";

export const COMBAT_SYSTEM: SystemTemplate = {
  name: "Weapon & Combat Framework",
  category: "Combat",
  description: "Hitbox detection, cooldowns, combo chains, VFX modules, and damage calculation with armor.",
  keywords: ["combat", "weapon", "sword", "fight", "attack", "damage", "hitbox", "pvp", "health", "armor", "kill"],
  serverCode: `--[[
  Combat System — Server ModuleScript
  Place in: ServerScriptService.Systems.CombatSystem
  README: Config.Weapons defines base damage, cooldowns, range, and combo chains.
          Hitbox uses spatial queries (GetPartBoundsInBox) for server-authoritative detection.
          Config.ArmorSlots defines damage reduction. DamageFormula is fully configurable.
]]
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local CombatSystem = {}
CombatSystem.__index = CombatSystem

local Config = {
  Weapons = {
    WoodenSword  = { Damage = 10, Cooldown = 0.8, Range = 6, ComboMax = 3, ComboMultiplier = 1.3 },
    IronSword    = { Damage = 18, Cooldown = 0.6, Range = 7, ComboMax = 4, ComboMultiplier = 1.4 },
    FireStaff    = { Damage = 25, Cooldown = 1.2, Range = 30, ComboMax = 2, ComboMultiplier = 1.2, Projectile = true },
    Dagger       = { Damage = 8,  Cooldown = 0.3, Range = 4, ComboMax = 6, ComboMultiplier = 1.5 },
  },
  ArmorSlots = {
    Helmet  = { DamageReduction = 0.05 },
    Chest   = { DamageReduction = 0.15 },
    Legs    = { DamageReduction = 0.10 },
    Boots   = { DamageReduction = 0.05 },
  },
  ComboResetTime = 1.5,
  IFrameDuration = 0.3,
  KnockbackForce = 30,
  CritChance = 0.1,
  CritMultiplier = 2.0,
}

local playerState = {}

function CombatSystem.new()
  return setmetatable({}, CombatSystem)
end

function CombatSystem:GetPlayerState(player)
  if not playerState[player] then
    playerState[player] = {
      weapon = nil, combo = 0, lastAttack = 0,
      lastHit = 0, armor = {}, health = 100, maxHealth = 100,
    }
  end
  return playerState[player]
end

function CombatSystem:CalculateDamage(attacker, defender, weaponConfig)
  local state = self:GetPlayerState(attacker)
  local defState = self:GetPlayerState(defender)
  local baseDmg = weaponConfig.Damage

  -- Combo multiplier
  local elapsed = os.clock() - state.lastAttack
  if elapsed < Config.ComboResetTime and state.combo < weaponConfig.ComboMax then
    state.combo += 1
  else
    state.combo = 1
  end
  local comboMult = 1 + (state.combo - 1) * (weaponConfig.ComboMultiplier - 1) / weaponConfig.ComboMax
  baseDmg *= comboMult

  -- Crit check
  local isCrit = math.random() < Config.CritChance
  if isCrit then baseDmg *= Config.CritMultiplier end

  -- Armor reduction
  local totalReduction = 0
  for slot, info in pairs(Config.ArmorSlots) do
    if defState.armor[slot] then totalReduction += info.DamageReduction end
  end
  baseDmg *= (1 - totalReduction)

  state.lastAttack = os.clock()
  return math.floor(baseDmg), isCrit, state.combo
end

function CombatSystem:PerformAttack(attacker, weaponName)
  local weapon = Config.Weapons[weaponName]
  if not weapon then return end
  local state = self:GetPlayerState(attacker)
  if os.clock() - state.lastAttack < weapon.Cooldown then return end

  local char = attacker.Character
  if not char then return end
  local hrp = char:FindFirstChild("HumanoidRootPart")
  if not hrp then return end

  -- Server-authoritative hitbox
  local hitboxCF = hrp.CFrame * CFrame.new(0, 0, -weapon.Range / 2)
  local hitboxSize = Vector3.new(weapon.Range * 0.6, 5, weapon.Range)
  local params = OverlapParams.new()
  params.FilterType = Enum.RaycastFilterType.Exclude
  params:AddToFilter(char)

  local hits = workspace:GetPartBoundsInBox(hitboxCF, hitboxSize, params)
  local damaged = {}
  for _, part in ipairs(hits) do
    local hitChar = part.Parent
    local hum = hitChar and hitChar:FindFirstChildOfClass("Humanoid")
    local hitPlayer = hum and Players:GetPlayerFromCharacter(hitChar)
    if hitPlayer and not damaged[hitPlayer] then
      -- I-frame check
      local defState = self:GetPlayerState(hitPlayer)
      if os.clock() - defState.lastHit > Config.IFrameDuration then
        local dmg, crit, combo = self:CalculateDamage(attacker, hitPlayer, weapon)
        hum:TakeDamage(dmg)
        defState.lastHit = os.clock()
        damaged[hitPlayer] = true
        -- Knockback
        local dir = (hitChar.HumanoidRootPart.Position - hrp.Position).Unit
        hitChar.HumanoidRootPart.AssemblyLinearVelocity = dir * Config.KnockbackForce + Vector3.new(0, 15, 0)
        -- Notify clients for VFX
        ReplicatedStorage:FindFirstChild("CombatVFX"):FireAllClients("hit", hitChar.HumanoidRootPart.Position, dmg, crit)
      end
    end
  end
end

function CombatSystem:Init()
  local attackRemote = Instance.new("RemoteEvent")
  attackRemote.Name = "AttackRequest"
  attackRemote.Parent = ReplicatedStorage
  local vfxRemote = Instance.new("RemoteEvent")
  vfxRemote.Name = "CombatVFX"
  vfxRemote.Parent = ReplicatedStorage

  attackRemote.OnServerEvent:Connect(function(player, weaponName)
    if type(weaponName) ~= "string" then return end
    self:PerformAttack(player, weaponName)
  end)

  Players.PlayerAdded:Connect(function(p) self:GetPlayerState(p) end)
  Players.PlayerRemoving:Connect(function(p) playerState[p] = nil end)
end

return CombatSystem`,
  clientCode: `--[[ Combat Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local attackRemote = ReplicatedStorage:WaitForChild("AttackRequest")
local vfxRemote = ReplicatedStorage:WaitForChild("CombatVFX")

local equippedWeapon = "WoodenSword"
local lastAttackTime = 0
local cooldowns = { WoodenSword = 0.8, IronSword = 0.6, FireStaff = 1.2, Dagger = 0.3 }

-- Attack on click
UserInputService.InputBegan:Connect(function(input, gpe)
  if gpe then return end
  if input.UserInputType == Enum.UserInputType.MouseButton1 then
    local now = tick()
    local cd = cooldowns[equippedWeapon] or 0.5
    if now - lastAttackTime < cd then return end
    lastAttackTime = now
    attackRemote:FireServer(equippedWeapon)
    -- Play local swing animation
    local char = player.Character
    local hum = char and char:FindFirstChildOfClass("Humanoid")
    if hum then
      local anim = Instance.new("Animation")
      anim.AnimationId = "rbxassetid://0" -- Replace with actual swing animation
      local track = hum:FindFirstChildOfClass("Animator")
      if track then
        local at = track:LoadAnimation(anim)
        at:Play()
        at.Stopped:Wait()
        at:Destroy()
      end
      anim:Destroy()
    end
  end
end)

-- Hit VFX handler
vfxRemote.OnClientEvent:Connect(function(vfxType, position, damage, isCrit)
  if vfxType == "hit" then
    -- Floating damage number
    local billboard = Instance.new("BillboardGui")
    billboard.Size = UDim2.new(0, 100, 0, 40)
    billboard.StudsOffset = Vector3.new(0, 2, 0)
    billboard.AlwaysOnTop = true
    billboard.Adornee = nil

    local part = Instance.new("Part")
    part.Size = Vector3.new(0.1, 0.1, 0.1)
    part.Position = position + Vector3.new(0, 3, 0)
    part.Anchored = true
    part.CanCollide = false
    part.Transparency = 1
    part.Parent = workspace
    billboard.Adornee = part

    local label = Instance.new("TextLabel")
    label.Size = UDim2.new(1, 0, 1, 0)
    label.BackgroundTransparency = 1
    label.Text = (isCrit and "CRIT! " or "") .. tostring(damage)
    label.TextColor3 = isCrit and Color3.fromRGB(255, 50, 50) or Color3.fromRGB(255, 255, 100)
    label.Font = Enum.Font.GothamBold
    label.TextSize = isCrit and 28 or 20
    label.TextStrokeTransparency = 0.5
    label.Parent = billboard
    billboard.Parent = part

    -- Float up and fade
    TweenService:Create(part, TweenInfo.new(1.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
      Position = part.Position + Vector3.new(0, 4, 0),
    }):Play()
    TweenService:Create(label, TweenInfo.new(1.5), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
    task.delay(1.5, function() part:Destroy() end)
  end
end)`,
};
