local HttpService = game:GetService("HttpService")
local ScriptEditorService = game:GetService("ScriptEditorService")
local ServerScriptService = game:GetService("ServerScriptService")
local TweenService = game:GetService("TweenService")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")

local TOOLBAR_NAME = "Apple Juice AI Sync (CLI)"
local WIDGET_TITLE = "Apple Juice AI Sync (CLI)"
local VERSION = "v1.1.0-cli"

-- The CLI runs the Apple Juice app locally and prints a pairing code in your
-- terminal. Point at localhost and pair using that code (manual key flow) —
-- IP auto-pairing does not apply to CLI sessions.
local defaultServerUrl = "http://localhost:3000"
local BASE_URL = defaultServerUrl
local CONNECT_ENDPOINT = BASE_URL .. "/api/connect"
local POLL_ENDPOINT = BASE_URL .. "/api/poll"
local LOGS_ENDPOINT = BASE_URL .. "/api/logs"
local TREE_ENDPOINT = BASE_URL .. "/api/tree"
local REPORT_FILE_ENDPOINT = BASE_URL .. "/api/report-file"
local SNAPSHOT_ENDPOINT = BASE_URL .. "/api/snapshot"
local MCP_NEXT_ENDPOINT = BASE_URL .. "/api/mcp/next"
local MCP_RESULT_ENDPOINT = BASE_URL .. "/api/mcp/result"

local function updateEndpoints(newUrl)
	newUrl = newUrl:gsub("%s+", "")
	if newUrl == "" then
		newUrl = defaultServerUrl
	end
	-- Strip trailing slash if present
	if newUrl:sub(-1) == "/" then
		newUrl = newUrl:sub(1, -2)
	end
	BASE_URL = newUrl
	CONNECT_ENDPOINT = BASE_URL .. "/api/connect"
	POLL_ENDPOINT = BASE_URL .. "/api/poll"
	LOGS_ENDPOINT = BASE_URL .. "/api/logs"
	TREE_ENDPOINT = BASE_URL .. "/api/tree"
	REPORT_FILE_ENDPOINT = BASE_URL .. "/api/report-file"
	SNAPSHOT_ENDPOINT = BASE_URL .. "/api/snapshot"
	MCP_NEXT_ENDPOINT = BASE_URL .. "/api/mcp/next"
	MCP_RESULT_ENDPOINT = BASE_URL .. "/api/mcp/result"
end

pcall(function()
	local savedUrl = plugin:GetSetting("ServerUrlCLI")
	if savedUrl and savedUrl ~= "" then
		updateEndpoints(savedUrl)
	end
end)
local POLL_INTERVAL = 0.2
-- Server-driven, plan-aware poll cadence. The /api/poll response may return a
-- recommended `pollInterval` (higher subscription tiers poll faster so code +
-- MCP commands land in Studio sooner). We clamp it to a safe range so a bad
-- value can never hammer the server or stall the loop.
local MIN_POLL_INTERVAL = 0.1
local MAX_POLL_INTERVAL = 1.0
local currentPollInterval = POLL_INTERVAL

local toolbar = plugin:CreateToolbar(TOOLBAR_NAME)
local toolbarButton = toolbar:CreateButton("AppleJuiceAISyncCLIToggle", "Toggle Apple Juice AI Sync (CLI)", "rbxassetid://4458901886")
toolbarButton.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, true, false, 380, 260, 300, 180)
local widget = plugin:CreateDockWidgetPluginGui("AppleJuiceAISyncCLIWidget", widgetInfo)
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

makeLabel("Apple Juice AI Sync " .. VERSION, 1, 24, Color3.fromRGB(240, 240, 245), Enum.Font.GothamBold, 17)
makeLabel("Enter the pairing code from your terminal, then Connect.", 2, 16, Color3.fromRGB(120, 126, 140), Enum.Font.Gotham, 11)

