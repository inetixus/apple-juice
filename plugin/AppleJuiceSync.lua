local HttpService = game:GetService("HttpService")
local ScriptEditorService = game:GetService("ScriptEditorService")
local ServerScriptService = game:GetService("ServerScriptService")
local TweenService = game:GetService("TweenService")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")

-- ╔═══ AJ_CONFIG_START ═══════════════════════════════════════════════════════╗
-- Single source of truth for the two plugin variants. The CLI plugin
-- (AppleJuiceSyncCLI.lua) is GENERATED from this file by scripts/build-plugins.cjs
-- which replaces ONLY this block. Do not hand-edit AppleJuiceSyncCLI.lua — edit
-- here and re-run `node scripts/build-plugins.cjs`.
local AJ_CONFIG = {
	toolbarName = "Apple Juice AI Sync",
	widgetTitle = "Apple Juice AI Sync",
	version = "v2.0.0",
	variant = "web",
	-- Fixed endpoint for the public build — there is NO URL box in the widget.
	serverUrl = "https://apple-juice.online",
	toggleButtonId = "AppleJuiceAISyncToggle",
	toggleButtonTooltip = "Toggle Apple Juice AI Sync",
	widgetId = "AppleJuiceAISyncWidget",
	tagline = "One click links Studio to your dashboard.",
	-- The public site pairs automatically by matching your IP to the open
	-- dashboard. A manual pairing code is offered only as a fallback.
	showManualCode = true,
	requireManualCode = false,
}
-- ╚═══ AJ_CONFIG_END ═════════════════════════════════════════════════════════╝

local TOOLBAR_NAME = AJ_CONFIG.toolbarName
local WIDGET_TITLE = AJ_CONFIG.widgetTitle
local VERSION = AJ_CONFIG.version

-- The server URL is FIXED per plugin variant (no in-widget URL box):
--   • Web build → the public Apple Juice site.
--   • CLI build → the local app the `aj` terminal serves on 127.0.0.1.
local BASE_URL = AJ_CONFIG.serverUrl
if BASE_URL:sub(-1) == "/" then BASE_URL = BASE_URL:sub(1, -2) end
local CONNECT_ENDPOINT = BASE_URL .. "/api/connect"
local POLL_ENDPOINT = BASE_URL .. "/api/poll"
local LOGS_ENDPOINT = BASE_URL .. "/api/logs"
local TREE_ENDPOINT = BASE_URL .. "/api/tree"
local REPORT_FILE_ENDPOINT = BASE_URL .. "/api/report-file"
local SNAPSHOT_ENDPOINT = BASE_URL .. "/api/snapshot"
local MCP_NEXT_ENDPOINT = BASE_URL .. "/api/mcp/next"
local MCP_RESULT_ENDPOINT = BASE_URL .. "/api/mcp/result"

local POLL_INTERVAL = 0.2
-- Server-driven, plan-aware poll cadence. The /api/poll response may return a
-- recommended `pollInterval` (higher subscription tiers poll faster so code +
-- MCP commands land in Studio sooner). We clamp it to a safe range so a bad
-- value can never hammer the server or stall the loop.
local MIN_POLL_INTERVAL = 0.1
local MAX_POLL_INTERVAL = 1.0
local currentPollInterval = POLL_INTERVAL

local toolbar = plugin:CreateToolbar(TOOLBAR_NAME)
local toolbarButton = toolbar:CreateButton(AJ_CONFIG.toggleButtonId, AJ_CONFIG.toggleButtonTooltip, "rbxassetid://4458901886")
toolbarButton.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, true, false, 360, 520, 320, 430)
local widget = plugin:CreateDockWidgetPluginGui(AJ_CONFIG.widgetId, widgetInfo)
widget.Title = WIDGET_TITLE

-- ─── UI ───────────────────────────────────────────────────────────────────────
-- Animated, modern panel. The server URL is FIXED (no input box). Pairing is one
-- click; a manual code box appears only as a fallback (web build) or not at all
-- (CLI build). running / unloading / undoStack are forward-declared here so the
-- animation closures and the engine below all capture the SAME upvalues.
local running = false
local unloading = false
local undoStack = {}

-- Palette
local COL_BG       = Color3.fromRGB(20, 22, 27)
local COL_SURFACE  = Color3.fromRGB(31, 34, 41)
local COL_SURFACE2 = Color3.fromRGB(40, 44, 53)
local COL_TEXT     = Color3.fromRGB(240, 241, 245)
local COL_DIM      = Color3.fromRGB(138, 145, 160)
local COL_ACCENT_A = Color3.fromRGB(230, 126, 34)   -- terracotta
local COL_ACCENT_B = Color3.fromRGB(255, 176, 102)  -- light orange
local COL_OK       = Color3.fromRGB(77, 214, 123)
local COL_WARN     = Color3.fromRGB(245, 208, 96)
local COL_ERR      = Color3.fromRGB(255, 96, 96)
local COL_DISC     = Color3.fromRGB(220, 64, 64)

local function corner(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r or 8)
	c.Parent = inst
	return c
end
local function pad(inst, l, r, t, b)
	local p = Instance.new("UIPadding")
	p.PaddingLeft = UDim.new(0, l or 0)
	p.PaddingRight = UDim.new(0, r or 0)
	p.PaddingTop = UDim.new(0, t or 0)
	p.PaddingBottom = UDim.new(0, b or 0)
	p.Parent = inst
	return p
end

local root = Instance.new("Frame")
root.Name = "Root"
root.Size = UDim2.fromScale(1, 1)
root.BackgroundColor3 = COL_BG
root.BorderSizePixel = 0
root.Parent = widget

-- Entrance scale/fade lives on a child container so the bg stays solid.
local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.Size = UDim2.fromScale(1, 1)
panel.BackgroundTransparency = 1
panel.BorderSizePixel = 0
panel.Parent = root
pad(panel, 16, 16, 16, 16)

local panelScale = Instance.new("UIScale")
panelScale.Scale = 0.94
panelScale.Parent = panel

local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Vertical
layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 12)
layout.Parent = panel

-- ── Header card (logo chip + title + animated gradient) ──────────────────────
local header = Instance.new("Frame")
header.Name = "Header"
header.Size = UDim2.new(1, 0, 0, 64)
header.BackgroundColor3 = COL_SURFACE
header.BorderSizePixel = 0
header.LayoutOrder = 1
header.Parent = panel
corner(header, 12)
pad(header, 12, 12, 10, 10)

local headerStroke = Instance.new("UIStroke")
headerStroke.Color = COL_ACCENT_A
headerStroke.Transparency = 0.6
headerStroke.Thickness = 1
headerStroke.Parent = header

local logoChip = Instance.new("Frame")
logoChip.Name = "Logo"
logoChip.Size = UDim2.fromOffset(44, 44)
logoChip.Position = UDim2.fromScale(0, 0.5)
logoChip.AnchorPoint = Vector2.new(0, 0.5)
logoChip.BackgroundColor3 = COL_ACCENT_A
logoChip.BorderSizePixel = 0
logoChip.Parent = header
corner(logoChip, 12)

local logoGrad = Instance.new("UIGradient")
logoGrad.Color = ColorSequence.new(COL_ACCENT_A, COL_ACCENT_B)
logoGrad.Rotation = 0
logoGrad.Parent = logoChip

local logoText = Instance.new("TextLabel")
logoText.BackgroundTransparency = 1
logoText.Size = UDim2.fromScale(1, 1)
logoText.Text = "🍎"
logoText.TextScaled = true
logoText.Font = Enum.Font.GothamBold
logoText.TextColor3 = Color3.fromRGB(255, 255, 255)
logoText.Parent = logoChip
pad(logoText, 7, 7, 7, 7)

local titleLabel = Instance.new("TextLabel")
titleLabel.BackgroundTransparency = 1
titleLabel.Position = UDim2.fromOffset(56, 8)
titleLabel.Size = UDim2.new(1, -120, 0, 22)
titleLabel.Text = "Apple Juice"
titleLabel.Font = Enum.Font.GothamBold
titleLabel.TextSize = 18
titleLabel.TextColor3 = COL_TEXT
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.Parent = header

local subLabel = Instance.new("TextLabel")
subLabel.BackgroundTransparency = 1
subLabel.Position = UDim2.fromOffset(56, 30)
subLabel.Size = UDim2.new(1, -60, 0, 16)
subLabel.Text = AJ_CONFIG.tagline
subLabel.Font = Enum.Font.Gotham
subLabel.TextSize = 11
subLabel.TextColor3 = COL_DIM
subLabel.TextXAlignment = Enum.TextXAlignment.Left
subLabel.TextTruncate = Enum.TextTruncate.AtEnd
subLabel.Parent = header

local verPill = Instance.new("TextLabel")
verPill.AnchorPoint = Vector2.new(1, 0)
verPill.Position = UDim2.new(1, 0, 0, 2)
verPill.Size = UDim2.fromOffset(58, 18)
verPill.BackgroundColor3 = COL_SURFACE2
verPill.Text = VERSION
verPill.Font = Enum.Font.GothamMedium
verPill.TextSize = 10
verPill.TextColor3 = COL_DIM
verPill.Parent = header
corner(verPill, 9)

-- ── Status card (pulsing dot + spinner + message) ────────────────────────────
local statusCard = Instance.new("Frame")
statusCard.Name = "StatusCard"
statusCard.Size = UDim2.new(1, 0, 0, 58)
statusCard.BackgroundColor3 = COL_SURFACE
statusCard.BorderSizePixel = 0
statusCard.LayoutOrder = 2
statusCard.Parent = panel
corner(statusCard, 12)
pad(statusCard, 14, 14, 12, 12)

local statusDot = Instance.new("Frame")
statusDot.Name = "Dot"
statusDot.Size = UDim2.fromOffset(10, 10)
statusDot.Position = UDim2.fromOffset(0, 3)
statusDot.BackgroundColor3 = COL_DIM
statusDot.BorderSizePixel = 0
statusDot.Parent = statusCard
corner(statusDot, 5)

local spinner = Instance.new("TextLabel")
spinner.Name = "Spinner"
spinner.BackgroundTransparency = 1
spinner.Position = UDim2.fromOffset(-4, -5)
spinner.Size = UDim2.fromOffset(18, 18)
spinner.Text = ""
spinner.Font = Enum.Font.GothamBold
spinner.TextSize = 16
spinner.TextColor3 = COL_ACCENT_B
spinner.Visible = false
spinner.Parent = statusCard

local statusLabel = Instance.new("TextLabel")
statusLabel.Name = "Status"
statusLabel.Position = UDim2.fromOffset(20, 0)
statusLabel.Size = UDim2.new(1, -20, 1, 0)
statusLabel.BackgroundTransparency = 1
statusLabel.TextWrapped = true
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.TextYAlignment = Enum.TextYAlignment.Top
statusLabel.Font = Enum.Font.GothamSemibold
statusLabel.TextSize = 12.5
statusLabel.TextColor3 = COL_DIM
statusLabel.Text = "Ready."
statusLabel.Parent = statusCard

-- ── Live activity feed (streams every Studio action in real time) ─────────────
local feedCard = Instance.new("Frame")
feedCard.Name = "Feed"
feedCard.Size = UDim2.new(1, 0, 0, 168)
feedCard.BackgroundColor3 = COL_SURFACE
feedCard.BorderSizePixel = 0
feedCard.LayoutOrder = 4
feedCard.Parent = panel
corner(feedCard, 12)
pad(feedCard, 12, 8, 10, 10)

local feedTitle = Instance.new("TextLabel")
feedTitle.BackgroundTransparency = 1
feedTitle.Size = UDim2.new(1, -16, 0, 14)
feedTitle.Text = "LIVE ACTIVITY"
feedTitle.Font = Enum.Font.GothamBold
feedTitle.TextSize = 10
feedTitle.TextColor3 = COL_DIM
feedTitle.TextXAlignment = Enum.TextXAlignment.Left
feedTitle.Parent = feedCard

local liveDot = Instance.new("Frame")
liveDot.Name = "LiveDot"
liveDot.Size = UDim2.fromOffset(6, 6)
liveDot.Position = UDim2.fromOffset(82, 4)
liveDot.BackgroundColor3 = COL_OK
liveDot.BorderSizePixel = 0
liveDot.Parent = feedCard
corner(liveDot, 3)

local feedScroll = Instance.new("ScrollingFrame")
feedScroll.Name = "FeedScroll"
feedScroll.Position = UDim2.fromOffset(0, 20)
feedScroll.Size = UDim2.new(1, 0, 1, -20)
feedScroll.BackgroundTransparency = 1
feedScroll.BorderSizePixel = 0
feedScroll.ScrollBarThickness = 4
feedScroll.ScrollBarImageColor3 = COL_ACCENT_A
feedScroll.CanvasSize = UDim2.new(0, 0, 0, 0)
feedScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
feedScroll.ScrollingDirection = Enum.ScrollingDirection.Y
feedScroll.Parent = feedCard

local feedLayout = Instance.new("UIListLayout")
feedLayout.FillDirection = Enum.FillDirection.Vertical
feedLayout.SortOrder = Enum.SortOrder.LayoutOrder
feedLayout.Padding = UDim.new(0, 3)
feedLayout.Parent = feedScroll

