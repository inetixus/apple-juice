local Players = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local syncEvent = ReplicatedStorage:WaitForChild("AppleJuicePlanSync")


local IDS = {
	PRO = "EXP-6181762863565242936",
	ULTRA = "EXP-2786378855714259452"
}

local COLORS = {
	bg = Color3.fromRGB(15, 17, 21),
	cardBg = Color3.fromRGB(20, 22, 28),
	green = Color3.fromRGB(204, 255, 0),
	purple = Color3.fromRGB(124, 58, 237),
	white = Color3.fromRGB(255, 255, 255),
	dim = Color3.fromRGB(120, 120, 120),
	faint = Color3.fromRGB(60, 60, 65),
}

-- ━━━ TWEEN HELPERS ━━━
local function tweenIn(obj, props, duration, delay)
	task.delay(delay or 0, function()
		TweenService:Create(obj, TweenInfo.new(duration or 0.5, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), props):Play()
	end)
end

local function hoverBtn(btn, hoverColor, normalColor)
	btn.MouseEnter:Connect(function()
		TweenService:Create(btn, TweenInfo.new(0.2), {BackgroundColor3 = hoverColor}):Play()
	end)
	btn.MouseLeave:Connect(function()
		TweenService:Create(btn, TweenInfo.new(0.2), {BackgroundColor3 = normalColor}):Play()
	end)
end

-- ━━━ SCREEN GUI ━━━
local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "AppleJuiceStore"
ScreenGui.ResetOnSpawn = false
ScreenGui.IgnoreGuiInset = true
ScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
ScreenGui.Parent = playerGui

-- Blur 3D world
local blur = Instance.new("BlurEffect")
blur.Size = 24
blur.Parent = game:GetService("Lighting")

-- ━━━ MAIN FRAME ━━━
local Main = Instance.new("Frame")
Main.Size = UDim2.new(1, 0, 1, 0)
Main.BackgroundColor3 = COLORS.bg
Main.BorderSizePixel = 0
Main.Parent = ScreenGui

-- Neon top line (like the site)
local TopLine = Instance.new("Frame")
TopLine.Size = UDim2.new(1, 0, 0, 2)
TopLine.BorderSizePixel = 0
TopLine.Parent = Main
local TopGrad = Instance.new("UIGradient")
TopGrad.Color = ColorSequence.new({
	ColorSequenceKeypoint.new(0, COLORS.bg),
	ColorSequenceKeypoint.new(0.5, COLORS.green),
	ColorSequenceKeypoint.new(1, COLORS.bg),
})
TopGrad.Parent = TopLine

-- ━━━ FLOATING GLOW ORBS (animated background) ━━━
local function makeOrb(color, size, posX, posY, driftX, driftY)
	local orb = Instance.new("Frame")
	orb.Size = UDim2.new(0, size, 0, size)
	orb.AnchorPoint = Vector2.new(0.5, 0.5)
	orb.Position = UDim2.new(posX, 0, posY, 0)
	orb.BackgroundColor3 = color
	orb.BackgroundTransparency = 0.92
	orb.BorderSizePixel = 0
	orb.ZIndex = 1
	orb.Parent = Main
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(1, 0)
	c.Parent = orb
	-- Slow drift animation loop
	task.spawn(function()
		while orb.Parent do
			tweenIn(orb, {Position = UDim2.new(posX + driftX, 0, posY + driftY, 0)}, 6)
			task.wait(6)
			tweenIn(orb, {Position = UDim2.new(posX, 0, posY, 0)}, 6)
			task.wait(6)
		end
	end)
end

makeOrb(COLORS.green, 300, 0.15, 0.3, 0.05, 0.05)
makeOrb(COLORS.purple, 350, 0.85, 0.7, -0.04, -0.06)
makeOrb(COLORS.green, 200, 0.7, 0.2, -0.03, 0.04)

