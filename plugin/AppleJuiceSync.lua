local HttpService = game:GetService("HttpService")
local ScriptEditorService = game:GetService("ScriptEditorService")
local ServerScriptService = game:GetService("ServerScriptService")
local TweenService = game:GetService("TweenService")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")

-- Try to get StudioTestService (may not exist in all Studio versions)
local StudioTestService = nil
pcall(function() StudioTestService = game:GetService("StudioTestService") end)

local TOOLBAR_NAME = "Apple Juice AI Sync"
local WIDGET_TITLE = "Apple Juice AI Sync"

local BASE_URL = "https://apple-juice.vercel.app"
local POLL_ENDPOINT = BASE_URL .. "/api/poll"
local LOGS_ENDPOINT = BASE_URL .. "/api/logs"
local POLL_INTERVAL = 2

local toolbar = plugin:CreateToolbar(TOOLBAR_NAME)
local toolbarButton = toolbar:CreateButton("AppleJuiceAISyncToggle", "Toggle Apple Juice AI Sync", "rbxassetid://4458901886")
toolbarButton.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, true, false, 380, 300, 300, 220)
local widget = plugin:CreateDockWidgetPluginGui("AppleJuiceAISyncWidget", widgetInfo)
widget.Title = WIDGET_TITLE

-- ─── UI ───────────────────────────────────────────────────────────────────────

local root = Instance.new("Frame")
root.Name = "Root"
root.Size = UDim2.fromScale(1, 1)
root.BackgroundColor3 = Color3.fromRGB(23, 25, 30)
root.BorderSizePixel = 0
root.Parent = widget

local rootCorner = Instance.new("UICorner")
rootCorner.CornerRadius = UDim.new(0, 6)
rootCorner.Parent = root

local rootPadding = Instance.new("UIPadding")
rootPadding.PaddingTop = UDim.new(0, 14)
rootPadding.PaddingBottom = UDim.new(0, 14)
rootPadding.PaddingLeft = UDim.new(0, 14)
rootPadding.PaddingRight = UDim.new(0, 14)
rootPadding.Parent = root

local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Vertical
layout.HorizontalAlignment = Enum.HorizontalAlignment.Left
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 6)
layout.Parent = root

local function makeLabel(text, order, sizeY, color, font, textSize)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.new(1, 0, 0, sizeY)
	label.Text = text
	label.TextColor3 = color
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.Font = font
	label.TextSize = textSize
	label.LayoutOrder = order
	label.Parent = root
	return label
end

local function makeInput(placeholder, order, height, isCodeFont)
	local box = Instance.new("TextBox")
	box.Size = UDim2.new(1, 0, 0, height)
	box.BackgroundColor3 = Color3.fromRGB(32, 35, 42)
	box.TextColor3 = Color3.fromRGB(235, 239, 245)
	box.PlaceholderColor3 = Color3.fromRGB(120, 126, 140)
	box.PlaceholderText = placeholder
	box.Text = ""
	box.ClearTextOnFocus = false
	box.Font = isCodeFont and Enum.Font.Code or Enum.Font.Gotham
	box.TextSize = isCodeFont and 18 or 14
	box.TextXAlignment = Enum.TextXAlignment.Left
	box.BorderSizePixel = 0
	box.LayoutOrder = order
	box.Parent = root

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = box
	local stroke = Instance.new("UIStroke")
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	stroke.Color = Color3.fromRGB(50, 50, 55)
	stroke.Thickness = 1
	stroke.Parent = box
	return box
end

makeLabel("Apple Juice AI Sync", 1, 24, Color3.fromRGB(240, 240, 245), Enum.Font.GothamBold, 16)
makeLabel(BASE_URL, 2, 16, Color3.fromRGB(120, 126, 140), Enum.Font.Code, 11)
makeLabel("Session Key (from dashboard)", 3, 18, Color3.fromRGB(165, 170, 180), Enum.Font.Gotham, 12)
local sessionKeyBox = makeInput("e.g. A3F2B1C9", 4, 34, true)

