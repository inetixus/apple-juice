import express from 'express';
import type { Request, Response } from 'express';
import { execFile } from 'child_process';


const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

interface ChatRequest {
  prompt: string;
}

app.post('/v1/chat', (req: Request<{}, {}, ChatRequest>, res: Response) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing prompt string' });
  }

  const kiroApiKey = process.env.KIRO_API_KEY;
  if (!kiroApiKey) {
    console.error('Missing KIRO_API_KEY in environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Using execFile is the most secure way to prevent shell injection vulnerabilities.
  // It passes arguments directly to the executable without invoking a shell, meaning
  // characters like ;, |, &&, etc. inside the prompt are treated as literal strings
  // and cannot execute arbitrary shell commands.
  execFile(
    'kiro-cli',
    ['chat', '--no-interactive', prompt],
    {
      env: {
        ...process.env,
        KIRO_API_KEY: kiroApiKey
      }
    },
    (error, stdout, stderr) => {
      if (error) {
        // Securely log the internal system error to the console
        console.error('Execution error:', error);
        console.error('stderr:', stderr);
        
        // Return a generic error message to the client without leaking sensitive system data
        return res.status(500).json({
          error: 'An error occurred while communicating with the CLI'
        });
      }

      // Success
      res.status(200).json({
        model: 'claude-sonnet-4.5',
        response: stdout.trim()
      });
    }
  );
});

app.listen(port, () => {
  console.log(`Kiro proxy server running on http://localhost:${port}`);
});