-- ━━━ HEADER ━━━
local Header = Instance.new("Frame")
Header.Size = UDim2.new(1, 0, 0, 160)
Header.Position = UDim2.new(0, 0, 0, 30)
Header.BackgroundTransparency = 1
Header.ZIndex = 5
Header.Parent = Main

local Badge = Instance.new("TextLabel")
Badge.Size = UDim2.new(0, 200, 0, 26)
Badge.AnchorPoint = Vector2.new(0.5, 0)
Badge.Position = UDim2.new(0.5, 0, 0, 0)
Badge.BackgroundColor3 = Color3.fromRGB(30, 32, 38)
Badge.Text = "  THE DEVELOPER'S EDGE  "
Badge.Font = Enum.Font.GothamBold
Badge.TextSize = 10
Badge.TextColor3 = COLORS.dim
Badge.ZIndex = 5
Badge.Parent = Header
Instance.new("UICorner", Badge).CornerRadius = UDim.new(1, 0)
local badgeStroke = Instance.new("UIStroke")
badgeStroke.Color = COLORS.faint
badgeStroke.Thickness = 1
badgeStroke.Parent = Badge

-- Animate badge in
Badge.BackgroundTransparency = 1
Badge.TextTransparency = 1
tweenIn(Badge, {BackgroundTransparency = 0, TextTransparency = 0}, 0.6, 0.2)

local Title = Instance.new("TextLabel")
Title.Size = UDim2.new(1, 0, 0, 55)
Title.Position = UDim2.new(0, 0, 0, 38)
Title.BackgroundTransparency = 1
Title.RichText = true
Title.Text = 'Stop <font color="#ccff00">Coding</font>. Start <font color="#a78bfa">Building.</font>'
Title.Font = Enum.Font.GothamBlack
Title.TextSize = 44
Title.TextColor3 = COLORS.white
Title.ZIndex = 5
Title.Parent = Header

Title.TextTransparency = 1
tweenIn(Title, {TextTransparency = 0}, 0.7, 0.4)

local Sub = Instance.new("TextLabel")
Sub.Size = UDim2.new(0.6, 0, 0, 30)
Sub.AnchorPoint = Vector2.new(0.5, 0)
Sub.Position = UDim2.new(0.5, 0, 0, 100)
Sub.BackgroundTransparency = 1
Sub.Text = "Why waste hours debugging? Let Apple Juice handle the heavy lifting while you build."
Sub.Font = Enum.Font.Gotham
Sub.TextSize = 15
Sub.TextColor3 = COLORS.dim
Sub.ZIndex = 5
Sub.Parent = Header

Sub.TextTransparency = 1
tweenIn(Sub, {TextTransparency = 0}, 0.6, 0.6)

-- ━━━ NOTIFICATION HELPER ━━━
local function showNotify(msg)
	local n = Instance.new("TextLabel")
	n.Size = UDim2.new(0, 400, 0, 40)
	n.Position = UDim2.new(0.5, -200, 0.9, 0)
	n.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
	n.TextColor3 = COLORS.white
	n.Font = Enum.Font.GothamBold
	n.TextSize = 14
	n.Text = msg
	n.ZIndex = 50
	n.Parent = Main
	Instance.new("UICorner", n).CornerRadius = UDim.new(0, 10)
	Instance.new("UIStroke", n).Color = COLORS.white

	TweenService:Create(n, TweenInfo.new(0.5), {Position = UDim2.new(0.5, -200, 0.8, 0)}):Play()
	task.wait(3)
	local t = TweenService:Create(n, TweenInfo.new(0.5), {TextTransparency = 1, BackgroundTransparency = 1})
	t:Play()
	t.Completed:Connect(function() n:Destroy() end)
end

-- ━━━ SCROLLING FRAME ━━━

local Scroll = Instance.new("ScrollingFrame")
Scroll.Size = UDim2.new(1, 0, 1, -240)
Scroll.Position = UDim2.new(0, 0, 0, 190)
Scroll.BackgroundTransparency = 1
Scroll.ScrollBarThickness = 8
Scroll.CanvasSize = UDim2.new(0, 0, 0, 800)
Scroll.ZIndex = 5
Scroll.Parent = Main

