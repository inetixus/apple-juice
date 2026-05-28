-- AppleJuiceUI Component Library v1.0
-- Auto-deployed by Apple Juice AI into ReplicatedStorage
local TweenService = game:GetService("TweenService")
local Players = game:GetService("Players")

local UI = {}
UI._themes = {
	Juice = {
		bg = Color3.fromRGB(26,26,46), surface = Color3.fromRGB(35,35,55),
		surfaceHover = Color3.fromRGB(50,50,70), accent = Color3.fromRGB(204,255,0),
		accentDark = Color3.fromRGB(160,200,0), text = Color3.fromRGB(255,255,255),
		textDim = Color3.fromRGB(160,160,180), error = Color3.fromRGB(240,80,80),
		success = Color3.fromRGB(80,200,120), warning = Color3.fromRGB(240,200,60),
		border = Color3.fromRGB(60,60,80), shadow = Color3.fromRGB(0,0,0),
		corner = 12, font = Enum.Font.GothamBold, fontBody = Enum.Font.Gotham,
	},
	Midnight = {
		bg = Color3.fromRGB(13,17,23), surface = Color3.fromRGB(22,27,34),
		surfaceHover = Color3.fromRGB(33,38,45), accent = Color3.fromRGB(88,166,255),
		accentDark = Color3.fromRGB(56,132,220), text = Color3.fromRGB(230,237,243),
		textDim = Color3.fromRGB(125,133,144), error = Color3.fromRGB(248,81,73),
		success = Color3.fromRGB(63,185,80), warning = Color3.fromRGB(210,153,34),
		border = Color3.fromRGB(48,54,61), shadow = Color3.fromRGB(0,0,0),
		corner = 10, font = Enum.Font.GothamBold, fontBody = Enum.Font.Gotham,
	},
	Ember = {
		bg = Color3.fromRGB(28,16,23), surface = Color3.fromRGB(40,25,35),
		surfaceHover = Color3.fromRGB(55,35,48), accent = Color3.fromRGB(255,107,53),
		accentDark = Color3.fromRGB(200,80,40), text = Color3.fromRGB(255,238,221),
		textDim = Color3.fromRGB(180,150,140), error = Color3.fromRGB(240,60,60),
		success = Color3.fromRGB(100,210,100), warning = Color3.fromRGB(255,200,50),
		border = Color3.fromRGB(70,45,55), shadow = Color3.fromRGB(0,0,0),
		corner = 14, font = Enum.Font.GothamBold, fontBody = Enum.Font.Gotham,
	},
	Claude = {
		bg = Color3.fromRGB(11,11,13), surface = Color3.fromRGB(20,20,24),
		surfaceHover = Color3.fromRGB(33,33,40), accent = Color3.fromRGB(215,119,87), -- Claude Orange
		accentDark = Color3.fromRGB(180,95,55), text = Color3.fromRGB(255,255,255),
		textDim = Color3.fromRGB(177,185,249), -- Permission Purple
		error = Color3.fromRGB(255,107,128), success = Color3.fromRGB(78,186,101),
		warning = Color3.fromRGB(255,193,7), border = Color3.fromRGB(175,135,255), -- Electric Violet
		shadow = Color3.fromRGB(0,0,0), corner = 10,
		font = Enum.Font.RobotoMono, fontBody = Enum.Font.RobotoMono,
	},
}
UI._activeTheme = "Juice"
function UI.setTheme(name) if UI._themes[name] then UI._activeTheme = name end end
function UI.theme() return UI._themes[UI._activeTheme] end

local function applyProps(inst, props)
	for k,v in pairs(props) do
		if k ~= "Parent" and k ~= "Children" and k ~= "OnClick" and k ~= "OnClose" and k ~= "OnChanged" then
			pcall(function() inst[k] = v end)
		end
	end
	if props.Children then for _,c in ipairs(props.Children) do c.Parent = inst end end
	if props.Parent then inst.Parent = props.Parent end
	return inst
end

local function tween(inst, dur, props)
	TweenService:Create(inst, TweenInfo.new(dur, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), props):Play()
end

function UI.createScreenGui(name)
	local sg = Instance.new("ScreenGui")
	sg.Name = name or "AppleJuiceGui"
	sg.ResetOnSpawn = false
	sg.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	sg.DisplayOrder = 100
	sg.Parent = Players.LocalPlayer:WaitForChild("PlayerGui", 10)
	return sg
end

function UI.Frame(parent, props)
	props = props or {}
	local t = UI.theme()
	local f = Instance.new("Frame")
	f.BackgroundColor3 = props.BackgroundColor3 or t.surface
	f.BorderSizePixel = 0
	f.Size = props.Size or UDim2.new(1,0,1,0)
	applyProps(f, props)
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0, props.Corner or t.corner); c.Parent = f
	if parent then f.Parent = parent end
	return f
end

