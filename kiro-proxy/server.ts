import express from 'express';
import type { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 3000;

// Build tag so we can verify which code is actually running (GET /version).
const BUILD_TAG = 'kiro-proxy-v3-brace-anchored';

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

// Health check + version endpoints
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

/** Remove the trailing "▸ Credits: X • Time: Ys" footer kiro-cli appends. */
function stripFooter(s: string): string {
  s = s.replace(/[\r\n]+[^\r\n]*Credits:[^\r\n]*Time:[^\r\n]*\s*$/u, '');
  s = s.replace(/[\u25B8\u25BA▸►][^\r\n]*Credits:[^\r\n]*$/u, '');
  return s;
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
      // Prepend our staged libstdc++ so kiro-cli finds GLIBCXX_3.4.30.
      LD_LIBRARY_PATH: KIRO_LIB_PATH +
        (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''),
    },
  });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const dummyPayload = JSON.stringify({
      id: 'chatcmpl-kiro',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'kiro-model',
      choices: [{ index: 0, delta: { content: '' } }],
    });
    res.write(`data: ${dummyPayload}\n\n`);
  }

  let rawBuffer = '';
  let errorOutput = '';

  // The JSON body begins at the first "{" in the cleaned output. Everything
  // before it (the "> " marker, a "json" tag, ``` fences) is CLI chrome and is
  // dropped. Locking this index once it's found keeps the stream monotonic, so
  // no chrome can leak even mid-stream.
  let bodyStart = -1;
  let emitted = '';
  // Small holdback protects against a partially-arrived trailing footer.
  const HOLDBACK = 64;

  const sendDelta = (delta: string) => {
    if (!delta) return;
    const payload = JSON.stringify({
      id: 'chatcmpl-kiro',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model || 'kiro-model',
      choices: [{ index: 0, delta: { content: delta } }],
    });
    res.write(`data: ${payload}\n\n`);
  };

  // Returns the current clean body, or null if we haven't seen a "{" yet
  // (and aren't finalizing). On final with no "{", falls back to plain text.
  const computeBody = (isFinal: boolean): string | null => {
    const clean = stripAnsi(rawBuffer);
    if (bodyStart === -1) {
      const brace = clean.indexOf('{');
      if (brace === -1) {
        if (!isFinal) return null;
        // No JSON at all — treat as plain text, strip prompt marker + fences.
        let t = clean.replace(/^\s*>\s?/, '');
        t = t.replace(/^\s*```[^\n]*\n/, '').replace(/\n\s*```\s*$/, '');
        return stripFooter(t);
      }
      bodyStart = brace;
    }
    return stripFooter(clean.slice(bodyStart));
  };

  const pump = (isFinal: boolean): string => {
    const body = computeBody(isFinal);
    if (body === null) return '';
    const emittable = isFinal ? body.length : Math.max(0, body.length - HOLDBACK);
    if (emittable > emitted.length) {
      const delta = body.slice(emitted.length, emittable);
      emitted = body.slice(0, emittable);
      return delta;
    }
    return '';
  };

  child.stdout.on('data', (data: any) => {
    rawBuffer += data.toString();
    if (stream) sendDelta(pump(false));
  });

  child.stderr.on('data', (data: any) => {
    errorOutput += data.toString();
  });

  child.on('close', (code: number | null) => {
    if (code !== 0) {
      console.error('Execution error code:', code);
      console.error('stderr:', errorOutput);
      if (!stream) {
        return res.status(500).json({
          error: 'An error occurred while communicating with the CLI',
          detail: errorOutput,
        });
      }
      sendDelta(`\n\n[CLI Error]: ${errorOutput}`);
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }

    if (stream) {
      sendDelta(pump(true)); // flush remaining body past the holdback
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }

    const finalText = (computeBody(true) || '').trim();
    return res.status(200).json({
      id: 'chatcmpl-' + Math.random().toString(36).substring(2),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'kiro-model',
      choices: [
        { index: 0, message: { role: 'assistant', content: finalText }, finish_reason: 'stop' },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  });
});

app.listen(port, () => {
  console.log(`Kiro proxy server running on port ${port} [${BUILD_TAG}]`);
  console.log(`Using LD_LIBRARY_PATH base: ${KIRO_LIB_PATH}`);
});