local feedEmpty = Instance.new("TextLabel")
feedEmpty.Name = "Empty"
feedEmpty.BackgroundTransparency = 1
feedEmpty.Size = UDim2.new(1, -6, 0, 16)
feedEmpty.Text = "Waiting for activity…"
feedEmpty.Font = Enum.Font.Gotham
feedEmpty.TextSize = 11
feedEmpty.TextColor3 = Color3.fromRGB(95, 101, 115)
feedEmpty.TextXAlignment = Enum.TextXAlignment.Left
feedEmpty.LayoutOrder = 0
feedEmpty.Parent = feedScroll

-- pulse the little "live" dot
TweenService:Create(liveDot, TweenInfo.new(1, SINE, Enum.EasingDirection.InOut, -1, true), { BackgroundTransparency = 0.6 }):Play()

local feedCount = 0
local FEED_MAX = 80

local function feedKindColor(kind)
	if kind == "success" then return COL_OK end
	if kind == "error" then return COL_ERR end
	if kind == "warn" then return COL_WARN end
	if kind == "test" then return COL_ACCENT_B end
	return Color3.fromRGB(186, 192, 205)
end

local function detectFeedKind(text)
	if string.find(text, "✓", 1, true) then return "success" end
	if string.find(text, "✖", 1, true) then return "error" end
	if string.find(text, "⚠", 1, true) then return "warn" end
	return "info"
end

-- Append a line to the live feed. Safe to call from anywhere; ignores the
-- internal control markers so the feed stays human-readable.
local function addFeed(text, kind)
	if not text or text == "" then return end
	if string.find(text, "APPLE_JUICE_TEST", 1, true) or string.find(text, "APPLE_JUICE_ERROR", 1, true) then
		return
	end
	if feedEmpty then feedEmpty:Destroy(); feedEmpty = nil end

	feedCount = feedCount + 1
	local now = os.date("%H:%M:%S")

	local row = Instance.new("TextLabel")
	row.Name = "Row" .. feedCount
	row.Size = UDim2.new(1, -8, 0, 0)
	row.AutomaticSize = Enum.AutomaticSize.Y
	row.BackgroundTransparency = 1
	row.Text = string.format("%s  %s", now, text)
	row.Font = Enum.Font.Gotham
	row.TextSize = 11
	row.TextColor3 = feedKindColor(kind or detectFeedKind(text))
	row.TextXAlignment = Enum.TextXAlignment.Left
	row.TextYAlignment = Enum.TextYAlignment.Top
	row.TextWrapped = true
	row.LayoutOrder = feedCount
	row.TextTransparency = 1
	row.Parent = feedScroll
	TweenService:Create(row, TweenInfo.new(0.25), { TextTransparency = 0 }):Play()

	-- Cap the number of rows so a long session can't grow unbounded.
	local rows = {}
	for _, c in ipairs(feedScroll:GetChildren()) do
		if c:IsA("TextLabel") then table.insert(rows, c) end
	end
	if #rows > FEED_MAX then
		table.sort(rows, function(a, b) return a.LayoutOrder < b.LayoutOrder end)
		for i = 1, #rows - FEED_MAX do
			rows[i]:Destroy()
		end
	end

	-- Auto-scroll to the newest entry once the canvas has re-measured.
	task.defer(function()
		pcall(function()
			feedScroll.CanvasPosition = Vector2.new(0, feedScroll.AbsoluteCanvasSize.Y)
		end)
	end)
end

-- ── Connect button (gradient + hover/press + connecting shimmer) ──────────────
local connectButton = Instance.new("TextButton")
connectButton.Name = "ConnectButton"
connectButton.Size = UDim2.new(1, 0, 0, 46)
connectButton.AutoButtonColor = false
connectButton.BackgroundColor3 = COL_ACCENT_A
connectButton.Text = "Connect"
connectButton.Font = Enum.Font.GothamBold
connectButton.TextSize = 16
connectButton.TextColor3 = Color3.fromRGB(255, 255, 255)
connectButton.BorderSizePixel = 0
connectButton.LayoutOrder = 3
connectButton.Parent = panel
corner(connectButton, 10)

local btnGrad = Instance.new("UIGradient")
btnGrad.Color = ColorSequence.new(COL_ACCENT_A, COL_ACCENT_B)
btnGrad.Rotation = 25
btnGrad.Parent = connectButton

local btnScale = Instance.new("UIScale")
btnScale.Scale = 1
btnScale.Parent = connectButton

-- compat aliases used by the engine (pollLoop / Unloading)
local buttonBaseColor = COL_ACCENT_A
local buttonConnectedColor = COL_DISC

-- ── Manual code (fallback only) ───────────────────────────────────────────────
local manualInput   -- forward decl (may stay nil on CLI build)
local manualToggle
if AJ_CONFIG.showManualCode then
	manualToggle = Instance.new("TextButton")
	manualToggle.Name = "ManualToggle"
	manualToggle.Size = UDim2.new(1, 0, 0, 18)
	manualToggle.BackgroundTransparency = 1
	manualToggle.Text = "Have a pairing code?  ▾"
	manualToggle.Font = Enum.Font.Gotham
	manualToggle.TextSize = 11
	manualToggle.TextColor3 = COL_DIM
	manualToggle.LayoutOrder = 5
	manualToggle.Parent = panel

	manualInput = Instance.new("TextBox")
	manualInput.Name = "ManualInput"
	manualInput.Size = UDim2.new(1, 0, 0, 32)
	manualInput.BackgroundColor3 = COL_SURFACE2
	manualInput.TextColor3 = COL_TEXT
	manualInput.Font = Enum.Font.GothamMedium
	manualInput.TextSize = 13
	manualInput.PlaceholderText = "Pairing code (optional)"
	manualInput.PlaceholderColor3 = COL_DIM
	manualInput.Text = ""
	manualInput.ClearTextOnFocus = false
	manualInput.BorderSizePixel = 0
	manualInput.Visible = false
	manualInput.LayoutOrder = 6
	manualInput.Parent = panel
	corner(manualInput, 8)
	pad(manualInput, 10, 10, 0, 0)

	manualToggle.MouseButton1Click:Connect(function()
		manualInput.Visible = not manualInput.Visible
		manualToggle.Text = manualInput.Visible and "Have a pairing code?  ▴" or "Have a pairing code?  ▾"
		if manualInput.Visible then
			pcall(function() manualInput:CaptureFocus() end)
		end
	end)
end

local function getManualCode()
	if manualInput and manualInput.Visible then
		return (manualInput.Text:gsub("%s+", "")):upper()
	end
	return ""
end

-- ── Undo button ───────────────────────────────────────────────────────────────
local undoButton = Instance.new("TextButton")
undoButton.Name = "UndoButton"
undoButton.Size = UDim2.new(1, 0, 0, 30)
undoButton.BackgroundColor3 = COL_SURFACE2
undoButton.TextColor3 = COL_DIM
undoButton.Font = Enum.Font.GothamSemibold
undoButton.TextSize = 12
undoButton.Text = "↩  Undo Last Sync"
undoButton.AutoButtonColor = true
undoButton.BorderSizePixel = 0
undoButton.Visible = false
undoButton.LayoutOrder = 7
undoButton.Parent = panel
corner(undoButton, 8)

-- ── Footer hint ───────────────────────────────────────────────────────────────
local footer = Instance.new("TextLabel")
footer.Name = "Footer"
footer.Size = UDim2.new(1, 0, 0, 14)
footer.BackgroundTransparency = 1
footer.Text = (AJ_CONFIG.variant == "cli") and "Local · 127.0.0.1:3000" or "apple-juice.online"
footer.Font = Enum.Font.Gotham
footer.TextSize = 10
footer.TextColor3 = Color3.fromRGB(90, 96, 110)
footer.LayoutOrder = 8
footer.Parent = panel

-- ── Animations ────────────────────────────────────────────────────────────────
local QUAD = Enum.EasingStyle.Quad
local SINE = Enum.EasingStyle.Sine