function UI.Card(parent, props)
	props = props or {}
	local t = UI.theme()
	local f = UI.Frame(nil, {
		BackgroundColor3 = props.BackgroundColor3 or t.surface,
		Size = props.Size or UDim2.new(1,0,0,80),
		Position = props.Position, AnchorPoint = props.AnchorPoint,
		Corner = props.Corner,
	})
	f.Name = props.Name or "Card"
	local s = Instance.new("UIStroke"); s.Color = t.border; s.Thickness = 1; s.Transparency = 0.5; s.Parent = f
	if props.Padding then
		local p = Instance.new("UIPadding")
		p.PaddingTop = UDim.new(0, props.Padding); p.PaddingBottom = UDim.new(0, props.Padding)
		p.PaddingLeft = UDim.new(0, props.Padding); p.PaddingRight = UDim.new(0, props.Padding)
		p.Parent = f
	end
	if props.Children then for _,c in ipairs(props.Children) do c.Parent = f end end
	if parent then f.Parent = parent end
	return f
end

function UI.Button(parent, props)
	props = props or {}
	local t = UI.theme()
	local style = props.Style or "Primary"
	local bgColor = style == "Primary" and t.accent or style == "Danger" and t.error or t.surface
	local txtColor = style == "Primary" and Color3.fromRGB(0,0,0) or t.text

	local btn = Instance.new("TextButton")
	btn.Name = props.Name or "Button"
	btn.Size = props.Size or UDim2.new(1,0,0,44)
	btn.Position = props.Position or UDim2.new(0,0,0,0)
	btn.AnchorPoint = props.AnchorPoint or Vector2.new(0,0)
	btn.BackgroundColor3 = bgColor
	btn.TextColor3 = txtColor
	btn.Text = props.Text or "Button"
	btn.Font = t.font
	btn.TextSize = props.TextSize or 15
	btn.BorderSizePixel = 0
	btn.AutoButtonColor = false

	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0, props.Corner or t.corner); c.Parent = btn
	if style ~= "Ghost" then
		local s = Instance.new("UIStroke"); s.Color = t.border; s.Thickness = 1; s.Transparency = 0.6; s.Parent = btn
	end

	local origSize = btn.Size
	btn.MouseEnter:Connect(function()
		tween(btn, 0.12, {BackgroundColor3 = style == "Primary" and t.accentDark or t.surfaceHover})
		tween(btn, 0.12, {Size = UDim2.new(origSize.X.Scale, origSize.X.Offset+4, origSize.Y.Scale, origSize.Y.Offset+2)})
	end)
	btn.MouseLeave:Connect(function()
		tween(btn, 0.12, {BackgroundColor3 = bgColor})
		tween(btn, 0.12, {Size = origSize})
	end)
	btn.MouseButton1Down:Connect(function()
		tween(btn, 0.05, {Size = UDim2.new(origSize.X.Scale, origSize.X.Offset-4, origSize.Y.Scale, origSize.Y.Offset-2)})
	end)
	btn.MouseButton1Up:Connect(function()
		tween(btn, 0.1, {Size = UDim2.new(origSize.X.Scale, origSize.X.Offset+4, origSize.Y.Scale, origSize.Y.Offset+2)})
	end)
	if props.OnClick then btn.MouseButton1Click:Connect(props.OnClick) end
	if parent then btn.Parent = parent end
	return btn
end

function UI.TitleBar(parent, props)
	props = props or {}
	local t = UI.theme()
	local bar = Instance.new("Frame")
	bar.Name = "TitleBar"
	bar.Size = props.Size or UDim2.new(1,0,0,48)
	bar.BackgroundColor3 = props.BackgroundColor3 or t.bg
	bar.BorderSizePixel = 0
	bar.Parent = parent

	local rc = Instance.new("UICorner"); rc.CornerRadius = UDim.new(0, t.corner); rc.Parent = bar
	local fill = Instance.new("Frame"); fill.Size = UDim2.new(1,0,0,t.corner); fill.Position = UDim2.new(0,0,1,-t.corner)
	fill.BackgroundColor3 = bar.BackgroundColor3; fill.BorderSizePixel = 0; fill.Parent = bar

	local lbl = Instance.new("TextLabel")
	lbl.Size = UDim2.new(1,-60,1,0); lbl.Position = UDim2.new(0,16,0,0)
	lbl.BackgroundTransparency = 1; lbl.Text = props.Title or "Title"
	lbl.TextColor3 = t.text; lbl.Font = t.font; lbl.TextSize = 18
	lbl.TextXAlignment = Enum.TextXAlignment.Left; lbl.Parent = bar

	if props.OnClose then
		local closeBtn = Instance.new("TextButton")
		closeBtn.Size = UDim2.new(0,32,0,32); closeBtn.Position = UDim2.new(1,-40,0.5,-16)
		closeBtn.BackgroundColor3 = t.error; closeBtn.Text = "✕"; closeBtn.TextColor3 = t.text
		closeBtn.Font = t.font; closeBtn.TextSize = 16; closeBtn.BorderSizePixel = 0; closeBtn.AutoButtonColor = false
		Instance.new("UICorner", closeBtn).CornerRadius = UDim.new(1,0)
		closeBtn.MouseButton1Click:Connect(props.OnClose); closeBtn.Parent = bar
		closeBtn.MouseEnter:Connect(function() tween(closeBtn,0.1,{BackgroundColor3=Color3.fromRGB(255,50,50)}) end)
		closeBtn.MouseLeave:Connect(function() tween(closeBtn,0.1,{BackgroundColor3=t.error}) end)
	end
	return bar
