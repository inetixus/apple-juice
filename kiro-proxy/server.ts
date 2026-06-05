import express from 'express';
import type { Request, Response } from 'express';
import * as path from 'path';
import {
  materialize,
  readScriptFiles,
  diffToScripts,
  diffToRevert,
  readManifest,
  diffManifest,
  diffManifestToRevert,
  sanityCheckLuau,
  extractSummary,
  runAgent,
  runMcpAgent,
  type SnapshotEntry,
} from './agent';

const app = express();
const port = process.env.PORT || 3000;

// Build tag so we can verify which code is actually running (GET /version).
const BUILD_TAG = 'kiro-proxy-v12-mcp';

// Where per-session project files are materialized.
const SESSIONS_ROOT = process.env.KIRO_SESSIONS_ROOT || '/tmp/kiro-sessions';

// Only one agent run per session at a time (the CLI mutates a shared dir).
const activeSessions = new Set<string>();

function sanitizeSessionKey(key: string): string {
  // Defend against path traversal — only allow safe chars in the dir name.
  return key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || 'default';
}

// ── Session directory cleanup ──────────────────────────────────────────────
// Materialized project dirs live in SESSIONS_ROOT. Sweep ones untouched for a
// while so the disk never fills (we hit a full disk during setup once).
const SESSION_TTL_MS = Number(process.env.KIRO_SESSION_TTL_MS || 60 * 60 * 1000); // 1h

async function sweepOldSessions(): Promise<void> {
  const fs = await import('fs/promises');
  let entries: string[] = [];
  try {
    entries = await fs.readdir(SESSIONS_ROOT);
  } catch {
    return; // root doesn't exist yet — nothing to sweep
  }
  const now = Date.now();
  for (const name of entries) {
    const dir = path.join(SESSIONS_ROOT, name);
    try {
      const st = await fs.stat(dir);
      if (now - st.mtimeMs > SESSION_TTL_MS) {
        await fs.rm(dir, { recursive: true, force: true });
        console.log(`[cleanup] removed stale session dir: ${name}`);
      }
    } catch {
      /* ignore individual failures */
    }
  }
}

// Run a sweep at startup and every 30 minutes.
setInterval(() => { void sweepOldSessions(); }, 30 * 60 * 1000);

// Path to a libstdc++ that provides GLIBCXX_3.4.30 (required by kiro-cli).
// On Oracle Linux 9 the system libstdc++ is too old, so we point the CLI at a
// newer copy staged in /opt/kirolibs. Override with KIRO_LIB_PATH if needed.
const KIRO_LIB_PATH = process.env.KIRO_LIB_PATH || '/opt/kirolibs';

app.use(express.json({ limit: '50mb' }));

// Enable CORS for direct browser requests
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/', (_req, res) => {
  res.status(200).send('Kiro Proxy is running');
});
app.get('/version', (_req, res) => {
  res.status(200).json({ build: BUILD_TAG });
});

interface ChatMessage {
  role: string;
  content: string;
}

interface OpenAIRequest {
  model?: string;
  messages?: ChatMessage[];
  stream?: boolean;
}

/** Remove ANSI CSI/OSC escape sequences. */
function stripAnsi(s: string): string {
  s = s.replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '');
  s = s.replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '');
  return s;
}

