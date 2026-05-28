--[[
	AIClient.lua - ModuleScript
	
	Production-ready AI client for Apple Juice (Roblox)
	Connects to a self-hosted Open WebUI / Ollama server.
	
	Endpoint : http://130.110.14.224:3000/api/chat/completions
	Model    : qwen2.5-coder:1.5b
	Auth     : Bearer token via Authorization header
--]]

local HttpService = game:GetService("HttpService")

-- ─── Constants ────────────────────────────────────────────────────────────────

local BASE_URL    = "http://130.110.14.224:3000/api/chat/completions"
local MODEL       = "qwen2.5-coder:1.5b"
local TIMEOUT_SEC = 30   -- Seconds before a request is considered timed out
local MAX_RETRIES = 2    -- Number of automatic retries on transient failures

-- ─── AIClient Class ───────────────────────────────────────────────────────────

local AIClient = {}
AIClient.__index = AIClient

--- Creates a new AIClient instance.
-- @param bearerToken string  Your Open WebUI API key / bearer token.
-- @param options table|nil  Optional config overrides: { model, timeout, maxRetries }
function AIClient.new(bearerToken: string, options: table?)
	assert(type(bearerToken) == "string" and #bearerToken > 0,
		"[AIClient] bearerToken must be a non-empty string.")

	local opts = options or {}

	local self = setmetatable({}, AIClient)

	-- Configuration
	self._token      = bearerToken
	self._model      = opts.model      or MODEL
	self._timeout    = opts.timeout    or TIMEOUT_SEC
	self._maxRetries = opts.maxRetries or MAX_RETRIES

	-- Concurrency queue
	-- A BindableEvent acts as a semaphore signal between coroutines.
	self._queue       = {}        -- Array of pending { resolve, reject, payload } entries
	self._busy        = false     -- Whether a request is currently in-flight
	self._queueSignal = Instance.new("BindableEvent")

	-- Start the queue consumer
	task.spawn(function()
		self:_processQueue()
	end)

	return self
end

-- ─── Private: HTTP Layer ──────────────────────────────────────────────────────

--- Builds the request headers table.
function AIClient:_buildHeaders(): table
	return {
		["Content-Type"]  = "application/json",
		["Authorization"] = "Bearer " .. self._token,
	}
end

--- Executes a single HTTP POST with retry logic.
-- Returns (responseTable, nil) on success or (nil, errorMessage) on failure.
function AIClient:_doRequest(payload: table): (table?, string?)
	local body = HttpService:JSONEncode(payload)
	local headers = self:_buildHeaders()

	for attempt = 1, self._maxRetries + 1 do
		local success, result = pcall(function()
			return HttpService:RequestAsync({
				Url     = BASE_URL,
				Method  = "POST",
				Headers = headers,
				Body    = body,
			})
		end)

		if not success then
			-- HttpService:RequestAsync threw (e.g. HTTP disabled, DNS failure)
			local errMsg = tostring(result)

			if errMsg:find("TIMEOUT") or errMsg:find("timed out") then
				-- Don't retry timeouts — propagate immediately
				return nil, "⏱ Request timed out. The AI server may be under heavy load."
			end

			if attempt <= self._maxRetries then
				warn(string.format("[AIClient] Attempt %d failed (%s). Retrying…", attempt, errMsg))
				task.wait(1.5 * attempt)  -- Exponential back-off
				continue
			end

			return nil, "🔌 Network error: " .. errMsg
		end

		-- HTTP call itself succeeded — check the status code
		if result.StatusCode == 200 then
			local ok, decoded = pcall(HttpService.JSONDecode, HttpService, result.Body)
			if ok then
				return decoded, nil
			else
				return nil, "⚠ Failed to parse server response."
			end
		elseif result.StatusCode == 503 or result.StatusCode == 507 then
			-- Oracle Cloud "Out of Capacity" typically surfaces as 503/507
			return nil, "🚫 AI server is out of capacity. Please try again later."
		elseif result.StatusCode == 401 then
			return nil, "🔑 Unauthorised. Check your bearer token."
		elseif result.StatusCode == 429 then
			-- Rate-limited — wait and retry
			if attempt <= self._maxRetries then
				warn("[AIClient] Rate-limited (429). Backing off…")
				task.wait(3 * attempt)
				continue
			end
			return nil, "⏳ Too many requests. Please slow down."
		else
			-- Non-retryable HTTP error
			local detail = result.Body ~= "" and result.Body or "(no body)"
			return nil, string.format("❌ Server returned %d: %s", result.StatusCode, detail)
		end
	end

	return nil, "❌ All retry attempts exhausted."
