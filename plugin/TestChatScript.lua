local HttpService = game:GetService("HttpService")

-- Configuration ------------------------------------------------------------
local CHAT_ENDPOINT = "http://127.0.0.1:3000/api/chat" -- local dev chat endpoint
local CONNECT_ENDPOINT = "http://127.0.0.1:3000/api/connect" -- endpoint to obtain sessionKey
local TIMEOUT_SECONDS = 30

-- Helper to fetch a session key from the connect endpoint ------------------
local function fetchSessionKey()
    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = CONNECT_ENDPOINT,
            Method = "GET",
            Timeout = TIMEOUT_SECONDS,
        })
    end)
    if not success then
        warn("Failed to request session key: " .. tostring(response))
        return nil
    end
    if not response.Success then
        warn("Connect endpoint error " .. response.StatusCode .. ": " .. response.StatusMessage)
        return nil
    end
    local data = nil
    pcall(function() data = HttpService:JSONDecode(response.Body) end)
    if data and data.sessionKey then
        return data.sessionKey
    else
        warn("Connect response missing sessionKey: " .. tostring(response.Body))
        return nil
    end
end

-- Helper to send a chat prompt --------------------------------------------
local function sendChatPrompt(sessionKey, prompt)
    local requestBody = {
        prompt = prompt,
        autoSync = true,
        sessionKey = sessionKey,
    }
    local requestJson = HttpService:JSONEncode(requestBody)
    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = CHAT_ENDPOINT,
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = requestJson,
            Timeout = TIMEOUT_SECONDS,
        })
    end)
    if not success then
        warn("HTTP request failed: " .. tostring(response))
        return nil
    end
    if not response.Success then
        warn("HTTP error " .. response.StatusCode .. ": " .. response.StatusMessage)
        return nil
    end
    return response.Body
end

-- Main execution -----------------------------------------------------------
local sessionKey = fetchSessionKey()
if not sessionKey then
    warn("Unable to obtain session key; aborting.")
    return
end

local prompt = "Hello AI, give me a short friendly greeting."
local body = sendChatPrompt(sessionKey, prompt)
if not body then
    warn("No response from AI")
    return
end

local parsed = nil
pcall(function() parsed = HttpService:JSONDecode(body) end)
if not parsed or not parsed.message then
    warn("Unexpected response format: " .. tostring(body))
    return
end

-- Create a visible part showing the AI's reply
local part = Instance.new("Part")
part.Size = Vector3.new(8, 2, 0.2)
part.Position = Vector3.new(0, 5, 0)
part.Anchored = true
part.Name = "AIResponsePart"
part.Parent = workspace

local billboard = Instance.new("BillboardGui")
billboard.Size = UDim2.new(0, 400, 0, 200)
billboard.Adornee = part
billboard.AlwaysOnTop = true
billboard.Parent = part

local label = Instance.new("TextLabel")
label.Size = UDim2.new(1, 0, 1, 0)
label.BackgroundTransparency = 1
label.TextColor3 = Color3.fromRGB(255, 255, 255)
label.TextScaled = true
label.TextWrapped = true
label.Font = Enum.Font.SourceSansBold
label.Text = parsed.message
label.Parent = billboard

print("[AppleJuice] AI response displayed in workspace.")

-- Configuration ------------------------------------------------------------
local API_ENDPOINT = "http://127.0.0.1:3000/api/chat" -- local dev endpoint
local SESSION_KEY = "demo-session-1234"
local TIMEOUT_SECONDS = 30

-- Helper to send a chat prompt --------------------------------------------
local function sendChatPrompt(prompt)
    local requestBody = {
        prompt = prompt,
        autoSync = true,
        sessionKey = SESSION_KEY,
    }
    local requestJson = HttpService:JSONEncode(requestBody)
    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = API_ENDPOINT,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
            },
            Body = requestJson,
            Timeout = TIMEOUT_SECONDS,
        })
    end)
    if not success then
        warn("HTTP request failed: " .. tostring(response))
        return nil
    end
    if not response.Success then
        warn("HTTP error " .. response.StatusCode .. ": " .. response.StatusMessage)
        return nil
    end
    return response.Body
end

-- Main execution ----------------------------------------------------------
local prompt = "Hello AI, give me a short friendly greeting."
local body = sendChatPrompt(prompt)
if not body then
    warn("No response from AI")
    return
end

local parsed = nil
pcall(function() parsed = HttpService:JSONDecode(body) end)
if not parsed or not parsed.message then
    warn("Unexpected response format: " .. tostring(body))
    return
end

-- Create a visible part showing the AI's reply
local part = Instance.new("Part")
part.Size = Vector3.new(8, 2, 0.2)
part.Position = Vector3.new(0, 5, 0)
part.Anchored = true
part.Name = "AIResponsePart"
part.Parent = workspace

local billboard = Instance.new("BillboardGui")
billboard.Size = UDim2.new(0, 400, 0, 200)
billboard.Adornee = part
billboard.AlwaysOnTop = true
billboard.Parent = part

local label = Instance.new("TextLabel")
label.Size = UDim2.new(1, 0, 1, 0)
label.BackgroundTransparency = 1
label.TextColor3 = Color3.fromRGB(255, 255, 255)
label.TextScaled = true
label.TextWrapped = true
label.Font = Enum.Font.SourceSansBold
label.Text = parsed.message
label.Parent = billboard

print("[AppleJuice] AI response displayed in workspace.")
