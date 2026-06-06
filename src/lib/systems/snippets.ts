/**
 * Apple Juice Script Snippet Database
 * ===================================
 * A library of small, focused, production-ready Roblox scripts — the "everyday"
 * mechanics (kill bricks, teleporters, sprint, shops, leaderstats, tools, etc).
 *
 * Unlike the big multi-feature SystemTemplates in this folder, each snippet is a
 * single drop-in script with a clear placement (scriptType + parent). The AI
 * references these as ready-made building blocks when a prompt matches.
 */

export interface ScriptSnippet {
  /** Human-readable name. */
  name: string;
  /** Grouping for display/filtering. */
  category: string;
  /** One-line description of what it does. */
  description: string;
  /** Lowercase search terms used to match a user prompt. */
  keywords: string[];
  /** Where the script should live. */
  scriptType: "Script" | "LocalScript" | "ModuleScript";
  /** Suggested parent path in the DataModel. */
  parent: string;
  /** The Luau source. */
  code: string;
}

export const SCRIPT_SNIPPETS: ScriptSnippet[] = [
  // ─── Character & Movement Mechanics ─────────────────────────────────────────
  {
    name: "Kill Brick",
    category: "Character & Movement",
    description: "Sets a touching player's health to 0 on contact.",
    keywords: ["kill brick", "kill block", "lava", "instant kill", "damage brick"],
    scriptType: "Script",
    parent: "Workspace.KillBrick",
    code: `-- Kill Brick: kills any character that touches it.
local brick = script.Parent

brick.Touched:Connect(function(hit)
\tlocal char = hit.Parent
\tlocal humanoid = char and char:FindFirstChildWhichIsA("Humanoid")
\tif humanoid and humanoid.Health > 0 then
\t\thumanoid.Health = 0
\tend
end)`,
  },
  {
    name: "Heal Pad",
    category: "Character & Movement",
    description: "Gradually heals players standing on the part.",
    keywords: ["heal pad", "healing", "regen", "health pad", "recovery"],
    scriptType: "Script",
    parent: "Workspace.HealPad",
    code: `-- Heal Pad: regenerates health while a player stands on it.
local pad = script.Parent
local HEAL_PER_SECOND = 10
local healing = {}

pad.Touched:Connect(function(hit)
\tlocal char = hit.Parent
\tlocal humanoid = char and char:FindFirstChildWhichIsA("Humanoid")
\tif not humanoid or healing[humanoid] then return end
\thealing[humanoid] = true
\twhile healing[humanoid] and humanoid.Health < humanoid.MaxHealth do
\t\thumanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + HEAL_PER_SECOND * 0.1)
\t\ttask.wait(0.1)
\tend
end)

pad.TouchEnded:Connect(function(hit)
\tlocal humanoid = hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid")
\tif humanoid then healing[humanoid] = nil end
end)`,
  },
  {
    name: "Speed Booster Pad",
    category: "Character & Movement",
    description: "Temporarily boosts WalkSpeed on contact, then resets.",
    keywords: ["speed pad", "boost pad", "speed booster", "walkspeed pad"],
    scriptType: "Script",
    parent: "Workspace.SpeedPad",
    code: `-- Speed Booster Pad: temporary WalkSpeed boost.
local pad = script.Parent
local BOOST = 50
local DURATION = 3
local boosted = {}

pad.Touched:Connect(function(hit)
\tlocal humanoid = hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid")
\tif not humanoid or boosted[humanoid] then return end
\tboosted[humanoid] = true
\tlocal base = humanoid.WalkSpeed
\thumanoid.WalkSpeed = base + BOOST
\ttask.delay(DURATION, function()
\t\tif humanoid then humanoid.WalkSpeed = base end
\t\tboosted[humanoid] = nil
\tend)
end)`,
  },
  {
    name: "Super Jump Pad",
    category: "Character & Movement",
    description: "Launches a character upward on contact.",
    keywords: ["jump pad", "super jump", "launch pad", "bounce pad", "trampoline"],
    scriptType: "Script",
    parent: "Workspace.JumpPad",
    code: `-- Super Jump Pad: launches characters into the air.
local pad = script.Parent
local LAUNCH_POWER = 150
local cooldown = {}

pad.Touched:Connect(function(hit)
\tlocal char = hit.Parent
\tlocal root = char and char:FindFirstChild("HumanoidRootPart")
\tif not root or cooldown[char] then return end
\tcooldown[char] = true
\troot.AssemblyLinearVelocity = Vector3.new(root.AssemblyLinearVelocity.X, LAUNCH_POWER, root.AssemblyLinearVelocity.Z)
\ttask.delay(0.5, function() cooldown[char] = nil end)
end)`,
  },
  {
    name: "Teleporter Pair",
    category: "Character & Movement",
    description: "Moves a player from Pad A to Pad B when touched.",
    keywords: ["teleporter", "teleport pad", "portal", "teleport pair"],
    scriptType: "Script",
    parent: "Workspace.TeleporterA",
    code: `-- Teleporter Pair: place this in Pad A; set DestinationName to Pad B.
local padA = script.Parent
local padB = workspace:WaitForChild("TeleporterB")
local cooldown = {}

padA.Touched:Connect(function(hit)
\tlocal char = hit.Parent
\tlocal root = char and char:FindFirstChild("HumanoidRootPart")
\tif not root or cooldown[char] then return end
\tcooldown[char] = true
\troot.CFrame = padB.CFrame + Vector3.new(0, 4, 0)
\ttask.delay(1, function() cooldown[char] = nil end)
end)`,
  },
  {
    name: "Team Changer Gate",
    category: "Character & Movement",
    description: "Changes a player's Team when they pass through a portal.",
    keywords: ["team changer", "team gate", "team portal", "join team"],
    scriptType: "Script",
    parent: "Workspace.TeamGate",
    code: `-- Team Changer Gate: assigns a team on touch.
local Players = game:GetService("Players")
local Teams = game:GetService("Teams")
local gate = script.Parent
local TEAM_NAME = "Red"

local team = Teams:FindFirstChild(TEAM_NAME)
if not team then
\tteam = Instance.new("Team")
\tteam.Name = TEAM_NAME
\tteam.AutoAssignable = false
\tteam.TeamColor = BrickColor.new("Bright red")
\tteam.Parent = Teams
end

gate.Touched:Connect(function(hit)
\tlocal player = Players:GetPlayerFromCharacter(hit.Parent)
\tif player and player.Team ~= team then
\t\tplayer.Team = team
\tend
end)`,
  },
  {
    name: "Low Gravity Zone",
    category: "Character & Movement",
    description: "Reduces a character's effective gravity inside an area.",
    keywords: ["low gravity", "gravity zone", "moon gravity", "antigravity", "float zone"],
    scriptType: "Script",
    parent: "Workspace.LowGravityZone",
    code: `-- Low Gravity Zone: applies a counter-force while inside the zone.
local zone = script.Parent
local GRAVITY_SCALE = 0.3 -- 0 = float, 1 = normal
local active = {}

zone.Touched:Connect(function(hit)
\tlocal char = hit.Parent
\tlocal root = char and char:FindFirstChild("HumanoidRootPart")
\tif not root or active[char] then return end
\tactive[char] = true
\tlocal force = Instance.new("VectorForce")
\tforce.Force = Vector3.new(0, root.AssemblyMass * workspace.Gravity * (1 - GRAVITY_SCALE), 0)
\tforce.RelativeTo = Enum.ActuatorRelativeTo.World
\tlocal att = root:FindFirstChild("RootAttachment") or Instance.new("Attachment", root)
\tforce.Attachment0 = att
\tforce.Parent = root
end)

zone.TouchEnded:Connect(function(hit)
\tlocal char = hit.Parent
\tif active[char] then
\t\tlocal root = char:FindFirstChild("HumanoidRootPart")
\t\tlocal f = root and root:FindFirstChildWhichIsA("VectorForce")
\t\tif f then f:Destroy() end
\t\tactive[char] = nil
\tend
end)`,
  },
  {
    name: "Sprint Script",
    category: "Character & Movement",
    description: "Hold Shift to sprint, release to return to normal speed.",
    keywords: ["sprint", "shift to run", "running", "walkspeed key", "sprint script"],
    scriptType: "LocalScript",
    parent: "StarterPlayer.StarterPlayerScripts",
    code: `-- Sprint: hold Left Shift to run.
local UIS = game:GetService("UserInputService")
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local WALK, RUN = 16, 28

local function getHumanoid()
\tlocal char = player.Character or player.CharacterAdded:Wait()
\treturn char:WaitForChild("Humanoid")
end

UIS.InputBegan:Connect(function(input, gp)
\tif gp then return end
\tif input.KeyCode == Enum.KeyCode.LeftShift then
\t\tgetHumanoid().WalkSpeed = RUN
\tend
end)

UIS.InputEnded:Connect(function(input)
\tif input.KeyCode == Enum.KeyCode.LeftShift then
\t\tgetHumanoid().WalkSpeed = WALK
\tend
end)`,
  },
  {
    name: "Double Jump",
    category: "Character & Movement",
    description: "Allows a second mid-air jump.",
    keywords: ["double jump", "second jump", "air jump", "multi jump"],
    scriptType: "LocalScript",
    parent: "StarterPlayer.StarterPlayerScripts",
    code: `-- Double Jump: one extra jump while airborne.
local UIS = game:GetService("UserInputService")
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local JUMP_POWER = 50
local canDouble = false

local function setup(char)
\tlocal humanoid = char:WaitForChild("Humanoid")
\thumanoid.StateChanged:Connect(function(_, new)
\t\tif new == Enum.HumanoidStateType.Landed then
\t\t\tcanDouble = true
\t\telseif new == Enum.HumanoidStateType.Freefall then
\t\t\t-- keep current canDouble flag
\t\tend
\tend)
end

if player.Character then setup(player.Character) end
player.CharacterAdded:Connect(setup)

UIS.JumpRequest:Connect(function()
\tlocal char = player.Character
\tlocal humanoid = char and char:FindFirstChildWhichIsA("Humanoid")
\tif not humanoid then return end
\tif humanoid:GetState() == Enum.HumanoidStateType.Freefall and canDouble then
\t\tcanDouble = false
\t\tlocal root = char.HumanoidRootPart
\t\troot.AssemblyLinearVelocity = Vector3.new(root.AssemblyLinearVelocity.X, JUMP_POWER, root.AssemblyLinearVelocity.Z)
\tend
end)`,
  },
  {
    name: "Anti-Void Teleporter",
    category: "Character & Movement",
    description: "Teleports players back to spawn if they fall out of the world.",
    keywords: ["anti void", "void teleport", "fall respawn", "out of bounds", "kill plane"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Anti-Void: returns players to spawn instead of letting them fall forever.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local FALL_Y = -50

RunService.Heartbeat:Connect(function()
\tfor _, player in ipairs(Players:GetPlayers()) do
\t\tlocal char = player.Character
\t\tlocal root = char and char:FindFirstChild("HumanoidRootPart")
\t\tif root and root.Position.Y < FALL_Y then
\t\t\tif player.RespawnLocation then
\t\t\t\troot.CFrame = player.RespawnLocation.CFrame + Vector3.new(0, 5, 0)
\t\t\telse
\t\t\t\tlocal humanoid = char:FindFirstChildWhichIsA("Humanoid")
\t\t\t\tif humanoid then humanoid.Health = 0 end
\t\t\tend
\t\tend
\tend
end)`,
  },
  {
    name: "Character Scale Changer",
    category: "Character & Movement",
    description: "Resizes a character via HumanoidDescription on touch.",
    keywords: ["scale changer", "resize", "grow", "shrink", "size block", "giant"],
    scriptType: "Script",
    parent: "Workspace.SizeBlock",
    code: `-- Character Scale Changer: multiplies a character's size on touch.
local block = script.Parent
local SCALE = 1.5
local cooldown = {}

block.Touched:Connect(function(hit)
\tlocal humanoid = hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid")
\tif not humanoid or cooldown[humanoid] then return end
\tcooldown[humanoid] = true
\tfor _, name in ipairs({"BodyHeightScale", "BodyWidthScale", "BodyDepthScale", "HeadScale"}) do
\t\tlocal val = humanoid:FindFirstChild(name)
\t\tif val then val.Value = val.Value * SCALE end
\tend
\ttask.delay(1, function() cooldown[humanoid] = nil end)
end)`,
  },
  {
    name: "Crouch System",
    category: "Character & Movement",
    description: "Hold C to crouch: slower speed and lowered camera.",
    keywords: ["crouch", "duck", "prone", "crouch system", "sneak"],
    scriptType: "LocalScript",
    parent: "StarterPlayer.StarterPlayerScripts",
    code: `-- Crouch: hold C to slow down and lower the camera.
local UIS = game:GetService("UserInputService")
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local NORMAL_SPEED, CROUCH_SPEED = 16, 8
local crouching = false

local function humanoid()
\tlocal char = player.Character or player.CharacterAdded:Wait()
\treturn char:WaitForChild("Humanoid")
end

UIS.InputBegan:Connect(function(input, gp)
\tif gp or input.KeyCode ~= Enum.KeyCode.C then return end
\tcrouching = true
\tlocal h = humanoid()
\th.WalkSpeed = CROUCH_SPEED
\th.CameraOffset = Vector3.new(0, -1.5, 0)
end)

UIS.InputEnded:Connect(function(input)
\tif input.KeyCode ~= Enum.KeyCode.C then return end
\tcrouching = false
\tlocal h = humanoid()
\th.WalkSpeed = NORMAL_SPEED
\th.CameraOffset = Vector3.new(0, 0, 0)
end)`,
  },

  // ─── Environment & Obstacle Course (Obby) ───────────────────────────────────
  {
    name: "Disappearing Platform",
    category: "Obby & Environment",
    description: "Fades out and drops collision shortly after being stepped on.",
    keywords: ["disappearing platform", "vanishing", "fade platform", "obby", "temporary platform"],
    scriptType: "Script",
    parent: "Workspace.DisappearingPlatform",
    code: `-- Disappearing Platform: fades and lets you fall through after a delay.
local part = script.Parent
local DELAY = 1
local RESET = 3
local busy = false

part.Touched:Connect(function(hit)
	if busy or not (hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid")) then return end
	busy = true
	task.wait(DELAY)
	part.Transparency = 0.7
	part.CanCollide = false
	task.wait(RESET)
	part.Transparency = 0
	part.CanCollide = true
	busy = false
end)`,
  },
  {
    name: "Blinking Laser Grid",
    category: "Obby & Environment",
    description: "Toggles a damaging laser on and off in a loop.",
    keywords: ["laser", "laser grid", "blinking", "trap", "obby hazard", "damage loop"],
    scriptType: "Script",
    parent: "Workspace.Laser",
    code: `-- Blinking Laser Grid: pulses on/off and damages on contact while on.
local laser = script.Parent
local ON_TIME, OFF_TIME = 1.5, 1
local DAMAGE = 35
local isOn = true

laser.Touched:Connect(function(hit)
	if not isOn then return end
	local humanoid = hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid")
	if humanoid then humanoid:TakeDamage(DAMAGE) end
end)

while true do
	isOn = true
	laser.Transparency = 0.2
	laser.CanCollide = false
	task.wait(ON_TIME)
	isOn = false
	laser.Transparency = 0.9
	task.wait(OFF_TIME)
end`,
  },
  {
    name: "Moving Platform",
    category: "Obby & Environment",
    description: "Glides between two points using TweenService.",
    keywords: ["moving platform", "sliding platform", "tween platform", "obby", "elevator"],
    scriptType: "Script",
    parent: "Workspace.MovingPlatform",
    code: `-- Moving Platform: tweens back and forth between two offsets.
local TweenService = game:GetService("TweenService")
local part = script.Parent
local OFFSET = Vector3.new(0, 0, 30)
local TIME = 3

local startCF = part.CFrame
local info = TweenInfo.new(TIME, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true)
TweenService:Create(part, info, { CFrame = startCF + OFFSET }):Play()`,
  },
  {
    name: "Rotating Spinner",
    category: "Obby & Environment",
    description: "Continuously spins a hazard block.",
    keywords: ["spinner", "rotating", "spinning trap", "obby spinner", "rotor"],
    scriptType: "Script",
    parent: "Workspace.Spinner",
    code: `-- Rotating Spinner: spins about the Y axis. Anchor the part.
local part = script.Parent
local SPEED = 2 -- radians/sec

local RunService = game:GetService("RunService")
RunService.Heartbeat:Connect(function(dt)
	part.CFrame = part.CFrame * CFrame.Angles(0, SPEED * dt, 0)
end)`,
  },
  {
    name: "Conveyor Belt",
    category: "Obby & Environment",
    description: "Pushes anything standing on it via surface velocity.",
    keywords: ["conveyor", "conveyor belt", "moving floor", "belt", "push floor"],
    scriptType: "Script",
    parent: "Workspace.Conveyor",
    code: `-- Conveyor Belt: anchor the part; pushes along its look vector.
local part = script.Parent
local SPEED = 20

local function update()
	part.AssemblyLinearVelocity = part.CFrame.LookVector * SPEED
end

update()
part:GetPropertyChangedSignal("CFrame"):Connect(update)`,
  },
  {
    name: "Falling Block",
    category: "Obby & Environment",
    description: "Unanchors and falls shortly after being touched.",
    keywords: ["falling block", "falling platform", "collapse", "obby", "crumble"],
    scriptType: "Script",
    parent: "Workspace.FallingBlock",
    code: `-- Falling Block: drops a moment after a player steps on it, then resets.
local part = script.Parent
local DELAY = 1
local RESET = 4
local triggered = false
local origCF = part.CFrame

part.Touched:Connect(function(hit)
	if triggered or not (hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid")) then return end
	triggered = true
	task.wait(DELAY)
	part.Anchored = false
	task.wait(RESET)
	part.Anchored = true
	part.CFrame = origCF
	part.AssemblyLinearVelocity = Vector3.zero
	triggered = false
end)`,
  },
  {
    name: "Flickering Light",
    category: "Obby & Environment",
    description: "Randomly toggles a light for a creepy atmosphere.",
    keywords: ["flickering light", "flicker", "horror light", "broken light", "strobe light"],
    scriptType: "Script",
    parent: "Workspace.Lamp",
    code: `-- Flickering Light: random on/off flicker.
local light = script.Parent:FindFirstChildWhichIsA("Light")

while light do
	light.Enabled = not light.Enabled
	task.wait(math.random(5, 40) / 100)
end`,
  },
  {
    name: "Day/Night Cycle",
    category: "Obby & Environment",
    description: "Continuously advances Lighting.ClockTime.",
    keywords: ["day night", "day/night", "time cycle", "clocktime", "sun cycle"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Day/Night Cycle: advances in-game time. MINUTES_PER_DAY controls speed.
local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local MINUTES_PER_DAY = 4

RunService.Heartbeat:Connect(function(dt)
	local hoursPerSecond = 24 / (MINUTES_PER_DAY * 60)
	Lighting.ClockTime = (Lighting.ClockTime + hoursPerSecond * dt) % 24
end)`,
  },
  {
    name: "Rising Danger Volume",
    category: "Obby & Environment",
    description: "Slowly raises a lava/water hazard over time.",
    keywords: ["rising lava", "rising water", "flood", "rising danger", "lava floor"],
    scriptType: "Script",
    parent: "Workspace.RisingLava",
    code: `-- Rising Danger Volume: slowly climbs and damages on contact.
local part = script.Parent
local RISE_PER_SECOND = 0.5
local DAMAGE = 100

part.Touched:Connect(function(hit)
	local humanoid = hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid")
	if humanoid then humanoid:TakeDamage(DAMAGE) end
end)

local RunService = game:GetService("RunService")
RunService.Heartbeat:Connect(function(dt)
	part.CFrame = part.CFrame + Vector3.new(0, RISE_PER_SECOND * dt, 0)
end)`,
  },
  {
    name: "Exploding Barrel",
    category: "Obby & Environment",
    description: "Spawns an explosion when clicked or damaged.",
    keywords: ["exploding barrel", "explosion", "barrel", "explode", "tnt"],
    scriptType: "Script",
    parent: "Workspace.Barrel",
    code: `-- Exploding Barrel: click to detonate.
local barrel = script.Parent
local BLAST_RADIUS = 16
local click = Instance.new("ClickDetector")
click.MaxActivationDistance = 20
click.Parent = barrel

click.MouseClick:Connect(function()
	local e = Instance.new("Explosion")
	e.Position = barrel.Position
	e.BlastRadius = BLAST_RADIUS
	e.Parent = workspace
	barrel:Destroy()
end)`,
  },
  {
    name: "Breakable Glass",
    category: "Obby & Environment",
    description: "Shatters into shards when clicked.",
    keywords: ["breakable glass", "glass", "shatter", "window break", "destructible"],
    scriptType: "Script",
    parent: "Workspace.GlassPane",
    code: `-- Breakable Glass: clicking shatters it into falling shards.
local pane = script.Parent
local Debris = game:GetService("Debris")
local click = Instance.new("ClickDetector")
click.Parent = pane

click.MouseClick:Connect(function()
	for i = 1, 6 do
		local shard = Instance.new("Part")
		shard.Size = pane.Size / 3
		shard.CFrame = pane.CFrame * CFrame.new(math.random(-2,2), math.random(-2,2), 0)
		shard.Color = pane.Color
		shard.Transparency = pane.Transparency
		shard.Material = pane.Material
		shard.Parent = workspace
		Debris:AddItem(shard, 4)
	end
	pane:Destroy()
end)`,
  },

  // ─── Interactive World & Tycoon Basics ──────────────────────────────────────
  {
    name: "Proximity Prompt Door",
    category: "Interactive & Tycoon",
    description: "Opens a door when the player holds the interact key.",
    keywords: ["proximity prompt", "door", "open door", "interact door", "prompt door"],
    scriptType: "Script",
    parent: "Workspace.Door",
    code: `-- Proximity Prompt Door: hold E to swing open, auto-closes.
local door = script.Parent
local TweenService = game:GetService("TweenService")
local prompt = Instance.new("ProximityPrompt")
prompt.ActionText = "Open"
prompt.HoldDuration = 0.3
prompt.Parent = door

local closedCF = door.CFrame
local openCF = closedCF * CFrame.Angles(0, math.rad(90), 0)
local isOpen = false

prompt.Triggered:Connect(function()
	isOpen = not isOpen
	local goal = { CFrame = isOpen and openCF or closedCF }
	TweenService:Create(door, TweenInfo.new(0.5), goal):Play()
end)`,
  },
  {
    name: "Keycard Door",
    category: "Interactive & Tycoon",
    description: "Only opens if the player holds a tool named Keycard.",
    keywords: ["keycard", "keycard door", "access card", "locked door", "key door"],
    scriptType: "Script",
    parent: "Workspace.KeycardDoor",
    code: `-- Keycard Door: opens only if the toucher has a "Keycard" tool.
local Players = game:GetService("Players")
local door = script.Parent
local open = false

door.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if not player or open then return end
	local hasCard = (player.Backpack and player.Backpack:FindFirstChild("Keycard"))
		or (player.Character and player.Character:FindFirstChild("Keycard"))
	if hasCard then
		open = true
		door.CanCollide = false
		door.Transparency = 0.7
		task.wait(3)
		door.CanCollide = true
		door.Transparency = 0
		open = false
	end
end)`,
  },
  {
    name: "Click Detector Door",
    category: "Interactive & Tycoon",
    description: "Swings a gate open when clicked.",
    keywords: ["click door", "click detector", "gate", "clickable door"],
    scriptType: "Script",
    parent: "Workspace.Gate",
    code: `-- Click Detector Door: click to toggle open/closed.
local door = script.Parent
local TweenService = game:GetService("TweenService")
local click = Instance.new("ClickDetector")
click.Parent = door

local closedCF = door.CFrame
local openCF = closedCF * CFrame.Angles(0, math.rad(90), 0)
local isOpen = false

click.MouseClick:Connect(function()
	isOpen = not isOpen
	TweenService:Create(door, TweenInfo.new(0.5), { CFrame = isOpen and openCF or closedCF }):Play()
end)`,
  },
  {
    name: "Button Purchase System",
    category: "Interactive & Tycoon",
    description: "Tycoon pad: spends currency to unlock a hidden structure.",
    keywords: ["tycoon", "purchase button", "buy button", "unlock pad", "tycoon button"],
    scriptType: "Script",
    parent: "Workspace.BuyButton",
    code: `-- Button Purchase System: stand on the pad to buy the linked asset.
local Players = game:GetService("Players")
local pad = script.Parent
local PRICE = 100
local asset = workspace:WaitForChild("LockedAsset") -- the thing to reveal
local bought = false

pad.Touched:Connect(function(hit)
	if bought then return end
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	local coins = player and player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	if coins and coins.Value >= PRICE then
		coins.Value = coins.Value - PRICE
		bought = true
		for _, p in ipairs(asset:GetDescendants()) do
			if p:IsA("BasePart") then p.Transparency = 0; p.CanCollide = true end
		end
		pad:Destroy()
	end
end)`,
  },
  {
    name: "Dropper Script",
    category: "Interactive & Tycoon",
    description: "Spawns a prize part every few seconds from a spout.",
    keywords: ["dropper", "tycoon dropper", "spawn loop", "money dropper", "generator"],
    scriptType: "Script",
    parent: "Workspace.Dropper",
    code: `-- Dropper: spawns a valued part periodically.
local spout = script.Parent
local Debris = game:GetService("Debris")
local INTERVAL = 2
local VALUE = 5

while true do
	task.wait(INTERVAL)
	local drop = Instance.new("Part")
	drop.Size = Vector3.new(1, 1, 1)
	drop.CFrame = spout.CFrame * CFrame.new(0, -2, 0)
	drop.Color = Color3.fromRGB(255, 215, 0)
	drop:SetAttribute("Value", VALUE)
	drop.Parent = workspace
	Debris:AddItem(drop, 20)
end`,
  },
  {
    name: "Collector Bin",
    category: "Interactive & Tycoon",
    description: "Destroys dropped items and credits their value to the owner.",
    keywords: ["collector", "tycoon collector", "bin", "money collector", "sell bin"],
    scriptType: "Script",
    parent: "Workspace.Collector",
    code: `-- Collector Bin: collects dropper parts and pays the owner.
local Players = game:GetService("Players")
local bin = script.Parent
local OWNER_NAME = bin:GetAttribute("Owner") -- set this attribute to a username

bin.Touched:Connect(function(hit)
	local value = hit:GetAttribute("Value")
	if not value then return end
	local owner = OWNER_NAME and Players:FindFirstChild(OWNER_NAME)
	local coins = owner and owner:FindFirstChild("leaderstats") and owner.leaderstats:FindFirstChild("Coins")
	if coins then coins.Value = coins.Value + value end
	hit:Destroy()
end)`,
  },

  // ─── UI & HUD Interaction ───────────────────────────────────────────────────
  {
    name: "Menu Toggle Button",
    category: "UI & HUD",
    description: "Opens/closes a UI frame from a button click.",
    keywords: ["menu toggle", "open menu", "toggle ui", "menu button", "gui toggle"],
    scriptType: "LocalScript",
    parent: "StarterGui.Menu.ToggleButton",
    code: `-- Menu Toggle Button: place inside the button; toggles a sibling "Frame".
local button = script.Parent
local frame = button.Parent:WaitForChild("Frame")

button.MouseButton1Click:Connect(function()
	frame.Visible = not frame.Visible
end)`,
  },
  {
    name: "Leaderstats Display UI",
    category: "UI & HUD",
    description: "A label that live-updates from a leaderstats value.",
    keywords: ["leaderstats ui", "stats display", "coins label", "hud stats", "currency display"],
    scriptType: "LocalScript",
    parent: "StarterGui.HUD.CoinsLabel",
    code: `-- Leaderstats Display: mirrors leaderstats.Coins onto this TextLabel.
local Players = game:GetService("Players")
local label = script.Parent
local player = Players.LocalPlayer

local stats = player:WaitForChild("leaderstats")
local coins = stats:WaitForChild("Coins")

local function update()
	label.Text = "Coins: " .. tostring(coins.Value)
end

update()
coins.Changed:Connect(update)`,
  },
  {
    name: "Billboard Health Bar",
    category: "UI & HUD",
    description: "Overhead bar that mirrors a humanoid's health.",
    keywords: ["health bar", "billboard", "overhead health", "hp bar", "nameplate health"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Billboard Health Bar: attaches an overhead HP bar to every character.
local Players = game:GetService("Players")

local function setup(char)
	local head = char:WaitForChild("Head")
	local humanoid = char:WaitForChild("Humanoid")
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(4, 0, 0.5, 0)
	bb.StudsOffset = Vector3.new(0, 2.5, 0)
	bb.AlwaysOnTop = true
	bb.Adornee = head
	bb.Parent = head
	local bg = Instance.new("Frame", bb)
	bg.Size = UDim2.fromScale(1, 1)
	bg.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
	local fill = Instance.new("Frame", bg)
	fill.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
	local function update()
		fill.Size = UDim2.fromScale(math.clamp(humanoid.Health / humanoid.MaxHealth, 0, 1), 1)
	end
	update()
	humanoid.HealthChanged:Connect(update)
end

Players.PlayerAdded:Connect(function(p)
	p.CharacterAdded:Connect(setup)
end)`,
  },
  {
    name: "Typewriter Text Effect",
    category: "UI & HUD",
    description: "Reveals dialogue text letter-by-letter.",
    keywords: ["typewriter", "text effect", "dialogue text", "letter by letter", "typing effect"],
    scriptType: "LocalScript",
    parent: "StarterGui.Dialogue.TextLabel",
    code: `-- Typewriter Text Effect: types out the label's text.
local label = script.Parent
local FULL_TEXT = "Welcome, adventurer..."
local SPEED = 0.04

label.Text = ""
for i = 1, #FULL_TEXT do
	label.Text = string.sub(FULL_TEXT, 1, i)
	task.wait(SPEED)
end`,
  },
  {
    name: "Hover Scale Effect",
    category: "UI & HUD",
    description: "Scales up a UI element on mouse hover.",
    keywords: ["hover effect", "button hover", "ui scale", "hover scale", "mouse enter"],
    scriptType: "LocalScript",
    parent: "StarterGui.Menu.Button",
    code: `-- Hover Scale Effect: grows the button slightly on hover.
local TweenService = game:GetService("TweenService")
local button = script.Parent
local baseSize = button.Size
local hoverSize = UDim2.new(baseSize.X.Scale * 1.1, baseSize.X.Offset, baseSize.Y.Scale * 1.1, baseSize.Y.Offset)

button.MouseEnter:Connect(function()
	TweenService:Create(button, TweenInfo.new(0.15), { Size = hoverSize }):Play()
end)
button.MouseLeave:Connect(function()
	TweenService:Create(button, TweenInfo.new(0.15), { Size = baseSize }):Play()
end)`,
  },
  {
    name: "Custom Mouse Crosshair",
    category: "UI & HUD",
    description: "Replaces the default cursor with a custom image.",
    keywords: ["crosshair", "custom cursor", "mouse icon", "cursor image", "reticle"],
    scriptType: "LocalScript",
    parent: "StarterPlayer.StarterPlayerScripts",
    code: `-- Custom Mouse Crosshair: swaps the cursor icon.
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local mouse = player:GetMouse()
-- Replace with your own decal/image asset id:
mouse.Icon = "rbxassetid://0"`,
  },
  {
    name: "Screen Flash Damage HUD",
    category: "UI & HUD",
    description: "Flashes a red vignette when the player takes damage.",
    keywords: ["damage flash", "red screen", "hurt overlay", "damage hud", "vignette"],
    scriptType: "LocalScript",
    parent: "StarterPlayer.StarterPlayerScripts",
    code: `-- Screen Flash Damage HUD: red overlay pulse on health loss.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local player = Players.LocalPlayer

local gui = Instance.new("ScreenGui")
gui.IgnoreGuiInset = true
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")
local overlay = Instance.new("Frame", gui)
overlay.Size = UDim2.fromScale(1, 1)
overlay.BackgroundColor3 = Color3.fromRGB(255, 0, 0)
overlay.BackgroundTransparency = 1

local function bind(char)
	local humanoid = char:WaitForChild("Humanoid")
	local last = humanoid.Health
	humanoid.HealthChanged:Connect(function(h)
		if h < last then
			overlay.BackgroundTransparency = 0.6
			TweenService:Create(overlay, TweenInfo.new(0.4), { BackgroundTransparency = 1 }):Play()
		end
		last = h
	end)
end

if player.Character then bind(player.Character) end
player.CharacterAdded:Connect(bind)`,
  },
  {
    name: "Shop Grid Populator",
    category: "UI & HUD",
    description: "Clones a UI template per item from a module list.",
    keywords: ["shop ui", "grid populator", "item grid", "populate shop", "shop layout"],
    scriptType: "LocalScript",
    parent: "StarterGui.Shop.ScrollingFrame",
    code: `-- Shop Grid Populator: clones a "Template" frame for each item.
local container = script.Parent
local template = container:WaitForChild("Template")
template.Visible = false

local ITEMS = {
	{ Name = "Sword", Price = 100 },
	{ Name = "Shield", Price = 150 },
	{ Name = "Potion", Price = 50 },
}

for _, item in ipairs(ITEMS) do
	local card = template:Clone()
	card.Name = item.Name
	card.Visible = true
	local nameLabel = card:FindFirstChild("NameLabel")
	local priceLabel = card:FindFirstChild("PriceLabel")
	if nameLabel then nameLabel.Text = item.Name end
	if priceLabel then priceLabel.Text = tostring(item.Price) end
	card.Parent = container
end`,
  },
  {
    name: "Floating Damage Numbers",
    category: "UI & HUD",
    description: "Spawns rising, fading damage text above a target.",
    keywords: ["damage numbers", "floating text", "hit numbers", "damage popup", "floating damage"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Floating Damage Numbers: call showDamage(part, amount) when a hit lands.
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local function showDamage(adornee, amount)
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 100, 0, 40)
	bb.StudsOffset = Vector3.new(math.random(-1,1), 2, 0)
	bb.AlwaysOnTop = true
	bb.Adornee = adornee
	bb.Parent = adornee
	local label = Instance.new("TextLabel", bb)
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = "-" .. tostring(amount)
	label.TextColor3 = Color3.fromRGB(255, 80, 80)
	label.TextScaled = true
	label.Font = Enum.Font.GothamBold
	TweenService:Create(bb, TweenInfo.new(1), { StudsOffset = bb.StudsOffset + Vector3.new(0, 3, 0) }):Play()
	TweenService:Create(label, TweenInfo.new(1), { TextTransparency = 1 }):Play()
	Debris:AddItem(bb, 1.1)
end

-- Example: expose via a BindableFunction or call directly from your combat code.
_G.ShowDamage = showDamage`,
  },

  // ─── Economy, Loops & Data Systems ──────────────────────────────────────────
  {
    name: "Leaderstats Setup Core",
    category: "Economy & Data",
    description: "Creates a leaderstats folder with Coins and Wins on join.",
    keywords: ["leaderstats", "leaderboard stats", "coins", "wins", "stats setup"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Leaderstats Setup Core: standard Coins/Wins leaderstats.
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player

	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Parent = stats

	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = stats
end)`,
  },
  {
    name: "Passive Income Loop",
    category: "Economy & Data",
    description: "Grants currency to every player on an interval.",
    keywords: ["passive income", "income loop", "currency loop", "salary", "auto coins"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Passive Income Loop: pays all players every interval.
local Players = game:GetService("Players")
local INTERVAL = 10
local AMOUNT = 25

while true do
	task.wait(INTERVAL)
	for _, player in ipairs(Players:GetPlayers()) do
		local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
		if coins then coins.Value = coins.Value + AMOUNT end
	end
end`,
  },
  {
    name: "Basic DataStore Save/Load",
    category: "Economy & Data",
    description: "Saves/loads leaderstats with DataStoreService.",
    keywords: ["datastore", "save data", "load data", "persistence", "save leaderstats"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Basic DataStore Save/Load: persists Coins and Wins.
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("PlayerData_v1")

local function load(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local coins = Instance.new("IntValue"); coins.Name = "Coins"; coins.Parent = stats
	local wins = Instance.new("IntValue"); wins.Name = "Wins"; wins.Parent = stats
	stats.Parent = player

	local ok, data = pcall(function() return store:GetAsync("u_" .. player.UserId) end)
	if ok and data then
		coins.Value = data.Coins or 0
		wins.Value = data.Wins or 0
	end
end

local function save(player)
	local stats = player:FindFirstChild("leaderstats")
	if not stats then return end
	pcall(function()
		store:SetAsync("u_" .. player.UserId, {
			Coins = stats.Coins.Value,
			Wins = stats.Wins.Value,
		})
	end)
end

Players.PlayerAdded:Connect(load)
Players.PlayerRemoving:Connect(save)
game:BindToClose(function()
	for _, p in ipairs(Players:GetPlayers()) do save(p) end
end)`,
  },
  {
    name: "Kill-Reward System",
    category: "Economy & Data",
    description: "Awards currency to whoever lands the killing blow.",
    keywords: ["kill reward", "kill bounty", "bounty", "kill coins", "killer reward"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Kill-Reward System: pays the killer (credited via Humanoid creator tag).
local Players = game:GetService("Players")
local REWARD = 50

local function onCharacter(char)
	local humanoid = char:WaitForChild("Humanoid")
	humanoid.Died:Connect(function()
		local tag = humanoid:FindFirstChild("creator")
		local killer = tag and tag.Value
		if killer and killer:IsA("Player") then
			local coins = killer:FindFirstChild("leaderstats") and killer.leaderstats:FindFirstChild("Coins")
			if coins then coins.Value = coins.Value + REWARD end
		end
	end)
end

Players.PlayerAdded:Connect(function(p)
	p.CharacterAdded:Connect(onCharacter)
end)`,
  },
  {
    name: "Win Pad Milestone",
    category: "Economy & Data",
    description: "Adds a Win, returns to lobby, plays a victory effect.",
    keywords: ["win pad", "finish pad", "victory", "win milestone", "obby end"],
    scriptType: "Script",
    parent: "Workspace.WinPad",
    code: `-- Win Pad Milestone: increments Wins and sends the player to spawn.
local Players = game:GetService("Players")
local pad = script.Parent
local cooldown = {}

pad.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if not player or cooldown[player] then return end
	cooldown[player] = true
	local wins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Wins")
	if wins then wins.Value = wins.Value + 1 end
	local char = hit.Parent
	local root = char:FindFirstChild("HumanoidRootPart")
	if root and player.RespawnLocation then
		root.CFrame = player.RespawnLocation.CFrame + Vector3.new(0, 5, 0)
	end
	task.delay(2, function() cooldown[player] = nil end)
end)`,
  },
  {
    name: "Daily Reward Timer",
    category: "Economy & Data",
    description: "Grants a daily chest using os.time() comparison.",
    keywords: ["daily reward", "daily chest", "login reward", "daily bonus", "24 hour reward"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Daily Reward Timer: gives a reward once every 24h.
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("DailyReward_v1")
local DAY = 86400
local REWARD = 500

Players.PlayerAdded:Connect(function(player)
	local key = "last_" .. player.UserId
	local ok, last = pcall(function() return store:GetAsync(key) end)
	local now = os.time()
	if not ok then return end
	if not last or (now - last) >= DAY then
		local coins = player:WaitForChild("leaderstats"):FindFirstChild("Coins")
		if coins then coins.Value = coins.Value + REWARD end
		pcall(function() store:SetAsync(key, now) end)
	end
end)`,
  },
  {
    name: "Promo Code System",
    category: "Economy & Data",
    description: "Validates typed codes against a server dictionary.",
    keywords: ["promo code", "redeem code", "code system", "coupon", "promo"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Promo Code System: fire the RemoteFunction "RedeemCode" from the client.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remote = Instance.new("RemoteFunction")
remote.Name = "RedeemCode"
remote.Parent = ReplicatedStorage

local CODES = {
	WELCOME = 100,
	JUICE = 250,
}
local redeemed = {} -- [userId] = { code = true }

remote.OnServerInvoke = function(player, code)
	code = tostring(code or ""):upper()
	local reward = CODES[code]
	redeemed[player.UserId] = redeemed[player.UserId] or {}
	if not reward then return false, "Invalid code" end
	if redeemed[player.UserId][code] then return false, "Already redeemed" end
	redeemed[player.UserId][code] = true
	local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	if coins then coins.Value = coins.Value + reward end
	return true, "Redeemed " .. reward .. " coins!"
end`,
  },
  {
    name: "Playtime Counter",
    category: "Economy & Data",
    description: "Tracks minutes spent in the session.",
    keywords: ["playtime", "time played", "session time", "minutes counter", "afk timer"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Playtime Counter: increments a Minutes stat each minute.
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
	local stats = player:WaitForChild("leaderstats")
	local minutes = stats:FindFirstChild("Minutes")
	if not minutes then
		minutes = Instance.new("IntValue")
		minutes.Name = "Minutes"
		minutes.Parent = stats
	end
	task.spawn(function()
		while player.Parent do
			task.wait(60)
			if player.Parent then minutes.Value = minutes.Value + 1 end
		end
	end)
end)`,
  },

  // ─── Basic Tools & Weapons ──────────────────────────────────────────────────
  {
    name: "Flashlight Tool",
    category: "Tools & Weapons",
    description: "Toggles a light in the tool handle on click.",
    keywords: ["flashlight", "torch", "light tool", "lantern"],
    scriptType: "Script",
    parent: "StarterPack.Flashlight",
    code: `-- Flashlight Tool: click to toggle the handle light. (Tool with a Handle part.)
local tool = script.Parent
local handle = tool:WaitForChild("Handle")
local light = handle:FindFirstChildWhichIsA("Light")
if not light then
	light = Instance.new("SpotLight")
	light.Range = 30
	light.Angle = 45
	light.Parent = handle
end
light.Enabled = false

tool.Activated:Connect(function()
	light.Enabled = not light.Enabled
end)`,
  },
  {
    name: "Classic Melee Sword",
    category: "Tools & Weapons",
    description: "Swings on click and damages what it touches.",
    keywords: ["sword", "melee", "blade", "knife", "slash weapon"],
    scriptType: "Script",
    parent: "StarterPack.Sword",
    code: `-- Classic Melee Sword: damage on touch during a swing.
local Players = game:GetService("Players")
local tool = script.Parent
local handle = tool:WaitForChild("Handle")
local DAMAGE = 35
local swinging = false

handle.Touched:Connect(function(hit)
	if not swinging then return end
	local humanoid = hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid")
	local player = Players:GetPlayerFromCharacter(tool.Parent)
	if humanoid and hit.Parent ~= tool.Parent then
		humanoid:TakeDamage(DAMAGE)
		local tag = Instance.new("ObjectValue")
		tag.Name = "creator"
		tag.Value = player
		tag.Parent = humanoid
		game:GetService("Debris"):AddItem(tag, 2)
	end
end)

tool.Activated:Connect(function()
	if swinging then return end
	swinging = true
	task.wait(0.5)
	swinging = false
end)`,
  },
  {
    name: "Click Teleporter Wand",
    category: "Tools & Weapons",
    description: "Teleports the user to the clicked position.",
    keywords: ["teleport wand", "blink", "warp tool", "teleport tool", "teleport gun"],
    scriptType: "LocalScript",
    parent: "StarterPack.Wand",
    code: `-- Click Teleporter Wand: teleports to where you click.
local Players = game:GetService("Players")
local tool = script.Parent
local player = Players.LocalPlayer
local mouse = player:GetMouse()

tool.Activated:Connect(function()
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if root and mouse.Hit then
		root.CFrame = CFrame.new(mouse.Hit.Position + Vector3.new(0, 3, 0))
	end
end)`,
  },
  {
    name: "Consumable Health Potion",
    category: "Tools & Weapons",
    description: "Heals on use, then consumes the tool.",
    keywords: ["health potion", "heal potion", "consumable", "medkit", "drink"],
    scriptType: "Script",
    parent: "StarterPack.HealthPotion",
    code: `-- Consumable Health Potion: heals then removes itself.
local tool = script.Parent
local HEAL = 50

tool.Activated:Connect(function()
	local char = tool.Parent
	local humanoid = char and char:FindFirstChildWhichIsA("Humanoid")
	if humanoid then
		humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + HEAL)
		tool:Destroy()
	end
end)`,
  },
  {
    name: "Speed Elixir",
    category: "Tools & Weapons",
    description: "Temporary speed buff with a particle effect.",
    keywords: ["speed elixir", "speed potion", "haste", "speed buff", "elixir"],
    scriptType: "Script",
    parent: "StarterPack.SpeedElixir",
    code: `-- Speed Elixir: temporary WalkSpeed buff, then consumes the tool.
local tool = script.Parent
local BOOST = 24
local DURATION = 8

tool.Activated:Connect(function()
	local char = tool.Parent
	local humanoid = char and char:FindFirstChildWhichIsA("Humanoid")
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not humanoid then return end
	local base = humanoid.WalkSpeed
	humanoid.WalkSpeed = base + BOOST
	local emitter
	if root then
		emitter = Instance.new("ParticleEmitter")
		emitter.Rate = 20
		emitter.Lifetime = NumberRange.new(0.5)
		emitter.Parent = root
	end
	tool:Destroy()
	task.delay(DURATION, function()
		if humanoid then humanoid.WalkSpeed = base end
		if emitter then emitter:Destroy() end
	end)
end)`,
  },
  {
    name: "Simple Raycast Gun",
    category: "Tools & Weapons",
    description: "Fires a raycast to the mouse, draws a tracer, deals damage.",
    keywords: ["gun", "raycast gun", "shoot", "pistol", "ranged weapon", "blaster"],
    scriptType: "Script",
    parent: "StarterPack.Gun",
    code: `-- Simple Raycast Gun: server-validated raycast from the tool tip.
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local tool = script.Parent
local handle = tool:WaitForChild("Handle")
local DAMAGE = 25
local RANGE = 300

tool.Activated:Connect(function()
	local char = tool.Parent
	local player = Players:GetPlayerFromCharacter(char)
	local origin = handle.Position
	local dir = (char:FindFirstChild("Head") and char.Head.CFrame.LookVector or Vector3.new(0,0,-1)) * RANGE

	local params = RaycastParams.new()
	params.FilterDescendantsInstances = { char }
	params.FilterType = Enum.RaycastFilterType.Exclude
	local result = workspace:Raycast(origin, dir, params)

	local hitPos = result and result.Position or (origin + dir)
	-- Tracer
	local tracer = Instance.new("Part")
	tracer.Anchored = true
	tracer.CanCollide = false
	tracer.Material = Enum.Material.Neon
	tracer.Color = Color3.fromRGB(255, 220, 100)
	local dist = (hitPos - origin).Magnitude
	tracer.Size = Vector3.new(0.15, 0.15, dist)
	tracer.CFrame = CFrame.lookAt(origin, hitPos) * CFrame.new(0, 0, -dist / 2)
	tracer.Parent = workspace
	Debris:AddItem(tracer, 0.1)

	if result and result.Instance then
		local humanoid = result.Instance.Parent and result.Instance.Parent:FindFirstChildWhichIsA("Humanoid")
		if humanoid then
			humanoid:TakeDamage(DAMAGE)
			local tag = Instance.new("ObjectValue")
			tag.Name = "creator"; tag.Value = player; tag.Parent = humanoid
			Debris:AddItem(tag, 2)
		end
	end
end)`,
  },

  // ─── Audio & Visual Polish ──────────────────────────────────────────────────
  {
    name: "Material Footstep Changer",
    category: "Audio & Visual",
    description: "Plays different footstep sounds based on floor material.",
    keywords: ["footstep", "footstep sound", "material sound", "walking sound", "step audio"],
    scriptType: "LocalScript",
    parent: "StarterPlayer.StarterPlayerScripts",
    code: `-- Material Footstep Changer: swaps step sound by FloorMaterial.
local Players = game:GetService("Players")
local player = Players.LocalPlayer

local SOUNDS = {
	[Enum.Material.Grass] = "rbxassetid://9114097906",
	[Enum.Material.Wood] = "rbxassetid://9114098002",
	[Enum.Material.Metal] = "rbxassetid://9114097832",
}

local function bind(char)
	local humanoid = char:WaitForChild("Humanoid")
	local root = char:WaitForChild("HumanoidRootPart")
	local sound = root:FindFirstChild("RunFootsteps") or Instance.new("Sound")
	sound.Name = "RunFootsteps"
	sound.Parent = root
	humanoid.Running:Connect(function(speed)
		if speed > 2 then
			local id = SOUNDS[humanoid.FloorMaterial]
			if id then sound.SoundId = id; sound.Looped = true; if not sound.IsPlaying then sound:Play() end end
		else
			sound:Stop()
		end
	end)
end

if player.Character then bind(player.Character) end
player.CharacterAdded:Connect(bind)`,
  },
  {
    name: "Ambient Music Zone",
    category: "Audio & Visual",
    description: "Crossfades background music when entering a region.",
    keywords: ["music zone", "ambient music", "region music", "background music", "zone audio"],
    scriptType: "Script",
    parent: "Workspace.MusicZone",
    code: `-- Ambient Music Zone: fades a track in/out as players enter/leave.
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local zone = script.Parent

local sound = Instance.new("Sound")
sound.SoundId = "rbxassetid://1846458016"
sound.Looped = true
sound.Volume = 0
sound.Parent = SoundService
sound:Play()

local inside = 0
zone.Touched:Connect(function(hit)
	if hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid") then
		inside += 1
		TweenService:Create(sound, TweenInfo.new(1), { Volume = 0.5 }):Play()
	end
end)
zone.TouchEnded:Connect(function(hit)
	if hit.Parent and hit.Parent:FindFirstChildWhichIsA("Humanoid") then
		inside = math.max(0, inside - 1)
		if inside == 0 then TweenService:Create(sound, TweenInfo.new(1), { Volume = 0 }):Play() end
	end
end)`,
  },
  {
    name: "Explosion Screen Shake",
    category: "Audio & Visual",
    description: "Shakes the camera with a decaying offset.",
    keywords: ["screen shake", "camera shake", "explosion shake", "rumble", "shake"],
    scriptType: "LocalScript",
    parent: "StarterPlayer.StarterPlayerScripts",
    code: `-- Explosion Screen Shake: call _G.ShakeCamera(intensity) to trigger.
local RunService = game:GetService("RunService")
local cam = workspace.CurrentCamera
local shake = 0

_G.ShakeCamera = function(intensity)
	shake = math.max(shake, intensity or 1)
end

RunService.RenderStepped:Connect(function(dt)
	if shake > 0.01 then
		local off = Vector3.new(math.random(-1,1), math.random(-1,1), 0) * shake * 0.4
		cam.CFrame = cam.CFrame * CFrame.new(off)
		shake = shake * (1 - math.min(1, dt * 5))
	end
end)`,
  },
  {
    name: "Rainbow Color Strobe",
    category: "Audio & Visual",
    description: "Cycles a part's color through the spectrum.",
    keywords: ["rainbow", "color strobe", "color cycle", "disco", "hsv color"],
    scriptType: "Script",
    parent: "Workspace.RainbowPart",
    code: `-- Rainbow Color Strobe: smooth hue rotation.
local part = script.Parent
local RunService = game:GetService("RunService")
local hue = 0

RunService.Heartbeat:Connect(function(dt)
	hue = (hue + dt * 0.2) % 1
	part.Color = Color3.fromHSV(hue, 1, 1)
end)`,
  },
  {
    name: "Motion Speed Trail",
    category: "Audio & Visual",
    description: "Enables a trail only when moving fast.",
    keywords: ["trail", "speed trail", "motion trail", "movement trail", "velocity trail"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Motion Speed Trail: adds a trail that shows above a speed threshold.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local THRESHOLD = 24

local function bind(char)
	local root = char:WaitForChild("HumanoidRootPart")
	local a0 = Instance.new("Attachment", root); a0.Position = Vector3.new(0, 1, 0)
	local a1 = Instance.new("Attachment", root); a1.Position = Vector3.new(0, -1, 0)
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0; trail.Attachment1 = a1
	trail.Lifetime = 0.3
	trail.Enabled = false
	trail.Parent = root
	RunService.Heartbeat:Connect(function()
		if root.Parent then
			trail.Enabled = root.AssemblyLinearVelocity.Magnitude > THRESHOLD
		end
	end)
end

Players.PlayerAdded:Connect(function(p)
	p.CharacterAdded:Connect(bind)
end)`,
  },
  {
    name: "Dynamic Weather Trigger",
    category: "Audio & Visual",
    description: "Randomly toggles rain/snow emitters on a timer.",
    keywords: ["weather", "rain", "snow", "weather trigger", "dynamic weather", "storm"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Dynamic Weather Trigger: toggles a weather emitter on a random timer.
-- Place a ParticleEmitter named "Weather" inside Workspace.WeatherEmitter (a part).
local emitterPart = workspace:WaitForChild("WeatherEmitter")
local emitter = emitterPart:WaitForChild("Weather")
emitter.Enabled = false

while true do
	task.wait(math.random(30, 90))
	emitter.Enabled = not emitter.Enabled
end`,
  },

  // ─── Administration & Utilities ─────────────────────────────────────────────
  {
    name: "Admin Kick Chat Command",
    category: "Admin & Utilities",
    description: "Kicks a user via '/kick name' from an authorized admin.",
    keywords: ["admin", "kick command", "chat command", "moderation", "admin kick"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Admin Kick Chat Command: "/kick <username>" from an allowed admin.
local Players = game:GetService("Players")
local ADMINS = { ["YourUsername"] = true } -- set your admin usernames

Players.PlayerAdded:Connect(function(player)
	player.Chatted:Connect(function(msg)
		if not ADMINS[player.Name] then return end
		local target = msg:match("^/kick%s+(.+)$")
		if target then
			local victim = Players:FindFirstChild(target)
			if victim then victim:Kick("Kicked by an admin.") end
		end
	end)
end)`,
  },
  {
    name: "Anti-Speed Exploiter Check",
    category: "Admin & Utilities",
    description: "Flags players moving faster than allowed over 1s.",
    keywords: ["anti exploit", "anti cheat", "speed check", "anti speed", "exploit detection"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Anti-Speed Exploiter Check: compares distance/sec against an allowed max.
local Players = game:GetService("Players")
local MAX_SPEED = 32 -- studs/sec allowance (set above your fastest legit speed)
local last = {}

while true do
	task.wait(1)
	for _, player in ipairs(Players:GetPlayers()) do
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if root then
			local prev = last[player]
			if prev then
				local dist = (root.Position - prev).Magnitude
				if dist > MAX_SPEED * 1.5 then
					warn(("[AntiCheat] %s moved %.0f studs in 1s"):format(player.Name, dist))
					-- Optionally teleport back: root.CFrame = CFrame.new(prev)
				end
			end
			last[player] = root.Position
		end
	end
end`,
  },
  {
    name: "Server Shutdown Warning",
    category: "Admin & Utilities",
    description: "Broadcasts a restart warning to all players.",
    keywords: ["shutdown warning", "restart warning", "server message", "broadcast", "announcement"],
    scriptType: "Script",
    parent: "ServerScriptService",
    code: `-- Server Shutdown Warning: broadcasts a message to all clients.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local event = Instance.new("RemoteEvent")
event.Name = "ServerBroadcast"
event.Parent = ReplicatedStorage

-- Call this when you want to warn players (e.g. before BindToClose / update).
local function warnShutdown(seconds)
	event:FireAllClients(("Server restarting in %d seconds for an update."):format(seconds))
end

-- Example: warnShutdown(30)
_G.WarnShutdown = warnShutdown`,
  },
  {
    name: "AFK Status Handler",
    category: "Admin & Utilities",
    description: "Tags a player AFK after a period of no input.",
    keywords: ["afk", "afk tag", "idle", "inactive", "afk status"],
    scriptType: "LocalScript",
    parent: "StarterPlayer.StarterPlayerScripts",
    code: `-- AFK Status Handler: shows an overhead AFK tag after inactivity.
local UIS = game:GetService("UserInputService")
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local AFK_AFTER = 60
local lastInput = tick()

local function markInput() lastInput = tick() end
UIS.InputBegan:Connect(markInput)
UIS.InputChanged:Connect(markInput)

task.spawn(function()
	while true do
		task.wait(1)
		local char = player.Character
		local head = char and char:FindFirstChild("Head")
		if head then
			local afk = (tick() - lastInput) >= AFK_AFTER
			local bb = head:FindFirstChild("AFKTag")
			if afk and not bb then
				bb = Instance.new("BillboardGui")
				bb.Name = "AFKTag"
				bb.Size = UDim2.new(0, 60, 0, 20)
				bb.StudsOffset = Vector3.new(0, 3, 0)
				bb.AlwaysOnTop = true
				bb.Adornee = head
				bb.Parent = head
				local label = Instance.new("TextLabel", bb)
				label.Size = UDim2.fromScale(1, 1)
				label.BackgroundTransparency = 1
				label.Text = "AFK"
				label.TextColor3 = Color3.fromRGB(255, 200, 0)
				label.TextScaled = true
				label.Font = Enum.Font.GothamBold
			elseif not afk and bb then
				bb:Destroy()
			end
		end
	end
end)`,
  },
];

/**
 * Score and return the snippets most relevant to a prompt (keyword match).
 * Returns up to `limit` snippets, highest score first.
 */
export function getRelevantSnippets(prompt: string, limit = 4): ScriptSnippet[] {
  const lower = (prompt || "").toLowerCase();
  if (!lower.trim()) return [];
  const scored = SCRIPT_SNIPPETS.map((s) => {
    let score = 0;
    for (const kw of s.keywords) {
      if (lower.includes(kw)) score += 3;
    }
    // Light bonus for a name-word match (e.g. "teleporter").
    for (const word of s.name.toLowerCase().split(/\s+/)) {
      if (word.length > 3 && lower.includes(word)) score += 1;
    }
    return { s, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.s);
}

/**
 * Build a context block of matching snippets for injection into the AI's
 * system prompt. Empty string when nothing matches.
 */
export function buildSnippetsContextBlock(prompt: string): string {
  const snippets = getRelevantSnippets(prompt);
  if (snippets.length === 0) return "";

  let block = `\n\n## READY-MADE SCRIPT SNIPPETS\nProven drop-in scripts that match this request. Adapt names/config to fit; place each at its suggested parent.\n`;
  for (const s of snippets) {
    block += `\n### ${s.name} — ${s.description}\n`;
    block += `Place: ${s.scriptType} in ${s.parent}\n`;
    block += `\`\`\`luau\n${s.code}\n\`\`\`\n`;
  }
  block += `\nUse these as a starting point — adjust constants and names to the user's request rather than copying blindly.\n`;
  return block;
}