end

function UI.ScrollList(parent, props)
	props = props or {}
	local t = UI.theme()
	local sf = Instance.new("ScrollingFrame")
	sf.Name = props.Name or "ScrollList"
	sf.Size = props.Size or UDim2.new(1,-16,1,-60)
	sf.Position = props.Position or UDim2.new(0,8,0,52)
	sf.BackgroundTransparency = 1; sf.BorderSizePixel = 0
	sf.ScrollBarThickness = 4; sf.ScrollBarImageColor3 = t.accent
	sf.CanvasSize = UDim2.new(0,0,0,0)
	sf.AutomaticCanvasSize = Enum.AutomaticSize.Y
	if parent then sf.Parent = parent end

	if props.Grid then
		local g = Instance.new("UIGridLayout")
		g.CellSize = props.CellSize or UDim2.new(0,140,0,140)
		g.CellPadding = UDim2.new(0, props.Spacing or 10, 0, props.Spacing or 10)
		g.SortOrder = Enum.SortOrder.LayoutOrder
		g.HorizontalAlignment = Enum.HorizontalAlignment.Center; g.Parent = sf
	else
		local l = Instance.new("UIListLayout")
		l.Padding = UDim.new(0, props.Spacing or 8)
		l.SortOrder = Enum.SortOrder.LayoutOrder; l.Parent = sf
	end
	if props.Children then for _,c in ipairs(props.Children) do c.Parent = sf end end
	return sf
end

function UI.ProductCard(parent, props)
	props = props or {}
	local t = UI.theme()
	local card = Instance.new("TextButton")
	card.Name = props.Name or "ProductCard"
	card.Size = props.Size or UDim2.new(0,140,0,140)
	card.BackgroundColor3 = t.surface; card.BorderSizePixel = 0
	card.Text = ""; card.AutoButtonColor = false
	Instance.new("UICorner", card).CornerRadius = UDim.new(0, t.corner)
	local stroke = Instance.new("UIStroke"); stroke.Color = t.border; stroke.Thickness = 1.5; stroke.Transparency = 0.4; stroke.Parent = card

	local layout = Instance.new("UIListLayout"); layout.FillDirection = Enum.FillDirection.Vertical
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center; layout.VerticalAlignment = Enum.VerticalAlignment.Center
	layout.Padding = UDim.new(0,4); layout.SortOrder = Enum.SortOrder.LayoutOrder; layout.Parent = card

	if props.Icon then
		local img = Instance.new("ImageLabel")
		img.Size = UDim2.new(0,64,0,64); img.BackgroundTransparency = 1
		img.Image = props.Icon; img.ScaleType = Enum.ScaleType.Fit; img.LayoutOrder = 1; img.Parent = card
	end
	local name = Instance.new("TextLabel")
	name.Size = UDim2.new(1,-8,0,20); name.BackgroundTransparency = 1; name.Text = props.Text or "Item"
	name.TextColor3 = t.text; name.Font = t.font; name.TextSize = 13
	name.TextXAlignment = Enum.TextXAlignment.Center; name.LayoutOrder = 2; name.Parent = card

	if props.Price then
		local price = Instance.new("TextLabel")
		price.Size = UDim2.new(1,-8,0,16); price.BackgroundTransparency = 1
		price.Text = "$"..tostring(props.Price).." Robux"
		price.TextColor3 = t.success; price.Font = t.fontBody; price.TextSize = 12
		price.TextXAlignment = Enum.TextXAlignment.Center; price.LayoutOrder = 3; price.Parent = card
	end

	card.MouseEnter:Connect(function() tween(card,0.12,{BackgroundColor3=t.surfaceHover}); tween(stroke,0.12,{Transparency=0}) end)
	card.MouseLeave:Connect(function() tween(card,0.12,{BackgroundColor3=t.surface}); tween(stroke,0.12,{Transparency=0.4}) end)
	card.MouseButton1Down:Connect(function() tween(card,0.05,{Size=UDim2.new(0,134,0,134)}) end)
	card.MouseButton1Up:Connect(function() tween(card,0.1,{Size=props.Size or UDim2.new(0,140,0,140)}) end)
	if props.OnClick then card.MouseButton1Click:Connect(props.OnClick) end
	if parent then card.Parent = parent end
	return card
end

function UI.Badge(parent, props)
	props = props or {}
	local t = UI.theme()
	local color = props.Color or t.accent
	if type(color) == "string" then
		color = color == "Accent" and t.accent or color == "Error" and t.error or color == "Success" and t.success or color == "Warning" and t.warning or t.accent
	end
	local b = Instance.new("TextLabel")
	b.Name = "Badge"; b.Size = props.Size or UDim2.new(0,60,0,22)
	b.Position = props.Position or UDim2.new(0,0,0,0)
	b.BackgroundColor3 = color; b.TextColor3 = Color3.fromRGB(0,0,0)
	b.Text = props.Text or "Tag"; b.Font = t.font; b.TextSize = 11; b.BorderSizePixel = 0
	Instance.new("UICorner", b).CornerRadius = UDim.new(0,6)
	if parent then b.Parent = parent end
	return b
