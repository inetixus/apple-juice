local HttpService = game:GetService("HttpService")
local ScriptEditorService = game:GetService("ScriptEditorService")
local ServerScriptService = game:GetService("ServerScriptService")
local TweenService = game:GetService("TweenService")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")

local StudioTestService = nil
pcall(function() StudioTestService = game:GetService("StudioTestService") end)

local TOOLBAR_NAME = "Apple Juice AI Sync"
local WIDGET_TITLE = "Apple Juice AI Sync"

if RunService:IsRunMode() and StudioTestService then
	pcall(function()
		if StudioTestService:GetTestArgs() == "AppleJuiceSession" then
			task.spawn(function()
				task.wait(4)
				StudioTestService:EndTest("success")
			end)
		end
	end)
end

local BASE_URL = "https://apple-juice.online"
local CONNECT_ENDPOINT = BASE_URL .. "/api/connect"
local POLL_ENDPOINT = BASE_URL .. "/api/poll"
local LOGS_ENDPOINT = BASE_URL .. "/api/logs"
local TREE_ENDPOINT = BASE_URL .. "/api/tree"
local REPORT_FILE_ENDPOINT = BASE_URL .. "/api/report-file"
local POLL_INTERVAL = 0.5

local toolbar = plugin:CreateToolbar(TOOLBAR_NAME)
local toolbarButton = toolbar:CreateButton("AppleJuiceAISyncToggle", "Toggle Apple Juice AI Sync", "rbxassetid://4458901886")
toolbarButton.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, true, false, 380, 260, 300, 180)
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
rootPadding.PaddingTop = UDim.new(0, 18)
rootPadding.PaddingBottom = UDim.new(0, 18)
rootPadding.PaddingLeft = UDim.new(0, 18)
rootPadding.PaddingRight = UDim.new(0, 18)
rootPadding.Parent = root

local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Vertical
layout.HorizontalAlignment = Enum.HorizontalAlignment.Left
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 8)
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

makeLabel("Apple Juice AI Sync", 1, 24, Color3.fromRGB(240, 240, 245), Enum.Font.GothamBold, 17)
makeLabel("Auto-pairs via IP — just click Connect.", 2, 16, Color3.fromRGB(120, 126, 140), Enum.Font.Gotham, 11)

local spacer = Instance.new("Frame")
spacer.Size = UDim2.new(1, 0, 0, 4)
spacer.BackgroundTransparency = 1
spacer.LayoutOrder = 3
spacer.Parent = root

local connectButton = Instance.new("TextButton")
connectButton.Name = "ConnectButton"
connectButton.Size = UDim2.new(1, 0, 0, 40)
local buttonBaseColor = Color3.fromRGB(43, 103, 255)
local buttonHoverColor = Color3.fromRGB(57, 117, 255)
local buttonConnectedColor = Color3.fromRGB(220, 38, 38)
connectButton.BackgroundColor3 = buttonBaseColor
connectButton.TextColor3 = Color3.fromRGB(255, 255, 255)
connectButton.Font = Enum.Font.GothamBold
connectButton.TextSize = 15
connectButton.Text = "Connect"
connectButton.AutoButtonColor = false
connectButton.BorderSizePixel = 0
connectButton.LayoutOrder = 4
connectButton.Parent = root

local connectButtonCorner = Instance.new("UICorner")
connectButtonCorner.CornerRadius = UDim.new(0, 8)
connectButtonCorner.Parent = connectButton

local statusLabel = Instance.new("TextLabel")
statusLabel.Name = "Status"
statusLabel.Size = UDim2.new(1, 0, 0, 56)
statusLabel.BackgroundTransparency = 1
statusLabel.TextWrapped = true
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.TextYAlignment = Enum.TextYAlignment.Top
statusLabel.Font = Enum.Font.GothamSemibold
statusLabel.TextSize = 12
statusLabel.LayoutOrder = 5
statusLabel.Parent = root

local hoverTweenInfo = TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
connectButton.MouseEnter:Connect(function()
	if not running then
		TweenService:Create(connectButton, hoverTweenInfo, { BackgroundColor3 = buttonHoverColor }):Play()
	end
end)
connectButton.MouseLeave:Connect(function()
	if not running then
		TweenService:Create(connectButton, hoverTweenInfo, { BackgroundColor3 = buttonBaseColor }):Play()
	end
end)

