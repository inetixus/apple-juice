import express from 'express';
import type { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 3000;

// Build tag so we can verify which code is actually running (GET /version).
const BUILD_TAG = 'kiro-proxy-v4-json-guarantee';

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

app.listen(port, () => {
  console.log(`Kiro proxy server running on port ${port} [${BUILD_TAG}]`);
  console.log(`Using LD_LIBRARY_PATH base: ${KIRO_LIB_PATH}`);
});