-- ━━━ MANAGE BUTTON ━━━
local ManageBtn = Instance.new("TextButton")
ManageBtn.Size = UDim2.new(0, 200, 0, 30)
ManageBtn.Position = UDim2.new(0.5, -100, 1, -35)
ManageBtn.BackgroundTransparency = 1
ManageBtn.Text = "Manage Subscriptions ⚙️"
ManageBtn.Font = Enum.Font.GothamBold
ManageBtn.TextSize = 12
ManageBtn.TextColor3 = COLORS.dim
ManageBtn.ZIndex = 10
ManageBtn.Parent = Main

ManageBtn.MouseButton1Click:Connect(function()
	showNotify("Open the Roblox Menu (Esc) > Subscriptions to cancel.")
end)

hoverBtn(ManageBtn, COLORS.white, COLORS.dim)

-- ━━━ HELP MODAL (Subscription Management) ━━━
local HelpModal = Instance.new("Frame")
HelpModal.Size = UDim2.new(0, 800, 0, 600)
HelpModal.Position = UDim2.new(0.5, -400, 0.5, -300)
HelpModal.BackgroundColor3 = COLORS.bg
HelpModal.BorderSizePixel = 0
HelpModal.Visible = false
HelpModal.ZIndex = 100
HelpModal.Parent = Main
Instance.new("UICorner", HelpModal).CornerRadius = UDim.new(0, 24)
Instance.new("UIStroke", HelpModal).Color = COLORS.white
Instance.new("UIStroke", HelpModal).Transparency = 0.8

local HelpTitle = Instance.new("TextLabel")
HelpTitle.Size = UDim2.new(1, 0, 0, 80)
HelpTitle.BackgroundTransparency = 1
HelpTitle.Text = "SUBSCRIPTION MANAGEMENT GUIDE"
HelpTitle.Font = Enum.Font.GothamBlack
HelpTitle.TextSize = 28
HelpTitle.TextColor3 = COLORS.white
HelpTitle.ZIndex = 101
HelpTitle.Parent = HelpModal


local CloseHelp = Instance.new("TextButton")
CloseHelp.Size = UDim2.new(0, 40, 0, 40)
CloseHelp.Position = UDim2.new(1, -50, 0, 10)
CloseHelp.BackgroundTransparency = 1
CloseHelp.Text = "✕"
CloseHelp.Font = Enum.Font.GothamBold
CloseHelp.TextSize = 20
CloseHelp.TextColor3 = COLORS.dim
CloseHelp.ZIndex = 102
CloseHelp.Parent = HelpModal
CloseHelp.MouseButton1Click:Connect(function() HelpModal.Visible = false end)

local HelpScroll = Instance.new("ScrollingFrame")
HelpScroll.Size = UDim2.new(1, -40, 1, -100)
HelpScroll.Position = UDim2.new(0, 20, 0, 90)
HelpScroll.CanvasSize = UDim2.new(0, 0, 0, 3000)
HelpScroll.BackgroundTransparency = 1
HelpScroll.ScrollBarThickness = 6
HelpScroll.ZIndex = 101
HelpScroll.Parent = HelpModal