local undoButton = Instance.new("TextButton")
undoButton.Name = "UndoButton"
undoButton.Size = UDim2.new(1, 0, 0, 28)
undoButton.BackgroundColor3 = Color3.fromRGB(50, 52, 60)
undoButton.TextColor3 = Color3.fromRGB(200, 200, 200)
undoButton.Font = Enum.Font.GothamSemibold
undoButton.TextSize = 12
undoButton.Text = "Undo Last Sync"
undoButton.AutoButtonColor = true
undoButton.BorderSizePixel = 0
undoButton.LayoutOrder = 6
undoButton.Visible = false
undoButton.Parent = root

local undoButtonCorner = Instance.new("UICorner")
undoButtonCorner.CornerRadius = UDim.new(0, 6)
undoButtonCorner.Parent = undoButton

-- ─── State ────────────────────────────────────────────────────────────────────

local STATUS_COLORS = {
	success = Color3.fromRGB(77, 214, 123),
	waiting = Color3.fromRGB(245, 208, 96),
	error = Color3.fromRGB(255, 96, 96),
	info = Color3.fromRGB(170, 176, 188),
}

running = false
local unloading = false
local lastMessageId = nil
local isConnected = false
local isAutoTesting = false
local currentSessionKey = nil

local undoStack = {}

local function updateUndoButton()
	if #undoStack > 0 then
		undoButton.Visible = true
		undoButton.Text = "Undo Last Sync (" .. #undoStack .. ")"
	else
		undoButton.Visible = false
	end
end

