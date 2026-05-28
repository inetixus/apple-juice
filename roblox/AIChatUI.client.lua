--[[
	AIChatUI.client.lua - LocalScript
	
	Example custom AI Chat UI for Apple Juice.
	Place this LocalScript inside StarterPlayerScripts or StarterGui.
	
	Assumes:
	  • AIClient module is in ReplicatedStorage.Modules.AIClient
	  • A ScreenGui called "AIChatGui" with the following hierarchy
	    exists inside StarterGui (build this in Studio):

	  AIChatGui (ScreenGui)
	  └── ChatFrame (Frame)           -- the main panel
	      ├── MessageList (ScrollingFrame)
	      │   └── UIListLayout        -- autolayout for messages
	      ├── InputRow (Frame)
	      │   ├── TextBox (TextBox)   -- where the user types
	      │   └── SendButton (TextButton)
	      └── StatusLabel (TextLabel) -- "Thinking…" / error text
	
	Feel free to replace the GUI hierarchy with your own – just update
	the variable bindings at the top of this script.
--]]

-- ─── Services ─────────────────────────────────────────────────────────────────

local Players         = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- ─── References ───────────────────────────────────────────────────────────────

local LocalPlayer = Players.LocalPlayer
local PlayerGui   = LocalPlayer:WaitForChild("PlayerGui")

-- GUI elements — adjust paths to match your ScreenGui layout
local ChatGui     = PlayerGui:WaitForChild("AIChatGui")
local ChatFrame   = ChatGui:WaitForChild("ChatFrame")
local MessageList = ChatFrame:WaitForChild("MessageList")
local InputRow    = ChatFrame:WaitForChild("InputRow")
local TextBox     = InputRow:WaitForChild("TextBox")
local SendButton  = InputRow:WaitForChild("SendButton")
local StatusLabel = ChatFrame:WaitForChild("StatusLabel")

-- ─── AI Client Setup ──────────────────────────────────────────────────────────

-- IMPORTANT: Replace with your actual Open WebUI API key.
-- Store this in a secure RemoteFunction / server config in production,
-- not hardcoded — this is a client-side example only.
local BEARER_TOKEN = "your-openwebui-api-key-here"

local AIClientModule = require(ReplicatedStorage.Modules.AIClient)
local AI = AIClientModule.new(BEARER_TOKEN, {
	-- Optional: override defaults per-session
	model      = "qwen2.5-coder:1.5b",
	timeout    = 30,
	maxRetries = 2,
})

-- System context that shapes all AI responses for the project
local SYSTEM_PROMPT = [[
You are the Apple Juice AI, an expert Roblox game developer and Luau programmer.
Your job is to help the development team build, debug, and improve their Roblox project.
Be concise, technical, and always write production-ready Luau code when asked.
Format code blocks using triple backticks with 'lua' as the language tag.
]]

-- ─── Conversation History ─────────────────────────────────────────────────────

-- Maintains context across multiple turns (rolling window)
local MAX_HISTORY = 20  -- Keep last 20 messages to avoid token limits
local conversationHistory = {}

-- ─── UI Helpers ───────────────────────────────────────────────────────────────

local function setStatus(text: string, color: Color3?)
	StatusLabel.Text      = text
	StatusLabel.TextColor3 = color or Color3.fromHex("#888888")
	StatusLabel.Visible   = text ~= ""
end