-- entrance pop-in
TweenService:Create(panelScale, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()

-- slow gradient sweep on the logo chip (0→360 loops seamlessly)
TweenService:Create(logoGrad, TweenInfo.new(5, Enum.EasingStyle.Linear, Enum.EasingDirection.Out, -1), { Rotation = 360 }):Play()

-- pulsing status dot
TweenService:Create(statusDot, TweenInfo.new(0.85, SINE, Enum.EasingDirection.InOut, -1, true), { BackgroundTransparency = 0.5 }):Play()

-- connect button hover / press
connectButton.MouseEnter:Connect(function()
	if running then return end
	TweenService:Create(btnScale, TweenInfo.new(0.12, QUAD), { Scale = 1.03 }):Play()
end)
connectButton.MouseLeave:Connect(function()
	TweenService:Create(btnScale, TweenInfo.new(0.12, QUAD), { Scale = 1 }):Play()
end)
connectButton.MouseButton1Down:Connect(function()
	TweenService:Create(btnScale, TweenInfo.new(0.07, QUAD), { Scale = 0.97 }):Play()
end)
connectButton.MouseButton1Up:Connect(function()
	TweenService:Create(btnScale, TweenInfo.new(0.1, QUAD), { Scale = 1 }):Play()
end)

-- connecting spinner state (cycles a ring glyph while pairing)
local connecting = false
local function setConnecting(on)
	connecting = on
	spinner.Visible = on
	statusDot.Visible = not on
	if on then
		task.spawn(function()
			local frames = { "◐", "◓", "◑", "◒" }
			local i = 1
			while connecting do
				spinner.Text = frames[i]
				i = i % #frames + 1
				task.wait(0.11)
			end
		end)
	end
end

-- ─── State ────────────────────────────────────────────────────────────────────

local STATUS_COLORS = {
	success = COL_OK,
	waiting = COL_WARN,
	warning = COL_WARN,
	error = COL_ERR,
	info = COL_DIM,
}

-- running / unloading / undoStack are forward-declared in the UI section above
-- so the animation closures capture the same upvalues.

local function setStatus(msg, statusType)
	statusLabel.Text = msg
	local c = STATUS_COLORS[statusType] or STATUS_COLORS.info
	statusLabel.TextColor3 = c
	pcall(function()
		TweenService:Create(statusDot, TweenInfo.new(0.2), { BackgroundColor3 = c }):Play()
	end)
end

local function updateUndoButton()
	undoButton.Visible = #undoStack > 0
end

-- ─── Helpers ──────────────────────────────────────────────────────────────────

local function reportLog(sessionKey, logMessage)
	-- Stream the action to the in-widget live feed (skips control markers).
	pcall(function() addFeed(logMessage) end)
	task.spawn(function()
		pcall(function()
			HttpService:PostAsync(
				LOGS_ENDPOINT,
				HttpService:JSONEncode({ key = sessionKey, logs = { logMessage } }),
				Enum.HttpContentType.ApplicationJson
			)
		end)
	end)
end

-- Forward error logs to the dashboard (non-test errors)
LogService.MessageOut:Connect(function(message, messageType)
	if running and isConnected and currentSessionKey then
		if messageType == Enum.MessageType.MessageError then
			-- Ignore errors from Roblox Core or other Plugins
			local isCoreError = message:match("CorePackages") or 
								message:match("CoreGui") or 
								message:match("Plugin_") or 
								message:match("builtin_") or 
								message:match("Studio")

			if not isCoreError then
				-- During auto-testing, collect into the test buffer (don't forward yet)
				if isAutoTesting then
					table.insert(testErrors, {
						message = message,
						timestamp = os.clock(),
					})
				else
					reportLog(currentSessionKey, message)
				end
			end
		elseif messageType == Enum.MessageType.MessageWarning then
			local isCoreWarning = message:match("CorePackages") or 
								  message:match("CoreGui") or 
								  message:match("Plugin_") or 
								  message:match("builtin_") or 
								  message:match("Studio")
			
			if not isCoreWarning then
				if isAutoTesting then
					table.insert(testWarnings, {
						message = message,
						timestamp = os.clock(),
					})
				end
			end
		end
	end
end)

-- ─── Advanced Auto-Test System ───────────────────────────────────────────────

local function parseErrorDetails(errorMessage)
	-- Extract script name, line number, and error description from Roblox error format
	-- Formats: "ServerScriptService.ScriptName:15: error message"
	--          "ScriptName:15: error message"
	--          "Workspace.Model.ScriptName:15: error message"
	local scriptPath, lineNum, errText = errorMessage:match("([%w_%.]+):(%d+):%s*(.+)")
	if scriptPath then
		-- Extract just the script name from the full path
		local parts = string.split(scriptPath, ".")
		local scriptName = parts[#parts] or scriptPath
		return {
			scriptName = scriptName,
			scriptPath = scriptPath,
			lineNumber = tonumber(lineNum) or 0,
			errorText = errText,
			rawMessage = errorMessage,
		}
	end
	-- Fallback: couldn't parse
	return {
		scriptName = "Unknown",
		scriptPath = "",
		lineNumber = 0,
		errorText = errorMessage,
		rawMessage = errorMessage,
	}
end

local function buildTestResult(passed, testDuration)
	local result = {
		passed = passed,
		duration = testDuration,
		errorCount = #testErrors,
		warningCount = #testWarnings,
		errors = {},
		warnings = {},
		scripts = {},
	}

	-- Parse each error for structured info
	for _, err in ipairs(testErrors) do
		local parsed = parseErrorDetails(err.message)
		table.insert(result.errors, {
			message = parsed.rawMessage,
			scriptName = parsed.scriptName,
			scriptPath = parsed.scriptPath,
			lineNumber = parsed.lineNumber,
			errorText = parsed.errorText,
		})
	end

	-- Include warnings
	for _, warn in ipairs(testWarnings) do
		table.insert(result.warnings, warn.message)
	end

	-- Include injected script metadata (name, parent, type, and first 800 chars of code)
	for _, script in ipairs(lastInjectedScripts) do
		local codePreview = script.code or ""
		if #codePreview > 800 then
			codePreview = codePreview:sub(1, 800) .. "\n-- [TRUNCATED]"
		end
		table.insert(result.scripts, {
			name = script.name,
			parent = script.parent,
			type = script.type,
			codePreview = codePreview,
		})
	end

	return result
end

local TEST_DURATION = 6 -- seconds

local function runPlaytest(sessionKey)
	currentPlaytestId += 1
	local myPlaytestId = currentPlaytestId

	-- If already auto-testing, stop and restart
	if isAutoTesting then
		isAutoTesting = false
		pcall(function() if RunService:IsRunMode() then RunService:Stop() end end)
		task.wait(0.5)
	elseif RunService:IsRunMode() then
		-- If manually running, stop first to apply new code
		pcall(function() RunService:Stop() end)
		task.wait(0.5)
	end

	isAutoTesting = true
	testErrors = {}
	testWarnings = {}
	setStatus("Running playtest (" .. TEST_DURATION .. "s)...", "waiting")

	task.spawn(function()
		local startTime = os.clock()
		local testOk = pcall(function()
			-- Start run mode
			RunService:Run()
		end)

		if not testOk then
			isAutoTesting = false
			setStatus("Could not start playtest.", "info")
			reportLog(sessionKey, "[APPLE_JUICE_TEST_SKIP]")
			return
		end

		-- Wait for test duration, checking for early fatal errors every 0.5s
		local elapsed = 0
		while elapsed < TEST_DURATION and isAutoTesting and myPlaytestId == currentPlaytestId do
			task.wait(0.5)
			elapsed = os.clock() - startTime

			-- If we got 3+ errors quickly, stop early (likely a crash loop)
			if #testErrors >= 3 and elapsed < 2 then
				setStatus("Multiple errors detected, stopping early...", "error")
				break
			end
		end

		if myPlaytestId ~= currentPlaytestId then
			return -- Aborted by a newer playtest
		end

		-- Stop playtest
		isAutoTesting = false
		local testDuration = os.clock() - startTime
		pcall(function()
			if RunService:IsRunMode() then
				RunService:Stop()
			end
		end)

		-- Small delay to catch any final error logs
		task.wait(0.3)

		-- Build and report structured test results
		local passed = #testErrors == 0
		local result = buildTestResult(passed, testDuration)
		local resultJson = HttpService:JSONEncode(result)

		if passed then
			reportLog(sessionKey, "[APPLE_JUICE_TEST_PASS]" .. resultJson)
			setStatus("Playtest passed! (" .. string.format("%.1f", testDuration) .. "s, no errors)", "success")
		else
			reportLog(sessionKey, "[APPLE_JUICE_TEST_FAIL]" .. resultJson)
			setStatus(#testErrors .. " error(s) found — auto-fixing...", "error")
		end
	end)
end

local function resolvePath(pathStr)
	if not pathStr or type(pathStr) ~= "string" then return nil end
	if string.lower(string.sub(pathStr, 1, 5)) == "game." then
		pathStr = string.sub(pathStr, 6)
	end
	local parts = string.split(pathStr, ".")
	local current = game
	for _, part in ipairs(parts) do
		local nextNode = current:FindFirstChild(part)
		if not nextNode and current == game then
			local ok, svc = pcall(function() return game:GetService(part) end)
			if ok then nextNode = svc end
		end
		if not nextNode then return nil end
		current = nextNode
	end
	return current
end

-- ─── 3D Property System ───────────────────────────────────────────────────────
-- Decodes JSON-friendly property values into real Roblox datatypes so the AI
-- can build 3D models (set Size/Position/CFrame/Color/Material/etc.). Values
-- may arrive as plain JSON (arrays/numbers/strings/bools); we coerce them based
-- on the property name and value shape. Also accepts an explicit tagged form:
--   { __t = "Vector3", v = {4,1,2} }  for unambiguous typing.

-- Property names whose array value is a Vector3 (3 numbers).
local VECTOR3_PROPS = {
	Size = true, Position = true, Orientation = true, Velocity = true,
	RotVelocity = true, AssemblyLinearVelocity = true, AssemblyAngularVelocity = true,
	Attachment0WorldPosition = true,
}
-- Property names whose array value is a Color3 (3 numbers 0-255 OR 0-1).
local COLOR3_PROPS = {
	Color = true, BrickColor = false, Color3 = true,
}

local function toNumberList(v)
	if type(v) ~= "table" then return nil end
	local out = {}
	for i = 1, #v do
		local n = tonumber(v[i])
		if n == nil then return nil end
		out[i] = n
	end
	return out
end

local function makeColor3(nums)
	if not nums or #nums < 3 then return nil end
	-- If any component > 1, assume 0-255 range.
	local max = math.max(nums[1], nums[2], nums[3])
	if max > 1.0001 then
		return Color3.fromRGB(nums[1], nums[2], nums[3])
	end
	return Color3.new(nums[1], nums[2], nums[3])
end

local function makeCFrame(nums)
	if not nums then return nil end
	if #nums == 3 then
		return CFrame.new(nums[1], nums[2], nums[3])
	elseif #nums == 6 then
		-- position + orientation (degrees, XYZ)
		return CFrame.new(nums[1], nums[2], nums[3])
			* CFrame.Angles(math.rad(nums[4]), math.rad(nums[5]), math.rad(nums[6]))
	elseif #nums == 12 then
		return CFrame.new(table.unpack(nums))
	end
	return nil
end

-- Coerce a single value for a given property name into a Roblox datatype.
local function decodePropertyValue(propName, value)
	-- Explicit tagged form takes priority.
	if type(value) == "table" and value.__t then
		local t = value.__t
		local nums = toNumberList(value.v) or {}
		if t == "Vector3" then return Vector3.new(nums[1] or 0, nums[2] or 0, nums[3] or 0) end
		if t == "Vector2" then return Vector2.new(nums[1] or 0, nums[2] or 0) end
		if t == "Color3" then return makeColor3(nums) end
		if t == "CFrame" then return makeCFrame(nums) end
		if t == "UDim2" then return UDim2.new(nums[1] or 0, nums[2] or 0, nums[3] or 0, nums[4] or 0) end
		if t == "UDim" then return UDim.new(nums[1] or 0, nums[2] or 0) end
		if t == "BrickColor" then return BrickColor.new(tostring(value.v)) end
		if t == "Enum" then
			local ok, e = pcall(function()
				return Enum[value.enum][value.item]
			end)
			if ok then return e end
		end
		return value.v
	end

	-- Booleans / numbers pass straight through.
	if type(value) == "boolean" or type(value) == "number" then
		return value
	end

	if type(value) == "string" then
		-- Material / Shape / etc. given as a string → resolve common enums by name.
		if propName == "Material" then
			local ok, e = pcall(function() return Enum.Material[value] end)
			if ok then return e end
		elseif propName == "Shape" then
			local ok, e = pcall(function() return Enum.PartType[value] end)
			if ok then return e end
		elseif propName == "BrickColor" then
			local ok, bc = pcall(function() return BrickColor.new(value) end)
			if ok then return bc end
		end
		return value
	end

	if type(value) == "table" then
		local nums = toNumberList(value)
		if nums then
			if VECTOR3_PROPS[propName] and #nums >= 3 then
				return Vector3.new(nums[1], nums[2], nums[3])
			end
			if COLOR3_PROPS[propName] and #nums >= 3 then
				return makeColor3(nums)
			end
			if propName == "CFrame" then
				return makeCFrame(nums)
			end
			-- Heuristic fallbacks by length.
			if #nums == 3 then return Vector3.new(nums[1], nums[2], nums[3]) end
			if #nums == 2 then return Vector2.new(nums[1], nums[2]) end
			if #nums == 4 then return UDim2.new(nums[1], nums[2], nums[3], nums[4]) end
		end
	end

	return value
end

-- Apply a properties table to an instance, coercing each value. Returns the
-- number of properties successfully set and a list of any that failed.
local function applyProperties(inst, props)
	if type(props) ~= "table" then return 0, {} end
	local applied = 0
	local failures = {}
	for propName, rawValue in pairs(props) do
		local decoded = decodePropertyValue(propName, rawValue)
		local ok = pcall(function()
			inst[propName] = decoded
		end)
		if ok then
			applied += 1
		else
			table.insert(failures, propName)
		end
	end
	return applied, failures
end

-- Build a complete Model from a structured spec in ONE operation. This is the
-- efficient path for 3D builds: many parts + welds + grouping without a round
-- trip per part. Spec shape:
--   {
--     name = "Tree",
--     parent = "Workspace",
--     parts = {
--       { className="Part", name="Trunk", properties={...} },
--       { className="Part", name="Leaves", properties={...} },
--     },
--     weld = true,            -- weld all parts to the first (primary)
--     primaryPart = "Trunk",  -- optional; defaults to first part
--   }
local function buildModel(spec)
	local parentPath = spec.parent or "Workspace"
	local parentInstance = resolvePath(parentPath)
	if not parentInstance then
		return false, "Parent path '" .. tostring(parentPath) .. "' not found."
	end

	local model = Instance.new("Model")
	model.Name = spec.name or "AIModel"

	local createdParts = {}
	local firstPart = nil
	local primaryName = spec.primaryPart

	local partList = spec.parts or {}
	for _, partSpec in ipairs(partList) do
		local className = partSpec.className or "Part"
		local ok, part = pcall(function() return Instance.new(className) end)
		if ok and part then
			part.Name = partSpec.name or className
			applyProperties(part, partSpec.properties or {})
			part.Parent = model
			createdParts[part.Name] = part
			if not firstPart then firstPart = part end
		end
	end

	-- Determine the primary part.
	local primary = (primaryName and createdParts[primaryName]) or firstPart
	if primary and primary:IsA("BasePart") then
		model.PrimaryPart = primary
	end

	-- Weld everything to the primary so the model moves as one rigid body.
	-- A WeldConstraint only rigidifies its parts when the FOLLOWER is unanchored;
	-- the assembly's anchored state is then driven entirely by the primary. If we
	-- anchored the followers too (e.g. mirroring an anchored primary) the welds
	-- would be redundant, and a half-anchored mix can make the model jitter or
	-- explode at runtime. So: the primary keeps whatever anchored state the spec
	-- gave it, and every follower is forced unanchored and welded to it.
	if spec.weld ~= false and primary and primary:IsA("BasePart") then
		for _, part in pairs(createdParts) do
			if part ~= primary and part:IsA("BasePart") then
				local weld = Instance.new("WeldConstraint")
				weld.Part0 = primary
				weld.Part1 = part
				weld.Parent = primary
				-- Follower is driven by the weld → must be unanchored. The primary's
				-- Anchored property determines whether the whole assembly is fixed.
				part.Anchored = false
			end
		end
	end

	model.Parent = parentInstance
	return true, model
end

-- Collect renderable geometry from an instance subtree so the server can render
-- an image of it for the AI to "see". Returns a flat list of part descriptors
-- (world-space center, size, orientation in degrees, color). Bounded so a huge
-- selection can't produce a massive payload.
local MAX_INSPECT_PARTS = 400
local function collectGeometry(root)
	local parts = {}
	local function visit(inst)
		if #parts >= MAX_INSPECT_PARTS then return end
		if inst:IsA("BasePart") then
			local cf = inst.CFrame
			local pos = cf.Position
			local rx, ry, rz = cf:ToEulerAnglesXYZ()
			local col = inst.Color
			local entry = {
				name = inst.Name,
				className = inst.ClassName,
				position = { pos.X, pos.Y, pos.Z },
				size = { inst.Size.X, inst.Size.Y, inst.Size.Z },
				orientation = { math.deg(rx), math.deg(ry), math.deg(rz) },
				color = { math.floor(col.R * 255 + 0.5), math.floor(col.G * 255 + 0.5), math.floor(col.B * 255 + 0.5) },
				transparency = inst.Transparency,
				shape = (inst:IsA("Part") and tostring(inst.Shape)) or nil,
				material = tostring(inst.Material),
			}
			table.insert(parts, entry)
		end
		for _, child in ipairs(inst:GetChildren()) do
			visit(child)
		end
	end
	visit(root)
	return parts
end

-- Build a quick spatial summary the model can read even without the image:
-- overall bounds, part count, and anything that looks off (floating / clipping).
local function summarizeGeometry(parts)
	if #parts == 0 then return "No parts found." end
	local minY = math.huge
	local minX, maxX, minZ, maxZ = math.huge, -math.huge, math.huge, -math.huge
	for _, p in ipairs(parts) do
		local halfY = p.size[2] / 2
		local bottom = p.position[2] - halfY
		if bottom < minY then minY = bottom end
		if p.position[1] - p.size[1] / 2 < minX then minX = p.position[1] - p.size[1] / 2 end
		if p.position[1] + p.size[1] / 2 > maxX then maxX = p.position[1] + p.size[1] / 2 end
		if p.position[3] - p.size[3] / 2 < minZ then minZ = p.position[3] - p.size[3] / 2 end
		if p.position[3] + p.size[3] / 2 > maxZ then maxZ = p.position[3] + p.size[3] / 2 end
	end
	local lines = {}
	table.insert(lines, string.format("%d parts; footprint %.1f x %.1f studs; lowest point y=%.2f.", #parts, maxX - minX, maxZ - minZ, minY))
	if minY > 0.6 then
		table.insert(lines, string.format("⚠ Lowest part is %.2f studs above y=0 — the build may be floating off the ground.", minY))
	elseif minY < -0.6 then
		table.insert(lines, string.format("⚠ Lowest part is %.2f studs below y=0 — the build may be sunk into the ground.", minY))
	end
	return table.concat(lines, " ")
end

-- ─── Resilient Script Editing ──────────────────────────────────────────────────
-- AI-generated search/replace edits frequently fail to apply because the search
-- block differs from the real source in trivial ways: tabs vs spaces, trailing
-- whitespace, CRLF vs LF, or extra blank lines. A plain gsub then matches zero
-- times and the edit is silently dropped. These helpers add tolerance:
--   1. exact match (fast path)
--   2. line-trimmed match (ignores leading/trailing whitespace per line)
--   3. whitespace-collapsed match (ignores all indentation differences)
-- The replacement is re-indented to match the indentation of the matched block
-- so the resulting source stays consistent.

-- Normalize line endings and tabs so comparisons are stable.
local function normalizeSource(s)
	s = s:gsub("\r\n", "\n"):gsub("\r", "\n")
	return s
end

-- Split a string into a list of lines (no trailing-newline surprises).
local function splitLines(s)
	local lines = {}
	for line in (s .. "\n"):gmatch("(.-)\n") do
		table.insert(lines, line)
	end
	-- gmatch above yields one extra empty entry from the appended newline; drop it.
	if #lines > 0 and lines[#lines] == "" then
		table.remove(lines, #lines)
	end
	return lines
end

local function trim(s)
	return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- Capture the leading whitespace of a line.
local function leadingWhitespace(line)
	return line:match("^(%s*)") or ""
end

-- Try to locate `search` inside `source` (both already newline-normalized) and
-- return the start and end byte offsets of the matched region, plus the
-- indentation of the matched block's first line. Falls back through three
-- increasingly lenient strategies. Returns nil when nothing matches.
local function locateBlock(source, search)
	if search == "" then return nil end

	-- Strategy 1: exact substring.
	local s, e = source:find(search, 1, true)
	if s then
		local lineStart = source:sub(1, s):match("([^\n]*)$") or ""
		return s, e, leadingWhitespace(lineStart)
	end

	-- Prepare line-based matching for strategies 2 & 3.
	local srcLines = splitLines(source)
	local searchLines = splitLines(search)
	if #searchLines == 0 then return nil end

	-- Precompute byte offset of the start of each source line.
	local lineOffsets = {}
	do
		local pos = 1
		for i, line in ipairs(srcLines) do
			lineOffsets[i] = pos
			pos = pos + #line + 1 -- +1 for the newline
		end
	end

	local function blockBytes(startLine, count)
		local startByte = lineOffsets[startLine]
		local endLineIdx = startLine + count - 1
		local endByte = lineOffsets[endLineIdx] + #srcLines[endLineIdx] - 1
		return startByte, endByte
	end

	-- Strategy 2: per-line trimmed equality.
	local n = #searchLines
	for i = 1, #srcLines - n + 1 do
		local allMatch = true
		for j = 1, n do
			if trim(srcLines[i + j - 1]) ~= trim(searchLines[j]) then
				allMatch = false
				break
			end
		end
		if allMatch then
			local sB, eB = blockBytes(i, n)
			return sB, eB, leadingWhitespace(srcLines[i])
		end
	end

	-- Strategy 3: whitespace-collapsed equality (all runs of whitespace → single).
	local function collapse(str) return (trim(str):gsub("%s+", " ")) end
	for i = 1, #srcLines - n + 1 do
		local allMatch = true
		for j = 1, n do
			if collapse(srcLines[i + j - 1]) ~= collapse(searchLines[j]) then
				allMatch = false
				break
			end
		end
		if allMatch then
			local sB, eB = blockBytes(i, n)
			return sB, eB, leadingWhitespace(srcLines[i])
		end
	end

	return nil
end

-- Re-indent a replacement block so its first line sits at `baseIndent` and the
-- relative indentation of subsequent lines is preserved.
local function reindentReplacement(replace, baseIndent)
	local lines = splitLines(replace)
	if #lines == 0 then return replace end
	-- Find the minimum indentation across non-empty lines to use as the anchor.
	local minIndent = nil
	for _, line in ipairs(lines) do
		if trim(line) ~= "" then
			local indent = #leadingWhitespace(line)
			if minIndent == nil or indent < minIndent then minIndent = indent end
		end
	end
	minIndent = minIndent or 0
	local out = {}
	for _, line in ipairs(lines) do
		if trim(line) == "" then
			table.insert(out, "")
		else
			local stripped = line:sub(minIndent + 1)
			table.insert(out, baseIndent .. stripped)
		end
	end
	return table.concat(out, "\n")
end

-- Apply a single {search, replace} edit to source, returning newSource and a
-- boolean indicating whether it matched. Tolerant of whitespace differences.
local function applyResilientEdit(source, search, replace)
	search = normalizeSource(search)
	replace = normalizeSource(replace)
	local s, e, baseIndent = locateBlock(source, search)
	if not s then return source, false end
	local adjustedReplace = reindentReplacement(replace, baseIndent or "")
	local newSource = source:sub(1, s - 1) .. adjustedReplace .. source:sub(e + 1)
	return newSource, true
end


local function injectSingleScript(scriptData)
	local action = scriptData.action or "create"
	local parentPath = scriptData.parent or "ServerScriptService"
	local scriptName = scriptData.name or "AIGeneratedScript"
	local scriptClass = scriptData.type or "Script"
	local codeText = scriptData.code or ""

	local parentInstance = resolvePath(parentPath)
	if not parentInstance then
		if currentSessionKey then
			reportLog(currentSessionKey, "✖ [Roblox Studio] Parent path '" .. tostring(parentPath) .. "' not found.")
		end
		return false, "Parent path '" .. tostring(parentPath) .. "' not found. Make sure you create the parent first.", nil
	end

	local undoFn = nil

	if action == "delete" then
		local target = parentInstance:FindFirstChild(scriptName)
		if target then
			if currentSessionKey then
				reportLog(currentSessionKey, "🛠️ [Roblox Studio] Deleting script " .. scriptName .. " in " .. parentPath)
			end
			local oldParent = target.Parent
			local oldName = target.Name
			local oldClass = target.ClassName
			local oldSource = target:IsA("LuaSourceContainer") and target.Source or ""
			
			undoFn = function()
				local rest = Instance.new(oldClass)
				rest.Name = oldName
				if rest:IsA("LuaSourceContainer") then
					ScriptEditorService:UpdateSourceAsync(rest, function() return oldSource end)
				end
				rest.Parent = oldParent
			end
			
			target:Destroy()
			if currentSessionKey then
				reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully deleted " .. scriptName)
			end
			return true, "Deleted " .. scriptName, undoFn
		else
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] Delete failed: " .. scriptName .. " not found")
			end
			return false, "Delete failed: " .. scriptName, nil
		end
	end

	if action == "insert_asset" then
		-- Features loading remote assets by ID are disabled for marketplace safety.
		-- Use "create_instance" or "create" to generate local components.
		return false, "Asset insertion via ID is disabled for safety. Please use script-based creation.", nil
	end

	if action == "create_instance" then
		local className = scriptData.className or "Part"
		local instanceName = scriptData.instanceName or className
		if currentSessionKey then
			reportLog(currentSessionKey, "🛠️ [Roblox Studio] Creating instance " .. className .. " [" .. instanceName .. "] in " .. parentPath)
		end
		local ok, newInst = pcall(function()
			return Instance.new(className)
		end)
		if ok and newInst then
			newInst.Name = instanceName
			-- Apply any 3D / visual properties (Size, Position, Color, Material…).
			local appliedCount, failures = applyProperties(newInst, scriptData.properties or {})
			newInst.Parent = parentInstance

			undoFn = function()
				if newInst and newInst.Parent then newInst:Destroy() end
			end

			local detail = ""
			if appliedCount > 0 then
				detail = " (" .. appliedCount .. " properties set)"
			end
			if #failures > 0 then
				detail = detail .. " [skipped: " .. table.concat(failures, ", ") .. "]"
			end
			if currentSessionKey then
				reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully created " .. className .. " [" .. instanceName .. "]" .. detail)
			end
			return true, "Created " .. className .. " [" .. instanceName .. "] in " .. parentPath .. detail, undoFn
		else
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] Failed to create instance " .. className .. ": " .. tostring(newInst))
			end
			return false, "Failed to create " .. className .. ": " .. tostring(newInst), nil
		end
	end

	if action == "set_properties" then
		-- Update properties on an EXISTING instance (move/recolor/resize/etc.).
		local targetPath = scriptData.path or (parentPath .. "." .. scriptName)
		local target = resolvePath(targetPath)
		if not target then
			target = parentInstance:FindFirstChild(scriptName)
		end
		if not target then
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] set_properties: target '" .. tostring(targetPath) .. "' not found.")
			end
			return false, "Target '" .. tostring(targetPath) .. "' not found.", nil
		end
		-- Snapshot prior values for undo.
		local priorValues = {}
		for propName in pairs(scriptData.properties or {}) do
			pcall(function() priorValues[propName] = target[propName] end)
		end
		local appliedCount, failures = applyProperties(target, scriptData.properties or {})
		undoFn = function()
			for propName, oldVal in pairs(priorValues) do
				pcall(function() target[propName] = oldVal end)
			end
		end
		local detail = appliedCount .. " properties set"
		if #failures > 0 then detail = detail .. " [skipped: " .. table.concat(failures, ", ") .. "]" end
		if currentSessionKey then
			reportLog(currentSessionKey, "🎨 [Roblox Studio] Updated " .. target.Name .. " — " .. detail)
		end
		return true, "Updated " .. target.Name .. " (" .. detail .. ")", undoFn
	end

	if action == "build_model" then
		-- Build a whole multi-part 3D model in one shot.
		if currentSessionKey then
			reportLog(currentSessionKey, "🧱 [Roblox Studio] Building model '" .. tostring(scriptData.name or "AIModel") .. "'...")
		end
		local ok, modelOrErr = buildModel({
			name = scriptData.name,
			parent = scriptData.parent or "Workspace",
			parts = scriptData.parts,
			weld = scriptData.weld,
			primaryPart = scriptData.primaryPart,
		})
		if ok then
			local model = modelOrErr
			undoFn = function()
				if model and model.Parent then model:Destroy() end
			end
			local partCount = scriptData.parts and #scriptData.parts or 0
			if currentSessionKey then
				reportLog(currentSessionKey, "✓ [Roblox Studio] Built model '" .. model.Name .. "' (" .. partCount .. " parts)")
			end
			return true, "Built model '" .. model.Name .. "' with " .. partCount .. " parts.", undoFn
		else
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] Build failed: " .. tostring(modelOrErr))
			end
			return false, "Build failed: " .. tostring(modelOrErr), nil
		end
	end

	if action == "run_playtest" then
		if currentSessionKey then
			reportLog(currentSessionKey, "🛠️ [Roblox Studio] Starting playtest verification...")
		end
		task.spawn(function()
			task.wait(0.2)
			if currentSessionKey then
				runPlaytest(currentSessionKey)
			end
		end)
		return true, "Remote playtest triggered by AI.", nil
	end

	if action == "stop_playtest" then
		return true, "Stop playtest action received.", nil
	end

	if action == "execute_luau" then
		-- Features using loadstring are disabled to ensure marketplace safety.
		-- You can use "create" or "create_instance" to inject functionality.
		return false, "Dynamic Luau execution is disabled for safety. Use script creation instead.", nil
	end

	if action == "rename_instance" then
		local oldPath = scriptData.oldPath
		local newName = scriptData.newName
		print("[AppleJuice] Renaming " .. tostring(oldPath) .. " to " .. tostring(newName))
		if currentSessionKey then
			reportLog(currentSessionKey, "🛠️ [Roblox Studio] Renaming " .. tostring(oldPath) .. " to " .. tostring(newName))
		end
		local target = resolvePath(oldPath)
		if target then
			local oldName = target.Name
			undoFn = function() if target and target.Parent then target.Name = oldName end end
			target.Name = newName
			print("[AppleJuice] Successfully renamed to " .. newName)
			if currentSessionKey then
				reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully renamed to " .. newName)
			end
			return true, "Renamed " .. oldName .. " to " .. newName, undoFn
		else
			warn("[AppleJuice] Rename failed: Could not find target at " .. tostring(oldPath))
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] Rename failed: Could not find target at " .. tostring(oldPath))
			end
			return false, "Rename failed: Could not find " .. tostring(oldPath), nil
		end
	end

	if action == "move_instance" then
		local oldPath = scriptData.oldPath
		local newParentPath = scriptData.newParentPath
		if currentSessionKey then
			reportLog(currentSessionKey, "🛠️ [Roblox Studio] Moving " .. tostring(oldPath) .. " to " .. tostring(newParentPath))
		end
		local target = resolvePath(oldPath)
		local newParent = resolvePath(newParentPath)
		if target and newParent then
			local oldParent = target.Parent
			undoFn = function() if target and target.Parent then target.Parent = oldParent end end
			target.Parent = newParent
			if currentSessionKey then
				reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully moved " .. target.Name .. " to " .. newParentPath)
			end
			return true, "Moved " .. target.Name .. " to " .. newParentPath, undoFn
		else
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] Move failed: Could not find target or new parent")
			end
			return false, "Move failed: Could not find target or new parent", nil
		end
	end

	if action == "edit_script" then
		if currentSessionKey then
			reportLog(currentSessionKey, "🛠️ [Roblox Studio] Modifying script " .. scriptName .. " in " .. parentPath)
		end
		local target = nil
		if scriptData.parent and scriptData.parent ~= "" then
			local parentInst = resolvePath(parentPath)
			if parentInst then target = parentInst:FindFirstChild(scriptName) end
		else
			local locations = { game:GetService("ServerScriptService"), game:GetService("ReplicatedStorage"), game:GetService("Workspace") }
			local starterPlayer = game:GetService("StarterPlayer")
			if starterPlayer:FindFirstChild("StarterPlayerScripts") then table.insert(locations, starterPlayer.StarterPlayerScripts) end
			if starterPlayer:FindFirstChild("StarterCharacterScripts") then table.insert(locations, starterPlayer.StarterCharacterScripts) end
			for _, loc in ipairs(locations) do
				local found = loc:FindFirstChild(scriptName, true)
				if found and found:IsA("LuaSourceContainer") then
					target = found
					break
				end
			end
		end

		if target and target:IsA("LuaSourceContainer") then
			local oldSource = normalizeSource(target.Source)
			local newSource = oldSource
			local successCount = 0
			local failedBlocks = {}

			if scriptData.edits and type(scriptData.edits) == "table" then
				for idx, edit in ipairs(scriptData.edits) do
					local search = edit.search or ""
					local replace = edit.replace or ""
					if search ~= "" then
						local result, matched = applyResilientEdit(newSource, search, replace)
						if matched then
							newSource = result
							successCount += 1
						else
							table.insert(failedBlocks, "#" .. idx)
						end
					end
				end
			end

			if successCount > 0 then
				target.Source = newSource
				undoFn = function() target.Source = oldSource end
				local detail = successCount .. " replacements"
				if #failedBlocks > 0 then
					detail = detail .. ", " .. #failedBlocks .. " unmatched (" .. table.concat(failedBlocks, ", ") .. ")"
				end
				if currentSessionKey then
					reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully modified " .. scriptName .. " (" .. detail .. ")")
				end
				return true, "Edited " .. scriptName .. " (" .. detail .. ")", undoFn
			else
				if currentSessionKey then
					reportLog(currentSessionKey, "✖ [Roblox Studio] Modification failed: search blocks not found in " .. scriptName)
				end
				return false, "Edit failed: search blocks not found in " .. scriptName, nil
			end
		else
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] Modification failed: could not find script " .. scriptName)
			end
			return false, "Edit failed: could not find script " .. scriptName, nil
		end
	end

	if action == "read_script" then
		if currentSessionKey then
			reportLog(currentSessionKey, "📖 [Roblox Studio] Reading file " .. scriptName)
		end
		return true, "Requested read for " .. scriptName, nil
	end

	local function parsePropertyValue(val)
		if type(val) ~= "string" then return val end
		
		-- Hex Color
		if val:match("^#%x%x%x%x%x%x$") then
			local ok, c = pcall(function() return Color3.fromHex(val) end)
			if ok then return c end
		end
		
		-- Color3.fromRGB(r, g, b)
		local r, g, b = val:match("Color3%.fromRGB%((%d+),%s*(%d+),%s*(%d+)%)")
		if r and g and b then return Color3.fromRGB(tonumber(r), tonumber(g), tonumber(b)) end

		-- UDim2.new(sx, ox, sy, oy)
		local sx, ox, sy, oy = val:match("UDim2%.new%((%-?[%d%.]+),%s*(%-?[%d%.]+),%s*(%-?[%d%.]+),%s*(%-?[%d%.]+)%)")
		if sx and ox and sy and oy then return UDim2.new(tonumber(sx), tonumber(ox), tonumber(sy), tonumber(oy)) end

		-- Vector3.new(x, y, z)
		local vx, vy, vz = val:match("Vector3%.new%((%-?[%d%.]+),%s*(%-?[%d%.]+),%s*(%-?[%d%.]+)%)")
		if vx and vy and vz then return Vector3.new(tonumber(vx), tonumber(vy), tonumber(vz)) end

		-- Enum
		local enumType, enumItem = val:match("Enum%.(%w+)%.(%w+)")
		if enumType and enumItem then
			local ok, res = pcall(function() return Enum[enumType][enumItem] end)
			if ok then return res end
		end

		return val
	end

	local target = parentInstance:FindFirstChild(scriptName)
	local didExist = false
	local oldSource = ""
	local oldClass = scriptClass

	if target and target:IsA("LuaSourceContainer") and target.ClassName == scriptClass then
		didExist = true
		oldSource = target.Source
	elseif target then
		didExist = true
		oldClass = target.ClassName
		oldSource = target:IsA("LuaSourceContainer") and target.Source or ""
		target:Destroy()
		target = nil
	end

	if currentSessionKey then
		reportLog(currentSessionKey, "🛠️ [Roblox Studio] Syncing script " .. scriptClass .. " [" .. scriptName .. "] to " .. parentPath)
	end

	if not target then
		local ok, newTarget = pcall(function() return Instance.new(scriptClass) end)
		if not ok then 
			warn("[AppleJuice] Invalid class " .. tostring(scriptClass) .. ", falling back to Script")
			newTarget = Instance.new("Script") 
			scriptClass = "Script"
		end
		target = newTarget
		target.Name = scriptName
		target.Parent = parentInstance

		-- Parenting Warnings
		if target:IsA("LocalScript") and (parentPath:match("ServerScriptService") or parentPath:match("ServerStorage")) then
			warn("[AppleJuice] ⚠️ WARNING: LocalScript '" .. scriptName .. "' parented to '" .. parentPath .. "'. LocalScripts ONLY run in StarterGui, StarterPlayerScripts, or StarterCharacterScripts. It will not show up!")
		elseif target:IsA("Script") and (parentPath:match("StarterGui") or parentPath:match("StarterPlayer")) then
			warn("[AppleJuice] ⚠️ WARNING: Server Script '" .. scriptName .. "' parented to '" .. parentPath .. "'. This is usually not what you want for GUIs.")
		end
		
		print("[AppleJuice] ✅ Created " .. scriptClass .. " [" .. scriptName .. "] in " .. parentPath)
	end

	-- Apply properties if provided (useful for GUIs, Parts, Values)
	if scriptData.properties and type(scriptData.properties) == "table" then
		for k, v in pairs(scriptData.properties) do
			pcall(function()
				target[k] = parsePropertyValue(v)
			end)
		end
	end

	undoFn = function()
		if didExist then
			if target and target.ClassName == oldClass then
				if target:IsA("LuaSourceContainer") then
					ScriptEditorService:UpdateSourceAsync(target, function() return oldSource end)
				end
			else
				if target then target:Destroy() end
				local rest = pcall(function() return Instance.new(oldClass) end) and Instance.new(oldClass) or Instance.new("Script")
				rest.Name = scriptName
				if rest:IsA("LuaSourceContainer") then
					ScriptEditorService:UpdateSourceAsync(rest, function() return oldSource end)
				end
				rest.Parent = parentInstance
			end
		else
			if target then target:Destroy() end
		end
	end

	-- Only update source if it's a script
	if target:IsA("LuaSourceContainer") then
		local ok, err = pcall(function()
			ScriptEditorService:UpdateSourceAsync(target, function() return codeText end)
		end)
		if ok then 
			-- Hot-Reload for active Playtests (Sync to PlayerGui immediately)
			if RunService:IsRunMode() and (target:IsA("LocalScript") or target:IsA("ScreenGui")) then
				task.spawn(function()
					local lp = game:GetService("Players").LocalPlayer
					if lp then
						local pGui = lp:FindFirstChild("PlayerGui")
						if pGui then
							local old = pGui:FindFirstChild(target.Name)
							if old then 
								old:Destroy() 
								print("[AppleJuice] ♻️ Replaced existing " .. target.Name .. " in PlayerGui")
							end
							local clone = target:Clone()
							clone.Parent = pGui
							print("[AppleJuice] ⚡ Hot-reloaded " .. target.Name .. " to PlayerGui")
						end
					end
				end)
			end
			if currentSessionKey then
				reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully synced script " .. scriptClass .. " [" .. scriptName .. "]")
			end
			return true, "Synced " .. scriptClass .. " [" .. scriptName .. "] → " .. parentPath, undoFn
		else 
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] Failed to sync " .. scriptClass .. " [" .. scriptName .. "]: " .. tostring(err))
			end
			return false, "ScriptEditor Error: " .. tostring(err), nil 
		end
	else
		-- Hot-Reload for non-script instances (like ScreenGui)
		if RunService:IsRunMode() and target:IsA("ScreenGui") then
			task.spawn(function()
				local lp = game:GetService("Players").LocalPlayer
				if lp then
					local pGui = lp:FindFirstChild("PlayerGui")
					if pGui then
						local old = pGui:FindFirstChild(target.Name)
						if old then old:Destroy() end
						local clone = target:Clone()
						clone.Parent = pGui
					end
				end
			end)
		end
		if currentSessionKey then
			reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully synced " .. scriptClass .. " [" .. scriptName .. "]")
		end
		return true, "Created " .. scriptClass .. " [" .. scriptName .. "] → " .. parentPath, undoFn
	end