local function createHelpStep(parent, text, imageId)
	local container = Instance.new("Frame")
	container.Size = UDim2.new(1, 0, 0, imageId and 580 or 80)
	container.BackgroundTransparency = 0.9
	container.BackgroundColor3 = COLORS.white
	container.BorderSizePixel = 0
	container.ZIndex = 102
	container.Parent = parent
	Instance.new("UICorner", container).CornerRadius = UDim.new(0, 12)

	local txt = Instance.new("TextLabel")
	txt.Size = UDim2.new(1, -40, 0, 60)
	txt.Position = UDim2.new(0, 20, 0, 10)
	txt.BackgroundTransparency = 1
	txt.Text = text
	txt.Font = Enum.Font.GothamBold
	txt.TextSize = 15
	txt.TextColor3 = COLORS.white
	txt.TextWrapped = true
	txt.TextXAlignment = Enum.TextXAlignment.Left
	txt.TextYAlignment = Enum.TextYAlignment.Top
	txt.ZIndex = 103
	txt.Parent = container

	if imageId then
		local img = Instance.new("ImageLabel")
		img.Size = UDim2.new(1, -40, 0, 480)
		img.Position = UDim2.new(0, 20, 0, 80)
		img.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
		img.BorderSizePixel = 0
		img.Image = "rbxassetid://" .. imageId
		img.ScaleType = Enum.ScaleType.Fit
		img.ZIndex = 103
		img.Parent = container
		Instance.new("UICorner", img).CornerRadius = UDim.new(0, 8)
	end

	return container
end

local helpLayout = Instance.new("UIListLayout")
helpLayout.Padding = UDim.new(0, 20)
helpLayout.Parent = HelpScroll

local function addHeader(parent, text)
	local h = Instance.new("TextLabel")
	h.Size = UDim2.new(1, 0, 0, 40)
	h.BackgroundTransparency = 1
	h.Text = "<b>" .. text .. "</b>"
	h.RichText = true
	h.Font = Enum.Font.GothamBlack
	h.TextSize = 20
	h.TextColor3 = COLORS.green
	h.TextXAlignment = Enum.TextXAlignment.Left
	h.ZIndex = 102
	h.Parent = parent
end

addHeader(HelpScroll, "METHOD 1: ROBLOX APP")
createHelpStep(HelpScroll, "1. Accessing More Options: On the main Roblox home screen, look at the left-hand sidebar and click the 'More' icon (the circle with three dots) as indicated by the red arrow.", "83819042837121")
createHelpStep(HelpScroll, "2. Opening Settings: Inside the 'More' menu, find the tile labeled 'Settings' with the gear icon. Click it to access your account preferences.", "140575477491304")
createHelpStep(HelpScroll, "3. Managing Subscriptions: In the Settings list, find 'Subscriptions'. This is where Roblox stores all your active recurring payments for games like Apple Juice.", "99357639459693")

addHeader(HelpScroll, "METHOD 2: ROBLOX WEBSITE")
createHelpStep(HelpScroll, "1. Gear Icon: On the Roblox.com home page, click the Gear icon located in the top-right corner and select 'Settings' from the dropdown menu.", "102045517989356")
createHelpStep(HelpScroll, "2. Sidebar Navigation: Once in Settings, look at the left-hand sidebar menu and click on 'Subscriptions' to view your current billing cycles.", "110641640572709")


ManageBtn.MouseButton1Click:Connect(function()
	HelpModal.Visible = true
end)


-- ━━━ CARD CONTAINER (Plans) ━━━


local Cards = Instance.new("Frame")
Cards.Size = UDim2.new(0, 960, 0, 420)
Cards.AnchorPoint = Vector2.new(0.5, 0)
Cards.Position = UDim2.new(0.5, 0, 0, 20)
Cards.BackgroundTransparency = 1
Cards.ZIndex = 5
Cards.Parent = Scroll

local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Horizontal
layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
layout.VerticalAlignment = Enum.VerticalAlignment.Center
layout.Padding = UDim.new(0, 20)
layout.Parent = Cards

-- ━━━ CARD BUILDER ━━━
local cardIndex = 0