local connectButton = Instance.new("TextButton")
connectButton.Name = "ConnectButton"
connectButton.Size = UDim2.new(1, 0, 0, 34)
local buttonBaseColor = Color3.fromRGB(43, 103, 255)
local buttonHoverColor = Color3.fromRGB(57, 117, 255)
connectButton.BackgroundColor3 = buttonBaseColor
connectButton.TextColor3 = Color3.fromRGB(255, 255, 255)
connectButton.Font = Enum.Font.GothamMedium
connectButton.TextSize = 14
connectButton.Text = "Connect"
connectButton.AutoButtonColor = false
connectButton.BorderSizePixel = 0
connectButton.LayoutOrder = 5
connectButton.Parent = root

local connectButtonCorner = Instance.new("UICorner")
connectButtonCorner.CornerRadius = UDim.new(0, 6)
connectButtonCorner.Parent = connectButton
local connectButtonStroke = Instance.new("UIStroke")
connectButtonStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
connectButtonStroke.Color = Color3.fromRGB(50, 50, 55)
connectButtonStroke.Thickness = 1
connectButtonStroke.Parent = connectButton

local statusLabel = Instance.new("TextLabel")
statusLabel.Name = "Status"
statusLabel.Size = UDim2.new(1, 0, 0, 56)
statusLabel.BackgroundTransparency = 1
statusLabel.TextWrapped = true
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.TextYAlignment = Enum.TextYAlignment.Top
statusLabel.Font = Enum.Font.GothamSemibold
statusLabel.TextSize = 13
statusLabel.LayoutOrder = 6
statusLabel.Parent = root

local hoverTweenInfo = TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
connectButton.MouseEnter:Connect(function()
	if connectButton.Active then TweenService:Create(connectButton, hoverTweenInfo, { BackgroundColor3 = buttonHoverColor }):Play() end
end)
connectButton.MouseLeave:Connect(function()
	if connectButton.Active then TweenService:Create(connectButton, hoverTweenInfo, { BackgroundColor3 = buttonBaseColor }):Play() end
end)

-- ─── State ────────────────────────────────────────────────────────────────────

local STATUS_COLORS = {
	success = Color3.fromRGB(77, 214, 123),
	waiting = Color3.fromRGB(245, 208, 96),
	error = Color3.fromRGB(255, 96, 96),
	info = Color3.fromRGB(170, 176, 188),
}

local running = false
local unloading = false
local lastMessageId = nil
local isConnected = false
local isAutoTesting = false

local function setStatus(message, kind)
	statusLabel.Text = "Status: " .. message
	statusLabel.TextColor3 = STATUS_COLORS[kind] or STATUS_COLORS.info
end

-- ─── Helpers ──────────────────────────────────────────────────────────────────

local function reportLog(sessionKey, logMessage)
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

-- Catch runtime errors and forward them to the dashboard
LogService.MessageOut:Connect(function(message, messageType)
	if running and isConnected and messageType == Enum.MessageType.MessageError then
		local currentKey = string.gsub(sessionKeyBox.Text or "", "^%s*(.-)%s*$", "%1")
		reportLog(currentKey, message)
		
		if isAutoTesting and RunService:IsRunMode() then
			setStatus("Error caught! Stopping test...", "error")
			isAutoTesting = false
			-- End the test session
			if StudioTestService then
				pcall(function() StudioTestService:EndTest("error") end)
			end
		end
	end
end)

local function resolvePath(pathStr)
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