end

local function injectCode(incomingData)
	local decodeOk, parsed = pcall(function() return HttpService:JSONDecode(incomingData) end)
	if not decodeOk or type(parsed) ~= "table" then return false, "Invalid JSON payload", 0, false end

	local currentBatch = {}
	local isManual = parsed.isManual == true or parsed.isManual == "true"

	-- Multi-script: payload has a "scripts" array
	if parsed.scripts and type(parsed.scripts) == "table" and #parsed.scripts > 0 then
		local successCount = 0
		local messages = {}
		for _, scriptData in ipairs(parsed.scripts) do
			local ok, msg, uFn = injectSingleScript(scriptData)
			if ok then successCount += 1 end
			if ok and uFn then table.insert(currentBatch, uFn) end
			table.insert(messages, msg)
		end
		
		if #currentBatch > 0 then
			table.insert(undoStack, currentBatch)
			updateUndoButton()
		end
		
		local summary = "Synced " .. successCount .. "/" .. #parsed.scripts .. " scripts"
		
		if successCount < #parsed.scripts then
			local failedMsgs = {}
			for _, m in ipairs(messages) do
				if m:match("failed") or m:match("Error") or m:match("not found") then
					table.insert(failedMsgs, m)
				end
			end
			if currentSessionKey then
				reportLog(currentSessionKey, "[APPLE_JUICE_TEST_FAIL]\nEdit failed: " .. table.concat(failedMsgs, " | "), "error")
			end
			return false, summary .. " (Errors: " .. table.concat(failedMsgs, ", ") .. ")", #parsed.scripts, isManual
		end

		return true, summary, #parsed.scripts, isManual
	end

	-- Single script
	local ok, msg, uFn = injectSingleScript(parsed)
	if ok and uFn then
		table.insert(currentBatch, uFn)
		table.insert(undoStack, currentBatch)
		updateUndoButton()
	end
	return ok, msg, 1, isManual