/** Strip the kiro-cli prompt marker, code fences, and the credits footer. */
function stripChrome(s: string): string {
  let t = stripAnsi(s);
  t = t.replace(/^\s*>\s?/, '');                 // leading "> " prompt marker
  t = t.replace(/^\s*```[^\n]*\n/, '');          // opening code fence (```json etc.)
  t = t.replace(/^\s*json\s*\n/i, '');           // bare "json" tag line
  t = t.replace(/\n\s*```\s*$/, '');             // closing code fence
  t = t.replace(/[\r\n]+[^\r\n]*Credits:[^\r\n]*Time:[^\r\n]*\s*$/u, ''); // footer
  t = t.replace(/[\u25B8\u25BA▸►][^\r\n]*Credits:[^\r\n]*$/u, '');
  return t.trim();
}

/**
 * Turn raw CLI output into a guaranteed-valid JSON string of the shape the app
 * expects: {"message":...,"scripts":[...]}.
 *  - If the output contains a parseable JSON object with message/scripts, use it.
 *  - Otherwise treat the whole thing as a plain chat reply and wrap it so the
 *    app never falls back to its "response was truncated" recovery path.
 */
function toAppJson(rawOutput: string): string {
  const clean = stripChrome(rawOutput);

  // Try the substring from the first "{" to the last "}" as JSON.
  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const candidate = clean.slice(first, last + 1);
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && ('message' in obj || 'scripts' in obj)) {
        // Normalize: ensure a scripts array is always present.
        if (!Array.isArray(obj.scripts)) obj.scripts = [];
        return JSON.stringify(obj);
      }
    } catch {
      /* not valid JSON — fall through to wrapping */
    }
  }

  // Plain conversational reply — wrap it.
  return JSON.stringify({ message: clean, scripts: [] });
}

/**
 * Flatten the OpenAI-style messages array into a single prompt for the CLI.
 * The system message carries the "output JSON only" + Roblox schema the app
 * depends on, so it must be preserved (the original proxy dropped it).
 */
function buildPrompt(messages: ChatMessage[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (!m || typeof m.content !== 'string' || !m.content.trim()) continue;
    if (m.role === 'system') parts.push(m.content.trim());
    else if (m.role === 'assistant') parts.push(`ASSISTANT: ${m.content.trim()}`);
    else parts.push(`USER: ${m.content.trim()}`);
  }
  return parts.join('\n\n');
}

app.post('/v1/chat/completions', (req: Request<{}, {}, OpenAIRequest>, res: Response) => {
  const kiroApiKey = process.env.KIRO_API_KEY;
  if (!kiroApiKey) {
    console.error('Missing KIRO_API_KEY in environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { messages, model, stream } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid or missing messages array' });
  }

  const prompt = buildPrompt(messages);
  if (!prompt) {
    return res.status(400).json({ error: 'No usable content in messages array' });
  }

  console.log(`Received request for model ${model}. Generating with spawn...`);

  const { spawn } = require('child_process');
  const child = spawn('kiro-cli', ['chat', '--no-interactive', prompt], {
    env: {
      ...process.env,
      KIRO_API_KEY: kiroApiKey,
      LD_LIBRARY_PATH: KIRO_LIB_PATH +
        (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''),
    },
  });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    // Immediate empty chunk to beat any upstream time-to-first-byte timeout.
    const dummy = JSON.stringify({
      id: 'chatcmpl-kiro',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'kiro-model',
      choices: [{ index: 0, delta: { content: '' } }],
    });
    res.write(`data: ${dummy}\n\n`);
  }

  let rawBuffer = '';
  let errorOutput = '';

  child.stdout.on('data', (d: any) => { rawBuffer += d.toString(); });
  child.stderr.on('data', (d: any) => { errorOutput += d.toString(); });

  child.on('close', (code: number | null) => {
    if (code !== 0) {
      console.error('Execution error code:', code, 'stderr:', errorOutput);
      const errJson = JSON.stringify({
        message: `[CLI Error]: ${errorOutput || 'unknown error'}`,
        scripts: [],
      });
      if (!stream) {
        return res.status(500).json({ error: 'CLI execution failed', detail: errorOutput });
      }
      const payload = JSON.stringify({
        id: 'chatcmpl-kiro', object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000), model: model || 'kiro-model',
        choices: [{ index: 0, delta: { content: errJson } }],
      });
      res.write(`data: ${payload}\n\n`);
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }

    // Always hand the app a single valid JSON object.
    const appJson = toAppJson(rawBuffer);

    if (stream) {
      const payload = JSON.stringify({
        id: 'chatcmpl-kiro', object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000), model: model || 'kiro-model',
        choices: [{ index: 0, delta: { content: appJson } }],
      });
      res.write(`data: ${payload}\n\n`);
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }

    return res.status(200).json({
      id: 'chatcmpl-' + Math.random().toString(36).substring(2),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'kiro-model',
      choices: [{ index: 0, message: { role: 'assistant', content: appJson }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  });
});

/**
 * TRUE MCP agent endpoint. Runs kiro-cli connected to our Studio MCP server so
 * the model makes live interactive tool calls into Studio via the bridge.
 * No snapshot/diff — changes are applied directly in Studio as the agent works.
 *
 * Body: { sessionKey, prompt, model?, uiContext? }
 * Streams SSE: progress events, then a result event.
 */
app.post('/v1/mcp-agent', async (req: Request, res: Response) => {
  const kiroApiKey = process.env.KIRO_API_KEY;
  const bridgeUrl = process.env.AJ_BRIDGE_URL || 'https://apple-juice.online';
  const bridgeSecret = process.env.AJ_BRIDGE_SECRET || '';
  const mcpEntry = process.env.AJ_MCP_ENTRY || path.join(__dirname, 'mcp', 'dist', 'studio-mcp.js');
  const mcpRunner = process.env.AJ_MCP_RUNNER || 'node';

  if (!kiroApiKey || !bridgeSecret) {
    return res.status(500).json({ ok: false, error: 'MCP agent not configured (KIRO_API_KEY / AJ_BRIDGE_SECRET).' });
  }

  const { sessionKey, prompt, model, uiContext } = req.body as {
    sessionKey?: string;
    prompt?: string;
    model?: string;
    uiContext?: string;
  };
  if (!prompt || !sessionKey) {
    return res.status(400).json({ ok: false, error: 'prompt and sessionKey are required' });
  }

  const safeKey = sanitizeSessionKey(sessionKey);
  if (activeSessions.has(safeKey)) {
    return res.status(429).json({ ok: false, error: 'A generation is already running for this session.' });
  }
  activeSessions.add(safeKey);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const sse = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await runMcpAgent(SESSIONS_ROOT, prompt, {
      libPath: KIRO_LIB_PATH,
      apiKey: kiroApiKey,
      sessionKey,
      bridgeUrl,
      bridgeSecret,
      mcpEntry,
      mcpRunner,
      model,
      uiContext,
      timeoutMs: 300000,
      onProgress: (text) => sse('progress', { text }),
    });

    sse('result', {
      ok: result.ok,
      // In MCP mode changes are already applied live in Studio, so there are no
      // scripts to return — just the agent's summary.
      message: extractSummary(result.stdout) || 'Done.',
      appliedLive: true,
      exitCode: result.code,
    });
    res.write('event: done\ndata: {}\n\n');
    return res.end();
  } catch (e: any) {
    console.error('MCP agent run failed:', e);
    sse('error', { error: e?.message || 'MCP agent run failed' });
    return res.end();
  } finally {
    activeSessions.delete(safeKey);
  }
});

/**
 * Stage 2 agentic endpoint.
 *
 * Body: { sessionKey, prompt, snapshot: SnapshotEntry[], model? }
 * Returns: { ok, scripts: ScriptAction[], message, log }
 *
 * Materializes the snapshot to disk, runs kiro-cli agentically in that dir,
 * diffs the result, and returns plugin-ready script actions. Stateless: the
 * app supplies the snapshot, so no Redis/keys live on the VPS.
 */
app.post('/v1/agent', async (req: Request, res: Response) => {
  const kiroApiKey = process.env.KIRO_API_KEY;
  if (!kiroApiKey) {
    return res.status(500).json({ ok: false, error: 'Server configuration error' });
  }

  const { sessionKey, prompt, snapshot, model, uiContext } = req.body as {
    sessionKey?: string;
    prompt?: string;
    snapshot?: SnapshotEntry[];
    model?: string;
    uiContext?: string;
  };

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ ok: false, error: 'prompt is required' });
  }
  if (!Array.isArray(snapshot)) {
    return res.status(400).json({ ok: false, error: 'snapshot array is required' });
  }

  const safeKey = sanitizeSessionKey(sessionKey || 'default');
  if (activeSessions.has(safeKey)) {
    return res.status(429).json({ ok: false, error: 'A generation is already running for this session.' });
  }
  activeSessions.add(safeKey);

  const sessionDir = path.join(SESSIONS_ROOT, safeKey);

  // Stream progress as SSE so the client can show live agent activity.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sse = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await materialize(sessionDir, snapshot);
    const before = await readScriptFiles(sessionDir);
    const beforeManifest = await readManifest(sessionDir);

    const result = await runAgent(sessionDir, prompt, {
      libPath: KIRO_LIB_PATH,
      apiKey: kiroApiKey,
      model,
      timeoutMs: 240000,
      uiContext,
      onProgress: (text) => sse('progress', { text }),
    });

    const after = await readScriptFiles(sessionDir);
    const afterManifest = await readManifest(sessionDir);

    const scriptActions = diffToScripts(before, after);
    const instanceActions = diffManifest(beforeManifest, afterManifest);
    const scriptRevert = diffToRevert(before, after);
    const instanceRevert = diffManifestToRevert(beforeManifest, afterManifest);
    // Revert ordering mirrors apply: recreate instances first, then scripts,
    // then deletes last.
    const revInstCreates = instanceRevert.filter((a) => a.action === 'create_instance');
    const revInstDeletes = instanceRevert.filter((a) => a.action === 'delete');
    const revert = [...revInstCreates, ...scriptRevert, ...revInstDeletes];

    // Instance creates should run BEFORE scripts (so scripts can reference
    // RemoteEvents/Folders), and deletes after. The plugin applies in order.
    const creates = instanceActions.filter((a) => a.action === 'create_instance');
    const deletes = instanceActions.filter((a) => a.action === 'delete');
    const scripts = [...creates, ...scriptActions, ...deletes];

    const changed = scriptActions.length + instanceActions.length;

    // Sanity-check generated Luau so we can surface warnings (non-blocking).
    const warnings: string[] = [];
    for (const a of scriptActions) {
      if (a.action === 'create' && a.code) {
        warnings.push(...sanityCheckLuau(`${a.parent}.${a.name}`, a.code));
      }
    }
    if (warnings.length) {
      console.warn('[agent] Luau sanity warnings:', warnings);
    }

    const message =
      extractSummary(result.stdout) ||
      (changed > 0
        ? `Updated ${changed} item${changed > 1 ? 's' : ''}.`
        : 'No changes were made.');

    sse('result', {
      ok: result.ok,
      scripts,
      revert,
      message,
      changed,
      warnings,
      exitCode: result.code,
    });
    res.write('event: done\ndata: {}\n\n');
    return res.end();
  } catch (e: any) {
    console.error('Agent run failed:', e);
    sse('error', { error: e?.message || 'Agent run failed' });
    return res.end();
  } finally {
    activeSessions.delete(safeKey);
  }
});

app.listen(port, () => {
  console.log(`Kiro proxy server running on port ${port} [${BUILD_TAG}]`);
  console.log(`Using LD_LIBRARY_PATH base: ${KIRO_LIB_PATH}`);
  void sweepOldSessions(); // initial cleanup on boot
});