end

function UI.ProgressBar(parent, props)
	props = props or {}
	local t = UI.theme()
	local container = Instance.new("Frame")
	container.Name = props.Name or "ProgressBar"
	container.Size = props.Size or UDim2.new(1,0,0,24)
	container.Position = props.Position or UDim2.new(0,0,0,0)
	container.BackgroundColor3 = t.bg; container.BorderSizePixel = 0
	Instance.new("UICorner", container).CornerRadius = UDim.new(0,8)

	local fill = Instance.new("Frame")
	fill.Name = "Fill"; fill.Size = UDim2.new(math.clamp(props.Value or 0.75, 0, 1),0,1,0)
	fill.BackgroundColor3 = props.FillColor or t.accent; fill.BorderSizePixel = 0
	Instance.new("UICorner", fill).CornerRadius = UDim.new(0,8)
	fill.Parent = container

	local lbl = Instance.new("TextLabel")
	lbl.Size = UDim2.new(1,-10,1,0); lbl.Position = UDim2.new(0,10,0,0)
	lbl.BackgroundTransparency = 1; lbl.Text = props.Label or ""
	lbl.TextColor3 = t.text; lbl.Font = t.font; lbl.TextSize = 11
	lbl.TextXAlignment = Enum.TextXAlignment.Left; lbl.ZIndex = 2; lbl.Parent = container

	if parent then container.Parent = parent end

	container.Update = function(_, val, label)
		tween(fill, 0.3, {Size = UDim2.new(math.clamp(val,0,1),0,1,0)})
		if label then lbl.Text = label end
	end
	return container
end

function UI.Tabs(parent, props)
	props = props or {}
	local t = UI.theme()
	local container = Instance.new("Frame")
	container.Name = "Tabs"; container.Size = props.Size or UDim2.new(0,200,1,-60)
	container.Position = props.Position or UDim2.new(0,0,0,50)
	container.BackgroundTransparency = 1; container.BorderSizePixel = 0
	local layout = Instance.new("UIListLayout"); layout.Padding = UDim.new(0, props.Spacing or 4)
	layout.SortOrder = Enum.SortOrder.LayoutOrder; layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.VerticalAlignment = Enum.VerticalAlignment.Center; layout.Parent = container

	local buttons = {}
	local activeTab = props.Default or (props.Items and props.Items[1] and props.Items[1].Id) or "tab1"
	for i, tab in ipairs(props.Items or {}) do
		local isActive = (tab.Id == activeTab)
		local btn = Instance.new("TextButton")
		btn.Name = "Tab_"..tab.Id; btn.Size = UDim2.new(1,0,0, props.TabHeight or 50)
		btn.BackgroundColor3 = isActive and t.accent or t.surface
		btn.TextColor3 = isActive and Color3.fromRGB(0,0,0) or t.text
		btn.Text = tab.Label or tab.Id; btn.Font = t.font; btn.TextSize = 14
		btn.BorderSizePixel = 0; btn.AutoButtonColor = false; btn.LayoutOrder = i
		Instance.new("UICorner", btn).CornerRadius = UDim.new(0, t.corner)
		btn.MouseButton1Click:Connect(function()
			activeTab = tab.Id
			for _, b in ipairs(buttons) do
				local act = (b.Name == "Tab_"..tab.Id)
				tween(b, 0.15, {BackgroundColor3 = act and t.accent or t.surface, TextColor3 = act and Color3.fromRGB(0,0,0) or t.text})
			end
			if props.OnChanged then props.OnChanged(tab.Id) end
		end)
		btn.Parent = container; table.insert(buttons, btn)
	end
	if parent then container.Parent = parent end
	return container
end

function UI.Divider(parent, props)
	props = props or {}
	local t = UI.theme()
	local d = Instance.new("Frame")
	d.Name = "Divider"; d.Size = props.Size or UDim2.new(1,-20,0,1)
	d.Position = props.Position or UDim2.new(0,10,0,0)
	d.BackgroundColor3 = t.border; d.BorderSizePixel = 0; d.BackgroundTransparency = 0.5
	if parent then d.Parent = parent end
	return d
end

function UI.Text(parent, props)
	props = props or {}
	local t = UI.theme()
	local lbl = Instance.new("TextLabel")
	lbl.Name = props.Name or "Text"
	lbl.Size = props.Size or UDim2.new(1,0,0,20)
	lbl.Position = props.Position or UDim2.new(0,0,0,0)
	lbl.BackgroundTransparency = 1
	lbl.Text = props.Text or ""; lbl.TextColor3 = props.Color or t.text
	lbl.Font = props.Bold and t.font or t.fontBody
	lbl.TextSize = props.TextSize or 14
	lbl.TextXAlignment = props.Align or Enum.TextXAlignment.Left
	lbl.TextWrapped = props.Wrapped or false
	if parent then lbl.Parent = parent end
	return lbl
end