end

-- ─── Auto-connect via IP ──────────────────────────────────────────────────────

local function buildTreePaths(parent, parentPath, maxDepth, currentDepth, results)
	if currentDepth > maxDepth then return end
	for _, child in ipairs(parent:GetChildren()) do
		local childPath = parentPath .. "." .. child.Name
		local line = childPath .. " [" .. child.ClassName .. "]"
		table.insert(results, line)
		buildTreePaths(child, childPath, maxDepth, currentDepth + 1, results)
	end
end

local function getProjectTree()
	local results = {}
	local serviceNames = { 
		"Workspace", 
		"Players",
		"Lighting",
		"MaterialService",
		"ReplicatedFirst",
		"ReplicatedStorage", 
		"ServerScriptService", 
		"ServerStorage", 
		"StarterGui",
		"StarterPack",
		"StarterPlayer",
		"Teams",
		"SoundService",
		"TextChatService"
	}
	
	for _, sName in ipairs(serviceNames) do
		local ok, root = pcall(function() return game:GetService(sName) end)
		if ok and root then
			-- Add the root service itself
			table.insert(results, root.Name .. " [" .. root.ClassName .. "]")
			buildTreePaths(root, root.Name, 4, 1, results)
		end
	end
	return table.concat(results, "\n")
end