local function createCard(rankName, planName, price, features, accentColor, buttonText, subId, isPopular)
	cardIndex += 1
	local idx = cardIndex

	local Card = Instance.new("Frame")
	Card.Name = "Card_" .. planName
	Card.Size = UDim2.new(0, 300, 0, 420)
	Card.BackgroundColor3 = COLORS.cardBg
	Card.BorderSizePixel = 0
	Card.ZIndex = 5
	Card.BackgroundTransparency = 1 -- start invisible for animation
	Card.Parent = Cards
	Instance.new("UICorner", Card).CornerRadius = UDim.new(0, 20)

	local stroke = Instance.new("UIStroke")
	stroke.Color = accentColor
	stroke.Thickness = 1
	stroke.Transparency = 0.6
	stroke.Parent = Card

	-- Top gradient glow
	local glow = Instance.new("Frame")
	glow.Size = UDim2.new(1, 0, 0, 120)
	glow.BackgroundColor3 = COLORS.white
	glow.BorderSizePixel = 0
	glow.ZIndex = 5
	glow.Parent = Card
	Instance.new("UICorner", glow).CornerRadius = UDim.new(0, 20)
	local grad = Instance.new("UIGradient")
	grad.Color = ColorSequence.new(accentColor, COLORS.cardBg)
	grad.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.85),
		NumberSequenceKeypoint.new(1, 1),
	})
	grad.Rotation = 90
	grad.Parent = glow

	-- "Most Popular" badge
	if isPopular then
		local pop = Instance.new("TextLabel")
		pop.Size = UDim2.new(0, 120, 0, 24)
		pop.AnchorPoint = Vector2.new(0.5, 0.5)
		pop.Position = UDim2.new(0.5, 0, 0, 0)
		pop.BackgroundColor3 = COLORS.green
		pop.Text = "MOST POPULAR"
		pop.Font = Enum.Font.GothamBlack
		pop.TextSize = 10
		pop.TextColor3 = Color3.fromRGB(0, 0, 0)
		pop.ZIndex = 10
		pop.Parent = Card
		Instance.new("UICorner", pop).CornerRadius = UDim.new(1, 0)
	end

	-- Rank label
	local rank = Instance.new("TextLabel")
	rank.Size = UDim2.new(1, -40, 0, 16)
	rank.Position = UDim2.new(0, 20, 0, 24)
	rank.BackgroundTransparency = 1
	rank.Text = string.upper(rankName)
	rank.Font = Enum.Font.GothamBold
	rank.TextSize = 10
	rank.TextColor3 = accentColor
	rank.TextXAlignment = Enum.TextXAlignment.Left
	rank.ZIndex = 6
	rank.Parent = Card

	-- Plan name
	local name = Instance.new("TextLabel")
	name.Size = UDim2.new(1, -40, 0, 28)
	name.Position = UDim2.new(0, 20, 0, 44)
	name.BackgroundTransparency = 1
	name.Text = planName
	name.Font = Enum.Font.GothamBlack
	name.TextSize = 22
	name.TextColor3 = COLORS.white
	name.TextXAlignment = Enum.TextXAlignment.Left
	name.ZIndex = 6
	name.Parent = Card

	-- Price
	local priceLbl = Instance.new("TextLabel")
	priceLbl.Size = UDim2.new(1, -40, 0, 40)
	priceLbl.Position = UDim2.new(0, 20, 0, 76)
	priceLbl.BackgroundTransparency = 1
	priceLbl.RichText = true
	priceLbl.Text = '<font size="34"><b>' .. price .. ' R$</b></font> <font size="13" color="#888888">/mo</font>'
	priceLbl.Font = Enum.Font.GothamBlack
	priceLbl.TextSize = 34
	priceLbl.TextColor3 = COLORS.white
	priceLbl.TextXAlignment = Enum.TextXAlignment.Left
	priceLbl.ZIndex = 6
	priceLbl.Parent = Card

	-- Divider
	local div = Instance.new("Frame")
	div.Size = UDim2.new(1, -40, 0, 1)
	div.Position = UDim2.new(0, 20, 0, 128)
	div.BackgroundColor3 = COLORS.faint
	div.BackgroundTransparency = 0.5
	div.BorderSizePixel = 0
	div.ZIndex = 6
	div.Parent = Card

	-- Features
	local featFrame = Instance.new("Frame")
	featFrame.Size = UDim2.new(1, -40, 0, 180)
	featFrame.Position = UDim2.new(0, 20, 0, 142)
	featFrame.BackgroundTransparency = 1
	featFrame.ZIndex = 6
	featFrame.Parent = Card
	local fLayout = Instance.new("UIListLayout")
	fLayout.Padding = UDim.new(0, 10)
	fLayout.Parent = featFrame

	for _, text in ipairs(features) do
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, 0, 0, 18)
		row.BackgroundTransparency = 1
		row.ZIndex = 6
		row.Parent = featFrame

		local dot = Instance.new("TextLabel")
		dot.Size = UDim2.new(0, 16, 0, 18)
		dot.BackgroundTransparency = 1
		dot.Text = "✦"
		dot.Font = Enum.Font.GothamBold
		dot.TextSize = 10
		dot.TextColor3 = accentColor
		dot.ZIndex = 6
		dot.Parent = row

		local lbl = Instance.new("TextLabel")
		lbl.Size = UDim2.new(1, -22, 0, 18)
		lbl.Position = UDim2.new(0, 22, 0, 0)
		lbl.BackgroundTransparency = 1
		lbl.Text = text
		lbl.Font = Enum.Font.Gotham
		lbl.TextSize = 13
		lbl.TextColor3 = Color3.fromRGB(200, 200, 200)
		lbl.TextXAlignment = Enum.TextXAlignment.Left
		lbl.TextWrapped = true
		lbl.ZIndex = 6
		lbl.Parent = row
	end

	-- CTA Button
	local btnColor = (price == "0") and Color3.fromRGB(40, 42, 48) or accentColor
	local btnHover = (price == "0") and Color3.fromRGB(55, 57, 63) or (price == "600" and COLORS.white or Color3.fromRGB(157, 100, 255))
	local btnText = (price == "600") and Color3.fromRGB(0,0,0) or COLORS.white

	local btn = Instance.new("TextButton")
	btn.Size = UDim2.new(1, -40, 0, 46)
	btn.Position = UDim2.new(0, 20, 1, -66)
	btn.BackgroundColor3 = btnColor
	btn.Text = buttonText
	btn.Font = Enum.Font.GothamBlack
	btn.TextSize = 14
	btn.TextColor3 = btnText
	btn.ZIndex = 6
	btn.AutoButtonColor = false
	btn.Parent = Card
	Instance.new("UICorner", btn).CornerRadius = UDim.new(0, 14)

	-- Button glow shadow for paid tiers
	if price ~= "0" then
		local shadow = Instance.new("Frame")
		shadow.Size = UDim2.new(1, 10, 0, 46)
		shadow.AnchorPoint = Vector2.new(0.5, 0.5)
		shadow.Position = UDim2.new(0.5, 0, 0.5, 0)
		shadow.BackgroundColor3 = accentColor
		shadow.BackgroundTransparency = 0.7
		shadow.BorderSizePixel = 0
		shadow.ZIndex = 5
		shadow.Parent = btn
		Instance.new("UICorner", shadow).CornerRadius = UDim.new(0, 14)
	end

	hoverBtn(btn, btnHover, btnColor)

	local clickConn = nil
	local function updateButton(text, color, newSubId)
		btn.Text = text
		btn.BackgroundColor3 = color
		if clickConn then clickConn:Disconnect() end

		if newSubId then
			btn.AutoButtonColor = true
			clickConn = btn.MouseButton1Click:Connect(function()
				MarketplaceService:PromptSubscriptionPurchase(player, newSubId)
			end)
		else
			btn.AutoButtonColor = false
		end
	end

	-- ━━━ ENTRANCE ANIMATION ━━━

	Card.Position = UDim2.new(0, 0, 0, 40) -- start offset down
	tweenIn(Card, {BackgroundTransparency = 0, Position = UDim2.new(0, 0, 0, 0)}, 0.6, 0.3 + (idx * 0.15))

	local cardObj = {Card = Card, Button = btn, DefaultColor = btnColor, AccentColor = accentColor, Update = updateButton, SubId = subId}
	return cardObj