function UI.Modal(parent, props)
	props = props or {}
	local t = UI.theme()
	local screen = parent or UI.createScreenGui(props.Name or "Modal")

	local backdrop = Instance.new("TextButton")
	backdrop.Name = "Backdrop"; backdrop.Size = UDim2.new(1,0,1,0)
	backdrop.BackgroundColor3 = Color3.fromRGB(0,0,0); backdrop.BackgroundTransparency = 1
	backdrop.Text = ""; backdrop.BorderSizePixel = 0; backdrop.AutoButtonColor = false; backdrop.Parent = screen

	local card = UI.Card(nil, {
		Size = props.Size or UDim2.new(0,400,0,300),
		Position = UDim2.new(0.5,0,0.5,0), AnchorPoint = Vector2.new(0.5,0.5),
		Padding = 16,
	})
	card.Name = props.Name or "ModalCard"; card.Parent = screen

	if props.Title then UI.TitleBar(card, {Title = props.Title, OnClose = props.OnClose or function() screen.Enabled = false end}) end
	tween(backdrop, 0.25, {BackgroundTransparency = 0.5})
	card.Size = UDim2.new(0, (props.Size and props.Size.X.Offset or 400)-40, 0, (props.Size and props.Size.Y.Offset or 300)-20)
	tween(card, 0.25, {Size = props.Size or UDim2.new(0,400,0,300)})

	if props.OnClose then backdrop.MouseButton1Click:Connect(props.OnClose) end
	if props.Children then for _,c in ipairs(props.Children) do c.Parent = card end end
	return card, screen
end

function UI.Toast(parent, props)
	props = props or {}
	local t = UI.theme()
	local colors = {
		success = {bg=Color3.fromRGB(30,70,40), bar=t.success},
		error = {bg=Color3.fromRGB(80,30,30), bar=t.error},
		info = {bg=Color3.fromRGB(30,40,70), bar=t.accent},
		warning = {bg=Color3.fromRGB(70,60,20), bar=t.warning},
	}
	local s = colors[props.Type or "info"] or colors.info
	local toast = Instance.new("Frame")
	toast.Name = "Toast"; toast.Size = UDim2.new(0,300,0,48)
	toast.Position = UDim2.new(1,320,1,-(props.Index or 1)*56)
	toast.BackgroundColor3 = s.bg; toast.BorderSizePixel = 0
	Instance.new("UICorner", toast).CornerRadius = UDim.new(0,10)
	local bar = Instance.new("Frame"); bar.Size = UDim2.new(0,3,0.7,0); bar.Position = UDim2.new(0,8,0.15,0)
	bar.BackgroundColor3 = s.bar; bar.BorderSizePixel = 0; Instance.new("UICorner",bar).CornerRadius = UDim.new(0,2); bar.Parent = toast
	local lbl = Instance.new("TextLabel"); lbl.Size = UDim2.new(1,-24,1,0); lbl.Position = UDim2.new(0,18,0,0)
	lbl.BackgroundTransparency = 1; lbl.Text = props.Text or "Notification"
	lbl.TextColor3 = t.text; lbl.Font = t.fontBody; lbl.TextSize = 13
	lbl.TextXAlignment = Enum.TextXAlignment.Left; lbl.TextWrapped = true; lbl.Parent = toast
	if parent then toast.Parent = parent end
	tween(toast, 0.3, {Position = UDim2.new(1,-320,1,-(props.Index or 1)*56)})
	task.delay(props.Duration or 4, function()
		tween(toast, 0.3, {Position = UDim2.new(1,320,1,-(props.Index or 1)*56)})
		task.delay(0.35, function() toast:Destroy() end)
	end)
	return toast
end

-- ══════════════════════════════════════════════════════════════════════
-- ICON CATALOG — Real Roblox asset IDs for common game icons
-- ══════════════════════════════════════════════════════════════════════
UI.Icons = {
	Coin = "rbxassetid://77506246542645",
	Cash = "rbxassetid://112756857142835",
	Crystal = "rbxassetid://81253425188370",
	Diamond = "rbxassetid://130403869659285",
	Ingot = "rbxassetid://85443008089013",
	Premium = "rbxassetid://76876761443329",
	Robux = "rbxassetid://94800204617476",
	Ticket = "rbxassetid://103084066403087",
	VIP = "rbxassetid://128733366506652",
	Aura = "rbxassetid://101723728988705",
	Trail = "rbxassetid://83396923860162",
	Teleport = "rbxassetid://113569253808900",
	AngelHeart = "rbxassetid://76541625491879",
	Magnet = "rbxassetid://89108897289913",
	Crown = "rbxassetid://91097101374561",
	LuckyBlock = "rbxassetid://107481007887279",
	Coil = "rbxassetid://82003481235567",
	Trophy = "rbxassetid://106910511015219",
	Shield = "rbxassetid://140004244450894",
	Sword = "rbxassetid://113879674175484",
	Gift = "rbxassetid://91545952440347",
	Potion = "rbxassetid://116120788528815",
	Rocket = "rbxassetid://132739132155261",
	Fire = "rbxassetid://104160053917971",
	Heart = "rbxassetid://88867748830914",
	Hoverboard = "rbxassetid://108488124800166",
	Lightning = "rbxassetid://80384669807985",
	Rebirth = "rbxassetid://111505774233400",
	Star = "rbxassetid://111803940069577",
	Upgrade = "rbxassetid://138342186651984",
	Wheel = "rbxassetid://78756458162291",
}