-- ─── Stage 2: Full project snapshot (tree + script sources) ────────────────────
-- Like getProjectTree, but also captures the .Source of every LuaSourceContainer
-- so the server can materialize the project as real files for the agentic CLI.
-- Capped to keep payloads sane.

local SNAPSHOT_SERVICES = {
	"Workspace", "ReplicatedFirst", "ReplicatedStorage",
	"ServerScriptService", "ServerStorage", "StarterGui",
	"StarterPack", "StarterPlayer",
}
local MAX_SNAPSHOT_ENTRIES = 1500
local MAX_SOURCE_BYTES = 200000 -- skip pathologically large scripts

local function buildSnapshotEntries(parent, parentPath, depth, results)
	if depth > 6 then return end
	if #results >= MAX_SNAPSHOT_ENTRIES then return end
	for _, child in ipairs(parent:GetChildren()) do
		if #results >= MAX_SNAPSHOT_ENTRIES then return end
		local childPath = parentPath .. "." .. child.Name
		local entry = { path = childPath, className = child.ClassName }
		if child:IsA("LuaSourceContainer") then
			local ok, src = pcall(function() return child.Source end)
			if ok and src and #src <= MAX_SOURCE_BYTES then
				entry.source = src
			else
				entry.source = ""
			end
		end
		table.insert(results, entry)
		buildSnapshotEntries(child, childPath, depth + 1, results)
	end
end

local function getProjectSnapshot()
	local results = {}
	for _, sName in ipairs(SNAPSHOT_SERVICES) do
		local ok, root = pcall(function() return game:GetService(sName) end)
		if ok and root then
			table.insert(results, { path = root.Name, className = root.ClassName })
			buildSnapshotEntries(root, root.Name, 1, results)
		end
	end
	return results
end

local isReportingSnapshot = false
local function reportSnapshot(sessionKey)
	if isReportingSnapshot then return end
	isReportingSnapshot = true
	task.spawn(function()
		local snapshot = getProjectSnapshot()
		pcall(function()
			HttpService:PostAsync(
				SNAPSHOT_ENDPOINT,
				HttpService:JSONEncode({ key = sessionKey, snapshot = snapshot }),
				Enum.HttpContentType.ApplicationJson
			)
		end)
		isReportingSnapshot = false
	end)
end

local lastTreeHash = ""
local isReportingTree = false
local function reportTree(sessionKey, force)
	if isReportingTree then return end
	local tree = getProjectTree()
	if not force and tree == lastTreeHash then return end
	
	isReportingTree = true
	task.spawn(function()
		local ok = pcall(function()
			HttpService:PostAsync(
				TREE_ENDPOINT,
				HttpService:JSONEncode({ key = sessionKey, tree = tree }),
				Enum.HttpContentType.ApplicationJson
			)
		end)
		if ok then
			lastTreeHash = tree
		else
			-- If it fails, clear lastTreeHash so it retries on the next poll
			lastTreeHash = ""
		end
		isReportingTree = false
	end)
end

local function autoConnect(manualKey)
	if manualKey then
		setStatus("Connecting via key [" .. manualKey .. "]...", "waiting")
	else
		setStatus("Connecting via IP...", "waiting")
	end
	
	local url = CONNECT_ENDPOINT
	if manualKey then
		url = url .. "?code=" .. HttpService:UrlEncode(manualKey)
	end

	local ok, response = pcall(function()
		return HttpService:RequestAsync({
			Url = url,
			Method = "GET",
			Headers = { ["Accept"] = "application/json" },
		})
	end)

	if not ok then
		-- `response` holds the thrown error here. Surface it so connection
		-- problems are diagnosable (e.g. trust/HTTP-disabled/DNS), instead of a
		-- generic message.
		return nil, "Cannot reach dashboard: " .. tostring(response)
	end

	if not response.Success then
		local errMsg = "Connection failed (HTTP " .. tostring(response.StatusCode) .. ")"
		pcall(function()
			local data = HttpService:JSONDecode(response.Body)
			if data.error then 
				errMsg = data.error 
				if data.ip then errMsg = errMsg .. "\n(Your IP: " .. data.ip .. ")" end
			end
		end)
		return nil, errMsg
	end

	local decodeOk, data = pcall(function() return HttpService:JSONDecode(response.Body) end)
	if not decodeOk then return nil, "Invalid response from server." end

	if data.connected and data.sessionKey then
		return data.sessionKey, nil
	end

	return nil, data.error or "No active dashboard found."
end

-- ─── MCP command executor ─────────────────────────────────────────────────────
-- Executes a single MCP command (from /api/mcp/next) against Studio using the
-- existing handlers, and returns ok, data, errMessage.