end

-- ━━━ REFILLS CONTAINER (Dev Products) ━━━
local RefillsFrame = Instance.new("Frame")
RefillsFrame.Size = UDim2.new(0, 940, 0, 200)
RefillsFrame.AnchorPoint = Vector2.new(0.5, 0)
RefillsFrame.Position = UDim2.new(0.5, 0, 0, 480)
RefillsFrame.BackgroundColor3 = Color3.fromRGB(20, 22, 28)
RefillsFrame.BorderSizePixel = 0
RefillsFrame.ZIndex = 5
RefillsFrame.Parent = Scroll
Instance.new("UICorner", RefillsFrame).CornerRadius = UDim.new(0, 20)

local RefillsStroke = Instance.new("UIStroke")
RefillsStroke.Color = Color3.fromRGB(255, 255, 255)
RefillsStroke.Thickness = 1
RefillsStroke.Transparency = 0.85
RefillsStroke.Parent = RefillsFrame

local RefillTitle = Instance.new("TextLabel")
RefillTitle.Size = UDim2.new(1, -40, 0, 40)
RefillTitle.Position = UDim2.new(0, 20, 0, 20)
RefillTitle.BackgroundTransparency = 1
RefillTitle.RichText = true
RefillTitle.Text = 'INSTANT <font color="#ccff00">JUICE BOX</font> REFILLS'
RefillTitle.Font = Enum.Font.GothamBlack
RefillTitle.TextSize = 22
RefillTitle.TextColor3 = COLORS.white
RefillTitle.TextXAlignment = Enum.TextXAlignment.Left
RefillTitle.ZIndex = 6
RefillTitle.Parent = RefillsFrame

