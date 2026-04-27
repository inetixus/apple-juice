local HttpService = game:GetService("HttpService")
local ScriptEditorService = game:GetService("ScriptEditorService")
local ServerScriptService = game:GetService("ServerScriptService")
local TweenService = game:GetService("TweenService")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")

local TOOLBAR_NAME = "Apple Juice AI Sync"
local WIDGET_TITLE = "Apple Juice AI Sync"

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
local currentSessionKey = nil
local isAutoTesting = false
local testErrors = {}
local testWarnings = {}
local lastInjectedScripts = {}

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

-- Forward error logs to the dashboard (non-test errors)
LogService.MessageOut:Connect(function(message, messageType)
	if running and isConnected and currentSessionKey then
		if messageType == Enum.MessageType.MessageError then
			-- During auto-testing, collect into the test buffer (don't forward yet)
			if isAutoTesting then
				table.insert(testErrors, {
					message = message,
					timestamp = os.clock(),
				})
			else
				reportLog(currentSessionKey, message)
			end
		elseif messageType == Enum.MessageType.MessageWarning then
			if isAutoTesting then
				table.insert(testWarnings, {
					message = message,
					timestamp = os.clock(),
				})
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
	-- Only run if not already in run mode
	if RunService:IsRunMode() then
		reportLog(sessionKey, "[APPLE_JUICE_TEST_SKIP]")
		return
	end

	isAutoTesting = true
	testErrors = {}
	testWarnings = {}
	setStatus("Running playtest (…" .. TEST_DURATION .. "s)...", "waiting")

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
		while elapsed < TEST_DURATION and isAutoTesting do
			task.wait(0.5)
			elapsed = os.clock() - startTime

			-- If we got 3+ errors quickly, stop early (likely a crash loop)
			if #testErrors >= 3 and elapsed < 2 then
				setStatus("Multiple errors detected, stopping early...", "error")
				break
			end
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
		return false, "Parent path '" .. tostring(parentPath) .. "' not found. Make sure you create the parent first.", nil
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
		return true, "Stop playtest action received.", nil
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
		if ok then return true, "Synced " .. scriptClass .. " [" .. scriptName .. "] → " .. parentPath, undoFn
		else return false, "ScriptEditor Error: " .. tostring(err), nil end
	else
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