local function readScriptByPath(fullPath)
	local target = resolvePath(fullPath)
	if not target then
		-- Try searching common locations by leaf name as a fallback.
		local leaf = string.split(fullPath, ".")
		leaf = leaf[#leaf]
		local locations = {
			game:GetService("ServerScriptService"),
			game:GetService("ReplicatedStorage"),
			game:GetService("StarterGui"),
			game:GetService("Workspace"),
		}
		for _, loc in ipairs(locations) do
			local found = loc:FindFirstChild(leaf, true)
			if found and found:IsA("LuaSourceContainer") then
				target = found
				break
			end
		end
	end
	if target and target:IsA("LuaSourceContainer") then
		return true, target.Source
	end
	return false, nil
end

-- ─── Tool-parity helpers (Phase 3): search, grep, inspect ──────────────────────
-- Mirror the OFFICIAL Roblox Studio MCP tool surface (script_search, script_grep,
-- inspect_instance) so the agent can explore an unfamiliar project the way it
-- does with the official server. Bounds mirror the official limits.

-- Enumerate every LuaSourceContainer in the project (across the main services),
-- returning { inst, path } records. Bounded so a huge place can't blow memory.
local SCRIPT_SCAN_SERVICES = {
	"Workspace", "ReplicatedFirst", "ReplicatedStorage",
	"ServerScriptService", "ServerStorage", "StarterGui",
	"StarterPack", "StarterPlayer", "SoundService", "Lighting",
}
local MAX_SCANNED_SCRIPTS = 4000

local function collectAllScripts()
	local out = {}
	for _, sName in ipairs(SCRIPT_SCAN_SERVICES) do
		local ok, root = pcall(function() return game:GetService(sName) end)
		if ok and root then
			for _, desc in ipairs(root:GetDescendants()) do
				if desc:IsA("LuaSourceContainer") then
					table.insert(out, { inst = desc, path = desc:GetFullName() })
					if #out >= MAX_SCANNED_SCRIPTS then return out end
				end
			end
		end
	end
	return out
end

-- Fuzzy-ish name search: case-insensitive substring match on the script name,
-- returns up to `limit` dotted paths (official: <=10).
local function scriptSearch(query, limit)
	limit = limit or 10
	query = string.lower(tostring(query or ""))
	local results = {}
	if query == "" then return results end
	for _, rec in ipairs(collectAllScripts()) do
		if string.find(string.lower(rec.inst.Name), query, 1, true) then
			table.insert(results, rec.path .. " [" .. rec.inst.ClassName .. "]")
			if #results >= limit then break end
		end
	end
	return results
end

-- Content search across all script sources. Returns up to `limit` matches
-- (official: <=50). Each match includes a small CONTEXT WINDOW (lines around
-- the hit) so the model sees the surrounding code topography and can write a
-- correct multi_edit on the first try, instead of just a bare line.
local GREP_CONTEXT_LINES = 2
local function scriptGrep(pattern, limit)
	limit = limit or 50
	pattern = string.lower(tostring(pattern or ""))
	local blocks = {}
	local total = 0
	if pattern == "" then return blocks end
	for _, rec in ipairs(collectAllScripts()) do
		local ok, src = pcall(function() return rec.inst.Source end)
		if ok and src then
			-- Split into an indexed line array once per script.
			local lines = {}
			for line in (src .. "\n"):gmatch("(.-)\n") do
				table.insert(lines, line)
			end
			for i = 1, #lines do
				if string.find(string.lower(lines[i]), pattern, 1, true) then
					local from = math.max(1, i - GREP_CONTEXT_LINES)
					local to = math.min(#lines, i + GREP_CONTEXT_LINES)
					local ctx = {}
					table.insert(ctx, rec.path .. ":" .. i)
					for n = from, to do
						local marker = (n == i) and "→ " or "  "
						local text = lines[n]
						if #text > 200 then text = text:sub(1, 200) .. "…" end
						table.insert(ctx, string.format("%s%d| %s", marker, n, text))
					end
					table.insert(blocks, table.concat(ctx, "\n"))
					total += 1
					if total >= limit then return blocks end
				end
			end
		end
	end
	return blocks
end

-- Detailed inspection of a single instance: readable properties, attributes,
-- and a child summary. Mirrors the official inspect_instance.
local INSPECT_PROP_NAMES = {
	"Name", "ClassName", "Parent", "Archivable",
	-- BasePart-ish
	"Anchored", "CanCollide", "Material", "Transparency", "Color", "BrickColor",
	"Size", "Position", "Orientation", "CFrame", "Shape",
	-- GUI-ish
	"Visible", "Enabled", "Text", "Active", "ZIndex", "BackgroundColor3",
	-- Misc commonly-useful
	"Value", "Disabled", "PrimaryPart",
}

local function inspectInstance(fullPath)
	local target = resolvePath(fullPath)
	if not target then
		return false, nil, "Instance '" .. tostring(fullPath) .. "' not found."
	end

	local props = {}
	for _, propName in ipairs(INSPECT_PROP_NAMES) do
		local ok, val = pcall(function() return target[propName] end)
		if ok and val ~= nil then
			-- Stringify datatypes the JSON encoder can't take directly.
			local t = typeof(val)
			if t == "Instance" then
				props[propName] = val:GetFullName()
			elseif t == "EnumItem" then
				props[propName] = tostring(val)
			elseif t == "Vector3" then
				props[propName] = { val.X, val.Y, val.Z }
			elseif t == "Color3" then
				props[propName] = {
					math.floor(val.R * 255 + 0.5),
					math.floor(val.G * 255 + 0.5),
					math.floor(val.B * 255 + 0.5),
				}
			elseif t == "string" or t == "number" or t == "boolean" then
				props[propName] = val
			else
				props[propName] = tostring(val)
			end
		end
	end

	-- Custom attributes.
	local attributes = {}
	local okAttr, attrMap = pcall(function() return target:GetAttributes() end)
	if okAttr and attrMap then
		for k, v in pairs(attrMap) do
			local t = typeof(v)
			attributes[k] = (t == "string" or t == "number" or t == "boolean") and v or tostring(v)
		end
	end

	-- Child summary (names + classes), bounded.
	local children = {}
	local childCount = 0
	for _, child in ipairs(target:GetChildren()) do
		childCount += 1
		if childCount <= 50 then
			table.insert(children, child.Name .. " [" .. child.ClassName .. "]")
		end
	end

	local descendantCount = 0
	pcall(function() descendantCount = #target:GetDescendants() end)

	local payload = HttpService:JSONEncode({
		path = target:GetFullName(),
		className = target.ClassName,
		properties = props,
		attributes = attributes,
		childCount = childCount,
		descendantCount = descendantCount,
		children = children,
	})
	return true, payload
end

-- ─── Split playtest controls (Phase 3): start / stop / console ─────────────────
-- Mirror the official start_stop_play + console_output. Unlike studio_run_playtest
-- (fixed ~6s blocking run), these let the AGENT control timing: start the run,
-- poll console_output while it runs, then stop — enabling an interactive debug
-- loop. They reuse the existing testErrors/testWarnings buffers, which the
-- LogService.MessageOut hook fills while isAutoTesting is true.

local function startPlaytestSession(sessionKey)
	if RunService:IsRunMode() or isAutoTesting then
		return false, "A playtest is already running. Stop it first."
	end
	currentPlaytestId += 1
	isAutoTesting = true
	testErrors = {}
	testWarnings = {}
	local ok = pcall(function() RunService:Run() end)
	if not ok then
		isAutoTesting = false
		return false, "Could not start playtest (RunService:Run failed)."
	end
	setStatus("Playtest running (agent-controlled)...", "waiting")
	return true, "Playtest started. Use console_output to read logs while it runs, then stop_playtest."
end

local function stopPlaytestSession()
	isAutoTesting = false
	currentPlaytestId += 1 -- invalidate any auto-test loop watching the old id
	pcall(function()
		if RunService:IsRunMode() then RunService:Stop() end
	end)
	setStatus("Playtest stopped.", "info")
	local errCount = #testErrors
	if errCount == 0 then
		return true, "Playtest stopped. No errors captured."
	end
	return true, "Playtest stopped. " .. errCount .. " error(s) captured — call console_output for details."
end

-- Return the captured console output so far (errors + warnings), newest-last.
local function consoleOutput()
	local lines = {}
	for _, e in ipairs(testErrors) do
		table.insert(lines, "[ERROR] " .. tostring(e.message))
	end
	for _, w in ipairs(testWarnings) do
		table.insert(lines, "[WARN] " .. tostring(w.message))
	end
	local state = (RunService:IsRunMode() or isAutoTesting) and "running" or "stopped"
	if #lines == 0 then
		return "Playtest " .. state .. ". No errors or warnings captured yet."
	end
	return "Playtest " .. state .. " — " .. #lines .. " line(s):\n" .. table.concat(lines, "\n")
end

-- Build a STRUCTURED JSON summary of captured errors/warnings so the agent's FIX
-- loop can target the right file+line directly (instead of re-parsing flat text).
-- Reuses parseErrorDetails for script/line/message extraction.
local function buildStructuredPlaytest(passed, state)
	local errors = {}
	for _, e in ipairs(testErrors) do
		local p = parseErrorDetails(e.message)
		table.insert(errors, {
			scriptName = p.scriptName,
			scriptPath = p.scriptPath,
			line = p.lineNumber,
			message = p.errorText,
			raw = p.rawMessage,
		})
	end
	local warnings = {}
	for _, w in ipairs(testWarnings) do
		table.insert(warnings, tostring(w.message))
	end
	return HttpService:JSONEncode({
		passed = passed,
		state = state,
		errorCount = #errors,
		warningCount = #warnings,
		errors = errors,
		warnings = warnings,
	})
end

-- multi_edit: apply an ordered list of resilient search/replace edits to a
-- script, creating it if it doesn't exist (mirrors official multi_edit). Reuses
-- the same applyResilientEdit + injectSingleScript paths as edit_script/create.
local function multiEditScript(sessionKey, scriptArgs)
	local pathStr = scriptArgs.path or scriptArgs.name or ""
	local edits = scriptArgs.edits
	if type(edits) ~= "table" or #edits == 0 then
		return false, "multi_edit requires a non-empty 'edits' array."
	end

	-- Locate the target script (by dotted path, then by leaf-name fallback).
	local target = resolvePath(pathStr)
	if not (target and target:IsA("LuaSourceContainer")) then
		local parts = string.split(pathStr, ".")
		local leaf = parts[#parts]
		local locations = {
			game:GetService("ServerScriptService"),
			game:GetService("ReplicatedStorage"),
			game:GetService("StarterGui"),
			game:GetService("Workspace"),
		}
		for _, loc in ipairs(locations) do
			local found = loc:FindFirstChild(leaf, true)
			if found and found:IsA("LuaSourceContainer") then
				target = found
				break
			end
		end
	end

	-- If the script doesn't exist, create it from the edits' replacement text
	-- (official multi_edit creates a new script when the path is missing).
	if not (target and target:IsA("LuaSourceContainer")) then
		local seed = {}
		for _, e in ipairs(edits) do
			if e.replace and e.replace ~= "" then table.insert(seed, e.replace) end
		end
		local parts = string.split(pathStr, ".")
		local newName = parts[#parts] or "NewScript"
		local parentPath = "ServerScriptService"
		if #parts > 1 then
			parentPath = table.concat(parts, ".", 1, #parts - 1)
		end
		local ok, msg, uFn = injectSingleScript({
			action = "create",
			parent = parentPath,
			name = newName,
			type = scriptArgs.type or "Script",
			code = table.concat(seed, "\n"),
		})
		if ok then
			return true, "Created " .. newName .. " (multi_edit on a new script)", uFn
		end
		return false, msg
	end

	-- Apply edits in order using the resilient matcher.
	local oldSource = normalizeSource(target.Source)
	local newSource = oldSource
	local successCount = 0
	local failed = {}
	for idx, edit in ipairs(edits) do
		local search = edit.search or ""
		local replace = edit.replace or ""
		if search == "" then
			-- Empty search = append (insert) the replacement at end of file.
			newSource = newSource .. "\n" .. replace
			successCount += 1
		else
			local result, matched = applyResilientEdit(newSource, search, replace)
			if matched then
				newSource = result
				successCount += 1
			else
				table.insert(failed, "#" .. idx)
			end
		end
	end

	if successCount > 0 then
		target.Source = newSource
		local uFn = function() target.Source = oldSource end
		local detail = successCount .. " edit(s)"
		if #failed > 0 then
			detail = detail .. ", " .. #failed .. " unmatched (" .. table.concat(failed, ", ") .. ")"
		end
		return true, "multi_edit applied to " .. target.Name .. " (" .. detail .. ")", uFn
	end
	return false, "multi_edit: no search blocks matched in " .. target.Name

end

-- search_game_tree: explore the instance hierarchy as a filtered flat list.
-- Supports rootPath (where to start), instanceType (ClassName/IsA filter),
-- keyword (name substring), and depth. Mirrors the official search_game_tree.
local function searchGameTree(args)
	local rootPath = args.path or args.rootPath
	local instanceType = args.instanceType or args.instance_type
	local keyword = args.keyword and string.lower(tostring(args.keyword)) or nil
	local depth = tonumber(args.depth) or 3
	if depth < 1 then depth = 1 end
	if depth > 10 then depth = 10 end

	-- Resolve the starting root(s).
	local roots = {}
	if rootPath and rootPath ~= "" then
		local r = resolvePath(rootPath)
		if not r then
			return false, "search_game_tree: root '" .. tostring(rootPath) .. "' not found."
		end
		table.insert(roots, { inst = r, path = rootPath })
	else
		for _, sName in ipairs(SCRIPT_SCAN_SERVICES) do
			local ok, svc = pcall(function() return game:GetService(sName) end)
			if ok and svc then table.insert(roots, { inst = svc, path = svc.Name }) end
		end
	end

	local MAX_RESULTS = 500
	local results = {}
	local function matches(inst)
		if instanceType and instanceType ~= "" then
			local okIsA = pcall(function() return inst:IsA(instanceType) end)
			if not (okIsA and inst:IsA(instanceType)) then return false end
		end
		if keyword and not string.find(string.lower(inst.Name), keyword, 1, true) then
			return false
		end
		return true
	end

	local function walk(inst, pathStr, curDepth)
		if curDepth > depth or #results >= MAX_RESULTS then return end
		for _, child in ipairs(inst:GetChildren()) do
			if #results >= MAX_RESULTS then return end
			local childPath = pathStr .. "." .. child.Name
			-- When NO filter is set, list everything (plain tree). With filters,
			-- only emit matching nodes but still recurse to find deeper matches.
			if (not instanceType and not keyword) or matches(child) then
				table.insert(results, childPath .. " [" .. child.ClassName .. "]")
			end
			walk(child, childPath, curDepth + 1)
		end
	end

	for _, root in ipairs(roots) do
		walk(root.inst, root.path, 1)
	end

	if #results == 0 then
		return true, "No instances matched the search_game_tree filters."
	end
	return true, table.concat(results, "\n")
end

local function executeMcpCommand(sessionKey, command)
	local tool = command.tool
	local args = command.args or {}

	if tool == "studio_get_tree" then
		return true, getProjectTree()

	elseif tool == "studio_read_script" then
		local ok, src = readScriptByPath(args.path or "")
		if ok then return true, src end
		return false, nil, "Script not found: " .. tostring(args.path)

	elseif tool == "studio_write_script" then
		local ok, msg = injectSingleScript({
			action = "create",
			parent = args.parent,
			name = args.name,
			type = args.type or "Script",
			code = args.code or "",
		})
		if ok then return true, "Wrote " .. tostring(args.name) end
		return false, nil, msg

	elseif tool == "studio_create_instance" then
		local ok, msg = injectSingleScript({
			action = "create_instance",
			parent = args.parent,
			className = args.className,
			instanceName = args.instanceName,
			properties = args.properties,
		})
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_set_properties" then
		local ok, msg = injectSingleScript({
			action = "set_properties",
			path = args.path,
			parent = args.parent,
			name = args.name,
			properties = args.properties,
		})
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_build_model" then
		local ok, msg = injectSingleScript({
			action = "build_model",
			name = args.name,
			parent = args.parent,
			parts = args.parts,
			weld = args.weld,
			primaryPart = args.primaryPart,
		})
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_inspect_build" then
		-- Return the geometry of an instance so the server can render an image
		-- of it (and so the model gets a spatial summary even without vision).
		local targetPath = args.path or "Workspace"
		local target = resolvePath(targetPath)
		if not target then
			return false, nil, "Inspect target '" .. tostring(targetPath) .. "' not found."
		end
		local geometry = collectGeometry(target)
		local summary = summarizeGeometry(geometry)
		local payload = HttpService:JSONEncode({
			path = targetPath,
			summary = summary,
			parts = geometry,
		})
		return true, payload

	elseif tool == "studio_delete" then
		local ok, msg = injectSingleScript({
			action = "delete",
			parent = args.parent,
			name = args.name,
		})
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_rename" then
		local ok, msg = injectSingleScript({
			action = "rename_instance",
			oldPath = args.oldPath,
			newName = args.newName,
		})
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_move" then
		local ok, msg = injectSingleScript({
			action = "move_instance",
			oldPath = args.oldPath,
			newParentPath = args.newParentPath,
		})
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_run_playtest" then
		-- Collect errors during a playtest and return them to the model.
		testErrors = {}
		runPlaytest(sessionKey)
		-- runPlaytest runs async (~6s). Wait for it to finish, then summarize.
		local waited = 0
		while isAutoTesting and waited < 12 do
			task.wait(0.5)
			waited += 0.5
		end
		-- Return STRUCTURED JSON so the agent's FIX loop gets script+line+message
		-- directly. (studio-bridge parses JSON, with a text fallback.)
		local passed = #testErrors == 0
		return true, buildStructuredPlaytest(passed, "stopped")

	elseif tool == "studio_script_search" then
		local results = scriptSearch(args.query, tonumber(args.limit) or 10)
		if #results == 0 then
			return true, "No scripts matched '" .. tostring(args.query) .. "'."
		end
		return true, table.concat(results, "\n")

	elseif tool == "studio_script_grep" then
		local matches = scriptGrep(args.pattern or args.query, tonumber(args.limit) or 50)
		if #matches == 0 then
			return true, "No matches for '" .. tostring(args.pattern or args.query) .. "'."
		end
		-- Blank line between match blocks (each block is path:line + context window).
		return true, #matches .. " match(es) (→ marks the hit line):\n\n" .. table.concat(matches, "\n\n")

	elseif tool == "studio_inspect_instance" then
		local ok, payload, err = inspectInstance(args.path or "")
		if ok then return true, payload end
		return false, nil, err

	elseif tool == "studio_search_game_tree" then
		local ok, payload = searchGameTree(args)
		if ok then return true, payload end
		return false, nil, payload

	elseif tool == "studio_multi_edit" then
		local ok, msg = multiEditScript(sessionKey, args)
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_start_playtest" then
		local ok, msg = startPlaytestSession(sessionKey)
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_stop_playtest" then
		local ok, msg = stopPlaytestSession()
		if ok then return true, msg end
		return false, nil, msg

	elseif tool == "studio_console_output" then
		local state = (RunService:IsRunMode() or isAutoTesting) and "running" or "stopped"
		return true, buildStructuredPlaytest(#testErrors == 0, state)

	elseif tool == "studio_execute_luau" then
		-- Disabled on the marketplace plugin (web/RemoteTransport) for safety &
		-- compliance. The local Runtime/CLI path uses Roblox's OFFICIAL Studio
		-- MCP, which provides execute_luau natively under Roblox's own safety
		-- model — so this branch should never be reached on the local path.
		return false, nil, "execute_luau is disabled on the Apple Juice plugin. Use the local Apple Juice Runtime (official Roblox Studio MCP) for arbitrary Luau execution."

	elseif tool == "studio_get_logs" then
		local logs = {}
		for _, e in ipairs(testErrors) do
			table.insert(logs, "[ERROR] " .. tostring(e.message))
		end
		for _, w in ipairs(testWarnings) do
			table.insert(logs, "[WARN] " .. tostring(w.message))
		end
		if #logs == 0 then
			return true, "No recent errors or warnings."
		end
		return true, table.concat(logs, "\n")
	end

	return false, nil, "Unknown tool: " .. tostring(tool)
end

local function reportMcpResult(sessionKey, requestId, ok, data, err)
	task.spawn(function()
		pcall(function()
			HttpService:PostAsync(
				MCP_RESULT_ENDPOINT,
				HttpService:JSONEncode({
					key = sessionKey,
					requestId = requestId,
					ok = ok,
					data = data,
					error = err,
				}),
				Enum.HttpContentType.ApplicationJson
			)
		end)
	end)
end

local function pollMcpCommand(sessionKey, waitMs)
	local url = MCP_NEXT_ENDPOINT .. "?key=" .. HttpService:UrlEncode(sessionKey)
	if waitMs and waitMs > 0 then
		url = url .. "&wait=" .. tostring(math.floor(waitMs))
	end
	local ok, response = pcall(function()
		return HttpService:RequestAsync({ Url = url, Method = "GET", Headers = { ["Accept"] = "application/json" } })
	end)
	if not ok or not response.Success then return nil end
	local decodeOk, data = pcall(function() return HttpService:JSONDecode(response.Body) end)
	if not decodeOk or not data.command then return nil end
	return data.command
end

-- Dedicated MCP long-poll loop. Runs in its OWN thread so a held request (up to
-- ~20s) never blocks the main poll loop's tree reporting / connection watchdog.
-- After executing a command it immediately re-polls (the official-plugin trick)
-- so a burst of agent tool calls lands back-to-back with no idle gap.
local MCP_LONGPOLL_MS = 20000
local mcpLoopStarted = false
local mcpBusy = false
local function mcpPollLoop(sessionKey)
	while running and not unloading do
		if mcpBusy then
			-- A command is executing (e.g. a 6s playtest); don't pull another.
			task.wait(0.1)
		else
			local mcpCmd = pollMcpCommand(sessionKey, MCP_LONGPOLL_MS)
			if mcpCmd then
				mcpBusy = true
				task.spawn(function()
					local ranOk, rok, rdata, rerr = pcall(executeMcpCommand, sessionKey, mcpCmd)
					if ranOk then
						reportMcpResult(sessionKey, mcpCmd.requestId, rok, rdata, rerr)
					else
						reportMcpResult(sessionKey, mcpCmd.requestId, false, nil, tostring(rok))
					end
					mcpBusy = false
				end)
				-- Immediately loop to re-poll; the busy guard above paces us.
			else
				-- Held request returned empty (no work within the hold window).
				-- Loop straight back into another held request; tiny yield keeps
				-- the scheduler happy without adding perceptible latency.
				task.wait(0.05)
			end
		end
	end
	mcpLoopStarted = false
end

-- ─── Polling ──────────────────────────────────────────────────────────────────

local function requestPoll(sessionKey)
	local url = POLL_ENDPOINT .. "?key=" .. HttpService:UrlEncode(sessionKey)
	local ok, response = pcall(function()
		return HttpService:RequestAsync({ Url = url, Method = "GET", Headers = { ["Accept"] = "application/json" } })
	end)

	if not ok then return false, nil, "Cannot reach dashboard." end
	if not response.Success then return false, nil, "HTTP " .. tostring(response.StatusCode) end

	local decodeOk, data = pcall(function() return HttpService:JSONDecode(response.Body) end)
	if not decodeOk then return false, nil, "Invalid JSON response." end
	return true, data, nil
end



local function pollLoop(sessionKey)
	currentSessionKey = sessionKey
	local hasError = false
	local pollTicks = 0
	-- Resilience: a single failed poll (transient network blip, a momentary
	-- 502 from the host, one slow request) used to disconnect immediately.
	-- Tolerate a few consecutive failures before actually giving up.
	local consecutiveFailures = 0
	local MAX_CONSECUTIVE_FAILURES = 5
	local consecutiveUnpaired = 0
	local MAX_CONSECUTIVE_UNPAIRED = 3

	while running and not unloading do
		pollTicks += 1
		-- Report tree on every poll if it changed. Force a report every 60 polls (~30s) to prevent cache expiry.
		reportTree(sessionKey, pollTicks % 60 == 1)

		-- MCP bridge: a dedicated long-poll loop (started once) pulls and executes
		-- interactive tool commands in its own thread, so a held request or a
		-- long-running command (e.g. a 6s playtest) never blocks this main poll
		-- loop's tree reporting or the connection watchdog.
		if not mcpLoopStarted then
			mcpLoopStarted = true
			task.spawn(function() mcpPollLoop(sessionKey) end)
		end

		local ok, data, err = requestPoll(sessionKey)

		if not ok then
			-- Transient failure: warn but keep trying. Only disconnect after
			-- several failures in a row (sustained outage / real problem).
			consecutiveFailures += 1
			if consecutiveFailures >= MAX_CONSECUTIVE_FAILURES then
				setStatus(err or "Poll failed.", "error")
				hasError = true
				running = false
				break
			else
				setStatus("Reconnecting... (" .. consecutiveFailures .. ")", "warning")
				-- Back off a little before the next attempt.
				local waited = 0
				while running and not unloading and waited < 1 do
					task.wait(0.2)
					waited += 0.2
				end
				-- Skip the rest of this iteration and retry.
				continue
			end
		end

		-- Successful request — reset the failure counter.
		consecutiveFailures = 0

		if data.paired ~= true then
			-- The dashboard heartbeat may briefly lapse (tab backgrounded,
			-- network hiccup). Tolerate a few before disconnecting.
			consecutiveUnpaired += 1
			if consecutiveUnpaired >= MAX_CONSECUTIVE_UNPAIRED then
				setStatus(data.error or "Session expired.", "error")
				hasError = true
				running = false
				isConnected = false
				connectButton.Text = "Connect"
				connectButton.BackgroundColor3 = buttonBaseColor
				break
			else
				setStatus("Waiting for dashboard...", "warning")
				local waited = 0
				while running and not unloading and waited < 1 do
					task.wait(0.2)
					waited += 0.2
				end
				continue
			end
		end

		-- Paired successfully — reset the unpaired counter.
		consecutiveUnpaired = 0

		if not isConnected then
			isConnected = true
			setStatus("Connected — waiting for code...", "success")
		end

		-- Honor the server's plan-aware poll cadence (clamped to a safe range).
		if type(data.pollInterval) == "number" then
			local pi = data.pollInterval
			if pi < MIN_POLL_INTERVAL then pi = MIN_POLL_INTERVAL end
			if pi > MAX_POLL_INTERVAL then pi = MAX_POLL_INTERVAL end
			currentPollInterval = pi
		end

		-- Stage 2: app requests a full project snapshot (tree + sources) so the
		-- agentic CLI can work against real files.
		if data.requestSnapshot then
			if sessionKey then
				reportLog(sessionKey, "📸 [Roblox Studio] Sending project snapshot...")
			end
			reportSnapshot(sessionKey)
		end

		if data.requestedFile then
			local fileName = data.requestedFile
			if sessionKey then
				reportLog(sessionKey, "📖 [Roblox Studio] Reading file " .. fileName)
			end
			-- Resolve the target script. The dashboard sends a full dotted path
			-- (e.g. "ServerScriptService.Folder.MyScript" or "game.Workspace.X"),
			-- while the agent may send a bare name. Handle both:
			--   1. If it's a dotted path, walk it from game (skipping a leading
			--      "game" segment) to land on the exact instance.
			--   2. Otherwise (or if the walk fails), recursively search common
			--      service roots for a script with that (leaf) name.
			local target = nil

			local function resolveDottedPath(path)
				local segments = string.split(path, ".")
				-- Drop a leading "game" segment if present.
				if segments[1] == "game" then
					table.remove(segments, 1)
				end
				if #segments == 0 then return nil end
				-- First segment is a service.
				local ok, current = pcall(function()
					return game:GetService(segments[1])
				end)
				if not ok or not current then
					current = game:FindFirstChild(segments[1])
				end
				if not current then return nil end
				for i = 2, #segments do
					current = current:FindFirstChild(segments[i])
					if not current then return nil end
				end
				return current
			end

			if string.find(fileName, "%.") then
				local resolved = resolveDottedPath(fileName)
				if resolved and resolved:IsA("LuaSourceContainer") then
					target = resolved
				end
			end

			-- Fallback: recursive search by leaf name across common locations.
			if not target then
				local leaf = fileName
				if string.find(leaf, "%.") then
					local parts = string.split(leaf, ".")
					leaf = parts[#parts]
				end
				local locations = {
					game:GetService("ServerScriptService"),
					game:GetService("ReplicatedStorage"),
					game:GetService("Workspace"),
					game:GetService("StarterGui"),
					game:GetService("ServerStorage"),
				}
				local starterPlayer = game:GetService("StarterPlayer")
				if starterPlayer:FindFirstChild("StarterPlayerScripts") then
					table.insert(locations, starterPlayer.StarterPlayerScripts)
				end
				if starterPlayer:FindFirstChild("StarterCharacterScripts") then
					table.insert(locations, starterPlayer.StarterCharacterScripts)
				end

				for _, loc in ipairs(locations) do
					local found = loc:FindFirstChild(leaf, true)
					if found and found:IsA("LuaSourceContainer") then
						target = found
						break
					end
				end
			end

			if target then
				task.spawn(function()
					pcall(function()
						HttpService:PostAsync(REPORT_FILE_ENDPOINT, HttpService:JSONEncode({
							key = sessionKey,
							fileName = fileName,
							content = target.Source
						}))
					end)
				end)
			else
				task.spawn(function()
					pcall(function()
						HttpService:PostAsync(REPORT_FILE_ENDPOINT, HttpService:JSONEncode({
							key = sessionKey,
							fileName = fileName,
							content = "[APPLE_JUICE_ERROR_FILE_NOT_FOUND]"
						}))
					end)
				end)
			end
		end

		if data.hasNewCode == true and type(data.code) == "string" and data.code ~= "" then
			local messageId = data.messageId and tostring(data.messageId) or nil
			if messageId ~= lastMessageId then
				lastMessageId = messageId

				-- Extract script metadata BEFORE injection for test reporting
				local extractOk, parsedPayload = pcall(function() return HttpService:JSONDecode(data.code) end)
				if extractOk and parsedPayload and type(parsedPayload) == "table" then
					lastInjectedScripts = {}
					if parsedPayload.scripts and type(parsedPayload.scripts) == "table" then
						for _, s in ipairs(parsedPayload.scripts) do
							table.insert(lastInjectedScripts, {
								name = s.name or "Unknown",
								parent = s.parent or "ServerScriptService",
								type = s.type or "Script",
								code = s.code or "",
							})
						end
					elseif parsedPayload.code then
						table.insert(lastInjectedScripts, {
							name = parsedPayload.name or "AIScript",
							parent = parsedPayload.parent or "ServerScriptService",
							type = parsedPayload.type or "Script",
							code = parsedPayload.code or "",
						})
					end
				end

				local injected, msg, scriptCount, isManual = injectCode(data.code)
				setStatus(msg, injected and "success" or "error")
				
				-- Trigger immediate tree update after any injection
				if injected then
					task.spawn(function() reportTree(sessionKey, true) end)
				end

				-- Auto-test: only for AI-generated code, not manual actions
				if injected and not isManual and not isAutoTesting then
					task.wait(0.5)
					runPlaytest(sessionKey)
				end
			end
		end

		local elapsed = 0
		while running and not unloading and elapsed < currentPollInterval do
			task.wait(0.1)
			elapsed += 0.1
		end
	end

	if not unloading then
		connectButton.Text = "Connect"
		connectButton.BackgroundColor3 = buttonBaseColor
		isConnected = false
		currentSessionKey = nil
		if not hasError then setStatus("Disconnected", "info") end
	end
end

-- ─── UI Events ────────────────────────────────────────────────────────────────

toolbarButton.Click:Connect(function() widget.Enabled = not widget.Enabled end)

local httpEnabled = false
pcall(function() httpEnabled = HttpService.HttpEnabled end)
if not httpEnabled then
	setStatus("Enable HTTP Requests in Game Settings → Security.", "error")
else
	setStatus("Ready. Click Connect to pair.", "info")
end

local function tweenButtonColor(c)
	pcall(function()
		TweenService:Create(connectButton, TweenInfo.new(0.25), { BackgroundColor3 = c }):Play()
	end)
end

connectButton.MouseButton1Click:Connect(function()
	if not httpEnabled then return end

	if running then
		-- Disconnect
		running = false
		setStatus("Disconnecting…", "info")
		pcall(function()
			if currentSessionKey then
				HttpService:RequestAsync({
					Url = POLL_ENDPOINT .. "?key=" .. HttpService:UrlEncode(currentSessionKey) .. "&disconnect=true",
					Method = "GET",
					Headers = { ["Accept"] = "application/json" }
				})
			end
		end)
		return
	end

	task.spawn(function()
		setConnecting(true)
		connectButton.Text = "Connecting…"
		setStatus("Pairing with your dashboard…", "waiting")

		local manualKey = getManualCode()
		local sessionKey, err

		if #manualKey >= 4 then
			sessionKey, err = autoConnect(manualKey)
		elseif AJ_CONFIG.requireManualCode then
			setConnecting(false)
			connectButton.Text = "Connect"
			setStatus("Enter the pairing code, then click Connect.", "waiting")
			return
		else
			sessionKey, err = autoConnect()
		end

		setConnecting(false)

		if not sessionKey then
			connectButton.Text = "Connect"
			setStatus(err or "Could not pair. Is the dashboard open?", "error")
			return
		end

		setStatus("Paired! Starting sync…", "success")
		running = true
		connectButton.Text = "Disconnect"
		btnGrad.Enabled = false
		tweenButtonColor(buttonConnectedColor)

		-- Start the polling loop directly in this thread. It returns when the
		-- session ends, so restore the idle button look afterwards.
		pollLoop(sessionKey)

		btnGrad.Enabled = true
		tweenButtonColor(buttonBaseColor)
		connectButton.Text = "Connect"
	end)
end)

plugin.Unloading:Connect(function()
    unloading = true
    running = false
    isConnected = false
    connectButton.Text = "Connect"
    connectButton.BackgroundColor3 = buttonBaseColor
    pcall(function()
        if currentSessionKey then
            HttpService:RequestAsync({
                Url = POLL_ENDPOINT .. "?key=" .. HttpService:UrlEncode(currentSessionKey) .. "&disconnect=true",
                Method = "GET",
                Headers = { ["Accept"] = "application/json" }
            })
        end
    end)
end)