local RefillList = Instance.new("Frame")
RefillList.Size = UDim2.new(1, -40, 0, 100)
RefillList.Position = UDim2.new(0, 20, 0, 70)
RefillList.BackgroundTransparency = 1
RefillList.ZIndex = 6
RefillList.Parent = RefillsFrame

local rLayout = Instance.new("UIListLayout")
rLayout.FillDirection = Enum.FillDirection.Horizontal
rLayout.Padding = UDim.new(0, 20)
rLayout.Parent = RefillList

local function createRefillItem(name, price, desc, accentColor, pId, isValue)
	local item = Instance.new("TextButton")
	item.Size = UDim2.new(0, 286, 0, 100)
	item.BackgroundColor3 = COLORS.bg
	item.BorderSizePixel = 0
	item.AutoButtonColor = false
	item.Text = ""
	item.ZIndex = 7
	item.Parent = RefillList
	Instance.new("UICorner", item).CornerRadius = UDim.new(0, 16)

	local stroke = Instance.new("UIStroke")
	stroke.Color = accentColor
	stroke.Thickness = isValue and 2 or 1
	stroke.Transparency = isValue and 0.2 or 0.8
	stroke.Parent = item

	hoverBtn(item, Color3.fromRGB(30, 32, 40), COLORS.bg)

	local nLbl = Instance.new("TextLabel")
	nLbl.Size = UDim2.new(1, -30, 0, 20)
	nLbl.Position = UDim2.new(0, 15, 0, 15)
	nLbl.BackgroundTransparency = 1
	nLbl.Text = string.upper(name)
	nLbl.Font = Enum.Font.GothamBold
	nLbl.TextSize = 10
	nLbl.TextColor3 = COLORS.dim
	nLbl.TextXAlignment = Enum.TextXAlignment.Left
	nLbl.ZIndex = 8
	nLbl.Parent = item

	local pLbl = Instance.new("TextLabel")
	pLbl.Size = UDim2.new(1, -30, 0, 30)
	pLbl.Position = UDim2.new(0, 15, 0, 35)
	pLbl.BackgroundTransparency = 1
	pLbl.Text = price .. " R$"
	pLbl.Font = Enum.Font.GothamBlack
	pLbl.TextSize = 24
	pLbl.TextColor3 = COLORS.white
	pLbl.TextXAlignment = Enum.TextXAlignment.Left
	pLbl.ZIndex = 8
	pLbl.Parent = item

	local dLbl = Instance.new("TextLabel")
	dLbl.Size = UDim2.new(1, -30, 0, 20)
	dLbl.Position = UDim2.new(0, 15, 0, 65)
	dLbl.BackgroundTransparency = 1
	dLbl.Text = desc
	dLbl.Font = Enum.Font.GothamBold
	dLbl.TextSize = 12
	dLbl.TextColor3 = accentColor
	dLbl.TextXAlignment = Enum.TextXAlignment.Left
	dLbl.ZIndex = 8
	dLbl.Parent = item

	if isValue then
		local best = Instance.new("TextLabel")
		best.Size = UDim2.new(0, 70, 0, 16)
		best.BackgroundColor3 = accentColor
		best.Text = "BEST VALUE"
		best.Font = Enum.Font.GothamBlack
		best.TextSize = 9
		best.TextColor3 = Color3.fromRGB(0,0,0)
		best.ZIndex = 9
		best.Parent = item
		local c = Instance.new("UICorner")
		c.CornerRadius = UDim.new(0, 8)
		c.Parent = best
	end

	item.MouseButton1Click:Connect(function()
		MarketplaceService:PromptProductPurchase(player, pId)
	end)