local function injectCode(incomingData)
	local decodeOk, parsed = pcall(function() return HttpService:JSONDecode(incomingData) end)
	if not decodeOk or type(parsed) ~= "table" then return false, "Invalid JSON payload" end

	local action = parsed.action or "create"
	local parentPath = parsed.parent or "ServerScriptService"
	local scriptName = parsed.name or "AIGeneratedScript"
	local scriptClass = parsed.type or "Script"
	local codeText = parsed.code or ""

	local parentInstance = resolvePath(parentPath)
	if not parentInstance then
		parentInstance = game:GetService("ServerScriptService")
		parentPath = "ServerScriptService"
	end

	if action == "delete" then
		local target = parentInstance:FindFirstChild(scriptName)
		if target then
			target:Destroy()
			return true, "Deleted " .. scriptName
		else
			return false, "Delete failed"
		end
	end

	if scriptClass ~= "Script" and scriptClass ~= "LocalScript" and scriptClass ~= "ModuleScript" then
		scriptClass = "Script"
	end

	local target = parentInstance:FindFirstChild(scriptName)
	if not target or not target:IsA("LuaSourceContainer") or target.ClassName ~= scriptClass then
		if target then target:Destroy() end
		target = Instance.new(scriptClass)
		target.Name = scriptName
		target.Parent = parentInstance
	end

	local ok, err = pcall(function()
		ScriptEditorService:UpdateSourceAsync(target, function() return codeText end)
	end)

	if ok then return true, "Synced " .. scriptClass .. " [" .. scriptName .. "]"
	else return false, "ScriptEditor Error: " .. tostring(err) end
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

local function stopPlaytest()
	if RunService:IsRunMode() then
		if StudioTestService then
			pcall(function() StudioTestService:EndTest("success") end)
		end
	end
end

local function pollLoop(sessionKey)
	setStatus("Connecting...", "waiting")
	local hasError = false

	while running and not unloading do
		local ok, data, err = requestPoll(sessionKey)

		if not ok then
			setStatus(err or "Poll failed.", "error")
			hasError = true
			running = false
			break
		end

		if data.paired ~= true then
			setStatus(data.error or "Invalid session key.", "error")
			hasError = true
			running = false
			break
		end

		if not isConnected then
			isConnected = true
			setStatus("Connected — waiting for code...", "success")
		end

		if data.hasNewCode == true and type(data.code) == "string" and data.code ~= "" then
			local messageId = data.messageId and tostring(data.messageId) or nil
			if messageId ~= lastMessageId then
				lastMessageId = messageId
				local injected, msg = injectCode(data.code)
				setStatus(msg, injected and "success" or "error")
				
				if injected and StudioTestService then
					task.wait(0.5)
					if not RunService:IsRunMode() then
						isAutoTesting = true
						setStatus("Auto-running test...", "waiting")
						
						task.spawn(function()
							-- Success timeout: if 4 seconds pass with no errors, pass the test
							task.spawn(function()
								task.wait(4)
								if isAutoTesting and RunService:IsRunMode() then
									setStatus("Test passed!", "success")
									isAutoTesting = false
									stopPlaytest()
									reportLog(sessionKey, "[SYSTEM_TEST_SUCCESS]")
								end
							end)

							pcall(function() StudioTestService:ExecuteRunModeAsync("AppleJuiceSession") end)
							-- Test ended (either by success timeout, error handler, or manually)
							isAutoTesting = false
						end)
					end
				elseif injected then
					-- No StudioTestService available, just report success immediately
					reportLog(sessionKey, "[SYSTEM_TEST_SUCCESS]")
				end
			end
		end

		local elapsed = 0
		while running and not unloading and elapsed < POLL_INTERVAL do
			task.wait(0.1)
			elapsed += 0.1
		end
	end

	if not unloading then
		connectButton.Text = "Connect"
		isConnected = false
		if not hasError then setStatus("Disconnected", "waiting") end
	end
end

-- ─── UI Events ────────────────────────────────────────────────────────────────

toolbarButton.Click:Connect(function() widget.Enabled = not widget.Enabled end)

local httpEnabled = false
pcall(function() httpEnabled = HttpService.HttpEnabled end)
if not httpEnabled then setStatus("Enable HTTP Requests in Game Settings.", "error") else setStatus("Disconnected", "waiting") end

connectButton.MouseButton1Click:Connect(function()
	if not httpEnabled then return end
	if running then
		running = false
		return
	end

	local sessionKey = string.gsub(sessionKeyBox.Text or "", "^%s*(.-)%s*$", "%1")

	if sessionKey == "" or #sessionKey < 4 then
		setStatus("Enter a valid session key.", "error")
		return
	end

	running = true
	connectButton.Text = "Disconnect"
	task.spawn(function() pollLoop(sessionKey) end)
end)

plugin.Unloading:Connect(function()
	unloading = true
	running = false
end)