undoButton.MouseButton1Click:Connect(function()
	if #undoStack == 0 then return end
	local batch = table.remove(undoStack, #undoStack)
	for _, fn in ipairs(batch) do
		pcall(fn)
	end
	updateUndoButton()
	statusLabel.Text = "Undid last generation successfully."
	statusLabel.TextColor3 = Color3.fromRGB(77, 214, 123)
end)

local function setStatus(message, kind)
	statusLabel.Text = message
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

LogService.MessageOut:Connect(function(message, messageType)
	if running and isConnected and currentSessionKey and messageType == Enum.MessageType.MessageError then
		reportLog(currentSessionKey, message)
		
		if isAutoTesting and RunService:IsRunMode() then
			setStatus("Error caught! Stopping test...", "error")
			isAutoTesting = false
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

local function injectSingleScript(scriptData)
	local action = scriptData.action or "create"
	local parentPath = scriptData.parent or "ServerScriptService"
	local scriptName = scriptData.name or "AIGeneratedScript"
	local scriptClass = scriptData.type or "Script"
	local codeText = scriptData.code or ""

	local parentInstance = resolvePath(parentPath)
	if not parentInstance then
		parentInstance = game:GetService("ServerScriptService")
	end

	local undoFn = nil

	if action == "delete" then
		local target = parentInstance:FindFirstChild(scriptName)
		if target then
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
			return true, "Deleted " .. scriptName, undoFn
		else
			return false, "Delete failed: " .. scriptName, nil
		end
	end

	if action == "insert_asset" then
		local assetId = scriptData.assetId
		if not assetId then return false, "No assetId provided", nil end
		local ok, objects = pcall(function()
			return game:GetObjects("rbxassetid://" .. tostring(assetId))
		end)
		if ok and objects and #objects > 0 then
			local actualParent = resolvePath(parentPath) or workspace
			local inserted = {}
			for _, child in ipairs(objects) do
				child.Parent = actualParent
				table.insert(inserted, child)
			end
			
			undoFn = function()
				for _, inst in ipairs(inserted) do
					if inst and inst.Parent then inst:Destroy() end
				end
			end
			
			return true, "Inserted Asset " .. tostring(assetId) .. " into " .. parentPath, undoFn
		else
			return false, "Failed to load asset " .. tostring(assetId), nil
		end
	end

	if action == "create_instance" then
		local className = scriptData.className or "Part"
		local instanceName = scriptData.instanceName or className
		local ok, newInst = pcall(function()
			return Instance.new(className)
		end)
		if ok and newInst then
			newInst.Name = instanceName
			newInst.Parent = parentInstance
			
			undoFn = function()
				if newInst and newInst.Parent then newInst:Destroy() end
			end
			
			return true, "Created " .. className .. " [" .. instanceName .. "] in " .. parentPath, undoFn
		else
			return false, "Failed to create " .. className .. ": " .. tostring(newInst), nil
		end
	end

	if action == "stop_playtest" then
		if RunService:IsRunMode() and StudioTestService then
			pcall(function() StudioTestService:EndTest("success") end)
			return true, "Playtest stopped.", nil
		else
			return false, "No playtest is currently running in this context.", nil
		end
	end

	if action == "rename_instance" then
		local oldPath = scriptData.oldPath
		local newName = scriptData.newName
		print("[AppleJuice] Renaming " .. tostring(oldPath) .. " to " .. tostring(newName))
		local target = resolvePath(oldPath)
		if target then
			local oldName = target.Name
			undoFn = function() if target and target.Parent then target.Name = oldName end end
			target.Name = newName
			print("[AppleJuice] Successfully renamed to " .. newName)
			return true, "Renamed " .. oldName .. " to " .. newName, undoFn
		else
			warn("[AppleJuice] Rename failed: Could not find target at " .. tostring(oldPath))
			return false, "Rename failed: Could not find " .. tostring(oldPath), nil
		end
	end

	if action == "move_instance" then
		local oldPath = scriptData.oldPath
		local newParentPath = scriptData.newParentPath
		local target = resolvePath(oldPath)
		local newParent = resolvePath(newParentPath)
		if target and newParent then
			local oldParent = target.Parent
			undoFn = function() if target and target.Parent then target.Parent = oldParent end end
			target.Parent = newParent
			return true, "Moved " .. target.Name .. " to " .. newParentPath, undoFn
		else
			return false, "Move failed: Could not find target or new parent", nil
		end
	end

	if scriptClass ~= "Script" and scriptClass ~= "LocalScript" and scriptClass ~= "ModuleScript" then
		scriptClass = "Script"
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

	if not target then
		target = Instance.new(scriptClass)
		target.Name = scriptName
		target.Parent = parentInstance
	end

	undoFn = function()
		if didExist then
			if target and target.ClassName == oldClass then
				ScriptEditorService:UpdateSourceAsync(target, function() return oldSource end)
			else
				if target then target:Destroy() end
				local rest = Instance.new(oldClass)
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

	local ok, err = pcall(function()
		ScriptEditorService:UpdateSourceAsync(target, function() return codeText end)
	end)

	if ok then return true, "Synced " .. scriptClass .. " [" .. scriptName .. "] → " .. parentPath, undoFn
	else return false, "ScriptEditor Error: " .. tostring(err), nil end
end

local function injectCode(incomingData)
	local decodeOk, parsed = pcall(function() return HttpService:JSONDecode(incomingData) end)
	if not decodeOk or type(parsed) ~= "table" then return false, "Invalid JSON payload", 0, false end

	local currentBatch = {}
	local isManual = parsed.isManual == true

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
		return successCount > 0, summary, #parsed.scripts, isManual
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
	local roots = { 
		game:GetService("Workspace"), 
		game:GetService("Players"),
		game:GetService("Lighting"),
		game:GetService("MaterialService"),
		game:GetService("ReplicatedFirst"),
		game:GetService("ReplicatedStorage"), 
		game:GetService("ServerScriptService"), 
		game:GetService("ServerStorage"), 
		game:GetService("StarterGui"),
		game:GetService("StarterPack"),
		game:GetService("StarterPlayer"),
		game:GetService("Teams"),
		game:GetService("SoundService"),
		game:GetService("TextChatService")
	}
	
	for _, root in ipairs(roots) do
		-- Add the root service itself
		table.insert(results, root.Name .. " [" .. root.ClassName .. "]")
		buildTreePaths(root, root.Name, 4, 1, results)
	end
	return table.concat(results, "\n")
end

local lastTreeHash = ""
local function reportTree(sessionKey, force)
	local tree = getProjectTree()
	if not force and tree == lastTreeHash then return end
	lastTreeHash = tree
	task.spawn(function()
		pcall(function()
			HttpService:PostAsync(
				TREE_ENDPOINT,
				HttpService:JSONEncode({ key = sessionKey, tree = tree }),
				Enum.HttpContentType.ApplicationJson
			)
		end)
	end)
end

local function autoConnect()
	setStatus("Connecting via IP...", "waiting")
	
	local ok, response = pcall(function()
		return HttpService:RequestAsync({
			Url = CONNECT_ENDPOINT,
			Method = "GET",
			Headers = { ["Accept"] = "application/json" },
		})
	end)

	if not ok then
		return nil, "Cannot reach dashboard."
	end

	if not response.Success then
		local errMsg = "Connection failed (HTTP " .. tostring(response.StatusCode) .. ")"
		pcall(function()
			local data = HttpService:JSONDecode(response.Body)
			if data.error then errMsg = data.error end
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
	if RunService:IsRunMode() and StudioTestService then
		pcall(function() StudioTestService:EndTest("success") end)
	end
end

local function pollLoop(sessionKey)
	currentSessionKey = sessionKey
	local hasError = false
	local pollTicks = 0

	while running and not unloading do
		pollTicks += 1
		-- Report tree on every poll if it changed. Force a report every 60 polls (~30s) to prevent cache expiry.
		reportTree(sessionKey, pollTicks % 60 == 1)

		local ok, data, err = requestPoll(sessionKey)

		if not ok then
			setStatus(err or "Poll failed.", "error")
			hasError = true
			running = false
			break
		end

		if data.paired ~= true then
			setStatus(data.error or "Session expired.", "error")
			hasError = true
			running = false
			break
		end

		if not isConnected then
			isConnected = true
			setStatus("Connected — waiting for code...", "success")
		end

		if data.requestedFile then
			local fileName = data.requestedFile
			-- Try to find the script in common locations
			local target = nil
			local locations = { 
				game:GetService("ServerScriptService"), 
				game:GetService("ReplicatedStorage"), 
				game:GetService("Workspace") 
			}
			
			local starterPlayer = game:GetService("StarterPlayer")
			if starterPlayer:FindFirstChild("StarterPlayerScripts") then
				table.insert(locations, starterPlayer.StarterPlayerScripts)
			end
			if starterPlayer:FindFirstChild("StarterCharacterScripts") then
				table.insert(locations, starterPlayer.StarterCharacterScripts)
			end

			for _, loc in ipairs(locations) do
				local found = loc:FindFirstChild(fileName, true)
				if found and found:IsA("LuaSourceContainer") then
					target = found
					break
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
			end
		end

		if data.hasNewCode == true and type(data.code) == "string" and data.code ~= "" then
			local messageId = data.messageId and tostring(data.messageId) or nil
			if messageId ~= lastMessageId then
				lastMessageId = messageId

				local injected, msg, scriptCount, isManual = injectCode(data.code)
				
				-- STRICT playtest suppression: If it's a manual action, DO NOT stop or start tests.
				if injected and not isManual then
					if RunService:IsRunMode() then
						setStatus("Stopping playtest for sync...", "waiting")
						stopPlaytest()
						task.wait(1.0)
					end
				end

				setStatus(msg, injected and "success" or "error")
				
				-- Trigger immediate tree update after any injection
				if injected then
					task.spawn(function() reportTree(sessionKey, true) end)
				end

				if injected and not isManual and StudioTestService then
					task.wait(0.3)
					if not RunService:IsRunMode() then
						isAutoTesting = true
						setStatus("Running playtest...", "waiting")
						
						task.spawn(function()
							local ok, err = pcall(function() StudioTestService:ExecuteRunModeAsync("AppleJuiceSession") end)
							isAutoTesting = false
							
							if ok then
								setStatus("Test passed!", "success")
								reportLog(sessionKey, "[SYSTEM_TEST_SUCCESS]")
							else
								setStatus("Test ended.", "info")
							end
						end)
					end
				elseif injected then
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
	setStatus("Enable HTTP Requests in Game Settings.", "error")
else
	setStatus("Ready. Click Connect to pair.", "info")
end

connectButton.MouseButton1Click:Connect(function()
	if not httpEnabled then return end
	
	if running then
		running = false
		return
	end

	local sessionKey, err = autoConnect()
	if not sessionKey then
		setStatus(err or "Could not auto-connect.", "error")
		return
	end

	setStatus("Paired! Starting sync...", "success")
	running = true
	connectButton.Text = "Disconnect"
	connectButton.BackgroundColor3 = buttonConnectedColor
	task.spawn(function() pollLoop(sessionKey) end)
end)

plugin.Unloading:Connect(function()
	unloading = true
	running = false
end)