end

createRefillItem("Small Sip", "350", "+5,000 mL Refill", COLORS.white, 3585012060, false)
createRefillItem("Juice Box", "950", "+20,000 mL Refill", COLORS.green, 3585218786, true)
createRefillItem("Mega Jug", "3,000", "+80,000 mL Refill", COLORS.white, 3585218944, false)

-- ━━━ CREATE THE 3 CARDS ━━━
local freeCard = createCard("Hobbyist", "Free Sip", "0",
	{"1,000 mL daily quota", "2 Project Limit", "Basic code snippets & logic", "Single-script context only"},
	COLORS.dim, "Current Plan", nil, false
)

local proCard = createCard("The Scripter", "Fresh Pro", "600",
	{"5,000 mL daily quota", "3 Project Limit", "One-Click Debugger: Fix errors instantly", "Multi-Script Logic: AI reads your files", "Gemini 3 Pro Access"},
	COLORS.green, "Upgrade Now", IDS.PRO, true
)

local ultraCard = createCard("The Architect", "Pure Ultra", "1,500",
	{"15,000 mL daily quota", "8 Project Limit", "Anti-Lag Engine: Auto optimization", "System Design: Full architecture", "OpenAI o1 & Priority Reasoning"},
	COLORS.purple, "Go Ultra", IDS.ULTRA, false
)

-- ━━━ HANDLE SYNC FROM SERVER ━━━
syncEvent.OnClientEvent:Connect(function(activePlan)
	-- Default State (if nothing is active)
	freeCard.Update("Current Plan", Color3.fromRGB(40, 42, 48), nil)
	proCard.Update("Upgrade Now", proCard.DefaultColor, IDS.PRO)
	ultraCard.Update("Go Ultra", ultraCard.DefaultColor, IDS.ULTRA)

	-- Set the active states
	if activePlan == "fresh_pro" then
		freeCard.Update("Downgrade", COLORS.faint, nil)
		proCard.Update("Current Plan", Color3.fromRGB(40, 42, 48), nil)
		ultraCard.Update("Go Ultra", ultraCard.DefaultColor, IDS.ULTRA)
	elseif activePlan == "pure_ultra" then
		freeCard.Update("Downgrade", COLORS.faint, nil)
		proCard.Update("Downgrade", COLORS.faint, nil)
		ultraCard.Update("Current Plan", Color3.fromRGB(40, 42, 48), nil)
	end
end)

-- Initial state before sync arrives
freeCard.Update("Current Plan", Color3.fromRGB(40, 42, 48), nil)
proCard.Update("Upgrade Now", proCard.DefaultColor, IDS.PRO)
ultraCard.Update("Go Ultra", ultraCard.DefaultColor, IDS.ULTRA)
