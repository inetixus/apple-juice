import express from 'express';
import type { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Health check endpoint for Render
app.get('/', (_req, res) => {
  res.status(200).send('Kiro Proxy is running');
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

  // Extract the latest user prompt
  const lastMessage = messages[messages.length - 1];
  const prompt = lastMessage.content;

  console.log(`Received request for model ${model}. Generating with spawn...`);

  const { spawn } = require('child_process');
  const child = spawn('kiro-cli', ['chat', '--no-interactive', prompt], {
    env: {
      ...process.env,
      KIRO_API_KEY: kiroApiKey
    }
  });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  }

  let fullResponse = '';
  let errorOutput = '';

  child.stdout.on('data', (data: any) => {
    let chunk = data.toString();
    
    // Strip ANSI codes and leading >
    chunk = chunk
      .replace(/\x1B\[\d+(;\d+)*m/g, '') 
      .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/^>\s*/, '');

    if (chunk) {
      console.log('AI Chunk:', chunk); // Log to Render dashboard
      fullResponse += chunk;
      
      if (stream) {
        const payload = JSON.stringify({
          choices: [{ delta: { content: chunk } }]
        });
        res.write(`data: ${payload}\n\n`);
      }
    }
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
          detail: errorOutput
        });
      } else {
        const payload = JSON.stringify({ choices: [{ delta: { content: `\n\n[CLI Error]: ${errorOutput}` } }] });
        res.write(`data: ${payload}\n\n`);
      }
    }

    if (stream) {
      res.write(`data: [DONE]\n\n`);
      return res.end();
    } else {
      return res.status(200).json({
        id: 'chatcmpl-' + Math.random().toString(36).substring(2),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'kiro-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: fullResponse.trim()
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Kiro proxy server running on port ${port}`);
});