local spacer = Instance.new("Frame")
spacer.Size = UDim2.new(1, 0, 0, 4)
spacer.BackgroundTransparency = 1
spacer.LayoutOrder = 3
spacer.Parent = root

local serverUrlInput = Instance.new("TextBox")
serverUrlInput.Name = "ServerUrlInput"
serverUrlInput.Size = UDim2.new(1, 0, 0, 32)
serverUrlInput.BackgroundColor3 = Color3.fromRGB(35, 38, 45)
serverUrlInput.TextColor3 = Color3.fromRGB(240, 240, 245)
serverUrlInput.Font = Enum.Font.GothamMedium
serverUrlInput.TextSize = 13
serverUrlInput.PlaceholderText = "CLI server URL (e.g. http://localhost:3000)"
serverUrlInput.Text = BASE_URL
serverUrlInput.ClearTextOnFocus = false
serverUrlInput.BorderSizePixel = 0
serverUrlInput.LayoutOrder = 3.2
serverUrlInput.Parent = root

local serverUrlCorner = Instance.new("UICorner")
serverUrlCorner.CornerRadius = UDim.new(0, 6)
serverUrlCorner.Parent = serverUrlInput

local serverUrlPadding = Instance.new("UIPadding")
serverUrlPadding.PaddingLeft = UDim.new(0, 8)
serverUrlPadding.PaddingRight = UDim.new(0, 8)
serverUrlPadding.Parent = serverUrlInput

local manualInput = Instance.new("TextBox")
manualInput.Name = "ManualInput"
manualInput.Size = UDim2.new(1, 0, 0, 32)
manualInput.BackgroundColor3 = Color3.fromRGB(35, 38, 45)
manualInput.TextColor3 = Color3.fromRGB(240, 240, 245)
manualInput.Font = Enum.Font.GothamMedium
manualInput.TextSize = 13
manualInput.PlaceholderText = "Terminal Pairing Code (e.g. TI9YIA)"
manualInput.Text = ""
manualInput.ClearTextOnFocus = false
manualInput.BorderSizePixel = 0
manualInput.LayoutOrder = 3.5
manualInput.Parent = root

local manualCorner = Instance.new("UICorner")
manualCorner.CornerRadius = UDim.new(0, 6)
manualCorner.Parent = manualInput

local manualPadding = Instance.new("UIPadding")
manualPadding.PaddingLeft = UDim.new(0, 8)
manualPadding.PaddingRight = UDim.new(0, 8)
manualPadding.Parent = manualInput

serverUrlInput.FocusLost:Connect(function(enterPressed)
	local url = serverUrlInput.Text:gsub("%s+", "")
	updateEndpoints(url)
	serverUrlInput.Text = BASE_URL
	pcall(function()
		plugin:SetSetting("ServerUrlCLI", BASE_URL)
	end)
end)

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

local running = false
local unloading = false
local lastMessageId = nil
local isConnected = false
local currentSessionKey = nil
local isAutoTesting = false
local currentPlaytestId = 0
local testErrors = {}
local testWarnings = {}
local mcpBusy = false
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
			newInst.Parent = parentInstance
			
			undoFn = function()
				if newInst and newInst.Parent then newInst:Destroy() end
			end
			
			if currentSessionKey then
				reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully created " .. className .. " [" .. instanceName .. "]")
			end
			return true, "Created " .. className .. " [" .. instanceName .. "] in " .. parentPath, undoFn
		else
			if currentSessionKey then
				reportLog(currentSessionKey, "✖ [Roblox Studio] Failed to create instance " .. className .. ": " .. tostring(newInst))
			end
			return false, "Failed to create " .. className .. ": " .. tostring(newInst), nil
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
			local oldSource = target.Source
			local newSource = oldSource
			local successCount = 0
			
			if scriptData.edits and type(scriptData.edits) == "table" then
				for _, edit in ipairs(scriptData.edits) do
					local search = edit.search or ""
					local replace = edit.replace or ""
					if search ~= "" then
						local escapedSearch = search:gsub("[%^%$%(%)%%%.%[%]%*%+%-%?]", "%%%1")
						local replaced, count = newSource:gsub(escapedSearch, replace:gsub("%%", "%%%%"))
						if count > 0 then
							newSource = replaced
							successCount += 1
						end
					end
				end
			end

			if successCount > 0 then
				target.Source = newSource
				undoFn = function() target.Source = oldSource end
				if currentSessionKey then
					reportLog(currentSessionKey, "✓ [Roblox Studio] Successfully modified " .. scriptName .. " (" .. successCount .. " replacements)")
				end
				return true, "Edited " .. scriptName .. " (" .. successCount .. " replacements)", undoFn
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
		})
		if ok then return true, msg end
		return false, nil, msg

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
		local errs = {}
		for _, e in ipairs(testErrors) do
			table.insert(errs, e.message)
		end
		if #errs == 0 then
			return true, "Playtest passed with no errors."
		end
		return true, "Playtest found " .. #errs .. " error(s):\n" .. table.concat(errs, "\n")

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