end

-- ─── Private: Queue Consumer ──────────────────────────────────────────────────

--- Runs forever as a background task, draining the request queue one-at-a-time.
function AIClient:_processQueue()
	while true do
		if #self._queue > 0 then
			self._busy = true
			local entry = table.remove(self._queue, 1)

			-- Execute the request
			local response, err = self:_doRequest(entry.payload)

			-- Resume the caller's coroutine with the result
			if err then
				task.spawn(entry.reject, err)
			else
				task.spawn(entry.resolve, response)
			end

			self._busy = false
		else
			-- Wait for a new item to be enqueued
			self._queueSignal.Event:Wait()
		end
	end
end

-- ─── Private: Enqueue ─────────────────────────────────────────────────────────

--- Adds a request to the queue and returns a promise-like pair of (resolve, reject).
-- The caller yields until the queue consumer fires either callback.
function AIClient:_enqueue(payload: table): (table?, string?)
	local thread = coroutine.running()
	local resolved, rejected = false, false
	local resultData, resultErr

	local function resolve(data)
		resolved = true
		resultData = data
		task.spawn(thread)
	end

	local function reject(errMsg)
		rejected = true
		resultErr = errMsg
		task.spawn(thread)
	end

	table.insert(self._queue, {
		payload = payload,
		resolve = resolve,
		reject  = reject,
	})

	-- Wake the queue consumer if it was sleeping
	self._queueSignal:Fire()

	-- Yield this coroutine until resolve or reject is called
	coroutine.yield()

	return resultData, resultErr
end

-- ─── Public API ───────────────────────────────────────────────────────────────

--- Sends a chat message and returns the assistant's reply (string).
-- Must be called from inside a task.spawn / coroutine — it yields.
--
-- @param messages   table   Array of { role = "user"|"assistant"|"system", content = "…" }
-- @param options    table?  Optional per-call overrides: { temperature, max_tokens, systemPrompt }
-- @returns string?, string?  (replyText, errorMessage)
--
-- Example:
--   local reply, err = client:Chat({
--       { role = "user", content = "Write a Roblox jump boost script." }
--   })
function AIClient:Chat(messages: table, options: table?): (string?, string?)
	assert(type(messages) == "table" and #messages > 0,
		"[AIClient] messages must be a non-empty array.")

	local opts = options or {}

	-- Optionally prepend a system prompt
	local fullMessages = {}
	if opts.systemPrompt then
		table.insert(fullMessages, { role = "system", content = opts.systemPrompt })
	end
	for _, m in ipairs(messages) do
		table.insert(fullMessages, m)
	end

	local payload = {
		model    = self._model,
		messages = fullMessages,
		stream   = false,  -- Roblox HttpService doesn't support streaming
	}

	if opts.temperature  then payload.temperature   = opts.temperature  end
	if opts.max_tokens   then payload.max_tokens    = opts.max_tokens   end

	local response, err = self:_enqueue(payload)
	if err then
		return nil, err
	end

	-- Parse the OpenAI-compatible response format
	local ok, reply = pcall(function()
		return response.choices[1].message.content
	end)

	if not ok or type(reply) ~= "string" then
		return nil, "⚠ Unexpected response format from server."
	end

	return reply, nil
end

--- Convenience wrapper: sends a single user message string.
-- @param message string   Plain text message from the user.
-- @param options table?   Same options as Chat().
-- @returns string?, string?
function AIClient:Ask(message: string, options: table?): (string?, string?)
	assert(type(message) == "string" and #message > 0,
		"[AIClient] message must be a non-empty string.")

	return self:Chat({{ role = "user", content = message }}, options)
end

--- Returns the number of requests currently waiting in the queue.
function AIClient:QueueDepth(): number
	return #self._queue
end

--- Returns true if a request is currently being processed.
function AIClient:IsBusy(): boolean
	return self._busy
end

--- Cleans up the queue and disconnects the signal. Call when done.
function AIClient:Destroy()
	self._queue = {}
	self._queueSignal:Destroy()
end

return AIClient
