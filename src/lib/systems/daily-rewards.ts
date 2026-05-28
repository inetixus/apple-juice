import type { SystemTemplate } from "./index";

export const DAILY_REWARDS_SYSTEM: SystemTemplate = {
  name: "Daily Rewards & Gacha",
  category: "Rewards",
  description: "Login streak rewards, daily spin wheel, and probability-based gacha rolling.",
  keywords: ["daily", "reward", "login", "streak", "spin", "gacha", "roll", "lucky", "chest", "loot", "crate"],
  serverCode: `--[[
  Daily Rewards & Gacha — Server ModuleScript
  Place in: ServerScriptService.Systems.DailyRewardsSystem
  README: Config.DailyRewards defines rewards per day in a streak (loops after max).
          Config.GachaTiers defines rarity pools with weights for probability rolling.
          Uses DataStore to track last login time and streak count.
]]
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local DailySystem = {}
DailySystem.__index = DailySystem

local Config = {
  DailyRewards = {
    { Day = 1, Type = "Gold", Amount = 100 },
    { Day = 2, Type = "Gold", Amount = 150 },
    { Day = 3, Type = "Gems", Amount = 5 },
    { Day = 4, Type = "Gold", Amount = 250 },
    { Day = 5, Type = "Gold", Amount = 300 },
    { Day = 6, Type = "Gems", Amount = 15 },
    { Day = 7, Type = "Crate", Id = "legendary_crate", Amount = 1 },
  },
  ResetHours = 24,
  GracePeriodHours = 48,
  GachaTiers = {
    StandardCrate = {
      { Rarity = "Common",    Weight = 50, Rewards = {"10 Gold","20 Gold","Wooden Sword"} },
      { Rarity = "Uncommon",  Weight = 30, Rewards = {"50 Gold","Iron Helmet","Speed Potion"} },
      { Rarity = "Rare",      Weight = 15, Rewards = {"200 Gold","Dragon Egg","10 Gems"} },
      { Rarity = "Legendary", Weight = 4,  Rewards = {"1000 Gold","Phoenix Pet","50 Gems"} },
      { Rarity = "Mythic",    Weight = 1,  Rewards = {"5000 Gold","Cosmic Sword","VIP Pass"} },
    },
  },
}

local dataStore = DataStoreService:GetDataStore("DailyRewards_v1")

function DailySystem.new()
  return setmetatable({}, DailySystem)
end

function DailySystem:CheckDailyReward(player)
  local key = "daily_" .. player.UserId
  local success, data = pcall(function() return dataStore:GetAsync(key) end)
  if not success then return nil end
  data = data or { lastClaim = 0, streak = 0 }
  local now = os.time()
  local elapsed = now - data.lastClaim
  local hours = elapsed / 3600
  if hours < Config.ResetHours then return { canClaim = false, streak = data.streak, nextIn = Config.ResetHours - hours } end
  if hours > Config.GracePeriodHours then data.streak = 0 end
  local day = (data.streak % #Config.DailyRewards) + 1
  return { canClaim = true, streak = data.streak, day = day, reward = Config.DailyRewards[day] }
end

function DailySystem:ClaimDaily(player)
  local check = self:CheckDailyReward(player)
  if not check or not check.canClaim then return nil end
  local key = "daily_" .. player.UserId
  local newData = { lastClaim = os.time(), streak = check.streak + 1 }
  pcall(function() dataStore:SetAsync(key, newData) end)
  return check.reward
end

function DailySystem:RollGacha(crateName)
  local tiers = Config.GachaTiers[crateName]
  if not tiers then return nil end
  local totalWeight = 0
  for _, t in ipairs(tiers) do totalWeight += t.Weight end
  local roll = math.random() * totalWeight
  local cumulative = 0
  for _, t in ipairs(tiers) do
    cumulative += t.Weight
    if roll <= cumulative then
      local reward = t.Rewards[math.random(#t.Rewards)]
      return { rarity = t.Rarity, reward = reward }
    end
  end
  return { rarity = "Common", reward = tiers[1].Rewards[1] }
end

function DailySystem:Init()
  local remote = Instance.new("RemoteFunction")
  remote.Name = "DailyRewards"
  remote.Parent = ReplicatedStorage
  remote.OnServerInvoke = function(player, action)
    if action == "check" then return self:CheckDailyReward(player)
    elseif action == "claim" then return self:ClaimDaily(player)
    elseif action == "roll" then return self:RollGacha("StandardCrate")
    end
  end
end

return DailySystem`,
  clientCode: `--[[ Daily Rewards Client — LocalScript in StarterPlayerScripts ]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice")

local player = Players.LocalPlayer
local remote = ReplicatedStorage:WaitForChild("DailyRewards")
local screen = UI.createScreenGui("DailyRewardGui")

-- Check on join
task.delay(2, function()
  local check = remote:InvokeServer("check")
  if not check then return end
  if check.canClaim then
    -- Show daily reward popup
    local panel = UI.Card(screen, {
      Size = UDim2.new(0, 420, 0, 320),
      Position = UDim2.new(0.5, -210, 0.5, -160),
    })
    UI.Text(panel, {
      Text = "🎁 Daily Reward!", Bold = true, TextSize = 26,
      Size = UDim2.new(1, 0, 0, 40), Position = UDim2.new(0, 0, 0, 10),
      Align = Enum.TextXAlignment.Center,
    })
    UI.Text(panel, {
      Text = "Day " .. check.day .. " — Streak: " .. check.streak,
      TextSize = 16,
      Size = UDim2.new(1, 0, 0, 25), Position = UDim2.new(0, 0, 0, 50),
      Align = Enum.TextXAlignment.Center,
    })
    local reward = check.reward
    UI.Text(panel, {
      Text = reward.Amount .. "x " .. reward.Type,
      Bold = true, TextSize = 32,
      Size = UDim2.new(1, 0, 0, 50), Position = UDim2.new(0, 0, 0, 100),
      Align = Enum.TextXAlignment.Center,
    })
    -- Day indicators
    for i = 1, 7 do
      local dot = Instance.new("Frame")
      dot.Size = UDim2.new(0, 36, 0, 36)
      dot.Position = UDim2.new(0, 25 + (i - 1) * 52, 0, 170)
      dot.BackgroundColor3 = i <= check.streak and Color3.fromRGB(80, 255, 120) or Color3.fromRGB(60, 60, 60)
      dot.Parent = panel
      local corner = Instance.new("UICorner")
      corner.CornerRadius = UDim.new(1, 0)
      corner.Parent = dot
      local dayLabel = Instance.new("TextLabel")
      dayLabel.Text = tostring(i)
      dayLabel.Size = UDim2.new(1, 0, 1, 0)
      dayLabel.BackgroundTransparency = 1
      dayLabel.TextColor3 = Color3.new(1, 1, 1)
      dayLabel.Font = Enum.Font.GothamBold
      dayLabel.TextSize = 14
      dayLabel.Parent = dot
    end
    UI.Button(panel, {
      Text = "Claim Reward!", Style = "Primary",
      Size = UDim2.new(0.8, 0, 0, 45),
      Position = UDim2.new(0.1, 0, 1, -60),
      OnClick = function()
        local result = remote:InvokeServer("claim")
        if result then
          UI.Toast(screen, { Text = "Claimed " .. result.Amount .. "x " .. result.Type .. "!", Type = "success" })
        end
        panel:Destroy()
      end,
    })
  end
end)`,
};