local function pollMcpCommand(sessionKey)
	local url = MCP_NEXT_ENDPOINT .. "?key=" .. HttpService:UrlEncode(sessionKey)
	local ok, response = pcall(function()
		return HttpService:RequestAsync({ Url = url, Method = "GET", Headers = { ["Accept"] = "application/json" } })
	end)
	if not ok or not response.Success then return nil end
	local decodeOk, data = pcall(function() return HttpService:JSONDecode(response.Body) end)
	if not decodeOk or not data.command then return nil end
	return data.command
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

		-- MCP bridge: pull and execute any pending interactive tool command.
		-- Run it in a separate thread so a long-running command (e.g. a 6s
		-- playtest) doesn't block the main poll loop and trip the connection
		-- watchdog. Only one MCP command in flight at a time.
		if not mcpBusy then
			local mcpCmd = pollMcpCommand(sessionKey)
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
			end
		end

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
			isConnected = false
			connectButton.Text = "Connect"
			connectButton.BackgroundColor3 = buttonBaseColor
			break
		end

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
	setStatus("Enable HTTP Requests in Game Settings.", "error")
else
	setStatus("Ready. Enter your terminal's pairing code, then Connect.", "info")
end

connectButton.MouseButton1Click:Connect(function()
	if not httpEnabled then return end
	
	if running then
		running = false
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
		local url = serverUrlInput.Text:gsub("%s+", "")
		updateEndpoints(url)
		serverUrlInput.Text = BASE_URL
		pcall(function()
			plugin:SetSetting("ServerUrlCLI", BASE_URL)
		end)

		local manualKey = manualInput.Text:gsub("%s+", ""):upper()
		local sessionKey, err

		if #manualKey >= 4 then
			setStatus("Connecting via code [" .. manualKey .. "]...", "waiting")
			sessionKey = manualKey
			-- Verify the pairing code is registered by the CLI session.
			local ok, data, pollErr = requestPoll(sessionKey)
			if not ok or data.paired ~= true then
				setStatus(pollErr or (data and data.error) or "Invalid pairing code. Check your terminal.", "error")
				return
			end
		else
			-- CLI sessions are keyed by the terminal pairing code (clientIp = "cli"),
			-- so IP auto-pairing can't find them. Try it as a courtesy, but guide
			-- the user to enter the code if nothing is found.
			sessionKey, err = autoConnect()
			if not sessionKey then
				setStatus("Enter the pairing code shown in your terminal, then click Connect.", "waiting")
				return
			end
		end

		if not sessionKey then
			setStatus(err or "Could not connect. Enter the terminal pairing code.", "error")
			return
		end

		setStatus("Paired! Starting sync...", "success")
		running = true
		connectButton.Text = "Disconnect"
		connectButton.BackgroundColor3 = buttonConnectedColor
		
		-- Start the polling loop directly in this thread
		pollLoop(sessionKey)
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