-- ══════════════════════════════════════════════════════════════════════
-- DynamicScale — Auto-scale UI to viewport like the competitor's AutoScaler
-- ══════════════════════════════════════════════════════════════════════
function UI.DynamicScale(parent, props)
	props = props or {}
	local camera = workspace.CurrentCamera
	local base = props.BaseResolution or Vector2.new(1920, 1080)
	local minS = props.MinScale or 0.5
	local maxS = props.MaxScale or 1.5

	local scale = Instance.new("UIScale")
	scale.Name = "DynamicScale"
	scale.Parent = parent

	local function update()
		local vp = camera.ViewportSize
		local ratio = math.min(vp.X / base.X, vp.Y / base.Y)
		scale.Scale = math.clamp(ratio, minS, maxS)
	end
	camera:GetPropertyChangedSignal("ViewportSize"):Connect(update)
	update()
	return scale
end

-- ══════════════════════════════════════════════════════════════════════
-- GradientCard — Card with vertical gradient background
-- ══════════════════════════════════════════════════════════════════════
function UI.GradientCard(parent, props)
	props = props or {}
	local t = UI.theme()
	local card = UI.Card(nil, {
		Size = props.Size or UDim2.new(1,0,0,100),
		Position = props.Position, AnchorPoint = props.AnchorPoint,
		Padding = props.Padding,
		BackgroundColor3 = Color3.new(1,1,1),
	})
	card.Name = props.Name or "GradientCard"

	local topColor = props.TopColor or t.accent
	local bottomColor = props.BottomColor or t.accentDark
	local gradient = Instance.new("UIGradient")
	gradient.Color = ColorSequence.new(topColor, bottomColor)
	gradient.Rotation = props.GradientRotation or 90
	gradient.Parent = card

	if props.Children then for _,c in ipairs(props.Children) do c.Parent = card end end
	if parent then card.Parent = parent end
	return card
end