local function createMessageBubble(role: string, text: string): Frame
	local isUser = role == "user"

	-- Outer row (used for alignment)
	local row = Instance.new("Frame")
	row.Size            = UDim2.new(1, 0, 0, 0)
	row.AutomaticSize   = Enum.AutomaticSize.Y
	row.BackgroundTransparency = 1
	row.Name            = role .. "_msg_" .. os.clock()

	-- Bubble
	local bubble = Instance.new("Frame")
	bubble.Size          = UDim2.new(0.75, 0, 0, 0)
	bubble.AutomaticSize = Enum.AutomaticSize.Y
	bubble.AnchorPoint   = isUser and Vector2.new(1, 0) or Vector2.new(0, 0)
	bubble.Position      = isUser and UDim2.new(1, -6, 0, 4) or UDim2.new(0, 6, 0, 4)
	bubble.BackgroundColor3 = isUser
		and Color3.fromHex("#CCFF00")   -- Lime for user
		or  Color3.fromHex("#1E2028")   -- Dark for AI
	bubble.BorderSizePixel = 0
	bubble.Parent = row

	-- Rounded corners
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = bubble

	-- Padding
	local padding = Instance.new("UIPadding")
	padding.PaddingTop    = UDim.new(0, 10)
	padding.PaddingBottom = UDim.new(0, 10)
	padding.PaddingLeft   = UDim.new(0, 12)
	padding.PaddingRight  = UDim.new(0, 12)
	padding.Parent = bubble

	-- Text
	local label = Instance.new("TextLabel")
	label.Size             = UDim2.new(1, 0, 0, 0)
	label.AutomaticSize    = Enum.AutomaticSize.Y
	label.BackgroundTransparency = 1
	label.Text             = text
	label.TextWrapped      = true
	label.RichText         = false   -- Disable for raw code safety; enable for styling
	label.TextXAlignment   = Enum.TextXAlignment.Left
	label.TextColor3       = isUser
		and Color3.fromHex("#111111")
		or  Color3.fromHex("#E8E8E8")
	label.FontFace         = Font.fromEnum(Enum.Font.Gotham)
	label.TextSize         = 13
	label.Parent = bubble

	return row
end

local function appendMessage(role: string, text: string)
	local bubble = createMessageBubble(role, text)
	bubble.Parent = MessageList

	-- Scroll to bottom after a frame so AutomaticSize has settled
	task.wait()
	MessageList.CanvasPosition = Vector2.new(0, MessageList.AbsoluteCanvasSize.Y)
end

-- ─── Core: Send Message ───────────────────────────────────────────────────────

local isSending = false   -- Prevent double-submits

local function sendMessage()
	if isSending then return end

	local userText = TextBox.Text:match("^%s*(.-)%s*$")  -- Trim whitespace
	if userText == "" then return end

	isSending        = true
	TextBox.Text     = ""
	TextBox.PlaceholderText = "Waiting for response…"
	SendButton.Active = false

	-- Show in UI immediately
	appendMessage("user", userText)
	setStatus("🤔 Thinking…", Color3.fromHex("#CCFF00"))

	-- Add to history
	table.insert(conversationHistory, { role = "user", content = userText })

	-- Trim history to rolling window
	while #conversationHistory > MAX_HISTORY do
		table.remove(conversationHistory, 1)
	end

	-- Run request in a new task so the UI thread stays responsive
	task.spawn(function()
		local reply, err = AI:Chat(conversationHistory, {
			systemPrompt = SYSTEM_PROMPT,
			temperature  = 0.7,
			max_tokens   = 1024,
		})

		if err then
			setStatus(err, Color3.fromHex("#FF6B6B"))
			appendMessage("assistant", "⚠ " .. err)
		else
			-- Add assistant reply to history for follow-up context
			table.insert(conversationHistory, { role = "assistant", content = reply })

			appendMessage("assistant", reply)
			setStatus("", nil)
		end

		isSending               = false
		SendButton.Active        = true
		TextBox.PlaceholderText = "Ask Apple Juice AI anything…"
		TextBox:CaptureFocus()
	end)
end

-- ─── Input Bindings ───────────────────────────────────────────────────────────

SendButton.MouseButton1Click:Connect(sendMessage)

TextBox.FocusLost:Connect(function(enterPressed)
	if enterPressed then
		sendMessage()
	end
end)

-- ─── Startup ──────────────────────────────────────────────────────────────────

TextBox.PlaceholderText = "Ask Apple Juice AI anything…"
setStatus("", nil)

-- Optional: greet the user with a welcome message
appendMessage("assistant",
	"👋 Hey! I'm the Apple Juice AI — powered by Qwen 2.5 Coder (1.5B).\n" ..
	"Ask me anything about your Roblox project and I'll help you build it."
)