-- ══════════════════════════════════════════════════════════════════════
-- HoverSpinIcon — Icon that wiggles on hover (matches competitor's pattern)
-- ══════════════════════════════════════════════════════════════════════
function UI.HoverSpinIcon(parent, props)
	props = props or {}
	local holder = Instance.new("Frame")
	holder.Name = "IconHolder"
	holder.Size = props.Size or UDim2.new(0,64,0,64)
	holder.BackgroundTransparency = 1
	holder.LayoutOrder = props.LayoutOrder or 1

	local icon = Instance.new("ImageLabel")
	icon.Name = "Icon"
	icon.Image = props.Image or ""
	icon.Size = UDim2.new(1,0,1,0)
	icon.Position = UDim2.new(0.5,0,0.5,0)
	icon.AnchorPoint = Vector2.new(0.5,0.5)
	icon.BackgroundTransparency = 1
	icon.ScaleType = Enum.ScaleType.Fit
	icon.Parent = holder

	local angle = props.Angle or 25
	local spinning = false
	local function spin()
		if spinning then return end
		spinning = true
		tween(icon, 0.08, {Rotation = angle})
		task.delay(0.08, function()
			tween(icon, 0.08, {Rotation = -angle * 0.6})
			task.delay(0.08, function()
				tween(icon, 0.12, {Rotation = angle * 0.3})
				task.delay(0.12, function()
					tween(icon, 0.15, {Rotation = 0})
					spinning = false
				end)
			end)
		end)
	end

	if parent then holder.Parent = parent end
	return holder, spin
end

-- ══════════════════════════════════════════════════════════════════════
-- ElevatedCard — Card with drop shadow for floating panel look
-- ══════════════════════════════════════════════════════════════════════
function UI.ElevatedCard(parent, props)
	props = props or {}
	local t = UI.theme()

	local shadow = Instance.new("Frame")
	shadow.Name = "Shadow"
	shadow.Size = (props.Size or UDim2.new(0,300,0,200)) + UDim2.new(0,8,0,8)
	shadow.Position = (props.Position or UDim2.new(0,0,0,0)) + UDim2.new(0,4,0,4)
	shadow.AnchorPoint = props.AnchorPoint or Vector2.new(0,0)
	shadow.BackgroundColor3 = Color3.fromRGB(0,0,0)
	shadow.BackgroundTransparency = 0.6
	shadow.BorderSizePixel = 0
	Instance.new("UICorner", shadow).CornerRadius = UDim.new(0, t.corner + 2)
	if parent then shadow.Parent = parent end

	local card = UI.Card(parent, {
		Size = props.Size or UDim2.new(0,300,0,200),
		Position = props.Position, AnchorPoint = props.AnchorPoint,
		Padding = props.Padding,
	})
	card.Name = props.Name or "ElevatedCard"
	if props.Children then for _,c in ipairs(props.Children) do c.Parent = card end end
	return card, shadow
end

-- ══════════════════════════════════════════════════════════════════════
-- Image — Simple themed image wrapper
-- ══════════════════════════════════════════════════════════════════════
function UI.Image(parent, props)
	props = props or {}
	local img = Instance.new("ImageLabel")
	img.Name = props.Name or "Image"
	img.Size = props.Size or UDim2.new(0,64,0,64)
	img.Position = props.Position or UDim2.new(0,0,0,0)
	img.AnchorPoint = props.AnchorPoint or Vector2.new(0,0)
	img.BackgroundTransparency = 1
	img.Image = props.Image or ""
	img.ImageColor3 = props.ImageColor3 or Color3.new(1,1,1)
	img.ScaleType = props.ScaleType or Enum.ScaleType.Fit
	if parent then img.Parent = parent end
	return img
end

-- ══════════════════════════════════════════════════════════════════════
-- CurrencyHUD — Floating HUD pill with icon + amount (like competitor's HUD)
-- ══════════════════════════════════════════════════════════════════════
function UI.CurrencyHUD(parent, props)
	props = props or {}
	local t = UI.theme()
	local pill = UI.Card(nil, {
		Size = props.Size or UDim2.new(0,200,0,48),
		Position = props.Position or UDim2.new(1,-220,0,16),
		Padding = 8,
	})
	pill.Name = "CurrencyHUD"

	local icon = Instance.new("ImageLabel")
	icon.Size = UDim2.new(0,32,0,32)
	icon.Position = UDim2.new(0,8,0.5,-16)
	icon.BackgroundTransparency = 1
	icon.Image = props.Icon or UI.Icons.Coin
	icon.ScaleType = Enum.ScaleType.Fit
	icon.Parent = pill

	local lbl = Instance.new("TextLabel")
	lbl.Name = "Amount"
	lbl.Size = UDim2.new(1,-52,1,0)
	lbl.Position = UDim2.new(0,48,0,0)
	lbl.BackgroundTransparency = 1
	lbl.TextColor3 = t.text
	lbl.Font = t.font
	lbl.TextSize = 18
	lbl.TextXAlignment = Enum.TextXAlignment.Left

	local function format(n)
		if type(n) ~= "number" then return tostring(n) end
		local s = tostring(math.floor(n))
		while true do
			local r; s, r = s:gsub("^(-?%d+)(%d%d%d)", "%1,%2")
			if r == 0 then break end
		end
		return s
	end
	lbl.Text = format(props.Amount or 0)
	lbl.Parent = pill

	if parent then pill.Parent = parent end

	pill.SetAmount = function(_, val)
		lbl.Text = format(val)
	end
	return pill
end

-- ══════════════════════════════════════════════════════════════════════
-- TEMPLATE: ShopTemplate — Complete shop UI in ONE call
-- ══════════════════════════════════════════════════════════════════════
function UI.ShopTemplate(props)
	props = props or {}
	local t = UI.theme()
	local screen = UI.createScreenGui(props.Name or "ShopGui")
	screen.Enabled = props.Visible ~= false

	UI.DynamicScale(screen, {BaseResolution = Vector2.new(1920, 1080)})

	local panel = UI.Card(screen, {
		Size = props.Size or UDim2.new(0,720,0,520),
		Position = UDim2.new(0.5,0,0.5,0),
		AnchorPoint = Vector2.new(0.5,0.5),
		Padding = 0,
	})

	UI.TitleBar(panel, {
		Title = props.Title or "Shop",
		OnClose = props.OnClose or function() screen.Enabled = false end,
	})

	local tabs = props.Tabs or {
		{Id="Currency", Label="BUY COINS", Items={
			{Text="Coin Pouch", Price=49, Icon=UI.Icons.Coin},
			{Text="Cash Stack", Price=99, Icon=UI.Icons.Cash},
			{Text="Crystals", Price=299, Icon=UI.Icons.Crystal},
			{Text="Diamonds", Price=499, Icon=UI.Icons.Diamond},
		}},
		{Id="Passes", Label="GAMEPASSES", Items={
			{Text="VIP", Price=499, Icon=UI.Icons.VIP},
			{Text="Magnet", Price=199, Icon=UI.Icons.Magnet},
			{Text="Crown", Price=399, Icon=UI.Icons.Crown},
		}},
	}

	local activeTabId = tabs[1].Id
	local productScroll = UI.ScrollList(panel, {
		Size = UDim2.new(1,-210,1,-60),
		Position = UDim2.new(0,200,0,54),
		Grid = true, CellSize = UDim2.new(0,150,0,150), Spacing = 12,
	})

	local function renderProducts(tabId)
		for _,child in ipairs(productScroll:GetChildren()) do
			if child:IsA("TextButton") then child:Destroy() end
		end
		for _,tab in ipairs(tabs) do
			if tab.Id == tabId then
				for _,item in ipairs(tab.Items or {}) do
					local cardHolder, spinFn = UI.HoverSpinIcon(nil, {Image=item.Icon, Size=UDim2.new(0,64,0,64)})
					local pc = UI.ProductCard(productScroll, {
						Text = item.Text, Price = item.Price, Icon = item.Icon,
						OnClick = item.OnClick or function() print("Buy:", item.Text) end,
					})
					pc.MouseEnter:Connect(function() spinFn() end)
				end
				break
			end
		end
	end

	local tabBtns = {}
	for i, tab in ipairs(tabs) do
		local btn = UI.Button(panel, {
			Text = tab.Label,
			Style = (tab.Id == activeTabId) and "Primary" or "Secondary",
			Size = UDim2.new(0,190,0,50),
			Position = UDim2.new(0,5,0,54 + (i-1)*54),
			OnClick = function()
				activeTabId = tab.Id
				renderProducts(tab.Id)
				for j,b in ipairs(tabBtns) do
					local active = tabs[j].Id == tab.Id
					tween(b, 0.15, {
						BackgroundColor3 = active and t.accent or t.surface,
						TextColor3 = active and Color3.new(0,0,0) or t.text,
					})
				end
			end,
		})
		table.insert(tabBtns, btn)
	end

	renderProducts(activeTabId)
	return screen, panel
end

-- ══════════════════════════════════════════════════════════════════════
-- TEMPLATE: InventoryTemplate — Complete inventory grid in ONE call
-- ══════════════════════════════════════════════════════════════════════
function UI.InventoryTemplate(props)
	props = props or {}
	local t = UI.theme()
	local screen = UI.createScreenGui(props.Name or "InventoryGui")
	screen.Enabled = props.Visible ~= false

	UI.DynamicScale(screen, {BaseResolution = Vector2.new(1920, 1080)})

	local panel = UI.Card(screen, {
		Size = props.Size or UDim2.new(0,600,0,450),
		Position = UDim2.new(0.5,0,0.5,0),
		AnchorPoint = Vector2.new(0.5,0.5),
	})

	UI.TitleBar(panel, {
		Title = props.Title or "Inventory",
		OnClose = props.OnClose or function() screen.Enabled = false end,
	})

	local grid = UI.ScrollList(panel, {
		Grid = true, CellSize = UDim2.new(0,120,0,140), Spacing = 10,
	})

	local RARITY_COLORS = {
		Common = t.textDim, Rare = t.accent, Epic = t.warning, Legendary = t.error,
	}

	local items = props.Items or {
		{Name="Iron Sword", Icon=UI.Icons.Sword, Count=1, Rarity="Common"},
		{Name="Gold Shield", Icon=UI.Icons.Shield, Count=1, Rarity="Rare"},
		{Name="Fire Potion", Icon=UI.Icons.Potion, Count=5, Rarity="Common"},
		{Name="Diamond Crown", Icon=UI.Icons.Crown, Count=1, Rarity="Legendary"},
	}

	for _, item in ipairs(items) do
		local card = UI.Card(grid, {Size = UDim2.new(0,120,0,140), Padding = 6})
		local holder, spinFn = UI.HoverSpinIcon(card, {
			Image = item.Icon, Size = UDim2.new(0,52,0,52),
		})
		holder.Position = UDim2.new(0.5,-26,0,8)

		UI.Text(card, {
			Text = item.Name, Bold = true, TextSize = 11,
			Size = UDim2.new(1,-4,0,16), Position = UDim2.new(0,2,0,66),
			Align = Enum.TextXAlignment.Center,
		})

		if item.Rarity then
			UI.Badge(card, {
				Text = item.Rarity,
				Color = RARITY_COLORS[item.Rarity] or t.accent,
				Size = UDim2.new(0,70,0,18),
				Position = UDim2.new(0.5,-35,0,86),
			})
		end

		if item.Count and item.Count > 1 then
			UI.Text(card, {
				Text = "x"..item.Count, TextSize = 10,
				Size = UDim2.new(0,30,0,14),
				Position = UDim2.new(1,-34,0,4),
			})
		end

		card.MouseEnter:Connect(function() spinFn() end)
	end

	return screen, panel
end

-- ══════════════════════════════════════════════════════════════════════
-- TEMPLATE: HUDTemplate — Full gameplay HUD in ONE call
-- ══════════════════════════════════════════════════════════════════════
function UI.HUDTemplate(props)
	props = props or {}
	local screen = UI.createScreenGui(props.Name or "HUDGui")

	local hp = UI.ProgressBar(screen, {
		Size = UDim2.new(0,250,0,28),
		Position = UDim2.new(0,20,0,20),
		Value = 1, Label = "100/100 HP",
		FillColor = Color3.fromRGB(220,50,50),
	})

	local currency = UI.CurrencyHUD(screen, {
		Position = UDim2.new(1,-220,0,16),
		Amount = props.StartingCoins or 0,
		Icon = props.CoinIcon or UI.Icons.Coin,
	})

	local xp = UI.ProgressBar(screen, {
		Size = UDim2.new(0,400,0,20),
		Position = UDim2.new(0.5,-200,1,-40),
		Value = props.XPProgress or 0,
		Label = props.XPLabel or "Level 1 — 0/100 XP",
	})

	return screen, {health = hp, currency = currency, xp = xp}
end

return UI
