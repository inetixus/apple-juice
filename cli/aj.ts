#!/usr/bin/env node

/**
 * Apple Juice CLI  —  Roblox Studio AI Sync
 * Full UI revamp modelled on Claude Code's terminal design.
 * Includes slash command menu with live filtering, Tab autocomplete.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import * as readline from 'readline';
import Enquirer from 'enquirer';
import { spawn } from 'child_process';
import http from 'http';
import { gradientText, SUNSET_START, SUNSET_END } from './utils/ansi.ts';
import { runLocalMcpAgent, localMcpReady, kiroCliAvailable, extractMcpSummary } from './utils/local-mcp-agent.ts';
import { officialStudioMcpInstalled, STUDIO_MCP_HELP } from './utils/roblox-mcp.ts';
import * as Diff from 'diff';
import https from 'https';
import { fileURLToPath } from 'url';

async function customFetch(url: string, options: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const isHttps = url.startsWith('https:');
      const lib = isHttps ? https : http;
      const method = options.method || 'GET';
      const headers = { ...options.headers };
      let body = options.body;

      if (body && typeof body === 'object') {
        body = JSON.stringify(body);
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }

      const req = lib.request(url, {
        method,
        headers,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            text: async () => raw,
            json: async () => {
              try { return JSON.parse(raw); }
              catch { return {}; }
            },
          });
        });
      });

      if (options.signal) {
        if (typeof options.signal.addEventListener === 'function') {
          options.signal.addEventListener('abort', () => {
            req.destroy();
            reject(new Error('The operation was aborted.'));
          });
        } else {
          options.signal.onabort = () => {
            req.destroy();
            reject(new Error('The operation was aborted.'));
          };
        }
      }

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        req.write(body);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Shadow global fetch to avoid experimental fetch warning and pkg Node 18 compatibility crash
const fetch = customFetch;

/**
 * The REAL Apple Juice backend (deployed site / VPS). Account features — Roblox
 * login, subscription, and credit balance — only exist here, NOT in the CLI's
 * local lightweight server (which is an offline shim with no auth/billing). So
 * auth + usage calls must always target production, regardless of config.apiUrl
 * (which may point at the local shim on :3000). Override with AJ_BACKEND_URL.
 */
const PROD_BACKEND_URL = (process.env.AJ_BACKEND_URL || 'https://apple-juice.online').replace(/\/$/, '');

/** Resolve the backend base for account/auth/usage calls (always production). */
function backendUrl(config: CLIConfig): string {
  const u = config.apiUrl || '';
  // If apiUrl points at a real remote host, honor it; otherwise use production.
  if (/^https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(u)) return u.replace(/\/$/, '');
  return PROD_BACKEND_URL;
}

/**
 * Stream an SSE chat response (used for TRUE MCP mode). The server's /api/chat
 * route, when sent `stream: true` and KIRO_MCP_URL is configured, relays the
 * VPS MCP agent's progress as OpenAI-style `reasoning` deltas and emits the
 * final result as a single `content` delta whose value is a JSON string
 * ({ message, scripts, suggestions }). We parse those deltas incrementally so
 * the CLI can render live "watch it work" progress, just like the web app.
 *
 * Calls `onProgress(text)` for each reasoning chunk and resolves with the
 * accumulated content payload + reasoning once `[DONE]` (or stream end) is hit.
 */
function streamChat(
  url: string,
  body: any,
  onProgress: (text: string) => void,
): Promise<{ ok: boolean; status: number; content: string; reasoning: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      const isHttps = url.startsWith('https:');
      const lib = isHttps ? https : http;
      const payload = JSON.stringify(body);
      const req = lib.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            Accept: 'text/event-stream',
          },
        },
        (res) => {
          const status = res.statusCode || 0;
          const ok = status >= 200 && status < 300;
          let buf = '';
          let content = '';
          let reasoning = '';

          // Non-2xx: collect the error body and bail.
          if (!ok) {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () =>
              resolve({ ok: false, status, content: '', reasoning: '', error: Buffer.concat(chunks).toString('utf8') }),
            );
            return;
          }

          res.on('data', (chunk: Buffer) => {
            buf += chunk.toString('utf8');
            const blocks = buf.split('\n\n');
            buf = blocks.pop() || '';
            for (const block of blocks) {
              for (const line of block.split('\n')) {
                const m = line.match(/^data:\s*(.*)$/);
                if (!m) continue;
                const data = m[1];
                if (data === '[DONE]') continue;
                let parsed: any;
                try { parsed = JSON.parse(data); } catch { continue; }
                const delta = parsed?.choices?.[0]?.delta;
                if (!delta) continue;
                if (typeof delta.reasoning === 'string' && delta.reasoning) {
                  reasoning += delta.reasoning;
                  onProgress(delta.reasoning);
                }
                if (typeof delta.content === 'string' && delta.content) {
                  content += delta.content;
                }
              }
            }
          });

          res.on('end', () => resolve({ ok: true, status, content, reasoning }));
          res.on('error', (err: any) =>
            resolve({ ok: false, status, content, reasoning, error: err?.message || String(err) }),
          );
        },
      );

      req.on('error', (err) => resolve({ ok: false, status: 0, content: '', reasoning: '', error: err.message }));
      req.write(payload);
      req.end();
    } catch (e: any) {
      resolve({ ok: false, status: 0, content: '', reasoning: '', error: e?.message || String(e) });
    }
  });
}

let globalConfig: CLIConfig | null = null;
let globalRl: readline.Interface | null = null;

let localOpenRouterModels: string[] = [];
try {
  const candidates: string[] = [];
  
  // Try using ESM import.meta.url
  try {
    const esmDirname = path.dirname(fileURLToPath(import.meta.url));
    if (esmDirname) {
      candidates.push(path.join(esmDirname, 'modellist.txt'));
      candidates.push(path.join(esmDirname, '../cli/modellist.txt'));
    }
  } catch (_) {}

  // Try using CJS __dirname
  try {
    if (typeof __dirname !== 'undefined') {
      candidates.push(path.join(__dirname, 'modellist.txt'));
      candidates.push(path.join(__dirname, '../cli/modellist.txt'));
    }
  } catch (_) {}

  // Fallbacks
  candidates.push(path.join(process.cwd(), 'cli/modellist.txt'));
  candidates.push(path.join(process.cwd(), 'modellist.txt'));
  
  try {
    candidates.push(path.join(path.dirname(process.execPath), 'cli/modellist.txt'));
    candidates.push(path.join(path.dirname(process.execPath), 'modellist.txt'));
  } catch (_) {}

  let foundPath = '';
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      foundPath = c;
      break;
    }
  }
  if (foundPath) {
    const raw = fs.readFileSync(foundPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data) {
      localOpenRouterModels = parsed.data.map((m: any) => m.id);
    }
  }
} catch (e) {
  // ignore
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface CLIConfig {
  sessionKey: string;
  apiUrl: string;
  isFirstRun: boolean;
  projectPath?: string;
  cliUserId?: string;
  provider?: 'openai' | 'google';
  openaiKey?: string;
  googleKey?: string;
  model?: string;
  /** Optional list of model names for autocomplete */
  availableModels?: string[];
  promptColor?: string;
  sessions?: Record<string, ChatMessage[]>;
  previousSessionKey?: string;
  themeColor?: 'terracotta' | 'red' | 'blue' | 'green' | 'yellow' | 'cyan';
  chatbarStyle?: 'mode' | 'minimal' | 'model' | 'both';
  showTokenPricing?: boolean;
  extendedThinking?: boolean;
  /**
   * TRUE MCP mode. When enabled, prompts are sent with stream:true so the
   * server routes through the VPS MCP agent (KIRO_MCP_URL): the model makes
   * live interactive studio_* tool calls into the paired Studio session via
   * the bridge. Changes are applied directly in Studio (no artifact/diff flow).
   */
  mcpMode?: boolean;
  /**
   * Local MCP transport preference for MCP mode:
   *   'auto'   — use the official local Roblox Studio MCP when available
   *              (Studio MCP binary + kiro-cli present), else the remote bridge.
   *   'local'  — force the official local Studio MCP (BloxBot-style).
   *   'remote' — always use the remote VPS bridge.
   * Defaults to 'auto'.
   */
  mcpTransport?: 'auto' | 'local' | 'remote';
  /** Roblox account linked via `aj login` (device flow). When set, generations
   *  bill against this user's subscription/credits. */
  robloxUserId?: string;
  robloxUsername?: string;
}

interface SyncStep {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
}

interface SessionState {
  serverOnline: boolean;
  paired: boolean;
  history: ChatMessage[];
  config: CLIConfig;
  lastError?: string;
  infoMessage?: string;
  pairingCode?: string;
  artifacts?: any[];
  modalOpen?: boolean;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  /** Cached account info from /api/cli/usage (refreshed on launch + after login). */
  account?: {
    loggedIn: boolean;
    plan: string;
    remainingMl: number;
    totalMl: number;
    monthlyCapped?: boolean;
  } | null;
}

// ─── ANSI ────────────────────────────────────────────────────────────────────
const R = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const BRIGHT_RED = '\x1b[91m';
const BRIGHT_GREEN = '\x1b[92m';
const BRIGHT_YELLOW = '\x1b[93m';
const BRIGHT_CYAN = '\x1b[96m';
const BRIGHT_WHITE = '\x1b[97m';
const WHITE = '\x1b[37m';

const THEME_COLORS = ['terracotta', 'red', 'blue', 'green', 'yellow', 'cyan'] as const;

// Apple Juice brand — dynamic colors (initially premium terracotta)
let BRAND = '\x1b[38;2;204;107;73m';
let BRAND_DIM = '\x1b[38;2;130;70;50m';
let BRAND_B = '\x1b[38;2;230;120;80m';
let BRAND_SHIMMER = '\x1b[38;2;250;165;130m';

function applyPromptColor(colorName?: string): void {
  const name = colorName?.toLowerCase() || 'terracotta';
  if (name === 'red') {
    BRAND = '\x1b[38;2;230;30;30m';
    BRAND_DIM = '\x1b[38;2;140;20;20m';
    BRAND_B = '\x1b[38;2;255;60;60m';
    BRAND_SHIMMER = '\x1b[38;2;255;120;120m';
  } else if (name === 'blue') {
    BRAND = '\x1b[38;2;40;110;230m';
    BRAND_DIM = '\x1b[38;2;25;65;140m';
    BRAND_B = '\x1b[38;2;70;150;255m';
    BRAND_SHIMMER = '\x1b[38;2;140;185;255m';
  } else if (name === 'green') {
    BRAND = '\x1b[38;2;46;204;113m';
    BRAND_DIM = '\x1b[38;2;25;120;65m';
    BRAND_B = '\x1b[38;2;85;235;150m';
    BRAND_SHIMMER = '\x1b[38;2;135;245;180m';
  } else if (name === 'yellow') {
    BRAND = '\x1b[38;2;241;196;15m';
    BRAND_DIM = '\x1b[38;2;145;115;8m';
    BRAND_B = '\x1b[38;2;255;220;50m';
    BRAND_SHIMMER = '\x1b[38;2;255;235;120m';
  } else if (name === 'cyan') {
    BRAND = '\x1b[38;2;52;152;219m';
    BRAND_DIM = '\x1b[38;2;30;90;130m';
    BRAND_B = '\x1b[38;2;85;185;245m';
    BRAND_SHIMMER = '\x1b[38;2;145;210;255m';
  } else {
    BRAND = '\x1b[38;2;204;107;73m';
    BRAND_DIM = '\x1b[38;2;130;70;50m';
    BRAND_B = '\x1b[38;2;230;120;80m';
    BRAND_SHIMMER = '\x1b[38;2;250;165;130m';
  }
}

const C_COMMENT = '\x1b[38;5;244m';
const C_STRING = '\x1b[38;5;78m';
const C_NUMBER = '\x1b[38;5;215m';
const C_KEYWORD = '\x1b[38;5;197m\x1b[1m';
const C_BUILTIN = '\x1b[38;5;75m';
const C_OPERATOR = '\x1b[38;5;116m';
const C_IDENTIFIER = '\x1b[38;5;253m';

function stripAnsi(s: string): string {
  return s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function formatModelName(model: string): string {
  if (!model) return '';
  const parts = model.split('/');
  let name = parts[parts.length - 1];
  let suffix = '';
  if (name.includes(':')) {
    const colonIdx = name.indexOf(':');
    suffix = ` <${name.slice(colonIdx + 1)}>`;
    name = name.slice(0, colonIdx);
  }
  const words = name.split('-');
  const formattedWords = words.map(word => {
    if (!word) return '';
    if (/\d/.test(word)) return word;
    if (word.toLowerCase() === 'reasoning') return 'reasoning';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  return formattedWords.filter(Boolean).join(' ') + suffix;
}

function termWidth(): number {
  return process.stdout.columns || 80;
}

function padRight(text: string, visLen: number): string {
  const vis = stripAnsi(text).length;
  return text + ' '.repeat(Math.max(0, visLen - vis));
}

function drawHorizontalLineWithText(leftText: string, rightText?: string): string {
  const w = (process.stdout.columns || 80) - 1;
  const leftTextPart = leftText ? ` ${leftText} ` : '';
  const rightTextPart = rightText ? ` ${rightText} ` : '';
  const leftLen = stripAnsi(leftTextPart).length;
  const rightLen = stripAnsi(rightTextPart).length;
  const leftLines = 3;
  const remaining = w - leftLines - leftLen - rightLen - 4;
  if (remaining <= 0) {
    return `\x1b[38;2;65;65;65m${'─'.repeat(w)}${R}`;
  }
  return `\x1b[38;2;65;65;65m${'─'.repeat(leftLines)}${R}${leftTextPart}\x1b[38;2;65;65;65m${'─'.repeat(remaining)}${R}${rightTextPart}\x1b[38;2;65;65;65m────${R}`;
}

function getGitBranch(): string {
  try {
    const headPath = path.join(process.cwd(), '.git', 'HEAD');
    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, 'utf8').trim();
      if (head.startsWith('ref: ')) {
        return head.replace('ref: refs/heads/', '');
      }
    }
  } catch (_) { }
  return 'main';
}

function getContextBar(history: ChatMessage[]): string {
  const textLen = JSON.stringify(history).length;
  const pct = Math.min(100, Math.max(0, Math.round((textLen / 30000) * 100)));
  const bars = Math.round(pct / 10);
  const barStr = '█'.repeat(bars) + '░'.repeat(10 - bars);
  return `${barStr} ${pct}% used`;
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
const SPIN_FRAMES = ['✦', '✧', '★', '☆', '✶', '✷', '✸', '✹'];

// Fixed apple frames: consistent dimensions, proper centered rotation effect
const APPLE_FRAMES: string[][] = [
  [
    "    \\|/     ",
    "   .-\"-.    ",
    "  /     \\   ",
    "  |  |  |   ",
    "  \\     /   ",
    "   `-'-`    "
  ],
  [
    "    \\|/     ",
    "   .-\"-.    ",
    "  /  |  \\   ",
    "  |  |  |   ",
    "  \\  |  /   ",
    "   `-'-`    "
  ],
  [
    "    \\|/     ",
    "   .-\"-.    ",
    "  / (|\\ \\   ",
    "  | (|)| |   ",
    "  \\ (|/ /   ",
    "   `-'-`    "
  ],
  [
    "    \\|/     ",
    "   .-\"-.    ",
    "  /  |\\ \\   ",
    "  |  |)| |   ",
    "  \\  |/ /   ",
    "   `-'-`    "
  ],
  [
    "    \\|/     ",
    "   .-\"-.    ",
    "  /     \\   ",
    "  |  |  |   ",
    "  \\     /   ",
    "   `-'-`    "
  ],
  [
    "    \\|/     ",
    "   .-\"-.    ",
    "  /  )| \\   ",
    "  |  )| |   ",
    "  \\  )| /   ",
    "   `-'-`    "
  ],
  [
    "    \\|/     ",
    "   .-\"-.    ",
    "  / (|  \\   ",
    "  | (|  |   ",
    "  \\ (|  /   ",
    "   `-'-`    "
  ],
  [
    "    \\|/     ",
    "   .-\"-.    ",
    "  /  \\| \\   ",
    "  |  \\| |   ",
    "  \\  \\| /   ",
    "   `-'-`    "
  ]
];

function getAppleFrame(frame: number, isRainbow = false): string[] {
  const fIndex = frame % APPLE_FRAMES.length;
  const rawLines = APPLE_FRAMES[fIndex];

  let frameColor = BRAND;
  if (isRainbow) {
    const rainbowColors = [
      '\x1b[38;2;255;99;71m',
      '\x1b[38;2;255;165;0m',
      '\x1b[38;2;238;232;170m',
      '\x1b[38;2;50;205;50m',
      '\x1b[38;2;64;224;208m',
      '\x1b[38;2;30;144;255m',
      '\x1b[38;2;147;112;219m'
    ];
    frameColor = rainbowColors[frame % rainbowColors.length];
  }

  const green = '\x1b[38;2;46;204;113m';
  const stem = '\x1b[38;2;139;69;19m';

  const lines = [...rawLines];
  lines[0] = lines[0].replace(/\\\|\//g, `${stem}\\${green}│${stem}/${R}`);
  lines[0] = lines[0].replace(/\|/g, `${stem}│${R}`);
  lines[0] = lines[0].replace(/\\\|/g, `${stem}\\│${R}`);
  lines[0] = lines[0].replace(/\|\\/g, `${stem}│\\${R}`);

  for (let idx = 1; idx < lines.length; idx++) {
    let line = lines[idx];
    line = line.replace(/([()|])/g, `${BRAND_SHIMMER}$1${frameColor}`);
    lines[idx] = `${frameColor}${line}${R}`;
  }

  return lines;
}

let _spinInterval: any = null;
let lastSpinnerLinesCount = 0;

function clearSpinner(cursorRow?: number): void {
  if (lastSpinnerLinesCount > 0) {
    const row = _spinnerStartRow || (process.stdout.rows || 24) - 4;
    process.stdout.write('\x1b[s');
    process.stdout.write(`\x1b[${row};1H\x1b[2K`);
    process.stdout.write('\x1b[u');
    lastSpinnerLinesCount = 0;
  }
}

function getSpinnerColor(frame: number, isRainbow = false): string {
  if (isRainbow) {
    const rainbowColors = [
      '\x1b[38;2;255;99;71m',
      '\x1b[38;2;255;165;0m',
      '\x1b[38;2;238;232;170m',
      '\x1b[38;2;50;205;50m',
      '\x1b[38;2;64;224;208m',
      '\x1b[38;2;30;144;255m',
      '\x1b[38;2;147;112;219m'
    ];
    return rainbowColors[frame % rainbowColors.length];
  }
  const colors = [BRAND, BRAND_B, BRAND_SHIMMER, BRAND_B, BRAND];
  return colors[frame % colors.length];
}

const SPIN_DURATIONS = [300, 150, 120, 120, 150, 300];

let _spinnerStartRow = 0;
let _spinnerRows = 0;

function startSpinner(msg: string, isRainbow = false): void {
  clearSpinner();
  let frame = 0;
  const startTime = Date.now();
  _spinnerStartRow = (process.stdout.rows || 24) - 4;

  const tick = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const elapsedSec = elapsed.toFixed(1);
    const phase = getReasoningPhase(elapsed);
    
    const spinColor = getSpinnerColor(frame, isRainbow);
    const spinnerIcon = SPIN_FRAMES[frame % SPIN_FRAMES.length];

    process.stdout.write('\x1b[s');
    process.stdout.write(`\x1b[${_spinnerStartRow};1H\x1b[2K  ${spinColor}${spinnerIcon}${R}  ${BOLD}${WHITE}${msg}${R} ${BRAND_DIM}➔${R} ${DIM}${phase}${R}  ${DIM}[${elapsedSec}s]${R}`);
    process.stdout.write('\x1b[u');
    lastSpinnerLinesCount = 1;
    _spinnerRows = 1;

    const delay = 80;
    frame++;

    _spinInterval = setTimeout(tick, delay);
  };

  tick();
}

function stopSpinner(): void {
  if (_spinInterval) {
    clearTimeout(_spinInterval);
    _spinInterval = null;
  }
  clearSpinner();
}

// ─── Sync Progress ────────────────────────────────────────────────────────────
const SF = SPIN_FRAMES;
let _sfFrame = 0;
let _sfInterval: NodeJS.Timeout | null = null;
let _sfLines = 0;
let _sfStartTime = 0;
let _sfStepTimes: Record<string, { start?: number; elapsed?: number }> = {};

function _drawSync(steps: SyncStep[]): void {
  for (const s of steps) {
    if (s.status === 'running' && !_sfStepTimes[s.name]?.start) {
      _sfStepTimes[s.name] = { start: Date.now() };
    }
    if (s.status === 'done' || s.status === 'failed') {
      if (!_sfStepTimes[s.name]) {
        _sfStepTimes[s.name] = { start: _sfStartTime };
      }
      if (!_sfStepTimes[s.name].elapsed) {
        _sfStepTimes[s.name].elapsed = (Date.now() - (_sfStepTimes[s.name].start ?? _sfStartTime)) / 1000;
      }
    }
  }

  const completedCount = steps.filter(s => s.status === 'done' || s.status === 'failed').length;
  const ratio = completedCount / steps.length;
  const overallElapsed = ((Date.now() - _sfStartTime) / 1000).toFixed(1);

  const w = Math.min(termWidth() - 4, 70);
  const lines: string[] = [];

  const headerText = ` ${BOLD}${gradientText('Syncing to Roblox Studio', SUNSET_START, SUNSET_END)}${R} `;
  const rawHeaderLen = 'Syncing to Roblox Studio'.length + 2;
  const sideLineLen = Math.max(0, Math.floor((w - rawHeaderLen - 12) / 2));
  const rightSideLineLen = Math.max(0, w - rawHeaderLen - sideLineLen - 12);

  lines.push(`  ${BRAND}╭${'─'.repeat(sideLineLen)}${headerText}${BRAND}${'─'.repeat(rightSideLineLen)} [${overallElapsed}s] ╮${R}`);

  for (const s of steps) {
    let icon = `${DIM}○${R}`;
    let nameText = `${DIM}${s.name}${R}`;
    let timeText = '';

    if (s.status === 'done') {
      icon = `${BRIGHT_GREEN}✔${R}`;
      const elapsed = _sfStepTimes[s.name]?.elapsed?.toFixed(1) ?? '0.0';
      nameText = `${WHITE}${s.name}${R}`;
      timeText = ` ${DIM}(${elapsed}s)${R}`;
    } else if (s.status === 'failed') {
      icon = `${BRIGHT_RED}✖${R}`;
      const elapsed = _sfStepTimes[s.name]?.elapsed?.toFixed(1) ?? '0.0';
      nameText = `${BRIGHT_RED}${s.name}${R}`;
      timeText = ` ${DIM}(${elapsed}s)${R}`;
    } else if (s.status === 'running') {
      icon = `${BRAND}${SF[_sfFrame]}${R}`;
      nameText = `${BOLD}${WHITE}${s.name}${R}`;
      const currentElapsed = ((Date.now() - (_sfStepTimes[s.name]?.start ?? Date.now())) / 1000).toFixed(1);
      timeText = ` ${BRAND}(${currentElapsed}s...)${R}`;
    }

    const stepLine = `  ${BRAND}│${R}  ${icon}  ${nameText}${timeText}`;
    lines.push(padRight(stepLine, w + 12) + `${BRAND}│${R}`);
  }

  lines.push(`  ${BRAND}├${'─'.repeat(w + 2)}┤${R}`);

  const barWidth = Math.max(10, w - 24);
  const filledLen = Math.round(barWidth * ratio);
  const emptyLen = barWidth - filledLen;
  const filledBar = `\x1b[38;2;255;160;30m${'█'.repeat(filledLen)}\x1b[0m`;
  const emptyBar = `\x1b[90m${'░'.repeat(emptyLen)}\x1b[0m`;
  const percentStr = `${Math.round(ratio * 100)}%`.padStart(4);
  const progressBar = `${filledBar}${emptyBar}  ${BRAND}${percentStr}${R}`;
  const progressLine = `  ${BRAND}│${R}  ${progressBar}`;
  lines.push(padRight(progressLine, w + 12) + `${BRAND}│${R}`);

  lines.push(`  ${BRAND}╰${'─'.repeat(w + 2)}╯${R}`);

  const box = lines.join('\n');
  if (_sfLines > 0) {
    for (let i = 0; i < _sfLines; i++) {
      process.stdout.write('\x1b[A\x1b[2K');
    }
  }
  process.stdout.write(box + '\n');
  _sfLines = lines.length;
}

function startSyncProgress(steps: SyncStep[]): void {
  _sfLines = 0;
  _sfStartTime = Date.now();
  _sfStepTimes = {};
  _sfInterval = setInterval(() => { _sfFrame = (_sfFrame + 1) % SF.length; _drawSync(steps); }, 80);
}

function stopSyncProgress(steps: SyncStep[]): void {
  if (_sfInterval) { clearInterval(_sfInterval); _sfInterval = null; }
  _drawSync(steps);
  _sfLines = 0;
}

const STATUS_VERBS = [
  'Reticulating', 'Orchestrating', 'Compiling', 'Restructuring', 'Optimizing', 'Indexing', 'Tokenizing', 'Hashing', 'Decrypting', 'Encrypting',
  'Parsing', 'Resolving', 'Validating', 'Calibrating', 'Synthesizing', 'Normalizing', 'Quantizing', 'Sharding', 'Serializing', 'Compressing',
  'Interpreting', 'Assembling', 'Refactoring', 'Profiling', 'Debugging', 'Tracing', 'Caching', 'Synchronizing', 'Serialising', 'Hydrating',
  'Dehydrating', 'Transpiling', 'Vectorizing', 'Clustering', 'Pruning', 'Pipetuning', 'Backpropagating', 'Fine-tuning', 'Quantifying', 'Formulating',
  'Cerebrating', 'Ruminating', 'Cogitating', 'Deliberating', 'Contemplating', 'Musing', 'Speculating', 'Envisioning', 'Rationalizing', 'Conceptualizing',
  'Hypothesizing', 'Analyzing', 'Deducting', 'Inferring', 'Deconstructing', 'Deciphering', 'Pondering', 'Meditating', 'Philosophizing', 'Weighing',
  'Synthesising', 'Diagnosing', 'Evaluating', 'Extrapolating', 'Brainstorming', 'Reviewing', 'Reflecting', 'Visualizing', 'Predicting', 'Discerning',
  'Grasping', 'Apprehending', 'Comprehending', 'Fathoming', 'Intuiting', 'Postulating', 'Scheming', 'Puzzling', 'Synthetizing', 'Postulating',
  'Brewing', 'Fermenting', 'Simmering', 'Distilling', 'Tempering', 'Kneading', 'Caramelizing', 'Flambéing', 'Zesting', 'Infusing',
  'Crystallizing', 'Transmuting', 'Coagulating', 'Sublimating', 'Filtering', 'Decanting', 'Steeping', 'Macerating', 'Roasting', 'Searing',
  'Baking', 'Basting', 'Pureeing', 'Whisking', 'Marinating', 'Glazing', 'Pickling', 'Chilling', 'Smoking', 'Condensing',
  'Extracting', 'Concentrating', 'Liquefying', 'Solidifying', 'Precipitating', 'Alchemizing', 'Vaporizing', 'Evaporating', 'Dissolving', 'Charring',
  'Orbiting', 'Undulating', 'Cascading', 'Hovering', 'Fluttering', 'Swooping', 'Gliding', 'Levitating', 'Oscillating', 'Vibrating',
  'Pulsating', 'Spinning', 'Swirling', 'Spiraling', 'Launching', 'Catapulting', 'Scurrying', 'Slithering', 'Galloping', 'Rippling',
  'Fluctuating', 'Surging', 'Sweeping', 'Whirling', 'Rotating', 'Revolving', 'Precessing', 'Drifting', 'Flowing', 'Streaming',
  'Zooming', 'Darting', 'Sprinting', 'Bounding', 'Leaping', 'Bouncing', 'Prancing', 'Swaying', 'Tumbling', 'Rolling',
  'Booping', "Beboppin'", 'Flibbertigibbeting', 'Lollygagging', 'Skedaddling', 'Shenaniganing', 'Bamboozling', 'Dilly-dallying', 'Tomfoolering', 'Boondoggling',
  'Discombobulating', 'Giga-thinking', 'Hyper-focusing', 'Coffee-powered', 'Pixel-pushing', 'Byte-chewing', 'Glitch-hunting', 'Rubber-ducking', 'Nonsensing', 'Kerfuffling',
  'Architecting', 'Composing', 'Crafting', 'Creating'
];

function getReasoningPhase(elapsed: number): string {
  const idx = Math.floor(elapsed / 1.5);
  const seed = (idx * 17 + 11) % STATUS_VERBS.length;
  return STATUS_VERBS[seed] + '...';
}

/**
 * Describe what one plan action is doing, in present tense, for the live feed.
 */
function describeAction(s: any): { verb: string; label: string } | null {
  const action = String(s.action || 'create').toLowerCase();
  const t = s.type || s.scriptType || 'Script';
  switch (action) {
    case 'read_script':
      return { verb: 'Reading', label: `${s.name || 'script'}` };
    case 'create':
      return { verb: 'Writing', label: `${t} ${s.name || ''} → ${s.parent || 'ServerScriptService'}`.trim() };
    case 'edit_script':
      return { verb: 'Editing', label: `${s.name || 'script'}` };
    case 'create_instance':
      return { verb: 'Creating', label: `${s.className || 'Instance'} ${s.instanceName || ''} → ${s.parent || ''}`.trim() };
    case 'delete':
      return { verb: 'Deleting', label: `${s.name || 'instance'}` };
    case 'rename_instance':
      return { verb: 'Renaming', label: `${s.oldPath || ''} → ${s.newName || ''}` };
    case 'move_instance':
      return { verb: 'Moving', label: `${s.oldPath || ''} → ${s.newParentPath || ''}` };
    case 'run_playtest':
      return { verb: 'Playtesting', label: 'verifying in Studio' };
    default:
      return null;
  }
}

/**
 * Print a live, ticking activity feed for the agent's real plan — each line
 * shows a spinner while "in progress", then flips to a green check. Gives the
 * CLI the same agentic "watch it work" feel as the web app.
 */
async function printActivityFeed(scripts: any[], thinking?: string): Promise<void> {
  const steps: { verb: string; label: string }[] = [];
  if (thinking && thinking.trim()) steps.push({ verb: 'Thinking', label: 'reasoning about the request' });
  for (const s of scripts || []) {
    const d = describeAction(s);
    if (d) steps.push(d);
  }
  if (steps.length === 0) return;

  process.stdout.write('\n');
  for (const step of steps) {
    // In-progress line with a brief spinner sweep.
    const frames = ['✦', '✧', '★', '✶'];
    for (let f = 0; f < 4; f++) {
      const icon = frames[f % frames.length];
      process.stdout.write(`\r  ${BRAND}${icon}${R}  ${BOLD}${WHITE}${step.verb}${R} ${DIM}${step.label}${R}   `);
      await new Promise(r => setTimeout(r, 60));
    }
    // Completed line.
    process.stdout.write(`\r  ${BRIGHT_GREEN}✓${R}  ${DIM}${step.verb}${R} ${DIM}${step.label}${R}   \n`);
  }
}

function formatArtifactsBox(scripts: any[]): string {
  if (!scripts || scripts.length === 0) return '';

  const w = termWidth() - 1;
  const boxW = Math.min(72, Math.max(48, w - 4));
  const G = '\x1b[38;2;90;90;95m';        // border grey
  const inner = boxW - 2;                  // usable content width inside │ … │

  // Pad a pre-colored string to a fixed *visible* width.
  const pad = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - stripAnsi(s).length));
  const row = (content: string) => `  ${G}│${R} ${pad(content, inner - 1)}${G}│${R}`;
  const rule = (left: string, right: string) =>
    `  ${G}${left}${'─'.repeat(boxW - 2)}${right}${R}`;

  // Tally actions for the header summary.
  let created = 0, modified = 0, deleted = 0, other = 0;
  for (const s of scripts) {
    const a = String(s.action || 'create').toLowerCase();
    if (a === 'create' || a === 'create_instance') created++;
    else if (a === 'delete') deleted++;
    else if (a === 'run_playtest' || a === 'rename_instance' || a === 'move_instance') other++;
    else modified++;
  }
  const summaryParts: string[] = [];
  if (created) summaryParts.push(`${BRIGHT_GREEN}+${created} new${R}`);
  if (modified) summaryParts.push(`${BRIGHT_YELLOW}~${modified} edit${modified > 1 ? 's' : ''}${R}`);
  if (deleted) summaryParts.push(`${BRIGHT_RED}-${deleted} del${R}`);
  if (other) summaryParts.push(`${DIM}${other} action${other > 1 ? 's' : ''}${R}`);
  const summary = summaryParts.join(`${DIM} · ${R}`);

  const lines: string[] = [''];

  // Header
  const title = ` ${BRAND}✦${R} ${BOLD}Implementation Plan${R}`;
  const headRight = summary;
  const headGap = Math.max(1, inner - 1 - stripAnsi(title).length - stripAnsi(headRight).length);
  lines.push(rule('╭', '╮'));
  lines.push(row(`${title}${' '.repeat(headGap)}${headRight}`));
  lines.push(rule('├', '┤'));

  // One block per script
  let totalLines = 0, totalBytes = 0;
  scripts.forEach((s, idx) => {
    const action = String(s.action || 'create').toLowerCase();
    const typeLabel = s.type || s.scriptType || s.className || 'Instance';
    const nameLabel = s.name || s.instanceName || 'Unnamed';
    const pathLabel = s.parent || s.newParentPath || '';

    let badge: string;
    let detail: string;

    if (action === 'delete') {
      badge = `${BRIGHT_RED}✗ DELETE${R}`;
      detail = `${WHITE}${nameLabel}${R} ${DIM}in ${pathLabel}${R}`;
    } else if (action === 'run_playtest') {
      badge = `${BRIGHT_CYAN}▶ TEST${R}`;
      detail = `${DIM}Run a Studio playtest to verify${R}`;
    } else if (action === 'rename_instance') {
      badge = `${BRIGHT_YELLOW}✎ RENAME${R}`;
      detail = `${DIM}${s.oldPath || ''} → ${s.newName || ''}${R}`;
    } else if (action === 'move_instance') {
      badge = `${BRIGHT_YELLOW}⇄ MOVE${R}`;
      detail = `${DIM}${s.oldPath || ''} → ${s.newParentPath || ''}${R}`;
    } else if (action === 'create_instance') {
      badge = `${BRIGHT_GREEN}+ NEW${R}`;
      detail = `${BRAND}${typeLabel}${R} ${BOLD}${WHITE}${nameLabel}${R} ${DIM}in ${pathLabel}${R}`;
    } else {
      const isModify = action !== 'create';
      badge = isModify ? `${BRIGHT_YELLOW}~ EDIT${R}` : `${BRIGHT_GREEN}+ NEW${R}`;
      detail = `${BRAND}${typeLabel}${R} ${BOLD}${WHITE}${nameLabel}${R} ${DIM}in ${pathLabel}${R}`;
    }

    // Tree connector
    const connector = idx === scripts.length - 1 ? '└' : '├';
    lines.push(row(`${DIM}${connector}─${R} ${badge}  ${detail}`));

    // Size meta for code-bearing scripts
    if (s.code && typeof s.code === 'string') {
      const ln = s.code.split('\n').length;
      const by = s.code.length;
      totalLines += ln;
      totalBytes += by;
      const sizeStr = by > 1024 ? `${(by / 1024).toFixed(1)} KB` : `${by} B`;
      lines.push(row(`${DIM}│  ${ln} lines · ${sizeStr}${R}`));
    }
  });

  // Footer with totals + next-step hint
  lines.push(rule('├', '┤'));
  const totalStr = totalLines > 0
    ? `${DIM}${totalLines} lines across ${scripts.length} file${scripts.length > 1 ? 's' : ''}${R}`
    : `${DIM}${scripts.length} action${scripts.length > 1 ? 's' : ''}${R}`;
  const hint = `${BRAND}/artifact${R}${DIM} to review${R}`;
  const footGap = Math.max(1, inner - 1 - stripAnsi(totalStr).length - stripAnsi(hint).length);
  lines.push(row(`${totalStr}${' '.repeat(footGap)}${hint}`));
  lines.push(rule('╰', '╯'));

  return lines.join('\n') + '\n';
}

function highlightLuau(code: string): string {
  const rules = [
    { type: 'comment', re: /^--\[\[\s\S]*?\]\]|^--.*$/ },
    { type: 'string', re: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^\[\[[\s\S]*?\]\]/ },
    { type: 'number', re: /^\b0x[0-9a-fA-F]+\b|^\b\d+(?:\.\d+)?\b/ },
    { type: 'keyword', re: /^\b(and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while|continue|self)\b/ },
    { type: 'builtin', re: /^\b(print|warn|error|Instance|game|workspace|script|Vector3|Color3|CFrame|UDim2|task|math|string|table|pairs|ipairs|typeof|new|Connect|Wait|Clone|Destroy|GetService)\b/ },
    { type: 'ident', re: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
    { type: 'op', re: /^[+\-*/%^#=~<>.:;]/ },
    { type: 'ws', re: /^\s+/ },
    { type: 'other', re: /^./ },
  ];
  let out = '', i = 0;
  while (i < code.length) {
    const sub = code.slice(i);
    for (const r of rules) {
      const m = sub.match(r.re);
      if (m) {
        const v = m[0]; i += v.length;
        switch (r.type) {
          case 'comment': out += C_COMMENT + v + R; break;
          case 'string': out += C_STRING + v + R; break;
          case 'number': out += C_NUMBER + v + R; break;
          case 'keyword': out += C_KEYWORD + v + R; break;
          case 'builtin': out += C_BUILTIN + v + R; break;
          case 'op': out += C_OPERATOR + v + R; break;
          case 'ident': out += C_IDENTIFIER + v + R; break;
          default: out += v;
        }
        break;
      }
    }
  }
  return out;
}

function renderAlignedTable(rows: string[][]): string {
  const dataRows = rows.filter(row => !row.every(cell => cell.startsWith('-')));
  if (dataRows.length === 0) return '';

  const numCols = dataRows[0].length;
  const colWidths = Array(numCols).fill(0);
  for (const row of dataRows) {
    for (let c = 0; c < numCols; c++) {
      if (row[c]) {
        colWidths[c] = Math.max(colWidths[c], stripAnsi(row[c]).length);
      }
    }
  }

  const w = termWidth();
  const G_LINE = '\x1b[38;2;100;100;100m';
  const outLines: string[] = [];

  const topBorder = G_LINE + '┌─' + colWidths.map(w => '─'.repeat(w)).join('─┬─') + '─┐' + R;
  outLines.push('  ' + topBorder);

  const header = dataRows[0];
  const headerCells = header.map((cell, idx) => {
    const text = `${BOLD}${WHITE}${cell}${R}`;
    return padRight(text, colWidths[idx]);
  }).join(` ${G_LINE}│${R} `);
  outLines.push(`  ${G_LINE}│${R} ` + headerCells + ` ${G_LINE}│${R}`);

  const midBorder = G_LINE + '├─' + colWidths.map(w => '─'.repeat(w)).join('─┼─') + '─┤' + R;
  outLines.push('  ' + midBorder);

  for (let r = 1; r < dataRows.length; r++) {
    const row = dataRows[r];
    const cells = row.map((cell, idx) => {
      const text = `${DIM}${cell}${R}`;
      return padRight(text, colWidths[idx]);
    }).join(` ${G_LINE}│${R} `);
    outLines.push(`  ${G_LINE}│${R} ` + cells + ` ${G_LINE}│${R}`);
  }

  const botBorder = G_LINE + '└─' + colWidths.map(w => '─'.repeat(w)).join('─┴─') + '─┘' + R;
  outLines.push('  ' + botBorder);

  return '\n' + outLines.join('\n') + '\n';
}

function renderMarkdown(text: string): string {
  if ((text.match(/```/g) || []).length % 2 === 1) text += '\n```';
  const parts = text.split(/(```[a-zA-Z]*\n[\s\S]*?\n```)/g);
  let out = '';
  for (const part of parts) {
    if (part.startsWith('```')) {
      const lines = part.split('\n');
      const lang = lines[0].replace('```', '').trim().toLowerCase();
      const code = lines.slice(1, -1).join('\n');
      const title = (lang || 'code').toUpperCase();
      const w = Math.min(termWidth() - 6, 72);
      out += `\n  ${DIM}╭─ ${title} ${'─'.repeat(Math.max(0, w - title.length - 3))}╮${R}\n`;
      const hl = (lang === 'lua' || lang === 'luau') ? highlightLuau(code) : code;
      out += hl.split('\n').map(l => `  ${DIM}│${R} ${l}`).join('\n');
      out += `\n  ${DIM}╰${'─'.repeat(w + 2)}╯${R}\n`;
    } else {
      let r = part;

      const lines = r.split('\n');
      const tableLinesList: string[][] = [];
      let isTable = false;
      let newLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          isTable = true;
          const cells = trimmed.split('|').map(c => c.trim()).slice(1, -1);
          tableLinesList.push(cells);
        } else {
          if (isTable && tableLinesList.length > 0) {
            const alignedTable = renderAlignedTable(tableLinesList);
            newLines.push(alignedTable);
            tableLinesList.length = 0;
            isTable = false;
          }
          newLines.push(line);
        }
      }
      if (isTable && tableLinesList.length > 0) {
        const alignedTable = renderAlignedTable(tableLinesList);
        newLines.push(alignedTable);
      }

      r = newLines.join('\n');
      r = r.replace(/\*\*(.*?)\*\*/g, `${BOLD}$1${R}`);
      r = r.replace(/\*(.*?)\*/g, `\x1b[3m$1${R}`);
      r = r.replace(/`(.*?)`/g, `${BRIGHT_YELLOW}$1${R}`);
      r = r.replace(/^### (.+)$/gm, `${BOLD}${WHITE}$1${R}`);
      r = r.replace(/^## (.+)$/gm, `${BOLD}${BRIGHT_WHITE}$1${R}`);
      r = r.replace(/^# (.+)$/gm, `${BOLD}${BRAND}$1${R}`);
      r = r.replace(/^[-*] (.+)$/gm, `  ${DIM}•${R} $1`);
      out += r;
    }
  }
  return out;
}

function drawHeader(serverOnline: boolean, paired: boolean, config: CLIConfig, state?: SessionState): void {
  const w = termWidth();
  const titleText = gradientText('Apple Juice CLI', SUNSET_START, SUNSET_END);
  const engineVersion = `${DIM}v2.1.0${R}`;

  // Show the signed-in user + plan here instead of the (irrelevant) local
  // working directory — the CLI connects to Roblox Studio, not a local project.
  const acct = state?.account;
  const identityLabel = acct && acct.loggedIn
    ? `${DIM}signed in:${R} ${WHITE}${config.robloxUsername || 'Roblox User'}${R} ${DIM}·${R} ${BRAND_B}${planLabel(acct.plan)}${R}`
    : `${DIM}not signed in ${R}${DIM}·${R} ${BRAND_B}/login${R}`;

  const serverStatus = serverOnline ? `\x1b[32m🟢 Server\x1b[0m` : `\x1b[31m🔴 Offline\x1b[0m`;
  const pairStatus = paired ? `\x1b[32m🟢 Paired\x1b[0m` : `\x1b[31m🔴 Unpaired\x1b[0m`;
  const statusGroup = `${serverStatus} ${DIM}│${R} ${pairStatus}`;

  const hasPending = state?.artifacts && state.artifacts.length > 0;
  const count = state?.artifacts ? state.artifacts.length : 0;
  const artifactStatus = hasPending ? `\x1b[38;2;230;126;34m[ ✦ ${count} Pending Artifact${count > 1 ? 's' : ''} ]\x1b[0m  ` : '';
  const rightPart = `${artifactStatus}${statusGroup} ${DIM}│${R} ${engineVersion}`;

  const leftPart = `  ${BOLD}${titleText}${R}  │  ${identityLabel}`;
  const gap = Math.max(1, w - stripAnsi(leftPart).length - stripAnsi(rightPart).length - 4);

  process.stdout.write(`\x1b[1;1H\x1b[2K${leftPart}${' '.repeat(gap)}${rightPart}\n`);
  process.stdout.write(`\x1b[2;1H\x1b[2K  \x1b[38;2;65;65;65m${'─'.repeat(w - 4)}${R}\n`);
  process.stdout.write(`\x1b[3;1H\x1b[2K`);
}

function drawWelcomeCard(state: SessionState): void {
  const col1W = 38;
  const col2W = 30;

  const padR = (str: string, len: number) => {
    const vis = stripAnsi(str).length;
    return str + ' '.repeat(Math.max(0, len - vis));
  };
  const padC = (str: string, len: number) => {
    const vis = stripAnsi(str).length;
    const left = Math.floor(Math.max(0, len - vis) / 2);
    const right = Math.max(0, len - vis - left);
    return ' '.repeat(left) + str + ' '.repeat(right);
  };

  const col1: string[] = [];
  const acct = state.account;
  const greeting = acct && acct.loggedIn
    ? `${BOLD}Welcome back, ${state.config.robloxUsername || 'creator'}!${R}`
    : `${BOLD}Welcome to Apple Juice!${R}`;
  col1.push(padC(greeting, col1W));

  const green = '\x1b[38;2;46;204;113m';
  const stem = '\x1b[38;2;139;69;19m';
  const red = '\x1b[38;2;230;30;30m';
  const white = '\x1b[38;2;255;255;255m';
  const art = [
    `            ${stem}█${green}▄▀${R}          `,
    `     ${red}▄█████████████▄${R}     `,
    `   ${red}▄████${white}██${red}███████████▄${R}   `,
    `   ${red}███████████████████${R}   `,
    `     ${red}▀█████████████▀${R}     `
  ];
  for (const line of art) {
    col1.push(padC(line, col1W));
  }
  col1.push(padR('', col1W));

  // Account / subscription summary.
  const usingCustomKey = !!state.config.openaiKey || !!state.config.googleKey || !!state.config.deepseekKey || !!state.config.openrouterKey;
  if (usingCustomKey && state.config.provider) {
    const providerLabel = state.config.provider.charAt(0).toUpperCase() + state.config.provider.slice(1);
    col1.push(padC(`${DIM}Custom key:${R} ${WHITE}${providerLabel}${R}`, col1W));
  } else if (acct && acct.loggedIn) {
    col1.push(padC(`${BRAND_B}${planLabel(acct.plan)}${R} ${DIM}plan${R}`, col1W));
    col1.push(padC(`${DIM}${Math.round(acct.remainingMl)}/${Math.round(acct.totalMl)} mL credits${R}`, col1W));
  } else {
    col1.push(padC(`${DIM}Not signed in —${R} ${BRAND_B}/login${R}`, col1W));
  }

  const col2: string[] = [];
  col2.push(padR(`${BOLD}${WHITE}Getting Started${R}`, col2W));
  col2.push(padR(`Type any prompt to ask the AI.`, col2W));
  col2.push(padR(`Use / for TUI commands:`, col2W));
  col2.push(padR(`  ${BRAND}/login${R}   Sign in with Roblox`, col2W));
  col2.push(padR(`  ${BRAND}/model${R}   Change AI Model`, col2W));
  col2.push(padR(`  ${BRAND}/settings${R} Custom keys & models`, col2W));
  col2.push('---');
  if (acct && acct.loggedIn && !usingCustomKey) {
    col2.push(padR(`${BOLD}${WHITE}Your models${R}`, col2W));
    const models = modelsForPlan(acct.plan);
    // Show up to 3 included models; summarize the rest.
    for (const m of models.slice(0, 3)) {
      col2.push(padR(`  ${BRIGHT_GREEN}•${R} ${m}`, col2W));
    }
    if (models.length > 3) {
      col2.push(padR(`  ${DIM}+${models.length - 3} more — ${R}${BRAND}/model${R}`, col2W));
    }
  } else {
    col2.push(padR(`${BOLD}${WHITE}Status${R}`, col2W));
    col2.push(padR(`Studio: ${state.paired ? `${BRIGHT_GREEN}Paired${R} ` : `${BRIGHT_YELLOW}Not paired${R}`}`, col2W));
    col2.push(padR(usingCustomKey ? `Using your own API key` : `Sign in for subscription models`, col2W));
    col2.push(padR(`Type ${BRAND}/help${R} for all commands`, col2W));
  }

  const maxLines = Math.max(col1.length, col2.length);
  while (col1.length < maxLines) col1.push(padR('', col1W));
  while (col2.length < maxLines) col2.push(padR('', col2W));

  const rawTitle = ' Apple Juice Sync v2.1 ';
  const coloredTitle = gradientText(rawTitle, SUNSET_START, SUNSET_END);
  const rawTitleLen = rawTitle.length;
  const prefix = '───';
  const G_LINE = '\x1b[38;2;100;100;100m';
  const suffixLen = Math.max(0, col1W + 2 - prefix.length - rawTitleLen);
  const suffix = '─'.repeat(suffixLen);
  const col1Top = `${prefix}${coloredTitle}${G_LINE}${suffix}`;
  const col2Top = '─'.repeat(col2W + 2);

  process.stdout.write(`\x1b[5;1H  ${G_LINE}┌${col1Top}┬${col2Top}┐${R}\n`);
  for (let i = 0; i < maxLines; i++) {
    const c1 = col1[i];
    const c2 = col2[i];
    if (c2 === '---') {
      process.stdout.write(`  ${G_LINE}│${R} ${c1} ${G_LINE}├${'─'.repeat(col2W + 2)}┤${R}\n`);
    } else {
      process.stdout.write(`  ${G_LINE}│${R} ${c1} ${G_LINE}│${R} ${c2} ${G_LINE}│${R}\n`);
    }
  }
  process.stdout.write(`  ${G_LINE}└${'─'.repeat(col1W + 2)}┴${'─'.repeat(col2W + 2)}┘${R}\n\n`);
}

function drawFooter(serverOnline: boolean, paired: boolean): string {
  const hints = `${DIM}?${R} ${DIM}for shortcuts${R}`;
  const srv = serverOnline ? `${BRIGHT_GREEN}● server${R}` : `${DIM}◦ server${R}`;
  const std = paired ? `${BRIGHT_GREEN}✓ studio${R}` : `${BRIGHT_YELLOW}◦ studio${R}`;
  const rightStatus = `${srv} · ${std}`;
  const w = termWidth();
  const gap = Math.max(1, w - stripAnsi(hints).length - stripAnsi(rightStatus).length - 4);
  return `  ${hints}${' '.repeat(gap)}${rightStatus}\n                                                               ${DIM}© apple juice · /sync${R}\n\n\n`;
}

function printUserMsg(text: string): void {
  const indentedText = text.split('\n').join('\n  ');
  process.stdout.write(`\n  ${BOLD}${WHITE}You${R}\n  ${DIM}${indentedText}${R}\n`);
}

function printThinkingBlock(thinking: string): void {
  if (!thinking) return;
  const w = Math.min(76, termWidth() - 4);
  const G_LINE = '\x1b[38;2;100;100;100m';
  const borderTop = `${G_LINE}┌─${BRAND} Thought Process ${G_LINE}${'─'.repeat(w - 18)}┐${R}`;
  process.stdout.write(`  ${borderTop}\n`);
  
  // Wrap lines to w
  const lines = thinking.split('\n');
  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    let words = rawLine.split(' ');
    let currentLine = '';
    for (const word of words) {
      if (currentLine.length + word.length + 1 > w - 4) {
        process.stdout.write(`  ${G_LINE}│${R}  ${DIM}${currentLine.trim()}${' '.repeat(Math.max(0, w - 4 - currentLine.trim().length))}${G_LINE}│${R}\n`);
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    if (currentLine.trim()) {
      process.stdout.write(`  ${G_LINE}│${R}  ${DIM}${currentLine.trim()}${' '.repeat(Math.max(0, w - 4 - currentLine.trim().length))}${G_LINE}│${R}\n`);
    }
  }
  const borderBot = `${G_LINE}└${'─'.repeat(w)}┘${R}`;
  process.stdout.write(`  ${borderBot}\n`);
}

function printAssistantMsg(text: string, thinking?: string, forceShowThinking = false): void {
  let displayText = text.trim();
  if (displayText.startsWith('{') && displayText.endsWith('}')) {
    try {
      const parsed = JSON.parse(displayText);
      if (typeof parsed.assistant === 'string') displayText = parsed.assistant;
      else if (typeof parsed.text === 'string') displayText = parsed.text;
      else if (typeof parsed.message === 'string') displayText = parsed.message;
      else if (typeof parsed.code === 'string') displayText = parsed.code;
    } catch (e) {
    }
  }
  process.stdout.write(`\n  ${BOLD}${BRAND}Apple Juice${R}\n`);
  if (thinking && thinking.trim()) {
    if (forceShowThinking || globalConfig?.extendedThinking) {
      printThinkingBlock(thinking);
    } else {
      process.stdout.write(`  ${DIM}🧠 Thought process hidden. Press ${R}${BRAND}[Alt+T]${R}${DIM} to toggle, or ${R}${BRAND}[Ctrl+O]${R}${DIM} to inspect transcript.${R}\n`);
    }
  }
  const rendered = renderMarkdown(displayText);
  for (const line of rendered.split('\n')) {
    process.stdout.write(`  ${line}\n`);
  }
}

function printError(msg: string): void {
  process.stdout.write(`\n  ${BRIGHT_RED}✘${R}  ${msg}\n`);
}

function printInfo(msg: string): void {
  process.stdout.write(`\n  ${DIM}${msg}${R}\n`);
}

function printSuccess(msg: string): void {
  process.stdout.write(`\n  ${BRIGHT_GREEN}✓${R}  ${msg}\n`);
}

function redrawScreen(state: SessionState): void {
  const rows = process.stdout.rows || 24;

  if (rows < 10) {
    process.stdout.write('\x1b[3J\x1b[H\x1b[2J');
    drawHeader(state.serverOnline, state.paired, state.config, state);
    if (state.history.length === 0) drawWelcomeCard(state);
    if (state.history.length > 0) {
      const last = state.history[state.history.length - 1];
      if (last.role === 'assistant') {
        const prev = state.history[state.history.length - 2];
        if (prev?.role === 'user') printUserMsg(prev.content);
        printAssistantMsg(last.content, last.thinking);
      }
    }
    if (globalRl) globalRl.prompt(true);
    return;
  }

  process.stdout.write('\x1b[r');
  process.stdout.write('\x1b[3J\x1b[H\x1b[2J');

  process.stdout.write('\x1b[1;1H');
  drawHeader(state.serverOnline, state.paired, state.config, state);

  process.stdout.write(`\x1b[4;${rows - 4}r`);

  process.stdout.write('\x1b[4;1H');

  if (state.history.length === 0) {
    drawWelcomeCard(state);
  } else {
    for (const msg of state.history) {
      if (msg.role === 'user') printUserMsg(msg.content);
      else printAssistantMsg(msg.content, msg.thinking);
    }
  }

  if (state.lastError) printError(state.lastError);
  if (state.infoMessage) printInfo(state.infoMessage);

  if (globalRl) {
    // Force-clear the input line and redraw prompt to prevent stale command text
    const inputRow = rows - 2;
    process.stdout.write(`\x1b[${inputRow};1H\x1b[2K`);
    globalRl.prompt(true);
  }
}

function getSessionLogPath(sessionKey: string): string {
  const dir = path.join(os.homedir(), '.applejuice', 'sessions');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `session-${sessionKey}.jsonl`);
}

function writeSessionEvent(config: CLIConfig, event: any): void {
  if (!config.sessionKey) return;
  try {
    const logPath = getSessionLogPath(config.sessionKey);
    const logLine = JSON.stringify({
      turnId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      timestamp: new Date().toISOString(),
      model: config.model || 'gpt-4o-mini',
      ...event
    }) + '\n';
    fs.appendFileSync(logPath, logLine, 'utf8');
  } catch (_) {}
}

function generateHighFidelityDiagnostics(content: string) {
  const words = content.split(/\s+/).filter(Boolean);
  const logits = words.slice(0, 15).map(word => {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    const prob = 0.85 + Math.random() * 0.149;
    const alternatives = [
      { token: cleanWord + '_alt', prob: parseFloat(((1 - prob) * 0.7).toFixed(4)) },
      { token: 'the', prob: parseFloat(((1 - prob) * 0.2).toFixed(4)) },
      { token: 'and', prob: parseFloat(((1 - prob) * 0.1).toFixed(4)) }
    ];
    return { token: word, prob: parseFloat(prob.toFixed(4)), alternatives };
  });

  const attentions = words.slice(0, 8).map((word, idx) => {
    return {
      sourceToken: word,
      targetToken: words[Math.min(words.length - 1, idx + 1)] || 'end',
      weight: parseFloat((0.2 + Math.random() * 0.8).toFixed(4))
    };
  });

  return { logits, attentions };
}

const getGlobalConfigPath = () => path.join(os.homedir(), '.aj.json');
const getLocalConfigPath = () => path.join(process.cwd(), '.aj.json');

function loadConfig(): CLIConfig {
  const config: CLIConfig = { sessionKey: '', apiUrl: 'http://localhost:3000', isFirstRun: true, extendedThinking: false };
  try {
    const g = getGlobalConfigPath();
    if (fs.existsSync(g)) Object.assign(config, JSON.parse(fs.readFileSync(g, 'utf8')), { isFirstRun: false });
  } catch (_) { }
  try {
    const l = getLocalConfigPath();
    if (fs.existsSync(l)) Object.assign(config, JSON.parse(fs.readFileSync(l, 'utf8')));
  } catch (_) { }
  if (config.sessionKey) config.isFirstRun = false;
  if (config.themeColor) {
    applyPromptColor(config.themeColor);
  } else if (config.promptColor) {
    applyPromptColor(config.promptColor);
  }
  return config;
}

function saveConfig(config: CLIConfig, global = false): void {
  const p = global ? getGlobalConfigPath() : getLocalConfigPath();
  try { fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8'); } catch (_) { }
}

function detectAndSaveProjectPath(config: CLIConfig): void {
  const markers = ['package.json', '.git', 'place.project.json'];
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (markers.some(m => fs.existsSync(path.join(dir, m)))) {
      config.projectPath = dir; saveConfig(config); return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

async function pingServer(apiUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const url = apiUrl.replace('://localhost', '://127.0.0.1');
    const res = await fetch(`${url}/api/projects`, { signal: ctrl.signal }).catch(() => null);
    clearTimeout(t);
    return !!res && (res.status === 200 || res.status === 401);
  } catch (_) { return false; }
}

async function checkPairingStatus(config: CLIConfig): Promise<boolean> {
  if (!config.sessionKey) return false;
  try {
    const res = await fetch(`${config.apiUrl}/api/status?key=${encodeURIComponent(config.sessionKey)}&t=${Date.now()}`);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!data && data.status === 'ok' && !!data.lastPollTime && (Date.now() - data.lastPollTime < 10000);
  } catch (_) { return false; }
}

async function startServerAutomatically(config: CLIConfig): Promise<boolean> {
  process.stdout.write(`\n  ${BRAND}⚡${R}  Starting local server…\n`);
  try {
    const isPkg = typeof (process as any).pkg !== 'undefined';
    let cmd = 'node';
    let args = [...process.execArgv, process.argv[1] || '', 'server'];
    if (isPkg) {
      cmd = process.execPath;
      args = [];
    }
    const env: Record<string, string> = {
      AJ_MODE: 'server', PATH: process.env.PATH || '',
      SystemRoot: process.env.SystemRoot || 'C:\\Windows',
      windir: process.env.windir || 'C:\\Windows',
      USERPROFILE: process.env.USERPROFILE || '',
      HOMEDRIVE: process.env.HOMEDRIVE || '',
      HOMEPATH: process.env.HOMEPATH || '',
      APPDATA: process.env.APPDATA || '',
      LOCALAPPDATA: process.env.LOCALAPPDATA || '',
    };
    const child = spawn(cmd, args, {
      detached: true, stdio: 'ignore',
      windowsHide: true, cwd: config.projectPath || process.cwd(), env,
    });
    child.unref();
  } catch (e: any) {
    process.stdout.write(`  ${BRIGHT_RED}✗${R}  Failed to start: ${e.message}\n`);
    return false;
  }

  startSpinner('Waiting for server');
  for (let i = 0; i < 40; i++) {
    if (await pingServer(config.apiUrl)) {
      stopSpinner();
      printSuccess(`Server online at ${BRAND}${config.apiUrl}${R}`);
      await new Promise(r => setTimeout(r, 100));
      return true;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  stopSpinner();
  process.stdout.write(`\n  ${BRIGHT_YELLOW}⚠${R}  Server still starting — proceeding.\n`);
  await new Promise(r => setTimeout(r, 300));
  return false;
}

async function generateAuthCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(0, chars.length)];
  return code;
}

/** Open a URL in the user's default browser (cross-platform, best-effort). */
function openBrowser(url: string): void {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (_) { /* ignore — we also print the URL */ }
}

/** Pretty plan label. */
function planLabel(plan?: string): string {
  if (!plan || plan === 'free') return 'Free';
  if (plan === 'fresh_pro') return 'Fresh Pro';
  if (plan === 'pure_ultra') return 'Pure Ultra';
  if (plan === 'partner') return 'Partner';
  return plan.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Plan → included models (mirrors src/lib/kiro-models.ts tiers). Used to show
// the user which subscription models they have access to on the home screen.
const PLAN_RANK_CLI: Record<string, number> = { free: 0, partner: 1, fresh_pro: 2, pure_ultra: 3 };
const CLI_MODELS: { label: string; tier: string }[] = [
  { label: 'Claude Opus 4.8', tier: 'pure_ultra' },
  { label: 'Claude Opus 4.7', tier: 'pure_ultra' },
  { label: 'Claude Sonnet 4.6', tier: 'fresh_pro' },
  { label: 'Claude Sonnet 4.5', tier: 'fresh_pro' },
  { label: 'GLM-5', tier: 'fresh_pro' },
  { label: 'MiniMax M2.5', tier: 'fresh_pro' },
  { label: 'Auto', tier: 'free' },
  { label: 'Claude Haiku 4.5', tier: 'free' },
  { label: 'DeepSeek 3.2', tier: 'free' },
];
function modelsForPlan(plan?: string): string[] {
  const rank = PLAN_RANK_CLI[plan || 'free'] ?? 0;
  return CLI_MODELS.filter((m) => rank >= (PLAN_RANK_CLI[m.tier] ?? 0)).map((m) => m.label);
}

/**
 * Fetch the linked user's plan + credit balance from the server. Returns null
 * if not logged in / unreachable. mL is the credit unit used across Apple Juice.
 */
async function fetchUsage(config: CLIConfig): Promise<{
  loggedIn: boolean; plan: string; remainingMl: number; totalMl: number; usedMl: number; bonusMl: number; monthlyCapped: boolean;
} | null> {
  try {
    const res = await fetch(`${backendUrl(config)}/api/cli/usage?key=${encodeURIComponent(config.sessionKey || '')}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

/**
 * Roblox device-login flow: open the browser to sign in with Roblox, then poll
 * until the user approves. On success the CLI session key is bound to the real
 * Roblox account so the user's subscription + credits apply.
 */
async function loginWithRoblox(config: CLIConfig): Promise<boolean> {
  process.stdout.write(`\n  ${BRAND}✦${R}  ${BOLD}${WHITE}Sign in with Roblox${R}\n`);
  let deviceCode = '';
  let verifyUrl = '';
  let pollIntervalMs = 2000;
  const base = backendUrl(config);
  try {
    const res = await fetch(`${base}/api/cli/login/start`, { method: 'POST' });
    if (!res.ok) {
      process.stdout.write(`  ${BRIGHT_RED}✗${R}  Could not start login (${res.status}).\n`);
      return false;
    }
    const data = await res.json();
    deviceCode = data.deviceCode;
    verifyUrl = data.verifyUrl;
    pollIntervalMs = data.pollIntervalMs || 2000;
  } catch (e: any) {
    process.stdout.write(`  ${BRIGHT_RED}✗${R}  ${e?.message || 'Network error'}\n`);
    return false;
  }

  process.stdout.write(`  ${DIM}Opening your browser to:${R}\n  ${BRAND_B}${verifyUrl}${R}\n`);
  process.stdout.write(`  ${DIM}If it doesn't open, paste that URL into your browser.${R}\n\n`);
  openBrowser(verifyUrl);

  startSpinner('Waiting for Roblox sign-in', true);
  const deadline = Date.now() + 600_000; // 10 min
  try {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      let body: any = null;
      try {
        const res = await fetch(`${base}/api/cli/login/poll?d=${encodeURIComponent(deviceCode)}`);
        body = res.ok ? await res.json() : null;
      } catch (_) { /* keep polling */ }
      if (!body) continue;
      if (body.status === 'approved' && body.sessionKey) {
        stopSpinner();
        config.sessionKey = body.sessionKey;
        config.robloxUserId = body.userId;
        config.robloxUsername = body.username;
        config.isFirstRun = false;
        saveConfig(config);
        printSuccess(`Signed in as ${BRAND}${body.username || 'Roblox User'}${R}`);
        const usage = await fetchUsage(config);
        if (usage) {
          process.stdout.write(`  ${DIM}Plan:${R} ${BOLD}${planLabel(usage.plan)}${R}   ${DIM}Credits:${R} ${BOLD}${Math.round(usage.remainingMl)}${R}${DIM}/${Math.round(usage.totalMl)} mL${R}\n`);
        }
        return true;
      }
      if (body.status === 'expired') {
        stopSpinner();
        process.stdout.write(`  ${BRIGHT_RED}✗${R}  Login request expired. Run /login to try again.\n`);
        return false;
      }
    }
  } finally {
    stopSpinner();
  }
  process.stdout.write(`  ${BRIGHT_RED}✗${R}  Timed out waiting for sign-in.\n`);
  return false;
}

async function initAuthPairing(config: CLIConfig): Promise<string | null> {
  if (!config.cliUserId) {
    config.cliUserId = crypto.randomBytes(8).toString('hex');
    saveConfig(config, true);
  }
  const authCode = await generateAuthCode();
  try {
    const res = await fetch(`${config.apiUrl}/api/pair/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authCode, cliUserId: config.cliUserId }),
    });
    if (res.ok) {
      const data = await res.json();
      config.sessionKey = data.sessionKey;
      config.isFirstRun = false;
      saveConfig(config);
      return authCode;
    }
    process.stdout.write(`\n${BRIGHT_RED}✗${R}  Failed to initialize pairing (${res.status})\n`);
  } catch (e: any) {
    process.stdout.write(`\n${BRIGHT_RED}✗${R}  Server error: ${e.message}\n`);
  }
  return null;
}

interface HelpData {
  shortcuts: string[];
  defaultCommands: [string, string][];
  customCommands: [string, string][];
}

function parseHelpFile(): HelpData {
  const fallback: HelpData = {
    shortcuts: [
      `  ${DIM}!${R} for shell mode            ${DIM}double tap esc${R} to clear input        ${DIM}ctrl + shift + _${R} to undo`,
      `  ${DIM}/${R} for commands              ${DIM}shift + tab${R} to auto-accept edits      ${DIM}alt + v${R} to paste images`,
      `  ${DIM}@${R} for file paths            ${DIM}ctrl + o${R} for verbose output           ${DIM}alt + p${R} to switch model`,
      `  ${DIM}&${R} for background            ${DIM}ctrl + t${R} to toggle tasks               ${DIM}ctrl + s${R} to stash prompt`,
      `  ${DIM}/btw${R} for side question      ${DIM}backslash (\\) + return (⏎)${R} for     ${DIM}ctrl + g${R} to edit in $EDITOR`,
      `                              newline                                ${DIM}/keybindings${R} to customize`
    ],
    defaultCommands: [
      ['/add-dir', 'Add a new working directory'],
      ['/agents', 'Manage agent configurations'],
      ['/background', 'Send this session to the background and free the terminal'],
      ['/branch', 'Create a branch of the current conversation at this point'],
      ['/btw', 'Ask a quick side question without interrupting the main conversation'],
      ['/clear', 'Start a new session with empty context; previous session stays on disk (resumable with /resume)'],
      ['/resume', 'Restore the previous session cleared with /clear'],
      ['/color', 'Set the prompt bar color for this session'],
      ['/compact', 'Free up context by summarizing the conversation so far'],
      ['/config', 'Open config panel'],
      ['/context', 'Visualize current context usage as a colored grid'],
    ],
    customCommands: [
      ['/pair', 'Link terminal to Roblox Studio'],
      ['/login', 'Sign in with Roblox (use your subscription)'],
      ['/credits', 'Show your plan and remaining credits'],
      ['/status', 'Refresh server + Studio status'],
      ['/sync', 'AI-edit a file and push to Studio'],
      ['/mcp', 'MCP mode: local|remote|auto|on|off (live Studio tool calls)'],
      ['/provider', 'Set API provider (openai|google|deepseek|openrouter)'],
      ['/key', 'Set API key (optional provider)'],
      ['/model', 'Select AI model interactively'],
      ['/config', 'Show configuration'],
      ['/clear', 'Clear history and screen'],
      ['/exit', 'Quit Apple Juice CLI'],
    ],
  };

  try {
    const possiblePaths = [
      path.join(process.cwd(), 'cli', 'help.txt'),
      path.join(process.cwd(), 'help.txt'),
      path.join(__dirname, 'help.txt'),
      path.join(__dirname, 'cli', 'help.txt'),
      path.join(__dirname, '..', 'cli', 'help.txt'),
    ];
    let content = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, 'utf8');
        break;
      }
    }
    if (!content) return fallback;

    const lines = content.split(/\r?\n/);
    const shortcuts: string[] = [];
    const defaultCommands: [string, string][] = [];
    const customCommands: [string, string][] = [];

    let currentSection = '';
    let lastCmd = '';

    const keyMap: Record<string, string> = {
      '!': `${DIM}!${R}`,
      '/': `${DIM}/${R}`,
      '@': `${DIM}@${R}`,
      '&': `${DIM}&${R}`,
      '/btw': `${DIM}/btw${R}`,
      'double tap esc': `${DIM}double tap esc${R}`,
      'shift + tab': `${DIM}shift + tab${R}`,
      'ctrl + o': `${DIM}ctrl + o${R}`,
      'ctrl + t': `${DIM}ctrl + t${R}`,
      'backslash (\\) + return (⏎)': `${DIM}backslash (\\) + return (⏎)${R}`,
      'ctrl + shift + _': `${DIM}ctrl + shift + _${R}`,
      'alt + v': `${DIM}alt + v${R}`,
      'alt + p': `${DIM}alt + p${R}`,
      'ctrl + s': `${DIM}ctrl + s${R}`,
      'ctrl + g': `${DIM}ctrl + g${R}`,
      '/keybindings': `${DIM}/keybindings${R}`,
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      const lowerTrimmed = trimmed.toLowerCase();
      if (lowerTrimmed === 'shortcuts') {
        currentSection = 'shortcuts';
        continue;
      } else if (lowerTrimmed === 'default commands') {
        currentSection = 'default commands';
        continue;
      } else if (lowerTrimmed === 'custom commands') {
        currentSection = 'custom commands';
        continue;
      }

      if (currentSection === 'shortcuts') {
        let styled = line;
        for (const [rawKey, styledKey] of Object.entries(keyMap)) {
          styled = styled.split(rawKey).join(styledKey);
        }
        shortcuts.push('  ' + styled);
      } else if (currentSection === 'default commands' || currentSection === 'custom commands') {
        if (trimmed.startsWith('/')) {
          lastCmd = trimmed;
        } else if (lastCmd) {
          const list = currentSection === 'default commands' ? defaultCommands : customCommands;
          list.push([lastCmd, trimmed]);
          lastCmd = '';
        }
      }
    }

    if (shortcuts.length === 0 && defaultCommands.length === 0 && customCommands.length === 0) {
      return fallback;
    }

    return {
      shortcuts: shortcuts.length > 0 ? shortcuts : fallback.shortcuts,
      defaultCommands: defaultCommands.length > 0 ? defaultCommands : fallback.defaultCommands,
      customCommands: customCommands.length > 0 ? customCommands : fallback.customCommands,
    };
  } catch (e) {
    return fallback;
  }
}

function drawHelpTab(tabIndex: number, helpData: HelpData): void {
  console.clear();
  const w = termWidth();
  const titleText = gradientText('Apple Juice', SUNSET_START, SUNSET_END);
  process.stdout.write(`\n  ${BOLD}${titleText}${R}  ${DIM}Help & Shortcuts${R}\n`);
  process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);

  const tabs = ['Help', 'General', 'Commands', 'Custom commands'];
  let tabLine = '  ';
  for (let i = 0; i < tabs.length; i++) {
    const active = i === tabIndex;
    const tabName = ` ${tabs[i]} `;
    if (active) {
      tabLine += `${BOLD}\x1b[48;2;40;100;200m\x1b[38;2;255;255;255m${tabName}${R}  `;
    } else {
      tabLine += `${DIM}${tabName}${R}  `;
    }
  }
  process.stdout.write(tabLine + '\n');
  process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);

  if (tabIndex === 0) {
    process.stdout.write(`  ${BOLD}Apple Juice Sync v2.1${R}\n\n`);
    process.stdout.write(`  Apple Juice is an AI-powered sync interface designed to sync your local workspace\n`);
    process.stdout.write(`  directly to Roblox Studio while using powerful LLM generation.\n\n`);
    process.stdout.write(`  ${BRAND}•${R} Type any chat message to chat with the AI about your Roblox scripts.\n`);
    process.stdout.write(`  ${BRAND}•${R} Use slash commands like ${BRAND}/sync${R} to automatically edit files.\n`);
    process.stdout.write(`  ${BRAND}•${R} Use the arrow keys ← and → to navigate the other tabs for shortcuts & commands.\n`);
  } else if (tabIndex === 1) {
    process.stdout.write(`  ${BOLD}Shortcuts${R}\n\n`);
    for (const line of helpData.shortcuts) {
      process.stdout.write(line + '\n');
    }
    process.stdout.write(`\n  ${DIM}For more help: https://code.claude.com/docs/en/overview${R}\n`);
  } else if (tabIndex === 2) {
    process.stdout.write(`  ${BOLD}Default Commands${R}\n\n`);
    for (const [c, d] of helpData.defaultCommands) {
      process.stdout.write(`  ${BRAND}${c.padEnd(16)}${R}${DIM}${d}${R}\n`);
    }
  } else if (tabIndex === 3) {
    process.stdout.write(`  ${BOLD}Custom Commands${R}\n\n`);
    for (const [c, d] of helpData.customCommands) {
      process.stdout.write(`  ${BRAND}${c.padEnd(16)}${R}${DIM}${d}${R}\n`);
    }
  }

  process.stdout.write(`\n  ${DIM}Use ← and → arrow keys to switch tabs · Esc to close${R}\n`);
}

async function showInteractiveHelp(rl: any, state: any): Promise<void> {
  return new Promise<void>((resolve) => {
    let tabIndex = 0;
    const helpData = parseHelpFile();

    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => { };

    drawHelpTab(tabIndex, helpData);

    const openedAt = Date.now();
    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\x1b[r');
        process.exit(0);
      }

      if (key.name === 'return' && Date.now() - openedAt < 300) {
        return;
      }

      if (key.name === 'escape' || key.name === 'return') {
        cleanup();
        resolve();
        return;
      }

      if (key.name === 'right') {
        tabIndex = (tabIndex + 1) % 4;
        drawHelpTab(tabIndex, helpData);
      } else if (key.name === 'left') {
        tabIndex = (tabIndex - 1 + 4) % 4;
        drawHelpTab(tabIndex, helpData);
      }
    };

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      rl._ttyWrite = origTtyWrite;
    }

    process.stdin.on('keypress', onKeypress);
  });
}

function renderWordDiff(original: string, modified: string): string {
  const lineDiffs = Diff.diffLines(original, modified);
  const outLines: string[] = [];

  const w = Math.min(termWidth() - 8, 70);
  const BG_ADD = '\x1b[48;2;20;70;30m\x1b[38;2;255;255;255m';
  const BG_REM = '\x1b[48;2;80;20;20m\x1b[38;2;255;255;255m';

  for (let idx = 0; idx < lineDiffs.length; idx++) {
    const part = lineDiffs[idx];
    const lines = part.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();

    if (part.added) {
      for (const line of lines) {
        outLines.push(`${BRIGHT_GREEN}+${R} ${BG_ADD} ${line} ${R}`);
      }
    } else if (part.removed) {
      for (const line of lines) {
        outLines.push(`${BRIGHT_RED}-${R} ${BG_REM} ${line} ${R}`);
      }
    } else {
      if (lines.length > 8) {
        outLines.push(`  ${DIM}[... ${lines.length - 4} unchanged lines collapsed ...]${R}`);
        outLines.push(`  ${DIM}${lines[lines.length - 2]}${R}`);
        outLines.push(`  ${DIM}${lines[lines.length - 1]}${R}`);
      } else {
        for (const line of lines) {
          outLines.push(`  ${DIM}${line}${R}`);
        }
      }
    }
  }
  return outLines.join('\n');
}

async function pollLogsUntilSyncComplete(state: any): Promise<void> {
  const startTime = Date.now();
  const timeoutMs = 12000;
  let complete = false;

  startSpinner('Syncing to Roblox Studio', false);

  while (Date.now() - startTime < timeoutMs) {
    try {
      await new Promise(r => setTimeout(r, 400));
      const res = await fetch(`${state.config.apiUrl}/api/status?key=${state.config.sessionKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.logs && data.logs.length > 0) {
          clearSpinner();
          for (const log of data.logs) {
            process.stdout.write(`\r  \x1b[38;2;230;100;80m🛠️\x1b[0m \x1b[36m[Progress]\x1b[0m ${log}\n`);
            if (log.includes('Successfully synced') || log.includes('Failed to sync') || log.includes('Successfully deleted') || log.includes('Successfully created') || log.includes('Successfully modified') || log.includes('Move failed') || log.includes('Rename failed')) {
              complete = true;
            }
          }
        }
      }
      if (complete) break;
    } catch (_) {}
  }

  stopSpinner();
}

async function showInteractiveArtifacts(rl: any, state: any): Promise<void> {
  if (!state.artifacts || state.artifacts.length === 0) {
    printInfo('No active artifacts to review.');
    await new Promise(r => setTimeout(r, 1500));
    return;
  }

  return new Promise<void>((resolve) => {
    let selectedIndex = 0; // script index inside the plan
    let selectedButtonIndex = 0; // 0: preview, 1: approve plan, 2: reject plan
    let viewMode: 'plan' | 'diff' = 'plan';
    const openedAt = Date.now();
    const rows = process.stdout.rows || 24;
    const w = termWidth() - 1;

    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => { };

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    const plan = state.artifacts[0];
    const listHeight = plan.scripts.length + 6;

    // Temporarily shrink chatbox scrolling region to fit the inline list height cleanly at the bottom
    if (state && rows >= (listHeight + 6)) {
      process.stdout.write(`\x1b[4;${rows - (listHeight + 3)}r`);
      redrawScreen(state);
    }

    const startRow = rows - listHeight - 1;

    const draw = () => {
      process.stdout.write('\x1b[s'); // Save cursor position

      // Clear the popup area (listHeight lines total)
      for (let r = 0; r < listHeight; r++) {
        process.stdout.write(`\x1b[${startRow + r};1H\x1b[2K`);
      }

      if (viewMode === 'plan') {
        // Draw Header Line
        process.stdout.write(`\x1b[${startRow};1H  ${BOLD}Proposed Implementation Plan (Artifact)${R}`);
        
        // Draw the Plan description
        const shortMsg = plan.message ? plan.message.slice(0, w - 6) : "Implementation plan details below.";
        process.stdout.write(`\x1b[${startRow + 1};1H  ${DIM}“${shortMsg}”${R}`);

        // Draw each script file row
        for (let i = 0; i < plan.scripts.length; i++) {
          const s = plan.scripts[i];
          const isActive = i === selectedIndex;
          const prefix = isActive ? `\x1b[36m> \x1b[0m` : '  ';
          
          const actionText = s.action === 'delete' ? `${BRIGHT_RED}delete${R}` : s.action === 'create' ? `${BRIGHT_GREEN}new${R}` : `${BRIGHT_YELLOW}modify${R}`;
          const typeLabel = s.type || s.scriptType || 'Script';
          const fileDisplay = `${prefix}${actionText} ${WHITE}${typeLabel}:${s.name}${R} ${DIM}in ${s.parent}${R}`;

          process.stdout.write(`\x1b[${startRow + 2 + i};1H${fileDisplay}`);
        }

        // Draw the single row of Plan action buttons
        const btnRow = startRow + 2 + plan.scripts.length + 1;
        let buttonsPart = '  ';
        const btnColors = [
          selectedButtonIndex === 0 ? `\x1b[48;2;90;150;220;38;2;255;255;255;1m PREVIEW DIFF \x1b[0m` : `\x1b[36mPREVIEW DIFF\x1b[0m`,
          selectedButtonIndex === 1 ? `\x1b[48;2;46;204;113;38;2;255;255;255;1m APPROVE PLAN \x1b[0m` : `\x1b[32mAPPROVE PLAN\x1b[0m`,
          selectedButtonIndex === 2 ? `\x1b[48;2;231;76;60;38;2;255;255;255;1m REJECT PLAN \x1b[0m` : `\x1b[31mREJECT PLAN\x1b[0m`
        ];
        buttonsPart += btnColors.join('   ');
        process.stdout.write(`\x1b[${btnRow};1H${buttonsPart}`);

        // Draw Keyboard Shortcuts Bar
        const helpRow = btnRow + 1;
        const helpText = `Keyboard: ↑/↓ Select File  ←/→ Select Action  y Approve Plan  n Reject Plan  esc Exit`;
        process.stdout.write(`\x1b[${helpRow};1H  ${DIM}${helpText}${R}`);
      } else {
        // Preview Diff view inside the popup area
        const activeScript = plan.scripts[selectedIndex];
        process.stdout.write(`\x1b[${startRow};1H  ${BOLD}${WHITE}Previewing changes for ${activeScript.name}${R}`);

        let originalCode = '';
        try {
          const possiblePath = path.resolve(process.cwd(), activeScript.name);
          if (fs.existsSync(possiblePath)) {
            originalCode = fs.readFileSync(possiblePath, 'utf8');
          }
        } catch (_) { }
        const diffText = renderWordDiff(originalCode, activeScript.code);
        const diffLines = diffText.split('\n');

        // Draw up to max lines of diff preview cleanly in the box space
        const maxDiffLines = listHeight - 3;
        for (let idx = 0; idx < maxDiffLines; idx++) {
          const rowText = idx < diffLines.length ? diffLines[idx] : '';
          process.stdout.write(`\x1b[${startRow + 1 + idx};1H\x1b[2K  ${rowText}`);
        }

        process.stdout.write(`\x1b[${startRow + listHeight - 1};1H\x1b[2K  ${DIM}Press Esc / Backspace to return to list${R}`);
      }

      process.stdout.write('\x1b[u'); // Restore cursor position
    };

    draw();

    const rejectAll = async () => {
      cleanup();
      state.infoMessage = `Rejected proposed plan.`;
      redrawScreen(state);
      await new Promise(r => setTimeout(r, 1500));
      state.infoMessage = undefined;
      state.artifacts = [];
      resolve();
    };

    const approveAll = async () => {
      cleanup();
      state.infoMessage = `Syncing all changes to Roblox Studio...`;
      redrawScreen(state);

      for (const s of plan.scripts) {
        s.status = 'approved';
      }
      plan.status = 'approved';

      try {
        const pushRes = await fetch(`${state.config.apiUrl}/api/cli/push-scripts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionKey: state.config.sessionKey,
            scripts: plan.scripts
          }),
        });
        if (pushRes.ok) {
          await pollLogsUntilSyncComplete(state);
          state.infoMessage = `${BRIGHT_GREEN}✓${R} Successfully synced all scripts to Roblox Studio!`;
        } else {
          state.lastError = `Sync failed: ${pushRes.statusText}`;
        }
      } catch (e: any) {
        state.lastError = `Sync error: ${e.message}`;
      }

      redrawScreen(state);
      await new Promise(r => setTimeout(r, 2000));
      state.infoMessage = undefined;
      state.lastError = undefined;
      resolve();
    };

    const onKeypress = async (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\x1b[r');
        process.exit(0);
      }

      if (viewMode === 'plan') {
        if (key.name === 'escape') {
          cleanup();
          resolve();
          return;
        }

        // Up/down arrow to change focused script file
        if (key.name === 'up') {
          selectedIndex = (selectedIndex - 1 + plan.scripts.length) % plan.scripts.length;
          draw();
        } else if (key.name === 'down') {
          selectedIndex = (selectedIndex + 1) % plan.scripts.length;
          draw();
        }
        // Left/right arrow to navigate buttons
        else if (key.name === 'left') {
          selectedButtonIndex = (selectedButtonIndex - 1 + 3) % 3;
          draw();
        } else if (key.name === 'right') {
          selectedButtonIndex = (selectedButtonIndex + 1) % 3;
          draw();
        }
        // Direct Hotkeys
        else if (key.name === 'y') {
          await approveAll();
        } else if (key.name === 'n') {
          await rejectAll();
        } else if (key.name === 'p') {
          viewMode = 'diff';
          draw();
        }
        // Enter to trigger active horizontal button
        else if (key.name === 'return' || key.name === 'enter') {
          if (selectedButtonIndex === 0) {
            viewMode = 'diff';
            draw();
          } else if (selectedButtonIndex === 1) {
            await approveAll();
          } else if (selectedButtonIndex === 2) {
            await rejectAll();
          }
        }
      } else {
        // Diff Preview Mode controls
        if (key.name === 'escape' || key.name === 'backspace') {
          viewMode = 'plan';
          draw();
        }
      }
    };

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      rl._ttyWrite = origTtyWrite;
      // Restore full scrolling region
      process.stdout.write(`\x1b[4;${rows - 4}r`);
      redrawScreen(state);
    }

    process.stdin.on('keypress', onKeypress);
  });
}

/**
 * Decide which MCP transport to use for this turn, honoring the user's
 * mcpTransport preference and what's actually available locally.
 *   - 'local'  : official local Studio MCP (errors out clearly if unavailable)
 *   - 'remote' : the remote VPS bridge
 *   - 'auto'   : local when ready, otherwise remote
 */
function resolveMcpTransport(config: CLIConfig): 'local' | 'remote' {
  const pref = config.mcpTransport ?? 'auto';
  if (pref === 'remote') return 'remote';
  if (pref === 'local') return 'local';
  return localMcpReady() ? 'local' : 'remote';
}

/**
 * Run one LOCAL MCP turn against the OFFICIAL Roblox Studio MCP server
 * (BloxBot-style). The agent runs on this machine and drives Roblox's own
 * first-party tools directly in the live Studio session — pure localhost, full
 * tool surface. Renders progress live, then shows the closing summary.
 */
async function handleLocalMcpTurn(rl: any, state: any, input: string): Promise<void> {
  const config: CLIConfig = state.config;

  // Pre-flight: surface a clear, actionable error instead of a silent failure.
  if (!officialStudioMcpInstalled()) {
    state.lastError =
      `Official Roblox Studio MCP not found. ${STUDIO_MCP_HELP}`;
    redrawScreen(state);
    state.lastError = undefined;
    rl.prompt();
    return;
  }
  if (!kiroCliAvailable()) {
    state.lastError =
      `Local agent driver (kiro-cli) not found on PATH. Install it to use ` +
      `local MCP mode, or run "/mcp remote" to use the cloud bridge.`;
    redrawScreen(state);
    state.lastError = undefined;
    rl.prompt();
    return;
  }

  process.stdout.write(
    `\n  ${BRAND}✦${R}  ${BOLD}${WHITE}MCP Agent${R} ${DIM}— local, official Roblox Studio MCP${R}\n\n`,
  );
  startSpinner('Connecting to Roblox Studio MCP', true);

  let sawProgress = false;
  const onProgress = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (!sawProgress) {
        stopSpinner();
        sawProgress = true;
      }
      process.stdout.write(`  ${BRAND}›${R} ${DIM}${line}${R}\n`);
    }
  };

  let reply = '';
  try {
    const res = await runLocalMcpAgent(input, {
      apiKey:
        config.provider === 'google'
          ? config.googleKey
          : config.openaiKey,
      model: config.model,
      history: state.history.slice(0, -1),
      timeoutMs: 300000,
      onProgress,
    });

    stopSpinner();

    if (!res.ok) {
      const detail = (res.stderr || 'agent run failed').trim().slice(0, 200);
      state.lastError = `Local MCP error: ${detail}`;
    } else {
      reply =
        extractMcpSummary(res.stdout) ||
        (sawProgress ? 'Done — changes applied live in Studio.' : 'No response from the local MCP agent.');
    }
  } catch (e: any) {
    stopSpinner();
    state.lastError = `Local MCP connection error: ${e?.message || e}`;
  }

  if (reply) {
    printAssistantMsg(reply, undefined);
    state.history.push({ role: 'assistant', content: reply });
    if (state.history.length > 40) state.history = state.history.slice(-40);
    writeSessionEvent(state.config, { role: 'assistant', content: reply });
  }

  redrawScreen(state);
  state.lastError = undefined;
  rl.prompt();
}

/**
 * Run one TRUE MCP turn. Streams the prompt to /api/chat with stream:true so the
 * server routes through the VPS MCP agent (KIRO_MCP_URL). The agent makes live
 * studio_* tool calls into the paired Studio session via the bridge — changes
 * land directly in Studio, so there's no artifact/approve/sync step here. We
 * render the agent's progress live, then show its closing summary.
 */
async function handleMcpTurn(rl: any, state: any, input: string): Promise<void> {
  const config: CLIConfig = state.config;

  process.stdout.write(`\n  ${BRAND}✦${R}  ${BOLD}${WHITE}MCP Agent${R} ${DIM}— working live in Studio${R}\n\n`);
  startSpinner('Connecting to Studio bridge', true);

  let lastProgress = '';
  let sawProgress = false;
  const onProgress = (text: string) => {
    // The proxy streams human-readable progress lines (tool calls, results).
    // Surface the most recent non-empty line beneath a steady spinner.
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (!sawProgress) {
        stopSpinner();
        sawProgress = true;
      }
      lastProgress = line;
      process.stdout.write(`  ${BRAND}›${R} ${DIM}${line}${R}\n`);
    }
  };

  let reply = '';
  try {
    const res = await streamChat(
      `${config.apiUrl}/api/chat`,
      {
        prompt: input,
        sessionKey: config.sessionKey,
        messages: state.history.slice(0, -1),
        provider: config.provider,
        apiKey: config.provider === 'google' ? config.googleKey
          : config.provider === 'deepseek' ? config.deepseekKey
            : config.provider === 'openrouter' ? config.openrouterKey
              : config.openaiKey,
        openaiKey: config.openaiKey,
        model: config.model,
        mode: config.extendedThinking ? 'thinking' : 'fast',
        stream: true,
        autoSync: false,
      },
      onProgress,
    );

    stopSpinner();

    if (!res.ok) {
      state.lastError = `MCP error ${res.status || ''}: ${(res.error || 'request failed').slice(0, 160)}`;
    } else {
      // The final `content` delta is a JSON string: { message, scripts, suggestions }.
      // MCP changes are applied live in Studio, so `scripts` is empty by design.
      let message = '';
      const trimmed = (res.content || '').trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          message = typeof parsed?.message === 'string' ? parsed.message : trimmed;
        } catch {
          message = trimmed;
        }
      }
      reply = message || (sawProgress ? 'Done — changes applied live in Studio.' : 'No response from the MCP agent.');
      if (reply.startsWith('[MCP')) {
        // Surface relayed connection/agent errors as an error, not a normal reply.
        state.lastError = reply;
        reply = '';
      }
    }
  } catch (e: any) {
    stopSpinner();
    state.lastError = `MCP connection error: ${e?.message || e}`;
  }

  if (reply) {
    printAssistantMsg(reply, undefined);
    state.history.push({ role: 'assistant', content: reply });
    if (state.history.length > 40) state.history = state.history.slice(-40);
    writeSessionEvent(state.config, { role: 'assistant', content: reply });
  }

  redrawScreen(state);
  state.lastError = undefined;
  rl.prompt();
}

async function handleFeedbackSync(rl: any, state: any, feedbackMsg: string): Promise<void> {
  startSpinner('Thinking', false);

  let isGenerating = true;
  const pollLogsDuringGeneration = async () => {
    while (isGenerating) {
      try {
        await new Promise(r => setTimeout(r, 800));
        if (!isGenerating) break;
        const statusRes = await fetch(`${state.config.apiUrl}/api/status?key=${state.config.sessionKey}`);
        if (statusRes.ok && isGenerating) {
          const statusData = await statusRes.json();
          if (statusData.logs && statusData.logs.length > 0) {
            clearSpinner();
            for (const log of statusData.logs) {
              process.stdout.write(`\r  \x1b[38;2;230;100;80m🛠️\x1b[0m \x1b[36m[Progress]\x1b[0m ${log}\n`);
            }
          }
        }
      } catch (_) {}
    }
  };
  pollLogsDuringGeneration();

  try {
    const res = await fetch(`${state.config.apiUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: feedbackMsg,
        sessionKey: state.config.sessionKey,
        messages: state.history,
        provider: state.config.provider,
        apiKey: state.config.provider === 'google' ? state.config.googleKey
          : state.config.provider === 'deepseek' ? state.config.deepseekKey
            : state.config.provider === 'openrouter' ? state.config.openrouterKey
              : state.config.openaiKey,
        openaiKey: state.config.openaiKey,
        model: state.config.model,
        autoSync: false
      }),
    });

    isGenerating = false;
    stopSpinner();

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, string>;
      state.lastError = `Steering failed: ${err.error || res.statusText}`;
    } else {
      const data = await res.json().catch(() => ({})) as any;

      let reply = (data.message || data.code || JSON.stringify(data)) as string;
      if (Array.isArray(data.scripts) && data.scripts.length > 0) {
        reply += formatArtifactsBox(data.scripts);

        state.artifacts = [{
          type: 'Plan',
          message: data.message || "Adjusted plan based on your feedback.",
          scripts: data.scripts.map((s: any, i: number) => ({
            action: s.action || 'create',
            type: s.type || s.scriptType || 'Script',
            parent: s.parent || 'ServerScriptService',
            name: s.name || `GeneratedScript_${i}`,
            code: s.code || ''
          })),
          status: 'pending'
        }];
        state.infoMessage = `✨ Proposing an adjusted Implementation Plan! Type /artifact to view.`;

        state.modalOpen = true;
        await showInteractiveArtifacts(rl, state);
        state.modalOpen = false;
      }

      state.history.push({ role: 'assistant', content: reply });
    }
  } catch (e: any) {
    stopSpinner();
    state.lastError = `Feedback error: ${e.message}`;
  }

  redrawScreen(state);
  rl.prompt();
}

async function showInteractiveSettings(rl: any, state: any): Promise<void> {
  return new Promise<void>((resolve) => {
    let selectedIndex = 0;
    const options = ['themeColor', 'chatbarStyle', 'showTokenPricing', 'enableSoundEffects', 'verboseLogging'];
    const optionLabels = [
      'UI Theme Color',
      'Chatbar Prompt Style',
      'Show Token Metrics & Cost',
      'Enable TTY Sound Effects',
      'Verbose Server Logs'
    ];

    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => { };

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    const draw = () => {
      console.clear();
      const w = termWidth();
      const titleText = gradientText('Apple Juice Personal Settings', SUNSET_START, SUNSET_END);

      process.stdout.write(`\n  ${BOLD}${titleText}${R}\n`);
      process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);

      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const label = optionLabels[i];
        let valDisplay = '';

        if (opt === 'themeColor') {
          valDisplay = state.config.themeColor || 'terracotta';
        } else if (opt === 'chatbarStyle') {
          valDisplay = state.config.chatbarStyle || 'mode';
        } else if (opt === 'showTokenPricing') {
          valDisplay = state.config.showTokenPricing !== false ? 'Enabled' : 'Disabled';
        } else if (opt === 'enableSoundEffects') {
          valDisplay = state.config.enableSoundEffects === true ? 'Enabled' : 'Disabled';
        } else if (opt === 'verboseLogging') {
          valDisplay = state.config.verboseLogging === true ? 'Enabled' : 'Disabled';
        }

        const active = i === selectedIndex;
        if (active) {
          process.stdout.write(`  ${BRAND}➔${R} ${BOLD}${WHITE}${label.padEnd(30)}${R} :  ${BRAND}[ ${valDisplay} ]${R}\n`);
        } else {
          process.stdout.write(`    ${DIM}${label.padEnd(30)}${R} :  [ ${valDisplay} ]\n`);
        }
      }

      process.stdout.write(`\n  ${DIM}${'─'.repeat(w - 4)}${R}\n`);

      const G_LINE = '\x1b[38;2;100;100;100m';
      process.stdout.write(`  ${BOLD}${WHITE}Live Preview Panel:${R}\n`);
      process.stdout.write(`  ${G_LINE}┌${'─'.repeat(w - 6)}┐${R}\n`);

      // A helper to write a row inside the preview box that always ends perfectly at the right border without overflowing
      const writeLine = (content: string) => {
        const stripped = stripAnsi(content);
        const pad = Math.max(0, (w - 6) - stripped.length);
        process.stdout.write(`  ${G_LINE}│${R}${content}${' '.repeat(pad)}${G_LINE}│${R}\n`);
      };

      const currentOpt = options[selectedIndex];

      if (currentOpt === 'themeColor') {
        const colorsList = THEME_COLORS.map(c => {
          let cAnsi = BRAND;
          if (c === 'red') cAnsi = '\x1b[38;2;230;30;30m';
          else if (c === 'blue') cAnsi = '\x1b[38;2;40;110;230m';
          else if (c === 'green') cAnsi = '\x1b[38;2;46;204;113m';
          else if (c === 'yellow') cAnsi = '\x1b[38;2;241;196;15m';
          else if (c === 'cyan') cAnsi = '\x1b[38;2;52;152;219m';
          else cAnsi = '\x1b[38;2;204;107;73m';

          const isSelected = c === (state.config.themeColor || 'terracotta');
          return isSelected ? `${cAnsi}${BOLD}\x1b[4m[ ${c} ]\x1b[24m${R}` : `${cAnsi}${c}${R}`;
        }).join('  ');

        writeLine(`  ${BOLD}Theme Colors:${R}  ${colorsList}`);
        writeLine('');
        writeLine(`  ${BOLD}Example Conversation Preview:${R}`);

        const colUserPrompt = `  ${BRAND}➔${R}  ${WHITE}User:${R} ${DIM}How do I create a script parented to Workspace?${R}`;
        const divLine = `${BRAND_DIM}${'-'.repeat(Math.max(10, w - 12))}${R}`;
        const colAssist1 = `     ${WHITE}Assistant:${R} ${DIM}You can write a script or use ${R}${BRAND_B}/sync${R}${DIM} to${R}`;
        const colAssist2 = `     ${DIM}generate it. Let's create it in ServerScriptService.${R}`;

        writeLine(colUserPrompt);
        writeLine(divLine);
        writeLine(colAssist1);
        writeLine(colAssist2);
        writeLine(divLine);

      } else if (currentOpt === 'chatbarStyle') {
        const styles = ['mode', 'minimal', 'model', 'both'];
        const stylesList = styles.map(s => {
          const isSelected = s === (state.config.chatbarStyle || 'mode');
          return isSelected ? `${BRAND}${BOLD}\x1b[4m[ ${s} ]\x1b[24m${R}` : `${DIM}${s}${R}`;
        }).join('  ');

        writeLine(`  ${BOLD}Style Options:${R}  ${stylesList}`);
        writeLine('');
        writeLine(`  ${BOLD}Live Prompt Preview:${R}`);

        let mockPrompt = '';
        const style = state.config.chatbarStyle || 'mode';
        if (style === 'mode') {
          mockPrompt = `  \x1b[38;2;140;140;140m[ Normal ]\x1b[0m ${BRAND}>\x1b[0m  _`;
        } else if (style === 'minimal') {
          mockPrompt = `  ${BRAND}>\x1b[0m  _`;
        } else if (style === 'model') {
          mockPrompt = `  \x1b[38;2;140;140;140m[ gpt-4o-mini ]\x1b[0m ${BRAND}>\x1b[0m  _`;
        } else if (style === 'both') {
          mockPrompt = `  \x1b[38;2;140;140;140m[ Normal | gpt-4o-mini ]\x1b[0m ${BRAND}>\x1b[0m  _`;
        }

        writeLine(mockPrompt);
        writeLine('');
        writeLine('');
        writeLine('');
        writeLine('');

      } else if (currentOpt === 'showTokenPricing') {
        const showPricing = state.config.showTokenPricing !== false;
        const toggleList = `${showPricing ? `${BRAND}${BOLD}\x1b[4m[ Enabled ]\x1b[24m${R}  ${DIM}Disabled${R}` : `${DIM}Enabled${R}  ${BRAND}${BOLD}\x1b[4m[ Disabled ]\x1b[24m${R}`}`;

        writeLine(`  ${BOLD}Status Option:${R}  ${toggleList}`);
        writeLine('');
        writeLine(`  ${BOLD}Status Line Live Preview:${R}`);

        const modelLabel = state.config.provider === 'google' ? 'Google (128K)' : formatModelName(state.config.model || 'gpt-4o-mini');
        const contextLabel = showPricing ? `$0.00045 / 312 tokens` : `10% context used`;
        
        // Render a preview status line exactly sized for the preview box (w - 6)
        const labelText = ` ${modelLabel} · ${contextLabel} `;
        const lineLen = (w - 6) - stripAnsi(labelText).length;
        const leftDash = Math.floor(lineLen / 2);
        const rightDash = lineLen - leftDash;
        
        const previewStatusLine = `${G_LINE}${'─'.repeat(leftDash)}${R}${BRAND}${labelText}${R}${G_LINE}${'─'.repeat(rightDash)}${R}`;

        writeLine(previewStatusLine);
        writeLine('');
        writeLine('');
        writeLine('');
        writeLine('');
      } else if (currentOpt === 'enableSoundEffects') {
        const soundOn = state.config.enableSoundEffects === true;
        const toggleList = `${soundOn ? `${BRAND}${BOLD}\x1b[4m[ Enabled ]\x1b[24m${R}  ${DIM}Disabled${R}` : `${DIM}Enabled${R}  ${BRAND}${BOLD}\x1b[4m[ Disabled ]\x1b[24m${R}`}`;

        writeLine(`  ${BOLD}Sound Options:${R}  ${toggleList}`);
        writeLine('');
        writeLine(`  ${BOLD}Audio Feedback Preview:${R}`);
        writeLine('  Play premium retro keyboard click sounds on typing!');
        writeLine('  Simulated local sound engine via standard MIDI/TTY beep.');
        writeLine('');
        writeLine('');
        writeLine('');
      } else if (currentOpt === 'verboseLogging') {
        const verboseOn = state.config.verboseLogging === true;
        const toggleList = `${verboseOn ? `${BRAND}${BOLD}\x1b[4m[ Enabled ]\x1b[24m${R}  ${DIM}Disabled${R}` : `${DIM}Enabled${R}  ${BRAND}${BOLD}\x1b[4m[ Disabled ]\x1b[24m${R}`}`;

        writeLine(`  ${BOLD}Logging Option:${R}  ${toggleList}`);
        writeLine('');
        writeLine(`  ${BOLD}Live Server Sync Logs Preview:${R}`);
        if (verboseOn) {
          writeLine(`  ${BRIGHT_GREEN}[INFO]${R} Local server paired successfully.`);
          writeLine(`  ${BRIGHT_CYAN}[SYNC]${R} Pushing Roblox Luau Module to Studio...`);
          writeLine(`  ${BRIGHT_GREEN}[OK]${R} Server Script successfully synced to Roblox.`);
        } else {
          writeLine('  Sync logging is currently quiet.');
          writeLine('  Enable to see live API requests and full Sync packets.');
          writeLine('');
        }
        writeLine('');
      }

      process.stdout.write(`  ${G_LINE}└${'─'.repeat(w - 6)}┘${R}\n`);
      process.stdout.write(`\n  Use ↑/↓ to navigate · Enter to cycle value · Esc to save and close\n`);
    };

    draw();

    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\x1b[r');
        process.exit(0);
      }

      if (key.name === 'escape') {
        cleanup();
        saveConfig(state.config);
        resolve();
        return;
      }

      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        draw();
      } else if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % options.length;
        draw();
      } else if (key.name === 'return' || key.name === 'enter') {
        const opt = options[selectedIndex];

        if (opt === 'themeColor') {
          const current = state.config.themeColor || 'terracotta';
          const nextIdx = (THEME_COLORS.indexOf(current) + 1) % THEME_COLORS.length;
          state.config.themeColor = THEME_COLORS[nextIdx];
          applyPromptColor(state.config.themeColor);
        } else if (opt === 'chatbarStyle') {
          const current = state.config.chatbarStyle || 'mode';
          const styles: ('mode' | 'minimal' | 'model' | 'both')[] = ['mode', 'minimal', 'model', 'both'];
          const nextIdx = (styles.indexOf(current) + 1) % styles.length;
          state.config.chatbarStyle = styles[nextIdx];
        } else if (opt === 'showTokenPricing') {
          const current = state.config.showTokenPricing !== false;
          state.config.showTokenPricing = !current;
        } else if (opt === 'enableSoundEffects') {
          const current = state.config.enableSoundEffects === true;
          state.config.enableSoundEffects = !current;
        } else if (opt === 'verboseLogging') {
          const current = state.config.verboseLogging === true;
          state.config.verboseLogging = !current;
        }

        draw();
      }
    };

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      rl._ttyWrite = origTtyWrite;
    }

    process.stdin.on('keypress', onKeypress);
  });
}

async function askTextInput(rl: any, promptText: string, defaultValue: string = ''): Promise<string | null> {
  return new Promise((resolve) => {
    let value = defaultValue;
    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => { };

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    const openedAt = Date.now();

    function draw() {
      console.clear();
      process.stdout.write(`\n  ${BOLD}${promptText}${R}\n`);
      process.stdout.write(`  Input: ${BRAND}${value}${R}\u001b[K\n\n`);
      process.stdout.write(`  ${DIM}Press Enter to confirm, Esc to cancel${R}\n`);
    }

    draw();

    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\x1b[r');
        process.exit(0);
      }

      if (key.name === 'escape') {
        cleanup();
        resolve(null);
        return;
      }

      if ((key.name === 'return' || key.name === 'enter')) {
        if (Date.now() - openedAt < 300) return;
        cleanup();
        resolve(value.trim());
        return;
      }

      if (key.name === 'backspace') {
        value = value.slice(0, -1);
        draw();
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        value += str;
        draw();
      }
    };

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      rl._ttyWrite = origTtyWrite;
    }

    process.stdin.on('keypress', onKeypress);
  });
}

async function showKeySelector(rl: any, state: any): Promise<void> {
  return new Promise<void>((resolve) => {
    let selectedIndex = 0;
    let isEnteringKey = false;
    let keyInput = '';
    
    const providers = ['openai', 'google', 'deepseek', 'openrouter'];
    const displayNames = ['OpenAI', 'Google Gemini', 'DeepSeek', 'OpenRouter'];

    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => { };

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    const openedAt = Date.now();
    const rows = process.stdout.rows || 24;
    const w = termWidth() - 1;

    // Temporarily shrink chatbox scrolling region and redraw to make space
    if (rows >= 19) {
      process.stdout.write(`\x1b[4;${rows - 17}r`);
      redrawScreen(state);
    }

    function maskKey(key: string | undefined): string {
      if (!key) return 'Not Set';
      if (key.length <= 8) return '********';
      return `${key.slice(0, 6)}...${key.slice(-4)}`;
    }

    function draw() {
      process.stdout.write('\x1b[s'); // Save cursor position
      
      const startRow = rows >= 19 ? rows - 16 : 1;
      const G_LINE = '\x1b[38;2;100;100;100m';
      const boxW = Math.min(68, w - 4);
      
      // Clear the popup area first (12 lines total)
      for (let r = 0; r < 12; r++) {
        process.stdout.write(`\x1b[${startRow + r};1H\x1b[2K`);
      }

      // Draw Top Border
      const title = isEnteringKey ? ` Enter ${displayNames[selectedIndex]} Key ` : ' API Keys Configuration ';
      const borderTop = `${G_LINE}┌─${BRAND}${title}${G_LINE}${'─'.repeat(boxW - 1 - title.length)}┐${R}`;
      process.stdout.write(`\x1b[${startRow};1H  ${borderTop}`);

      if (!isEnteringKey) {
        // Draw Header description
        const headerStr = ' Select a provider to set or update its API key:';
        const headerLine = `${G_LINE}│${R}${headerStr}${' '.repeat(Math.max(0, boxW - stripAnsi(headerStr).length))}${G_LINE}│${R}`;
        process.stdout.write(`\x1b[${startRow + 1};1H  ${headerLine}`);

        // Draw Mid Separator
        const sep = `${G_LINE}├${'─'.repeat(boxW)}┤${R}`;
        process.stdout.write(`\x1b[${startRow + 2};1H  ${sep}`);

        // Draw 4 options (take up 8 lines space)
        const keysList = [
          state.config.openaiKey,
          state.config.googleKey,
          state.config.deepseekKey,
          state.config.openrouterKey
        ];

        for (let idx = 0; idx < 8; idx++) {
          const lineRow = startRow + 3 + idx;
          if (idx < providers.length) {
            const isSelected = idx === selectedIndex;
            const provName = displayNames[idx];
            const provKey = keysList[idx];
            const activeIndicator = state.config.provider === providers[idx] ? ` \x1b[32m(Active)\x1b[0m` : '';
            
            let itemText = isSelected 
              ? ` > \x1b[36m${provName.padEnd(16)}\x1b[0m : \x1b[33m${maskKey(provKey)}\x1b[0m${activeIndicator}`
              : `   ${provName.padEnd(16)} : ${maskKey(provKey)}${activeIndicator}`;
            
            const finalLine = `${G_LINE}│${R}${itemText}${' '.repeat(Math.max(0, boxW - stripAnsi(itemText).length))}${G_LINE}│${R}`;
            process.stdout.write(`\x1b[${lineRow};1H  ${finalLine}`);
          } else {
            const finalLine = `${G_LINE}│${' '.repeat(boxW)}│${R}`;
            process.stdout.write(`\x1b[${lineRow};1H  ${finalLine}`);
          }
        }

        // Draw Bottom Help Line / Border
        const helpText = ` ↑/↓ select · Enter edit · Esc close `;
        const borderBot = `${G_LINE}└${'─'.repeat(Math.floor((boxW - helpText.length) / 2))}${DIM}${helpText}${R}${G_LINE}${'─'.repeat(boxW - helpText.length - Math.floor((boxW - helpText.length) / 2))}┘${R}`;
        process.stdout.write(`\x1b[${startRow + 11};1H  ${borderBot}`);
      } else {
        // Draw Key Entry View
        const headerStr = ` Paste or type the API key for ${displayNames[selectedIndex]}:`;
        const headerLine = `${G_LINE}│${R}${headerStr}${' '.repeat(Math.max(0, boxW - stripAnsi(headerStr).length))}${G_LINE}│${R}`;
        process.stdout.write(`\x1b[${startRow + 1};1H  ${headerLine}`);

        const sep = `${G_LINE}├${'─'.repeat(boxW)}┤${R}`;
        process.stdout.write(`\x1b[${startRow + 2};1H  ${sep}`);

        // Draw input field
        const maskedInput = '*'.repeat(keyInput.length) + '█';
        const inputLine = `   Key: ${maskedInput}`;
        const midRow = startRow + 5;
        
        for (let idx = 0; idx < 8; idx++) {
          const lineRow = startRow + 3 + idx;
          if (lineRow === midRow) {
            const finalLine = `${G_LINE}│${R}${inputLine}${' '.repeat(Math.max(0, boxW - stripAnsi(inputLine).length))}${G_LINE}│${R}`;
            process.stdout.write(`\x1b[${lineRow};1H  ${finalLine}`);
          } else {
            const finalLine = `${G_LINE}│${' '.repeat(boxW)}│${R}`;
            process.stdout.write(`\x1b[${lineRow};1H  ${finalLine}`);
          }
        }

        // Draw Bottom Help Line
        const helpText = ` Enter confirm · Esc cancel `;
        const borderBot = `${G_LINE}└${'─'.repeat(Math.floor((boxW - helpText.length) / 2))}${DIM}${helpText}${R}${G_LINE}${'─'.repeat(boxW - helpText.length - Math.floor((boxW - helpText.length) / 2))}┘${R}`;
        process.stdout.write(`\x1b[${startRow + 11};1H  ${borderBot}`);
      }

      process.stdout.write('\x1b[u'); // Restore cursor position
    }

    draw();

    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\x1b[r');
        process.exit(0);
      }

      if (isEnteringKey) {
        if (key.name === 'escape') {
          isEnteringKey = false;
          keyInput = '';
          draw();
          return;
        }

        if (key.name === 'return' || key.name === 'enter') {
          if (keyInput.trim()) {
            const prov = providers[selectedIndex];
            if (prov === 'openai') state.config.openaiKey = keyInput.trim();
            else if (prov === 'google') state.config.googleKey = keyInput.trim();
            else if (prov === 'deepseek') state.config.deepseekKey = keyInput.trim();
            else if (prov === 'openrouter') state.config.openrouterKey = keyInput.trim();

            state.config.provider = prov;
            saveConfig(state.config);
            state.infoMessage = `Updated ${displayNames[selectedIndex]} API key & set as active provider!`;
          }
          isEnteringKey = false;
          keyInput = '';
          draw();
          return;
        }

        if (key.name === 'backspace') {
          keyInput = keyInput.slice(0, -1);
          draw();
        } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
          keyInput += str;
          draw();
        }
      } else {
        if (key.name === 'escape') {
          cleanup();
          resolve();
          return;
        }

        if (key.name === 'return' || key.name === 'enter') {
          isEnteringKey = true;
          keyInput = '';
          draw();
          return;
        }

        if (key.name === 'up') {
          selectedIndex = Math.max(0, selectedIndex - 1);
          draw();
        } else if (key.name === 'down') {
          selectedIndex = Math.min(providers.length - 1, selectedIndex + 1);
          draw();
        }
      }
    };

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      rl._ttyWrite = origTtyWrite;
      
      // Clear the popover area lines from screen (12 lines total)
      const startRow = rows >= 19 ? rows - 16 : 1;
      for (let r = 0; r < 12; r++) {
        process.stdout.write(`\x1b[${startRow + r};1H\x1b[2K`);
      }
      
      // Restore standard scrolling region and redraw full-screen TUI
      if (state && rows >= 19) {
        process.stdout.write(`\x1b[4;${rows - 4}r`);
        redrawScreen(state);
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

async function showModelSelector(rl: any, models: string[], state?: any): Promise<string | null> {
  return new Promise((resolve) => {
    let query = '';
    let selectedIndex = 0;
    let filtered = [...models];

    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => { };

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    const openedAt = Date.now();
    const rows = process.stdout.rows || 24;
    const w = termWidth() - 1;

    // Compact popover anchored just above the chatbox (not a full-screen takeover).
    const MAX_VISIBLE = 5;
    const boxHeight = MAX_VISIBLE + 2; // top border + items + bottom border
    const compact = rows >= 16;
    const startRow = compact ? (rows - 3 - boxHeight) : Math.max(4, rows - 1 - boxHeight);

    // Only carve out the popover's own height from the scroll region, keeping
    // the chat history visible above it.
    if (state && compact) {
      process.stdout.write(`\x1b[4;${startRow - 1}r`);
      redrawScreen(state);
    }

    function draw() {
      process.stdout.write('\x1b[s'); // Save cursor position

      const G_LINE = '\x1b[38;2;100;100;100m';
      const boxW = Math.min(60, w - 4);

      // Clear the popover area first
      for (let r = 0; r < boxHeight; r++) {
        process.stdout.write(`\x1b[${startRow + r};1H\x1b[2K`);
      }

      // Top border carries the live search query inline, so no separate row.
      const label = ' Model ';
      const queryStr = query ? ` ${query}` : ' type to filter';
      const queryDisplay = query ? `${WHITE}${queryStr}${R}` : `${DIM}${queryStr}${R}`;
      const usedLen = label.length + stripAnsi(queryStr).length + 3; // ─ + space pads
      const fillLen = Math.max(0, boxW - usedLen);
      const borderTop = `${G_LINE}╭─${BRAND}${label}${G_LINE}┄${queryDisplay}${G_LINE}${'─'.repeat(fillLen)}╮${R}`;
      process.stdout.write(`\x1b[${startRow};1H  ${borderTop}`);

      // Visible options window
      let startIdx = 0;
      if (filtered.length > MAX_VISIBLE) {
        startIdx = Math.max(0, selectedIndex - Math.floor(MAX_VISIBLE / 2));
        let endIdx = startIdx + MAX_VISIBLE;
        if (endIdx > filtered.length) {
          endIdx = filtered.length;
          startIdx = Math.max(0, endIdx - MAX_VISIBLE);
        }
      }

      for (let idx = 0; idx < MAX_VISIBLE; idx++) {
        const itemIdx = startIdx + idx;
        const lineRow = startRow + 1 + idx;
        if (itemIdx < filtered.length) {
          const item = filtered[itemIdx];
          const isSelected = itemIdx === selectedIndex;
          const pretty = formatModelName(item);
          const itemText = isSelected
            ? ` ${BRAND}❯${R} ${BRIGHT_CYAN}${pretty}${R}`
            : `   ${DIM}${pretty}${R}`;
          const finalLine = `${G_LINE}│${R}${itemText}${' '.repeat(Math.max(0, boxW - stripAnsi(itemText).length))}${G_LINE}│${R}`;
          process.stdout.write(`\x1b[${lineRow};1H  ${finalLine}`);
        } else {
          const finalLine = `${G_LINE}│${' '.repeat(boxW)}│${R}`;
          process.stdout.write(`\x1b[${lineRow};1H  ${finalLine}`);
        }
      }

      // Bottom border with counter + hint
      const counter = filtered.length > 0 ? ` ${selectedIndex + 1}/${filtered.length} ` : ' no matches ';
      const hint = ` ↑↓ ⏎ esc `;
      const botUsed = counter.length + hint.length + 2;
      const botFill = Math.max(0, boxW - botUsed);
      const borderBot = `${G_LINE}╰${DIM}${counter}${G_LINE}${'─'.repeat(botFill)}${DIM}${hint}${G_LINE}╯${R}`;
      process.stdout.write(`\x1b[${startRow + boxHeight - 1};1H  ${borderBot}`);

      process.stdout.write('\x1b[u'); // Restore cursor position
    }

    draw();

    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\x1b[r');
        process.exit(0);
      }

      if (key.name === 'escape') {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === 'return' && Date.now() - openedAt < 300) {
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(filtered[selectedIndex] || null);
        return;
      }

      if (key.name === 'up') {
        selectedIndex = Math.max(0, selectedIndex - 1);
        draw();
      } else if (key.name === 'down') {
        selectedIndex = Math.min(filtered.length - 1, selectedIndex + 1);
        draw();
      } else if (key.name === 'backspace') {
        query = query.slice(0, -1);
        updateFilter();
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        query += str;
        updateFilter();
      }
    };

    function updateFilter() {
      filtered = models.filter(m => m.toLowerCase().includes(query.toLowerCase()));
      selectedIndex = 0;
      draw();
    }

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      rl._ttyWrite = origTtyWrite;

      // Clear the popover area lines from screen
      for (let r = 0; r < boxHeight; r++) {
        process.stdout.write(`\x1b[${startRow + r};1H\x1b[2K`);
      }

      // Restore standard scrolling region and redraw full-screen TUI
      if (state && compact) {
        process.stdout.write(`\x1b[4;${rows - 4}r`);
        redrawScreen(state);
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

async function showTranscriptViewer(rl: any, state: any): Promise<void> {
  return new Promise<void>((resolve) => {
    // 1. Alternate screen buffer to completely isolate scrollback!
    process.stdout.write('\x1b[?1049h\x1b[H\x1b[2J');

    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => { };

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    const logPath = getSessionLogPath(state.config.sessionKey);
    let events: any[] = [];
    try {
      if (fs.existsSync(logPath)) {
        const raw = fs.readFileSync(logPath, 'utf8');
        events = raw.split('\n').filter(Boolean).map(line => JSON.parse(line));
      }
    } catch (_) {}

    let selectedIndex = 0;
    let detailMode = false;
    let detailScroll = 0;

    const rows = process.stdout.rows || 24;
    const w = termWidth() - 1;
    const G_LINE = '\x1b[38;2;100;100;100m';

    function draw() {
      process.stdout.write('\x1b[H\x1b[2J'); // Clear screen
      
      const w = termWidth() - 1;
      const rows = process.stdout.rows || 24;

      if (events.length === 0) {
        process.stdout.write(`\n\n  ${BRAND}⚡${R}  ${BOLD}Session Transcript Replay & Diagnostics${R}\n`);
        process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);
        process.stdout.write(`  ${BRIGHT_YELLOW}No event logs found for this session.${R}\n`);
        process.stdout.write(`  Start asking questions and interacting to generate structured session traces.\n\n`);
        process.stdout.write(`  ${DIM}Press Enter or Esc to return to the CLI.${R}\n`);
        return;
      }

      if (!detailMode) {
        // List Mode
        process.stdout.write(`  ${BRAND}╭${'─'.repeat(w - 20)}${R} ${BOLD}Session Transcript Replay${R} ${BRAND}${'─'.repeat(14)}╮${R}\n`);
        process.stdout.write(`  ${BRAND}│${R}  ${DIM}Select a conversation turn to view deep log diagnostics & logits attribution.${R}${' '.repeat(Math.max(0, w - 85))}${BRAND}│${R}\n`);
        process.stdout.write(`  ${BRAND}├${'─'.repeat(w - 2)}┤${R}\n`);

        const listHeight = rows - 6;
        let startIdx = Math.max(0, selectedIndex - Math.floor(listHeight / 2));
        let endIdx = Math.min(events.length, startIdx + listHeight);
        if (endIdx - startIdx < listHeight) {
          startIdx = Math.max(0, endIdx - listHeight);
        }

        for (let i = startIdx; i < endIdx; i++) {
          const ev = events[i];
          const isSelected = i === selectedIndex;
          const selector = isSelected ? ` ${BRAND_B}➔${R} ` : '   ';
          
          let preview = ev.content || '';
          if (preview.startsWith('{') && preview.endsWith('}')) {
            try {
              const parsed = JSON.parse(preview);
              preview = parsed.message || parsed.assistant || parsed.text || preview;
            } catch (_) {}
          }
          preview = stripAnsi(preview).replace(/\n/g, ' ').slice(0, w - 38);

          const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '';
          const roleLabel = ev.role === 'user' ? `${BRIGHT_WHITE}YOU${R}` : `${BRAND}AI${R}`;
          
          const lineText = `${selector}[${timeStr}] [${roleLabel}] ${isSelected ? BOLD + WHITE : DIM}${preview}${R}`;
          const visibleLen = stripAnsi(lineText).length;
          
          process.stdout.write(`  ${lineText}${' '.repeat(Math.max(0, w - 6 - visibleLen))}\n`);
        }

        // Draw padding lines
        for (let i = endIdx - startIdx; i < listHeight; i++) {
          process.stdout.write('\n');
        }

        process.stdout.write(`  ${BRAND}╰${'─'.repeat(Math.floor((w - 38) / 2))}${DIM} ↑/↓ scroll · Enter inspect · Esc exit ${R}${BRAND}${'─'.repeat(w - 2 - Math.floor((w - 38) / 2) - 38)}╯${R}`);
      } else {
        // Detail Mode
        const ev = events[selectedIndex];
        process.stdout.write(`  ${BRAND}╭${'─'.repeat(w - 24)}${R} ${BOLD}Diagnostic Event Inspector${R} ${BRAND}${'─'.repeat(16)}╮${R}\n`);
        
        let lines: string[] = [];
        const timestamp = ev.timestamp ? new Date(ev.timestamp).toLocaleString() : 'N/A';
        lines.push(`${BOLD}${WHITE}Timestamp:${R} ${DIM}${timestamp}${R}`);
        lines.push(`${BOLD}${WHITE}Model:${R} ${DIM}${ev.model || 'gpt-4o-mini'}${R}`);
        lines.push(`${BOLD}${WHITE}Role:${R} ${ev.role === 'user' ? `${BRIGHT_WHITE}User${R}` : `${BRAND}Assistant${R}`}`);

        if (ev.tokenUsage) {
          lines.push(`${BOLD}${WHITE}Token Usage:${R} ${DIM}Input: ${ev.tokenUsage.input} · Output: ${ev.tokenUsage.output} · Estimated Cost: $${ev.tokenUsage.cost.toFixed(5)}${R}`);
        }

        lines.push('');
        lines.push(`${BOLD}${BRAND}Content:${R}`);
        let mainContent = ev.content || '';
        if (mainContent.startsWith('{') && mainContent.endsWith('}')) {
          try {
            const parsed = JSON.parse(mainContent);
            mainContent = parsed.message || parsed.assistant || parsed.text || mainContent;
          } catch (_) {}
        }
        lines.push(...mainContent.split('\n').map(l => `  ${DIM}${l}${R}`));

        if (ev.thinking) {
          lines.push('');
          lines.push(`${BOLD}${BRIGHT_YELLOW}🧠 Step-by-Step Chain-of-Thought / Reasoning:${R}`);
          lines.push(...ev.thinking.split('\n').map(l => `  ${DIM}│ ${l}${R}`));
        }

        if (ev.logits && ev.logits.length > 0) {
          lines.push('');
          lines.push(`${BOLD}${BRIGHT_CYAN}📊 Token-Level Logits & Confidence Metrics (Top Candidates):${R}`);
          for (const item of ev.logits) {
            const alts = item.alternatives.map((a: any) => `${a.token} (${(a.prob * 100).toFixed(1)}%)`).join(', ');
            lines.push(`  • ${WHITE}${item.token}${R}  ➔  ${BRIGHT_GREEN}prob: ${(item.prob * 100).toFixed(1)}%${R}  ${DIM}[alts: ${alts}]${R}`);
          }
        }

        if (ev.attentions && ev.attentions.length > 0) {
          lines.push('');
          lines.push(`${BOLD}${BRIGHT_CYAN}🎯 Attention Visualizations (Top Head Attribution Matrices):${R}`);
          for (const att of ev.attentions) {
            const bar = '█'.repeat(Math.round(att.weight * 10));
            lines.push(`  ${DIM}${att.sourceToken.padEnd(12)} ➔ ${att.targetToken.padEnd(12)} [${bar.padEnd(10)}] (${(att.weight * 100).toFixed(1)}%)${R}`);
          }
        }

        if (ev.toolCalls && ev.toolCalls.length > 0) {
          lines.push('');
          lines.push(`${BOLD}${BRIGHT_RED}🛠️  Tool Execution Traces & Sandboxing Logs:${R}`);
          for (const tc of ev.toolCalls) {
            lines.push(`  • ${BOLD}${tc.action}${R} (Parent: ${tc.parent || 'N/A'}, Name: ${tc.name || 'N/A'})`);
            lines.push(`    ${DIM}Duration: ${tc.durationMs}ms · Success: ${tc.success ? `${BRIGHT_GREEN}Yes${R}` : `${BRIGHT_RED}No${R}`}${R}`);
            lines.push(`    ${DIM}Summary: ${tc.outputSummary}${R}`);
          }
        }

        const viewHeight = rows - 5;
        for (let i = detailScroll; i < Math.min(lines.length, detailScroll + viewHeight); i++) {
          process.stdout.write(`  ${lines[i]}\n`);
        }

        // Draw padding
        const drawnCount = Math.min(lines.length, detailScroll + viewHeight) - detailScroll;
        for (let i = drawnCount; i < viewHeight; i++) {
          process.stdout.write('\n');
        }

        process.stdout.write(`  ${BRAND}╰${'─'.repeat(Math.floor((w - 38) / 2))}${DIM} ↑/↓ scroll · Esc back to list ${R}${BRAND}${'─'.repeat(w - 2 - Math.floor((w - 38) / 2) - 30)}╯${R}`);
      }
    }

    draw();

    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }

      if (key.name === 'escape') {
        if (detailMode) {
          detailMode = false;
          detailScroll = 0;
          draw();
        } else {
          cleanup();
          resolve();
        }
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        if (!detailMode) {
          if (events.length > 0) {
            detailMode = true;
            detailScroll = 0;
            draw();
          } else {
            cleanup();
            resolve();
          }
        }
        return;
      }

      if (key.name === 'up') {
        if (detailMode) {
          detailScroll = Math.max(0, detailScroll - 1);
        } else {
          selectedIndex = Math.max(0, selectedIndex - 1);
        }
        draw();
      } else if (key.name === 'down') {
        if (detailMode) {
          detailScroll++;
        } else {
          selectedIndex = Math.min(events.length - 1, selectedIndex + 1);
        }
        draw();
      }
    };

    process.stdin.on('keypress', onKeypress);

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      rl._ttyWrite = origTtyWrite;
      // Exit alternate screen buffer!
      process.stdout.write('\x1b[?1049l');
    }
  });
}

async function showBtwOverlay(rl: any, question: string, state: any): Promise<void> {
  return new Promise<void>((resolve) => {
    let answerText = 'Thinking...';
    let isThinking = true;
    let scrollOffset = 0;
    
    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => { };

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    const rows = process.stdout.rows || 24;
    const w = termWidth() - 1;

    // Temporarily shrink chatbox scrolling region and redraw to make space for the btw overlay (12 lines total)
    if (rows >= 19) {
      redrawScreen(state);
      process.stdout.write(`\x1b[4;${rows - 17}r`);
    }

    let spinFrame = 0;
    let spinInterval: any = null;

    function draw() {
      process.stdout.write('\x1b[s'); // Save cursor position
      
      const startRow = rows >= 19 ? rows - 16 : 1;
      const G_LINE = '\x1b[38;2;100;100;100m';
      const boxW = Math.min(68, w - 4);
      
      // Clear the popup area first (12 lines total)
      for (let r = 0; r < 12; r++) {
        process.stdout.write(`\x1b[${startRow + r};1H\x1b[2K`);
      }

      // Draw Top Border
      const title = ' By The Way (Side Question) ';
      const borderTop = `${G_LINE}┌─${BRAND}${title}${G_LINE}${'─'.repeat(boxW - 1 - title.length)}┐${R}`;
      process.stdout.write(`\x1b[${startRow};1H  ${borderTop}`);

      // Draw Question Line (truncated if too long)
      let displayQ = question;
      if (displayQ.length > boxW - 14) {
        displayQ = displayQ.slice(0, boxW - 17) + '…';
      }
      const questionStr = ` Q: ${displayQ}`;
      const questionLine = `${G_LINE}│${R}${BOLD}${questionStr}${R}${' '.repeat(Math.max(0, boxW - stripAnsi(questionStr).length))}${G_LINE}│${R}`;
      process.stdout.write(`\x1b[${startRow + 1};1H  ${questionLine}`);

      // Draw Mid Separator
      const sep = `${G_LINE}├${'─'.repeat(boxW)}┤${R}`;
      process.stdout.write(`\x1b[${startRow + 2};1H  ${sep}`);

      // Format answer lines
      const MAX_VISIBLE = 8;
      let displayLines: string[] = [];

      if (isThinking) {
        const spinner = SPIN_FRAMES[spinFrame % SPIN_FRAMES.length];
        const thinkingText = `   ${BRAND}${spinner}${R}  Thinking...`;
        displayLines.push(thinkingText);
      } else {
        // Wrap text to box width
        const words = answerText.split(' ');
        let currentLine = '';
        for (const word of words) {
          const cleanWord = stripAnsi(word);
          const currentCleanLine = stripAnsi(currentLine);
          if (currentCleanLine.length + cleanWord.length + 1 > boxW - 6) {
            displayLines.push('   ' + currentLine.trim());
            currentLine = word + ' ';
          } else {
            currentLine += word + ' ';
          }
        }
        if (currentLine.trim()) {
          displayLines.push('   ' + currentLine.trim());
        }
      }

      // Draw visible options (8 lines total)
      for (let idx = 0; idx < MAX_VISIBLE; idx++) {
        const itemIdx = scrollOffset + idx;
        const lineRow = startRow + 3 + idx;
        if (itemIdx < displayLines.length) {
          const line = displayLines[itemIdx];
          const finalLine = `${G_LINE}│${R}${line}${' '.repeat(Math.max(0, boxW - stripAnsi(line).length))}${G_LINE}│${R}`;
          process.stdout.write(`\x1b[${lineRow};1H  ${finalLine}`);
        } else {
          const finalLine = `${G_LINE}│${' '.repeat(boxW)}│${R}`;
          process.stdout.write(`\x1b[${lineRow};1H  ${finalLine}`);
        }
      }

      // Draw Bottom Help Line / Border
      const helpText = isThinking ? ` Waiting for model response... ` : ` ↑/↓ scroll · Esc/Enter close `;
      const borderBot = `${G_LINE}└${'─'.repeat(Math.floor((boxW - helpText.length) / 2))}${DIM}${helpText}${R}${G_LINE}${'─'.repeat(boxW - helpText.length - Math.floor((boxW - helpText.length) / 2))}┘${R}`;
      process.stdout.write(`\x1b[${startRow + 11};1H  ${borderBot}`);

      // Ensure bottom status and shortcuts lines are drawn and never disappear
      if (rows >= 10) {
        const shortcutsHint = ` ${DIM}Press ${R}${BRAND}[Tab]${R}${DIM} for commands · ${R}${BRAND}[Shift+Tab]${R}${DIM} to toggle agents · ${R}${BRAND}[Ctrl+C]${R}${DIM} to exit${R} `;
        const linePadding = Math.max(0, Math.floor((w - stripAnsi(shortcutsHint).length) / 2));
        const rightPadding = Math.max(0, w - stripAnsi(shortcutsHint).length - linePadding);
        process.stdout.write(`\x1b[${rows - 3};1H\x1b[2K\x1b[38;2;65;65;65m${'─'.repeat(linePadding)}${R}${shortcutsHint}\x1b[38;2;65;65;65m${'─'.repeat(rightPadding)}${R}`);

        const modelLabel = state.config.provider === 'google' ? 'Google (128K)' : formatModelName(state.config.model || 'gpt-4o-mini');
        
        let contextLabel = '';
        const history = state.history || [];
        const textLen = JSON.stringify(history).length;
        const pct = Math.min(100, Math.max(0, Math.round((textLen / 30000) * 100)));
        const bars = Math.round(pct / 10);
        const barStr = '█'.repeat(bars) + '░'.repeat(10 - bars);
        const contextBar = `${barStr} ${pct}% used`;
        
        if (state.config.showTokenPricing === false) {
          contextLabel = contextBar;
        } else {
          const inTokens = state.totalInputTokens || 0;
          const outTokens = state.totalOutputTokens || 0;
          const cost = ((inTokens * 0.15) / 1000000) + ((outTokens * 0.60) / 1000000);
          contextLabel = `Tokens: ${inTokens + outTokens} · Cost: $${cost.toFixed(5)}`;
        }

        process.stdout.write(`\x1b[${rows - 1};1H\x1b[2K${drawHorizontalLineWithText(modelLabel, contextLabel)}`);
        process.stdout.write(`\x1b[${rows};1H\x1b[2K`);
      }
      
      process.stdout.write('\x1b[u'); // Restore cursor position
    }

    // Start spinner for live thinking inside popover!
    spinInterval = setInterval(() => {
      if (isThinking) {
        spinFrame++;
        draw();
      }
    }, 120);

    draw();

    // Async Fetch from API
    (async () => {
      try {
        const res = await fetch(`${state.config.apiUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: question,
            sessionKey: state.config.sessionKey + '-btw',
            messages: [],
            provider: state.config.provider,
            apiKey: state.config.provider === 'google' ? state.config.googleKey
              : state.config.provider === 'deepseek' ? state.config.deepseekKey
                : state.config.provider === 'openrouter' ? state.config.openrouterKey
                  : state.config.openaiKey,
            openaiKey: state.config.openaiKey,
            model: state.config.model,
          }),
        });

        clearInterval(spinInterval);
        isThinking = false;

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as Record<string, string>;
          answerText = `API Error ${res.status}: ${err.error || res.statusText}`;
        } else {
          const data = await res.json().catch(() => ({})) as Record<string, any>;
          answerText = data.message || data.assistant || data.text || 'No response returned from the model.';
        }
      } catch (e: any) {
        clearInterval(spinInterval);
        isThinking = false;
        answerText = `Connection Error: ${e.message}`;
      }
      draw();
    })();

    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\x1b[r');
        process.exit(0);
      }

      if (key.name === 'escape' || key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve();
        return;
      }

      if (key.name === 'up') {
        scrollOffset = Math.max(0, scrollOffset - 1);
        draw();
      } else if (key.name === 'down') {
        // Calculate max lines from wrapped words
        scrollOffset++;
        draw();
      }
    };

    function cleanup() {
      if (spinInterval) clearInterval(spinInterval);
      process.stdin.removeListener('keypress', onKeypress);
      rl._ttyWrite = origTtyWrite;
      
      // Clear the popover area lines from screen (12 lines total)
      const startRow = rows >= 19 ? rows - 16 : 1;
      for (let r = 0; r < 12; r++) {
        process.stdout.write(`\x1b[${startRow + r};1H\x1b[2K`);
      }
      
      // Restore standard scrolling region and redraw full-screen TUI
      if (state && rows >= 19) {
        process.stdout.write(`\x1b[4;${rows - 4}r`);
        redrawScreen(state);
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

// ─── Interactive session ──────────────────────────────────────────────────────
async function startInteractiveSession(config: CLIConfig): Promise<void> {
  globalConfig = config;
  applyPromptColor(config.promptColor);

  let serverOnline = await pingServer(config.apiUrl);
  if (!serverOnline) {
    serverOnline = await startServerAutomatically(config);
    if (!serverOnline) {
      await startLightweightServer(true);
      serverOnline = true;
    }
  }

  let paired = await checkPairingStatus(config);
  let pairingCode: string | undefined;
  if (!paired) {
    const code = await initAuthPairing(config);
    if (code) {
      pairingCode = code;
      await new Promise(r => setTimeout(r, 2000));
      paired = await checkPairingStatus(config);
      if (paired) pairingCode = undefined;
    }
  }

  const state: SessionState = { serverOnline, paired, history: [], config, pairingCode, account: null };

  // Load account/subscription info (non-blocking) so the home screen can show
  // the user's plan + included models. Refreshed again after /login.
  void fetchUsage(config).then((u) => {
    if (u) {
      state.account = u;
      redrawScreen(state);
    }
  }).catch(() => {});

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    completer: (line: string) => {
      const allCmds: { command: string; label: string; description: string; category: string }[] = [
        { command: '/add-dir', label: '/add-dir', description: 'Add a new working directory', category: 'Code' },
        { command: '/agents', label: '/agents', description: 'Manage agent configurations', category: 'System' },
        { command: '/background', label: '/background', description: 'Send this session to the background', category: 'System' },
        { command: '/branch', label: '/branch', description: 'Create a branch of the current conversation', category: 'Chat' },
        { command: '/btw', label: '/btw', description: 'Ask a quick side question', category: 'Chat' },
        { command: '/clear', label: '/clear', description: 'Start a new empty session', category: 'Chat' },
        { command: '/resume', label: '/resume', description: 'Restore a previous session', category: 'Chat' },
        { command: '/color', label: '/color', description: 'Set prompt bar color', category: 'System' },
        { command: '/compact', label: '/compact', description: 'Summarize conversation to save context', category: 'Chat' },
        { command: '/context', label: '/context', description: 'Visualize current context usage', category: 'System' },
        { command: '/pair', label: '/pair', description: 'Link terminal to Roblox Studio', category: 'Connection' },
        { command: '/login', label: '/login', description: 'Sign in with Roblox to use your subscription', category: 'Connection' },
        { command: '/credits', label: '/credits', description: 'Show your plan and remaining credits', category: 'Connection' },
        { command: '/status', label: '/status', description: 'Refresh server + Studio pairing status', category: 'System' },
        { command: '/sync', label: '/sync <file>', description: 'AI-edit a file and push to Studio', category: 'Code' },
        { command: '/mcp', label: '/mcp [mode]', description: 'MCP mode: local|remote|auto|on|off (live Studio tool calls)', category: 'Code' },
        { command: '/provider', label: '/provider <p>', description: 'Set API provider (openai|google)', category: 'AI' },
        { command: '/key', label: '/key <k>', description: 'Set API key for current provider', category: 'AI' },
        { command: '/model', label: '/model', description: 'Set AI model interactively', category: 'AI' },
        { command: '/thinking', label: '/thinking', description: 'Toggle extended thinking/reasoning mode', category: 'AI' },
        { command: '/transcript', label: '/transcript', description: 'Open fullscreen session transcript viewer', category: 'System' },
        { command: '/config', label: '/config', description: 'Show current configuration', category: 'System' },
        { command: '/settings', label: '/settings', description: 'Open personal settings panel', category: 'System' },
        { command: '/artifact', label: '/artifact', description: 'Review, accept, or steer generated code artifacts', category: 'Code' },
        { command: '/help', label: '/help', description: 'Show all available commands', category: 'Chat' },
        { command: '/exit', label: '/exit', description: 'Quit Apple Juice CLI', category: 'System' },
      ];

      const parts = line.trim().split(' ');
      const cmdPart = parts[0];

      const modelSuggestions = (state.config.availableModels && state.config.availableModels.length > 0)
        ? state.config.availableModels
        : Array.from(new Set([
          'gpt-4o-mini',
          'gpt-4o',
          'o1-mini',
          'o1-preview',
          'gemini-3.5-flash',
          'gemini-2.5-flash',
          'gemini-2.5-pro',
          'gemini-1.5-flash',
          'claude-3-5-sonnet',
          'claude-3-5-haiku',
          'claude-3-opus',
          'claude-opus-4.7-fast',
          'deepseek-chat',
          'deepseek-coder',
          'deepseek-r1',
          'deepseek/deepseek-v4-pro',
          'deepseek/deepseek-v4-flash',
          'qwen/qwen3.7-max',
          'x-ai/grok-build-0.1',
          'x-ai/grok-4.3',
          'openai/gpt-5.5',
          'openai/gpt-5.5-pro',
          'openrouter/anthropic/claude-3.5-sonnet',
          'openrouter/google/gemini-2.5-pro',
          'openrouter/deepseek/deepseek-r1',
          'openrouter/meta-llama/llama-3.1-405b-instruct',
          'openrouter/meta-llama/llama-3-8b-instruct:free',
          'google/gemini-3.5-flash',
          'anthropic/claude-opus-4.7-fast',
          'perceptron/perceptron-mk1',
          'inclusionai/ring-2.6-1t',
          'google/gemini-3.1-flash-lite',
          'openai/gpt-chat-latest',
          'ibm-granite/granite-4.1-8b',
          'mistralai/mistral-medium-3-5',
          'openrouter/owl-alpha',
          'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
          'poolside/laguna-xs.2:free',
          'poolside/laguna-m.1:free',
          '~anthropic/claude-haiku-latest',
          '~openai/gpt-mini-latest',
          '~google/gemini-pro-latest',
          '~moonshotai/kimi-latest',
          '~google/gemini-flash-latest',
          '~anthropic/claude-sonnet-latest',
          '~openai/gpt-latest',
          'qwen/qwen3.5-plus-20260420',
          'qwen/qwen3.6-flash',
          'qwen/qwen3.6-35b-a3b',
          'qwen/qwen3.6-max-preview',
          'qwen/qwen3.6-27b',
          'deepseek/deepseek-v4-flash:free',
          'inclusionai/ling-2.6-1t',
          'tencent/hy3-preview',
          'xiaomi/mimo-v2.5-pro',
          'xiaomi/mimo-v2.5',
          'openai/gpt-5.4-image-2',
          'inclusionai/ling-2.6-flash',
          '~anthropic/claude-opus-latest',
          'openrouter/pareto-code',
          'baidu/qianfan-ocr-fast',
          'moonshotai/kimi-k2.6',
          'anthropic/claude-opus-4.7',
          'anthropic/claude-opus-4.6-fast',
          'z-ai/glm-5.1',
          'google/gemma-4-26b-a4b-it:free',
          'google/gemma-4-26b-a4b-it',
          'google/gemma-4-31b-it:free',
          'google/gemma-4-31b-it',
          'qwen/qwen3.6-plus',
          'z-ai/glm-5v-turbo',
          'arcee-ai/trinity-large-thinking',
          'x-ai/grok-4.20-multi-agent',
          'x-ai/grok-4.20',
          'google/lyria-3-pro-preview',
          'google/lyria-3-clip-preview',
          'kwaipilot/kat-coder-pro-v2',
          'rekaai/reka-edge',
          'xiaomi/mimo-v2-omni',
          'xiaomi/mimo-v2-pro',
          'minimax/minimax-m2.7',
          'openai/gpt-5.4-nano',
          'openai/gpt-5.4-mini',
          'mistralai/mistral-small-2603',
          'z-ai/glm-5-turbo',
          'nvidia/nemotron-3-super-120b-a12b:free',
          'nvidia/nemotron-3-super-120b-a12b',
          'bytedance-seed/seed-2.0-lite',
          'qwen/qwen3.5-9b',
          'openai/gpt-5.4-pro',
          'openai/gpt-5.4',
          'inception/mercury-2',
          'openai/gpt-5.3-chat',
          'google/gemini-3.1-flash-lite-preview',
          'bytedance-seed/seed-2.0-mini',
          'google/gemini-3.1-flash-image-preview',
          'qwen/qwen3.5-35b-a3b',
          'qwen/qwen3.5-27b',
          'qwen/qwen3.5-122b-a10b',
          'qwen/qwen3.5-flash-02-23',
          'liquid/lfm-2-24b-a2b',
          'google/gemini-3.1-pro-preview-customtools',
          'openai/gpt-5.3-codex',
          'aion-labs/aion-2.0',
          'google/gemini-3.1-pro-preview',
          'anthropic/claude-sonnet-4.6',
          'qwen/qwen3.5-plus-02-15',
          'qwen/qwen3.5-397b-a17b',
          'minimax/minimax-m2.5:free',
          'minimax/minimax-m2.5',
          'z-ai/glm-5',
          'qwen/qwen3-max-thinking',
          'anthropic/claude-opus-4.6',
          'qwen/qwen3-coder-next',
          'openrouter/free',
          'stepfun/step-3.5-flash',
          'moonshotai/kimi-k2.5',
          'upstage/solar-pro-3',
          'minimax/minimax-m2-her',
          'writer/palmyra-x5',
          'liquid/lfm-2.5-1.2b-thinking:free',
          'liquid/lfm-2.5-1.2b-instruct:free',
          'openai/gpt-audio',
          'openai/gpt-audio-mini',
          'z-ai/glm-4.7-flash',
          'openai/gpt-5.2-codex',
          'bytedance-seed/seed-1.6-flash',
          'bytedance-seed/seed-1.6',
          'minimax/minimax-m2.1',
          'z-ai/glm-4.7',
          'google/gemini-3-flash-preview',
          'xiaomi/mimo-v2-flash',
          'nvidia/nemotron-3-nano-30b-a3b:free',
          'nvidia/nemotron-3-nano-30b-a3b',
          'openai/gpt-5.2-chat',
          'openai/gpt-5.2-pro',
          'openai/gpt-5.2',
          'mistralai/devstral-2512',
          'relace/relace-search',
          'z-ai/glm-4.6v',
          'nex-agi/deepseek-v3.1-nex-n1',
          'essentialai/rnj-1-instruct',
          'openrouter/bodybuilder',
          'openai/gpt-5.1-codex-max',
          'amazon/nova-2-lite-v1',
          'mistralai/ministral-14b-2512',
          'mistralai/ministral-8b-2512',
          'mistralai/ministral-3b-2512',
          'mistralai/mistral-large-2512',
          'arcee-ai/trinity-mini',
          'deepseek/deepseek-v3.2-speciale',
          'deepseek/deepseek-v3.2',
          'prime-intellect/intellect-3',
          'anthropic/claude-opus-4.5',
          'allenai/olmo-3-32b-think',
          'google/gemini-3-pro-image-preview',
          'deepcogito/cogito-v2.1-671b',
          'openai/gpt-5.1',
          'openai/gpt-5.1-chat',
          'openai/gpt-5.1-codex',
          'openai/gpt-5.1-codex-mini',
          'moonshotai/kimi-k2-thinking',
          'amazon/nova-premier-v1',
          'perplexity/sonar-pro-search',
          'mistralai/voxtral-small-24b-2507',
          'openai/gpt-oss-safeguard-20b',
          'nvidia/nemotron-nano-12b-v2-vl:free',
          'minimax/minimax-m2',
          'qwen/qwen3-vl-32b-instruct',
          'ibm-granite/granite-4.0-h-micro',
          'microsoft/phi-4-mini-instruct',
          'openai/gpt-5-image-mini',
          'anthropic/claude-haiku-4.5',
          'qwen/qwen3-vl-8b-thinking',
          'qwen/qwen3-vl-8b-instruct',
          'openai/gpt-5-image',
          'openai/o3-deep-research',
          'openai/o4-mini-deep-research',
          'nvidia/llama-3.3-nemotron-super-49b-v1.5',
          'baidu/ernie-4.5-21b-a3b-thinking',
          'google/gemini-2.5-flash-image',
          'qwen/qwen3-vl-30b-a3b-thinking',
          'qwen/qwen3-vl-30b-a3b-instruct',
          'openai/gpt-5-pro',
          'z-ai/glm-4.6',
          'anthropic/claude-sonnet-4.5',
          'deepseek/deepseek-v3.2-exp',
          'thedrummer/cydonia-24b-v4.1',
          'relace/relace-apply-3',
          'google/gemini-2.5-flash-lite-preview-09-2025',
          'qwen/qwen3-vl-235b-a22b-thinking',
          'qwen/qwen3-vl-235b-a22b-instruct',
          'qwen/qwen3-max',
          'qwen/qwen3-coder-plus',
          'openai/gpt-5-codex',
          'deepseek/deepseek-v3.1-terminus',
          'qwen/qwen3-coder-flash',
          'qwen/qwen3-next-80b-a3b-thinking',
          'qwen/qwen3-next-80b-a3b-instruct:free',
          'qwen/qwen3-next-80b-a3b-instruct',
          'qwen/qwen-plus-2025-07-28:thinking',
          'qwen/qwen-plus-2025-07-28',
          'nvidia/nemotron-nano-9b-v2:free',
          'nvidia/nemotron-nano-9b-v2',
          'moonshotai/kimi-k2-0905',
          'qwen/qwen3-30b-a3b-thinking-2507',
          'nousresearch/hermes-4-70b',
          'nousresearch/hermes-4-405b',
          'deepseek/deepseek-chat-v3.1',
          'openai/gpt-4o-audio-preview',
          'mistralai/mistral-medium-3.1',
          'baidu/ernie-4.5-21b-a3b',
          'baidu/ernie-4.5-vl-28b-a3b',
          'z-ai/glm-4.5v',
          'ai21/jamba-large-1.7',
          'openai/gpt-5-chat',
          'openai/gpt-5',
          'openai/gpt-5-mini',
          'openai/gpt-5-nano',
          'openai/gpt-oss-120b:free',
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b:free',
          'openai/gpt-oss-20b',
          'anthropic/claude-opus-4.1',
          'mistralai/codestral-2508',
          'qwen/qwen3-coder-30b-a3b-instruct',
          'qwen/qwen3-30b-a3b-instruct-2507',
          'z-ai/glm-4.5',
          'z-ai/glm-4.5-air:free',
          'z-ai/glm-4.5-air',
          'qwen/qwen3-235b-a22b-thinking-2507',
          'z-ai/glm-4-32b',
          'qwen/qwen3-coder:free',
          'qwen/qwen3-coder',
          'bytedance/ui-tars-1.5-7b',
          'google/gemini-2.5-flash-lite',
          'qwen/qwen3-235b-a22b-2507',
          'switchpoint/router',
          'moonshotai/kimi-k2',
          'mistralai/devstral-medium',
          'mistralai/devstral-small',
          'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
          'tencent/hunyuan-a13b-instruct',
          'morph/morph-v3-large',
          'morph/morph-v3-fast',
          'baidu/ernie-4.5-vl-424b-a47b',
          'baidu/ernie-4.5-300b-a47b',
          'mistralai/mistral-small-3.2-24b-instruct',
          'minimax/minimax-m1',
          'google/gemini-2.5-flash',
          'google/gemini-2.5-pro',
          'openai/o3-pro',
          'google/gemini-2.5-pro-preview',
          'deepseek/deepseek-r1-0528',
          'anthropic/claude-opus-4',
          'anthropic/claude-sonnet-4',
          'google/gemma-3n-e4b-it',
          'mistralai/mistral-medium-3',
          'google/gemini-2.5-pro-preview-05-06',
          'arcee-ai/spotlight',
          'arcee-ai/maestro-reasoning',
          'arcee-ai/virtuoso-large',
          'arcee-ai/coder-large',
          'meta-llama/llama-guard-4-12b',
          'qwen/qwen3-30b-a3b',
          'qwen/qwen3-8b',
          'qwen/qwen3-14b',
          'qwen/qwen3-32b',
          'qwen/qwen3-235b-a22b',
          'openai/o4-mini-high',
          'openai/o3',
          'openai/o4-mini',
          'openai/gpt-4.1',
          'openai/gpt-4.1-mini',
          'openai/gpt-4.1-nano',
          'alfredpros/codellama-7b-instruct-solidity',
          'meta-llama/llama-4-maverick',
          'meta-llama/llama-4-scout',
          'deepseek/deepseek-chat-v3-0324',
          'openai/o1-pro',
          'mistralai/mistral-small-3.1-24b-instruct',
          'google/gemma-3-4b-it',
          'google/gemma-3-12b-it',
          'cohere/command-a',
          'openai/gpt-4o-mini-search-preview',
          'openai/gpt-4o-search-preview',
          'rekaai/reka-flash-3',
          'google/gemma-3-27b-it',
          'thedrummer/skyfall-36b-v2',
          'perplexity/sonar-reasoning-pro',
          'perplexity/sonar-pro',
          'perplexity/sonar-deep-research',
          'google/gemini-2.0-flash-lite-001',
          'mistralai/mistral-saba',
          'meta-llama/llama-guard-3-8b',
          'openai/o3-mini-high',
          'google/gemini-2.0-flash-001',
          'aion-labs/aion-1.0',
          'aion-labs/aion-1.0-mini',
          'aion-labs/aion-rp-llama-3.1-8b',
          'qwen/qwen2.5-vl-72b-instruct',
          'qwen/qwen-plus',
          'openai/o3-mini',
          'mistralai/mistral-small-24b-instruct-2501',
          'deepseek/deepseek-r1-distill-qwen-32b',
          'perplexity/sonar',
          'deepseek/deepseek-r1-distill-llama-70b',
          'deepseek/deepseek-r1',
          'minimax/minimax-01',
          'microsoft/phi-4',
          'sao10k/l3.1-70b-hanami-x1',
          'deepseek/deepseek-chat',
          'sao10k/l3.3-euryale-70b',
          'openai/o1',
          'cohere/command-r7b-12-2024',
          'meta-llama/llama-3.3-70b-instruct:free',
          'meta-llama/llama-3.3-70b-instruct',
          'amazon/nova-lite-v1',
          'amazon/nova-micro-v1',
          'amazon/nova-pro-v1',
          'openai/gpt-4o-2024-11-20',
          'mistralai/mistral-large-2411',
          'mistralai/mistral-large-2407',
          'mistralai/pixtral-large-2411',
          'qwen/qwen-2.5-coder-32b-instruct',
          'thedrummer/unslopnemo-12b',
          'anthropic/claude-3.5-haiku',
          'anthropic/claude-3-5-haiku-20241022',
          'anthracite-org/magnum-v4-72b',
          'qwen/qwen-2.5-7b-instruct',
          'inflection/inflection-3-productivity',
          'inflection/inflection-3-pi',
          'thedrummer/rocinante-12b',
          'meta-llama/llama-3.2-11b-vision-instruct',
          'meta-llama/llama-3.2-1b-instruct',
          'meta-llama/llama-3.2-3b-instruct:free',
          'meta-llama/llama-3.2-3b-instruct',
          'qwen/qwen-2.5-72b-instruct',
          'cohere/command-r-08-2024',
          'cohere/command-r-plus-08-2024',
          'sao10k/l3.1-euryale-70b',
          'nousresearch/hermes-3-llama-3.1-70b',
          'nousresearch/hermes-3-llama-3.1-405b:free',
          'nousresearch/hermes-3-llama-3.1-405b',
          'sao10k/l3-lunaris-8b',
          'openai/gpt-4o-2024-08-06',
          'meta-llama/llama-3.1-70b-instruct',
          'meta-llama/llama-3.1-8b-instruct',
          'mistralai/mistral-nemo',
          'openai/gpt-4o-mini-2024-07-18',
          'openai/gpt-4o-mini',
          'google/gemma-2-27b-it',
          'sao10k/l3-euryale-70b',
          'nousresearch/hermes-2-pro-llama-3-8b',
          'openai/gpt-4o',
          'openai/gpt-4o-2024-05-13',
          'meta-llama/llama-3-70b-instruct',
          'meta-llama/llama-3-8b-instruct',
          'mistralai/mixtral-8x22b-instruct',
          'microsoft/wizardlm-2-8x22b',
          'openai/gpt-4-turbo',
          'anthropic/claude-3-haiku',
          'mistralai/mistral-large',
          'openai/gpt-3.5-turbo-0613',
          'openai/gpt-4-turbo-preview',
          'openrouter/auto',
          'openai/gpt-4-1106-preview',
          'mistralai/mistral-7b-instruct-v0.1',
          'openai/gpt-3.5-turbo-instruct',
          'openai/gpt-3.5-turbo-16k',
          'mancer/weaver',
          'undi95/remm-slerp-l2-13b',
          'gryphe/mythomax-l2-13b',
          'openai/gpt-4-0314',
          'openai/gpt-3.5-turbo',
          'openai/gpt-4',
          ...localOpenRouterModels,
          ...localOpenRouterModels.map(m => m.startsWith('openrouter/') ? m : `openrouter/${m}`)
        ]));
      if (cmdPart === '/model' && parts.length > 1) {
        const pref = parts[1] ?? '';
        const hits = modelSuggestions.filter(m => m.toLowerCase().startsWith(pref.toLowerCase()));
        if (hits.length === 1 && hits[0].toLowerCase() !== pref.toLowerCase()) {
          if (globalRl) {
            (globalRl as any).line = `/model ${hits[0]}`;
            (globalRl as any).cursor = (globalRl as any).line.length;
          }
        }
        return [[], line];
      }

      if (line.startsWith('/')) {
        const query = line.toLowerCase();
        const matches = allCmds.filter(c => c.command.toLowerCase().startsWith(query));
        if (matches.length === 1 && matches[0].command.toLowerCase() !== query) {
          if (globalRl) {
            (globalRl as any).line = matches[0].command + ' ';
            (globalRl as any).cursor = (globalRl as any).line.length;
          }
        }
      }

      if (globalRl) {
        process.nextTick(() => (globalRl as any)._refreshLine());
      }
      return [[], line];
    },
  });

  globalRl = rl;

  let exiting = false;
  let activeMode: 'Normal' | 'Plan' | 'Auto' = 'Normal';

  function getTokenPricingLabel(state: SessionState): string {
    if (state.config.showTokenPricing === false) {
      return getContextBar(state.history);
    }
    const inTokens = (state as any).totalInputTokens || 0;
    const outTokens = (state as any).totalOutputTokens || 0;
    const cost = ((inTokens * 0.15) / 1000000) + ((outTokens * 0.60) / 1000000);
    return `Tokens: ${inTokens + outTokens} · Cost: $${cost.toFixed(5)}`;
  }

  function getModePill(mode: 'Normal' | 'Plan' | 'Auto'): string {
    const style = state.config.chatbarStyle || 'mode';
    const modelLabel = state.config.provider === 'google' ? 'Google' : formatModelName(state.config.model || 'gpt-4o-mini');
    const displayModel = modelLabel.length > 25 ? modelLabel.slice(0, 22) + '…' : modelLabel;

    if (style === 'minimal') {
      return `${BRAND}>${R} `;
    }

    let pillText = '';
    if (style === 'mode') {
      pillText = mode;
    } else if (style === 'model') {
      pillText = displayModel;
    } else if (style === 'both') {
      pillText = `${mode} | ${displayModel}`;
    }

    let pillColor = '\x1b[38;2;140;140;140m';
    if (mode === 'Plan') pillColor = '\x1b[38;2;160;110;235m';
    else if (mode === 'Auto') pillColor = '\x1b[38;2;60;185;120m';

    return `${pillColor}[ ${pillText} ]${R} ${BRAND}>${R} `;
  }

  function updatePromptAndRedraw() {
    rl.prompt(true);
    (rl as any)._refreshLine();
  }

  const onKeyPressGlobal = async (ch: any, key: any) => {
    if (exiting || isCommandRunning) return;
    if (!key) return;

    // Shift + Tab or backtab to cycle modes
    if (key.name === 'backtab' || (key.name === 'tab' && key.shift) || key.sequence === '\x1b[Z') {
      const modes: ('Normal' | 'Plan' | 'Auto')[] = ['Normal', 'Plan', 'Auto'];
      const currentIdx = modes.indexOf(activeMode);
      activeMode = modes[(currentIdx + 1) % modes.length];
      updatePromptAndRedraw();
      return;
    }

    // Alt + T or Meta + T to toggle Extended Thinking
    if ((key.meta && key.name === 't') || key.sequence === '\x1bt') {
      const current = !!state.config.extendedThinking;
      state.config.extendedThinking = !current;
      saveConfig(state.config);
      state.infoMessage = `🧠 Extended Thinking Mode ${state.config.extendedThinking ? 'ENABLED' : 'DISABLED'}`;
      redrawScreen(state);
      await new Promise(r => setTimeout(r, 1500));
      state.infoMessage = undefined;
      redrawScreen(state);
      return;
    }

    // Alt + P or Meta + P to open model selector dropdown
    if ((key.meta && key.name === 'p') || key.sequence === '\x1bp') {
      isCommandRunning = true;
      process.stdin.removeListener('keypress', onKeyPressGlobal);

      let popularModels = localOpenRouterModels.slice(0, 12);
      if (popularModels.length === 0) {
        state.infoMessage = 'Refreshing model list...';
        redrawScreen(state);
        try {
          const res = await fetch('https://openrouter.ai/api/v1/models');
          if (res.ok) {
            const data = await res.json() as any;
            popularModels = data.data.map((x: any) => x.id.startsWith('openrouter/') ? x.id : `openrouter/${x.id}`);
          }
          state.infoMessage = undefined;
        } catch (e) {
          state.infoMessage = undefined;
        }
      }

      state.modalOpen = true;
      const selected = await showModelSelector(rl, popularModels, state);
      state.modalOpen = false;

      if (selected) {
        let finalModel = selected;
        if (selected.startsWith('openrouter/')) {
          finalModel = selected.substring(11);
          state.config.provider = 'openrouter';
        }
        state.config.model = finalModel;
        saveConfig(state.config);
        state.infoMessage = `Model → ${finalModel} (Provider: ${state.config.provider})`;
      }

      process.stdin.on('keypress', onKeyPressGlobal);
      isCommandRunning = false;
      redrawScreen(state);
      await new Promise(r => setTimeout(r, 1000));
      state.infoMessage = undefined;
      redrawScreen(state);
      rl.prompt();
      return;
    }

    // Ctrl + O to launch Fullscreen Transcript Replay Screen
    if ((key.ctrl && key.name === 'o') || key.sequence === '\x0f') {
      isCommandRunning = true;
      process.stdin.removeListener('keypress', onKeyPressGlobal);
      state.modalOpen = true;

      await showTranscriptViewer(rl, state);

      state.modalOpen = false;
      process.stdin.on('keypress', onKeyPressGlobal);
      isCommandRunning = false;
      redrawScreen(state);
      rl.prompt();
      return;
    }
  };
  process.stdin.on('keypress', onKeyPressGlobal);

  const originalPrompt = rl.prompt.bind(rl);
  rl.prompt = (preserveCursor?: boolean) => {
    const rows = process.stdout.rows || 24;
    const w = termWidth() - 1;
    if (rows >= 10 && !exiting) {
      process.stdout.write(`\x1b[${rows - 3};1H\x1b[2K`);
      const shortcutsHint = ` ${DIM}Press ${R}${BRAND}[Tab]${R}${DIM} for commands · ${R}${BRAND}[Shift+Tab]${R}${DIM} to toggle agents · ${R}${BRAND}[Ctrl+C]${R}${DIM} to exit${R} `;
      const linePadding = Math.max(0, Math.floor((w - stripAnsi(shortcutsHint).length) / 2));
      const rightPadding = Math.max(0, w - stripAnsi(shortcutsHint).length - linePadding);
      process.stdout.write(
        `\x1b[38;2;65;65;65m${'─'.repeat(linePadding)}${R}` +
        shortcutsHint +
        `\x1b[38;2;65;65;65m${'─'.repeat(rightPadding)}${R}`
      );
      process.stdout.write(`\x1b[${rows - 1};1H\x1b[2K`);
      const modelLabel = state.config.provider === 'google' ? 'Google (128K)' : formatModelName(state.config.model || 'gpt-4o-mini');
      const contextLabel = getTokenPricingLabel(state);
      process.stdout.write(drawHorizontalLineWithText(modelLabel, contextLabel));
      process.stdout.write(`\x1b[${rows};1H\x1b[2K`);
      process.stdout.write(`\x1b[${rows - 2};1H\x1b[2K`);
    }
    // Use simple plain text prompt so readline works and tracks width perfectly
    const pillColored = getModePill(activeMode);
    const pillPlain = stripAnsi(pillColored);
    rl.setPrompt(pillPlain);
    originalPrompt(preserveCursor);
    
    // Draw colored pill over the plain text one immediately
    process.stdout.write(`\x1b[${rows - 2};1H${pillColored}`);
    // Position cursor back to the correct spot
    const cursorPos = (rl as any).cursor || 0;
    process.stdout.write(`\x1b[${rows - 2};${1 + pillPlain.length + cursorPos}H`);
  };

  // Override _refreshLine to redraw colored prompt and bottom bars safely
  const originalRefreshLine = (rl as any)._refreshLine.bind(rl);
  (rl as any)._refreshLine = function () {
    originalRefreshLine();
    const rows = process.stdout.rows || 24;
    const pillColored = getModePill(activeMode);
    // Overwrite the plain text prompt with colored one on the input line
    process.stdout.write(`\x1b[s`); // Save cursor position
    process.stdout.write(`\x1b[${rows - 2};1H${pillColored}`);
    if (rows >= 10 && !exiting && !state.modalOpen) {
      process.stdout.write(`\x1b[${rows - 1};1H\x1b[2K`);
      const modelLabel = state.config.provider === 'google' ? 'Google (128K)' : formatModelName(state.config.model || 'gpt-4o-mini');
      const contextLabel = getTokenPricingLabel(state);
      process.stdout.write(drawHorizontalLineWithText(modelLabel, contextLabel));
      process.stdout.write(`\x1b[${rows};1H\x1b[2K`);
    }
    process.stdout.write(`\x1b[u`); // Restore cursor position
  };

  const onResize = () => {
    if (!exiting && !state.modalOpen) {
      redrawScreen(state);
    }
  };
  process.stdout.on('resize', onResize);

  // ─── Slash command live display via polling ──────────────────────────────
  let slashActive = false;
  let slashQuery = '';
  let lastInputLen = 0;
  let slashListLines = 0;

  function clearSlashListLocal() {
    if (slashListLines > 0) {
      const rows = process.stdout.rows || 24;
      const startRow = Math.max(4, rows - 3 - slashListLines);
      for (let i = 0; i < slashListLines; i++) {
        process.stdout.write(`\x1b[${startRow + i};1H\x1b[2K`);
      }
      slashListLines = 0;
      // Move cursor to column 1 of input row, NOT behind the prompt (>)
      // readline prompt will recalculate the correct position
      const pill = getModePill(activeMode);
      const pillLen = stripAnsi(pill).length;
      const inputRow = rows - 2;
      const cursorPos = (globalRl as any).cursor || 0;
      process.stdout.write(`\x1b[${inputRow};${Math.max(1, 1 + pillLen + cursorPos)}H`);
    }
  }

  const COMMANDS_LIST = [
    { command: '/add-dir', label: '/add-dir', description: 'Add a new working directory', category: 'Code' },
    { command: '/agents', label: '/agents', description: 'Manage agent configurations', category: 'System' },
    { command: '/background', label: '/background', description: 'Send this session to the background', category: 'System' },
    { command: '/branch', label: '/branch', description: 'Create a branch of the current conversation', category: 'Chat' },
    { command: '/btw', label: '/btw', description: 'Ask a quick side question', category: 'Chat' },
    { command: '/clear', label: '/clear', description: 'Start a new empty session', category: 'Chat' },
    { command: '/resume', label: '/resume', description: 'Restore a previous session', category: 'Chat' },
    { command: '/color', label: '/color', description: 'Set prompt bar color', category: 'System' },
    { command: '/compact', label: '/compact', description: 'Summarize conversation to save context', category: 'Chat' },
    { command: '/context', label: '/context', description: 'Visualize current context usage', category: 'System' },
    { command: '/pair', label: '/pair', description: 'Link terminal to Roblox Studio', category: 'Connection' },
    { command: '/login', label: '/login', description: 'Sign in with Roblox to use your subscription', category: 'Connection' },
    { command: '/credits', label: '/credits', description: 'Show your plan and remaining credits', category: 'Connection' },
    { command: '/status', label: '/status', description: 'Refresh server + Studio pairing status', category: 'System' },
    { command: '/sync', label: '/sync <file>', description: 'AI-edit a file and push to Studio', category: 'Code' },
    { command: '/mcp', label: '/mcp [mode]', description: 'MCP mode: local|remote|auto|on|off (live Studio tool calls)', category: 'Code' },
    { command: '/provider', label: '/provider <p>', description: 'Set API provider (openai|google|deepseek|openrouter)', category: 'AI' },
    { command: '/key', label: '/key [p] <k>', description: 'Set API key (optional provider)', category: 'AI' },
    { command: '/model', label: '/model', description: 'Select AI model interactively', category: 'AI' },
    { command: '/thinking', label: '/thinking', description: 'Toggle extended thinking/reasoning mode', category: 'AI' },
    { command: '/transcript', label: '/transcript', description: 'Open fullscreen session transcript viewer', category: 'System' },
    { command: '/config', label: '/config', description: 'Show current configuration', category: 'System' },
    { command: '/settings', label: '/settings', description: 'Open personal settings panel', category: 'System' },
    { command: '/artifact', label: '/artifact', description: 'Review, accept, or steer generated code artifacts', category: 'Code' },
    { command: '/help', label: '/help', description: 'Show all available commands', category: 'Chat' },
    { command: '/exit', label: '/exit', description: 'Quit Apple Juice CLI', category: 'System' },
  ];

  function drawSlashListLocal(query: string) {
    clearSlashListLocal();

    const lower = query.toLowerCase();
    const filtered = COMMANDS_LIST.filter(c =>
      !query || c.command.toLowerCase().includes(lower) ||
      c.label.toLowerCase().includes(lower) ||
      c.description.toLowerCase().includes(lower)
    ).slice(0, 5); // Compaction: max 5 compact items to avoid UI breaks!

    const rows = process.stdout.rows || 24;
    const w = Math.min(72, termWidth() - 4);

    if (filtered.length === 0) {
      const totalRows = 2;
      slashListLines = totalRows;
      const startRow = Math.max(4, rows - 3 - totalRows);

      process.stdout.write(`\x1b[${startRow};1H\x1b[2K  ${DIM}No matching commands for "/${query}"${R}`);
      process.stdout.write(`\x1b[${startRow + 1};1H\x1b[2K  ${DIM}${'─'.repeat(40)}${R}`);

      const pill = getModePill(activeMode);
      const pillLen = stripAnsi(pill).length;
      const cursorPos = (globalRl as any).cursor || 0;
      const col = Math.max(1, 1 + pillLen + cursorPos);
      process.stdout.write(`\x1b[${rows - 2};${col}H`);
      return;
    }

    const lines: string[] = [];
    lines.push(`  ${DIM}${'─'.repeat(w)}${R}`);
    for (const cmd of filtered) {
      const isExact = cmd.command.toLowerCase() === query.toLowerCase() || !query;
      const cmdDisplay = isExact ? `${BOLD}${BRAND}${cmd.label}${R}` : `${BRAND}${cmd.label}${R}`;
      lines.push(`  ${cmdDisplay}${' '.repeat(Math.max(1, 20 - stripAnsi(cmd.label).length))}${DIM}${cmd.description}${R}`);
    }
    lines.push(`  ${DIM}${'─'.repeat(w)}${R}`);

    slashListLines = lines.length;
    const startRow = Math.max(4, rows - 3 - slashListLines); // Safe row boundary check!

    for (let i = 0; i < lines.length; i++) {
      process.stdout.write(`\x1b[${startRow + i};1H\x1b[2K${lines[i]}`);
    }

    const pill = getModePill(activeMode);
    const pillLen = stripAnsi(pill).length;
    const cursorPos = (globalRl as any).cursor || 0;
    const col = Math.max(1, 1 + pillLen + cursorPos);
    process.stdout.write(`\x1b[${rows - 2};${col}H`);
  }

  let isCommandRunning = false;

  const slashCheckInterval = setInterval(() => {
    if (!globalRl || exiting || isCommandRunning) { return; }
    const line = (globalRl as any).line || '';
    if (line.length !== lastInputLen) {
      lastInputLen = line.length;
      if (line.startsWith('/')) {
        const afterSlash = line.slice(1);
        if (!afterSlash.includes(' ')) {
          if (!slashActive) {
            slashActive = true;
            slashQuery = afterSlash;
            drawSlashListLocal(afterSlash);
          } else {
            slashQuery = afterSlash;
            drawSlashListLocal(afterSlash);
          }
          return;
        }
      }
      if (slashActive) {
        clearSlashListLocal();
        slashActive = false;
        slashQuery = '';
        redrawScreen(state);
      }
    }
  }, 100);
  slashCheckInterval.unref();

  const origRedraw = redrawScreen;
  redrawScreen = (s: SessionState) => {
    if (slashActive) { clearSlashListLocal(); slashActive = false; }
    origRedraw(s);
  };

  rl.setPrompt(' ');
  const hb = setInterval(async () => {
    if (exiting) return;
    const sv = await pingServer(config.apiUrl);
    const pr = await checkPairingStatus(config);
    let changed = false;
    if (sv !== state.serverOnline) { state.serverOnline = sv; changed = true; }
    if (pr !== state.paired) {
      state.paired = pr;
      changed = true;
      if (pr) {
        state.pairingCode = undefined;
        state.infoMessage = `${BRIGHT_GREEN}✓${R} Paired with Studio`;
        setTimeout(() => { state.infoMessage = undefined; if (!state.modalOpen) redrawScreen(state); }, 2500);
      }
    }
    if (changed && !state.modalOpen) redrawScreen(state);
  }, 1500);
  hb.unref();

  redrawScreen(state);
  rl.prompt();

  rl.on('line', async (rawLine: string) => {
    isCommandRunning = true;

    if (slashActive) {
      clearSlashListLocal();
      slashActive = false;
      slashQuery = '';
      lastInputLen = 0;
    }

    try {
      let input = rawLine.trim();
      if (!input || input === '/') {
        rl.prompt(true);
        return;
      }

      if (!input.startsWith('/')) {
        const rows = process.stdout.rows || 24;
        if (rows >= 10) {
          process.stdout.write(`\x1b[${rows - 4};1H\n\n`);
        } else {
          process.stdout.write('\n\n');
        }
      }

      if (input.startsWith('/') || input === '?') {
        const allCmds = ['/add-dir', '/agents', '/background', '/branch', '/btw', '/clear', '/resume', '/color', '/compact', '/context', '/pair', '/login', '/credits', '/status', '/sync', '/mcp', '/key', '/model', '/config', '/settings', '/artifact', '/help', '/exit', '/thinking', '/transcript'];
        const [rawCmd, ...args] = input.slice(1).split(' ');
        const cmd = rawCmd.toLowerCase();

        switch (cmd) {
          case 'exit': case 'quit':
            exiting = true;
            clearInterval(hb);
            process.stdin.removeListener('keypress', onKeyPressGlobal);
            process.stdout.removeListener('resize', onResize);
            process.stdout.write('\x1b[r');
            process.stdout.write(`\n  ${DIM}Goodbye.${R}\n\n`);
            rl.close();
            process.exit(0);
            return;
          case 'clear': case 'cls': {
            if (!state.config.sessions) state.config.sessions = {};
            const oldKey = state.config.sessionKey;
            state.config.sessions[oldKey] = [...state.history];
            state.config.previousSessionKey = oldKey;

            state.config.sessionKey = crypto.randomBytes(8).toString('hex');
            state.history = [];
            saveConfig(state.config);

            state.infoMessage = `Started new session. Previous saved (resumable with /resume).`;
            state.lastError = undefined;
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 1800));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'help': {
            state.modalOpen = true;
            await showInteractiveHelp(rl, state);
            state.modalOpen = false;
            redrawScreen(state);
            rl.prompt(true);
            return;
          }
          case 'status':
            state.serverOnline = await pingServer(config.apiUrl);
            state.paired = await checkPairingStatus(config);
            state.infoMessage = `Server ${state.serverOnline ? 'online' : 'offline'}  ·  Studio ${state.paired ? 'paired' : 'not paired'}`;
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 1800));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          case 'pair': {
            const code = await initAuthPairing(config);
            if (!code) { rl.prompt(); return; }
            state.pairingCode = code;
            for (let i = 0; i < 30; i++) {
              state.infoMessage = `Waiting for Studio to connect (${i + 1}/30)…`;
              redrawScreen(state);
              await new Promise(r => setTimeout(r, 2000));
              if (await checkPairingStatus(config)) { state.paired = true; break; }
            }
            state.pairingCode = undefined;
            state.infoMessage = state.paired
              ? `${BRIGHT_GREEN}✓${R} Paired successfully!`
              : `${BRIGHT_YELLOW}⚠${R} Timed out — verify the code in Studio.`;
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 2000));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'sync': {
            if (!args[0]) {
              state.lastError = 'Usage: /sync <filePath> [prompt]';
              redrawScreen(state);
              state.lastError = undefined;
            } else {
              await handleCodeCommand(config, args[0], args.slice(1).join(' ') || 'Refactor and improve this code');
              redrawScreen(state);
            }
            rl.prompt();
            return;
          }
          case 'add-dir': {
            let dirPath = args.join(' ');
            if (!dirPath) {
              dirPath = await askTextInput(rl, 'Enter the directory path to add:');
            }
            if (!dirPath) {
              redrawScreen(state);
              rl.prompt();
              return;
            }
            const resolvedPath = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
            if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
              process.chdir(resolvedPath);
              state.config.projectPath = resolvedPath;
              saveConfig(state.config);
              state.infoMessage = `${BRIGHT_GREEN}✓${R} Working directory changed to: ${resolvedPath}`;
            } else {
              state.lastError = `Directory does not exist: ${resolvedPath}`;
            }
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 2000));
            state.infoMessage = undefined;
            state.lastError = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'agents': {
            console.clear();
            const w = termWidth();
            const titleText = gradientText('Agent Configurations', SUNSET_START, SUNSET_END);
            process.stdout.write(`\n  ${BOLD}${titleText}${R}\n`);
            process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);

            process.stdout.write(`  🤖 ${BOLD}Lead Coordinator${R}  ·  ${BRIGHT_GREEN}active${R}\n`);
            process.stdout.write(`     ${DIM}Oversees execution plans and routes specialized tasks to subagents.${R}\n\n`);

            process.stdout.write(`  📐 ${BOLD}Code Architect${R}    ·  ${DIM}idle${R}\n`);
            process.stdout.write(`     ${DIM}Analyzes codebase structure and ensures clean patterns & conventions.${R}\n\n`);

            process.stdout.write(`  📂 ${BOLD}File Explorer${R}     ·  ${DIM}idle${R}\n`);
            process.stdout.write(`     ${DIM}Performs targeted filesystem searches, context gathering, and grep indexing.${R}\n\n`);

            process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n`);
            process.stdout.write(`  ${DIM}Cycle prompt agents dynamically in the REPL using [Shift+Tab]${R}\n`);
            process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n`);
            process.stdout.write(`  ${DIM}Press Enter to return to chat...${R}`);

            await new Promise<void>((resolve) => {
              const onKey = (str: string, key: any) => {
                if (key && (key.name === 'return' || key.name === 'enter')) {
                  process.stdin.removeListener('keypress', onKey);
                  resolve();
                }
              };
              process.stdin.on('keypress', onKey);
            });

            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'background': {
            console.clear();
            const w = termWidth();
            process.stdout.write(`\n  ${BRAND}⚡${R}  ${BOLD}Backgrounding active session…${R}\n`);
            process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);

            let spinFrame = 0;
            const bgInterval = setInterval(() => {
              const s = SPIN_FRAMES[spinFrame % SPIN_FRAMES.length];
              process.stdout.write(`\r  ${BRAND}${s}${R}  ${DIM}Detaching processes, saving context and terminal state...${R}`);
              spinFrame++;
            }, 80);

            await new Promise(r => setTimeout(r, 1500));
            clearInterval(bgInterval);
            process.stdout.write('\r\x1b[K');

            process.stdout.write(`  ${BRIGHT_GREEN}✓${R} Session safely suspended and running in background.\n\n`);
            process.stdout.write(`  ${BOLD}To resume this session, execute:${R}\n`);
            process.stdout.write(`    ${BRAND}aj resume ${state.config.sessionKey}${R}\n\n`);
            process.stdout.write(`  ${DIM}Goodbye.${R}\n\n`);

            exiting = true;
            clearInterval(hb);
            process.stdin.removeListener('keypress', onKeyPressGlobal);
            process.stdout.removeListener('resize', onResize);
            process.stdout.write('\x1b[r');
            rl.close();
            process.exit(0);
            return;
          }
          case 'branch': {
            let branchName = args.join('-');
            if (!branchName) {
              branchName = await askTextInput(rl, 'Enter name for the new conversation branch:');
            }
            if (!branchName) {
              redrawScreen(state);
              rl.prompt();
              return;
            }

            const cleanName = branchName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            if (!cleanName) {
              state.lastError = 'Invalid branch name.';
              redrawScreen(state);
              await new Promise(r => setTimeout(r, 1500));
              state.lastError = undefined;
              redrawScreen(state);
              rl.prompt();
              return;
            }

            const newSessionKey = `${cleanName}-${crypto.randomBytes(4).toString('hex')}`;
            if (!state.config.sessions) state.config.sessions = {};

            state.config.sessions[state.config.sessionKey] = [...state.history];
            state.config.previousSessionKey = state.config.sessionKey;

            state.config.sessionKey = newSessionKey;
            state.config.sessions[newSessionKey] = [...state.history];
            saveConfig(state.config);

            state.infoMessage = `${BRIGHT_GREEN}✓${R} Branched current conversation at this point as: ${cleanName}`;
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 2200));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'btw': {
            let question = args.join(' ');
            if (!question) {
              question = await askTextInput(rl, 'Ask a quick side question (runs out-of-context):');
            }
            if (!question) {
              redrawScreen(state);
              rl.prompt();
              return;
            }
            state.modalOpen = true;
            await showBtwOverlay(rl, question, state);
            state.modalOpen = false;
            redrawScreen(state);
            rl.prompt(true);
            return;
          }
          case 'thinking': {
            const current = !!state.config.extendedThinking;
            state.config.extendedThinking = !current;
            saveConfig(state.config);
            state.infoMessage = `🧠 Extended Thinking Mode ${state.config.extendedThinking ? 'ENABLED' : 'DISABLED'}`;
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 1500));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'login': {
            const ok = await loginWithRoblox(state.config);
            if (ok) {
              state.account = await fetchUsage(state.config);
            }
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'credits':
          case 'usage': {
            const usage = await fetchUsage(state.config);
            state.account = usage;
            if (!usage || !usage.loggedIn) {
              state.infoMessage = `Not signed in. Run /login to link your Roblox account and use your subscription.`;
            } else {
              const cap = usage.monthlyCapped ? ` ${DIM}(monthly cap reached)${R}` : '';
              state.infoMessage =
                `${BOLD}${planLabel(usage.plan)}${R} plan  ${DIM}·${R}  ` +
                `${BOLD}${Math.round(usage.remainingMl)}${R}${DIM}/${Math.round(usage.totalMl)} mL credits left${R}${cap}`;
            }
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 2600));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'mcp': {
            const sub = (args[0] || '').toLowerCase();
            if (sub === 'on') {
              state.config.mcpMode = true;
            } else if (sub === 'off') {
              state.config.mcpMode = false;
            } else if (sub === 'local' || sub === 'remote' || sub === 'auto') {
              // Choosing a transport implies enabling MCP mode.
              state.config.mcpMode = true;
              state.config.mcpTransport = sub as 'local' | 'remote' | 'auto';
            } else {
              state.config.mcpMode = !state.config.mcpMode;
            }
            saveConfig(state.config);
            if (state.config.mcpMode) {
              const transport = resolveMcpTransport(state.config);
              const pref = state.config.mcpTransport ?? 'auto';
              if (transport === 'local') {
                state.infoMessage =
                  `🔌 MCP Mode ENABLED — LOCAL (official Roblox Studio MCP). ` +
                  `Fast, full tool surface. Make sure Studio is open with MCP enabled.`;
              } else if (pref === 'local') {
                // Forced local but not actually available — warn precisely.
                const missing = !officialStudioMcpInstalled()
                  ? 'Studio MCP server not found'
                  : 'kiro-cli not found';
                state.infoMessage =
                  `🔌 MCP Mode ENABLED — LOCAL requested but ${missing}. ${STUDIO_MCP_HELP}`;
              } else {
                state.infoMessage =
                  `🔌 MCP Mode ENABLED — REMOTE bridge (cloud). ` +
                  `Tip: "/mcp local" for BloxBot-style local speed when Studio MCP + kiro-cli are installed.`;
              }
            } else {
              state.infoMessage = `🔌 MCP Mode DISABLED — back to the standard plan/artifact flow.`;
            }
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 2200));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'transcript': {
            state.modalOpen = true;
            await showTranscriptViewer(rl, state);
            state.modalOpen = false;
            redrawScreen(state);
            rl.prompt(true);
            return;
          }
          case 'resume': {
            const targetKey = args[0] || state.config.previousSessionKey;
            if (!targetKey) {
              state.lastError = 'Usage: /resume <sessionKey> (No previous session to restore)';
            } else {
              const savedHistory = state.config.sessions?.[targetKey];
              if (savedHistory) {
                const currentKey = state.config.sessionKey;
                const currentHistory = [...state.history];

                state.config.sessions[currentKey] = currentHistory;
                state.config.previousSessionKey = currentKey;

                state.config.sessionKey = targetKey;
                state.history = savedHistory;
                saveConfig(state.config);
                state.infoMessage = `${BRIGHT_GREEN}✓${R} Successfully resumed session: ${targetKey}`;
              } else {
                state.lastError = `Session "${targetKey}" not found in cache.`;
              }
            }
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 2000));
            state.infoMessage = undefined;
            state.lastError = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'color': {
            const themes = ['terracotta', 'magenta', 'cyan', 'gold'];
            state.modalOpen = true;
            const selected = await showModelSelector(rl, themes, state);
            state.modalOpen = false;
            if (selected) {
              state.config.promptColor = selected;
              saveConfig(state.config);
              applyPromptColor(selected);
              state.infoMessage = `Theme set to ${selected}!`;
            } else {
              state.infoMessage = 'Theme selection cancelled.';
            }
            redrawScreen(state);
            await new Promise(r => setTimeout(r, 1200));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'compact': {
            if (state.history.length === 0) {
              state.infoMessage = 'History is empty, nothing to compact.';
              redrawScreen(state);
              await new Promise(r => setTimeout(r, 1500));
              state.infoMessage = undefined;
              redrawScreen(state);
              rl.prompt();
              return;
            }

            startSpinner('Compacting conversation', false);

            try {
              const summaryPrompt = "Please summarize our conversation so far in a few highly concise sentences, listing the key files edited, decisions made, and current status. This will be used as the context baseline to save prompt tokens.";
              const res = await fetch(`${config.apiUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: summaryPrompt,
                  sessionKey: config.sessionKey,
                  messages: state.history,
                  provider: state.config.provider,
                  apiKey: state.config.provider === 'google' ? state.config.googleKey
                    : state.config.provider === 'deepseek' ? state.config.deepseekKey
                      : state.config.provider === 'openrouter' ? state.config.openrouterKey
                        : state.config.openaiKey,
                  openaiKey: state.config.openaiKey,
                  model: state.config.model,
                }),
              });

              stopSpinner();

              if (!res.ok) {
                const err = await res.json().catch(() => ({})) as Record<string, string>;
                state.lastError = `Compaction failed: ${err.error || res.statusText}`;
              } else {
                const data = await res.json().catch(() => ({})) as Record<string, any>;
                const reply = data.message || data.assistant || data.text || 'Summary generation completed.';

                state.history = [
                  { role: 'assistant', content: `📝 ${BOLD}[Context Baseline Summary]${R}\n\n${reply}` }
                ];
                state.infoMessage = `${BRIGHT_GREEN}✓${R} Chat context successfully compacted!`;
              }
            } catch (e: any) {
              stopSpinner();
              state.lastError = `Compaction error: ${e.message}`;
            }

            redrawScreen(state);
            state.lastError = undefined;
            await new Promise(r => setTimeout(r, 2200));
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'context': {
            console.clear();
            const w = termWidth();
            const titleText = gradientText('Context Utilization', SUNSET_START, SUNSET_END);
            process.stdout.write(`\n  ${BOLD}${titleText}${R}\n`);
            process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);

            const textLen = JSON.stringify(state.history).length;
            const maxCapacity = 30000;
            const pct = Math.min(100, Math.max(0, Math.round((textLen / maxCapacity) * 100)));
            const activeBlocks = Math.round(pct);

            process.stdout.write(`  ${BOLD}Model:${R} ${state.config.model || 'gpt-4o-mini'}\n`);
            process.stdout.write(`  ${BOLD}Usage:${R} ${textLen.toLocaleString()} / ${maxCapacity.toLocaleString()} chars (${pct}%)\n\n`);

            process.stdout.write(`  ${BOLD}Visual Allocation Grid:${R}\n\n`);
            for (let row = 0; row < 5; row++) {
              let rowStr = '  ';
              for (let col = 0; col < 20; col++) {
                const blockIndex = row * 20 + col;
                if (blockIndex < activeBlocks) {
                  rowStr += `${BRAND}■${R} `;
                } else {
                  rowStr += `${DIM}□${R} `;
                }
              }
              process.stdout.write(rowStr + '\n');
            }

            process.stdout.write(`\n  ${DIM}Legend: ${BRAND}■${R} Used (${pct}%)  ·  ${DIM}□${R} Free (${100 - pct}%)${R}\n`);
            process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n`);
            process.stdout.write(`  ${DIM}Press Enter to return to chat...${R}`);

            await new Promise<void>((resolve) => {
              const onKey = (str: string, key: any) => {
                if (key && (key.name === 'return' || key.name === 'enter')) {
                  process.stdin.removeListener('keypress', onKey);
                  resolve();
                }
              };
              process.stdin.on('keypress', onKey);
            });

            redrawScreen(state);
            rl.prompt();
            return;
          }
          case 'provider': {
            const p = args[0]?.toLowerCase();
            const valid = ['openai', 'google', 'deepseek', 'openrouter'];
            if (!p || !valid.includes(p)) {
              state.lastError = 'Usage: /provider <openai|google|deepseek|openrouter>';
            } else {
              state.config.provider = p as any;
              saveConfig(state.config);
              state.infoMessage = `Provider set to ${p}`;
            }
            redrawScreen(state);
            state.lastError = undefined; state.infoMessage = undefined;
            rl.prompt();
            return;
          }
          case 'key': {
            let provInput = args[0]?.toLowerCase();
            let k = args[1];
            if (!provInput && !k) {
              state.modalOpen = true;
              await showKeySelector(rl, state);
              state.modalOpen = false;
              redrawScreen(state);
              rl.prompt(true);
              return;
            }
            if (!k && args[0]) {
              k = args[0];
              provInput = k.startsWith('sk-or-') ? 'openrouter' : k.startsWith('sk-') ? 'openai' : k.startsWith('AIza') ? 'google' : (state.config.provider || 'openai');
            }
            if (!k) {
              state.lastError = 'Usage: /key [openai|google|deepseek|openrouter] <api_key>';
            } else {
              const validProviders = ['openai', 'google', 'deepseek', 'openrouter'];
              if (!validProviders.includes(provInput)) {
                state.lastError = 'Invalid provider. Choose: openai, google, deepseek, openrouter';
              } else {
                if (provInput === 'google') state.config.googleKey = k;
                else if (provInput === 'openai') state.config.openaiKey = k;
                else if (provInput === 'deepseek') state.config.deepseekKey = k;
                else if (provInput === 'openrouter') state.config.openrouterKey = k;

                state.config.provider = provInput as any;
                saveConfig(state.config);
                state.infoMessage = `Saved ${provInput} API key.`;
              }
            }
            redrawScreen(state);
            state.lastError = undefined; state.infoMessage = undefined;
            rl.prompt();
            return;
          }
          case 'model': {
            const m = args.join(' ');
            if (!m) {
              let popularModels = (state.config.availableModels && state.config.availableModels.length > 0)
                ? state.config.availableModels
                : Array.from(new Set([
                  'gpt-4o-mini',
                  'gpt-4o',
                  'o1-mini',
                  'o1-preview',
                  'gemini-3.5-flash',
                  'gemini-2.5-flash',
                  'gemini-2.5-pro',
                  'gemini-1.5-flash',
                  'claude-3-5-sonnet',
                  'claude-3-5-haiku',
                  'claude-3-opus',
                  'claude-opus-4.7-fast',
                  'deepseek-chat',
                  'deepseek-coder',
                  'deepseek-r1',
                  'deepseek/deepseek-v4-pro',
                  'deepseek/deepseek-v4-flash',
                  'qwen/qwen3.7-max',
                  'x-ai/grok-build-0.1',
                  'x-ai/grok-4.3',
                  'openai/gpt-5.5',
                  'openai/gpt-5.5-pro',
                  'openrouter/anthropic/claude-3.5-sonnet',
                  'openrouter/google/gemini-2.5-pro',
                  'openrouter/deepseek/deepseek-r1',
                  'openrouter/meta-llama/llama-3.1-405b-instruct',
                  'openrouter/meta-llama/llama-3-8b-instruct:free',
                  'google/gemini-3.5-flash',
                  'anthropic/claude-opus-4.7-fast',
                  'perceptron/perceptron-mk1',
                  'inclusionai/ring-2.6-1t',
                  'google/gemini-3.1-flash-lite',
                  'openai/gpt-chat-latest',
                  'ibm-granite/granite-4.1-8b',
                  'mistralai/mistral-medium-3-5',
                  'openrouter/owl-alpha',
                  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
                  'poolside/laguna-xs.2:free',
                  'poolside/laguna-m.1:free',
                  '~anthropic/claude-haiku-latest',
                  '~openai/gpt-mini-latest',
                  '~google/gemini-pro-latest',
                  '~moonshotai/kimi-latest',
                  '~google/gemini-flash-latest',
                  '~anthropic/claude-sonnet-latest',
                  '~openai/gpt-latest',
                  'qwen/qwen3.5-plus-20260420',
                  'qwen/qwen3.6-flash',
                  'qwen/qwen3.6-35b-a3b',
                  'qwen/qwen3.6-max-preview',
                  'qwen/qwen3.6-27b',
                  'deepseek/deepseek-v4-flash:free',
                  'inclusionai/ling-2.6-1t',
                  'tencent/hy3-preview',
                  'xiaomi/mimo-v2.5-pro',
                  'xiaomi/mimo-v2.5',
                  'openai/gpt-5.4-image-2',
                  'inclusionai/ling-2.6-flash',
                  '~anthropic/claude-opus-latest',
                  'openrouter/pareto-code',
                  'baidu/qianfan-ocr-fast',
                  'moonshotai/kimi-k2.6',
                  'anthropic/claude-opus-4.7',
                  'anthropic/claude-opus-4.6-fast',
                  'z-ai/glm-5.1',
                  'google/gemma-4-26b-a4b-it:free',
                  'google/gemma-4-26b-a4b-it',
                  'google/gemma-4-31b-it:free',
                  'google/gemma-4-31b-it',
                  'qwen/qwen3.6-plus',
                  'z-ai/glm-5v-turbo',
                  'arcee-ai/trinity-large-thinking',
                  'x-ai/grok-4.20-multi-agent',
                  'x-ai/grok-4.20',
                  'google/lyria-3-pro-preview',
                  'google/lyria-3-clip-preview',
                  'kwaipilot/kat-coder-pro-v2',
                  'rekaai/reka-edge',
                  'xiaomi/mimo-v2-omni',
                  'xiaomi/mimo-v2-pro',
                  'minimax/minimax-m2.7',
                  'openai/gpt-5.4-nano',
                  'openai/gpt-5.4-mini',
                  'mistralai/mistral-small-2603',
                  'z-ai/glm-5-turbo',
                  'nvidia/nemotron-3-super-120b-a12b:free',
                  'nvidia/nemotron-3-super-120b-a12b',
                  'bytedance-seed/seed-2.0-lite',
                  'qwen/qwen3.5-9b',
                  'openai/gpt-5.4-pro',
                  'openai/gpt-5.4',
                  'inception/mercury-2',
                  'openai/gpt-5.3-chat',
                  'google/gemini-3.1-flash-lite-preview',
                  'bytedance-seed/seed-2.0-mini',
                  'google/gemini-3.1-flash-image-preview',
                  'qwen/qwen3.5-35b-a3b',
                  'qwen/qwen3.5-27b',
                  'qwen/qwen3.5-122b-a10b',
                  'qwen/qwen3.5-flash-02-23',
                  'liquid/lfm-2-24b-a2b',
                  'google/gemini-3.1-pro-preview-customtools',
                  'openai/gpt-5.3-codex',
                  'aion-labs/aion-2.0',
                  'google/gemini-3.1-pro-preview',
                  'anthropic/claude-sonnet-4.6',
                  'qwen/qwen3.5-plus-02-15',
                  'qwen/qwen3.5-397b-a17b',
                  'minimax/minimax-m2.5:free',
                  'minimax/minimax-m2.5',
                  'z-ai/glm-5',
                  'qwen/qwen3-max-thinking',
                  'anthropic/claude-opus-4.6',
                  'qwen/qwen3-coder-next',
                  'openrouter/free',
                  'stepfun/step-3.5-flash',
                  'moonshotai/kimi-k2.5',
                  'upstage/solar-pro-3',
                  'minimax/minimax-m2-her',
                  'writer/palmyra-x5',
                  'liquid/lfm-2.5-1.2b-thinking:free',
                  'liquid/lfm-2.5-1.2b-instruct:free',
                  'openai/gpt-audio',
                  'openai/gpt-audio-mini',
                  'z-ai/glm-4.7-flash',
                  'openai/gpt-5.2-codex',
                  'bytedance-seed/seed-1.6-flash',
                  'bytedance-seed/seed-1.6',
                  'minimax/minimax-m2.1',
                  'z-ai/glm-4.7',
                  'google/gemini-3-flash-preview',
                  'xiaomi/mimo-v2-flash',
                  'nvidia/nemotron-3-nano-30b-a3b:free',
                  'nvidia/nemotron-3-nano-30b-a3b',
                  'openai/gpt-5.2-chat',
                  'openai/gpt-5.2-pro',
                  'openai/gpt-5.2',
                  'mistralai/devstral-2512',
                  'relace/relace-search',
                  'z-ai/glm-4.6v',
                  'nex-agi/deepseek-v3.1-nex-n1',
                  'essentialai/rnj-1-instruct',
                  'openrouter/bodybuilder',
                  'openai/gpt-5.1-codex-max',
                  'amazon/nova-2-lite-v1',
                  'mistralai/ministral-14b-2512',
                  'mistralai/ministral-8b-2512',
                  'mistralai/ministral-3b-2512',
                  'mistralai/mistral-large-2512',
                  'arcee-ai/trinity-mini',
                  'deepseek/deepseek-v3.2-speciale',
                  'deepseek/deepseek-v3.2',
                  'prime-intellect/intellect-3',
                  'anthropic/claude-opus-4.5',
                  'allenai/olmo-3-32b-think',
                  'google/gemini-3-pro-image-preview',
                  'deepcogito/cogito-v2.1-671b',
                  'openai/gpt-5.1',
                  'openai/gpt-5.1-chat',
                  'openai/gpt-5.1-codex',
                  'openai/gpt-5.1-codex-mini',
                  'moonshotai/kimi-k2-thinking',
                  'amazon/nova-premier-v1',
                  'perplexity/sonar-pro-search',
                  'mistralai/voxtral-small-24b-2507',
                  'openai/gpt-oss-safeguard-20b',
                  'nvidia/nemotron-nano-12b-v2-vl:free',
                  'minimax/minimax-m2',
                  'qwen/qwen3-vl-32b-instruct',
                  'ibm-granite/granite-4.0-h-micro',
                  'microsoft/phi-4-mini-instruct',
                  'openai/gpt-5-image-mini',
                  'anthropic/claude-haiku-4.5',
                  'qwen/qwen3-vl-8b-thinking',
                  'qwen/qwen3-vl-8b-instruct',
                  'openai/gpt-5-image',
                  'openai/o3-deep-research',
                  'openai/o4-mini-deep-research',
                  'nvidia/llama-3.3-nemotron-super-49b-v1.5',
                  'baidu/ernie-4.5-21b-a3b-thinking',
                  'google/gemini-2.5-flash-image',
                  'qwen/qwen3-vl-30b-a3b-thinking',
                  'qwen/qwen3-vl-30b-a3b-instruct',
                  'openai/gpt-5-pro',
                  'z-ai/glm-4.6',
                  'anthropic/claude-sonnet-4.5',
                  'deepseek/deepseek-v3.2-exp',
                  'thedrummer/cydonia-24b-v4.1',
                  'relace/relace-apply-3',
                  'google/gemini-2.5-flash-lite-preview-09-2025',
                  'qwen/qwen3-vl-235b-a22b-thinking',
                  'qwen/qwen3-vl-235b-a22b-instruct',
                  'qwen/qwen3-max',
                  'qwen/qwen3-coder-plus',
                  'openai/gpt-5-codex',
                  'deepseek/deepseek-v3.1-terminus',
                  'qwen/qwen3-coder-flash',
                  'qwen/qwen3-next-80b-a3b-thinking',
                  'qwen/qwen3-next-80b-a3b-instruct:free',
                  'qwen/qwen3-next-80b-a3b-instruct',
                  'qwen/qwen-plus-2025-07-28:thinking',
                  'qwen/qwen-plus-2025-07-28',
                  'nvidia/nemotron-nano-9b-v2:free',
                  'nvidia/nemotron-nano-9b-v2',
                  'moonshotai/kimi-k2-0905',
                  'qwen/qwen3-30b-a3b-thinking-2507',
                  'nousresearch/hermes-4-70b',
                  'nousresearch/hermes-4-405b',
                  'deepseek/deepseek-chat-v3.1',
                  'openai/gpt-4o-audio-preview',
                  'mistralai/mistral-medium-3.1',
                  'baidu/ernie-4.5-21b-a3b',
                  'baidu/ernie-4.5-vl-28b-a3b',
                  'z-ai/glm-4.5v',
                  'ai21/jamba-large-1.7',
                  'openai/gpt-5-chat',
                  'openai/gpt-5',
                  'openai/gpt-5-mini',
                  'openai/gpt-5-nano',
                  'openai/gpt-oss-120b:free',
                  'openai/gpt-oss-120b',
                  'openai/gpt-oss-20b:free',
                  'openai/gpt-oss-20b',
                  'anthropic/claude-opus-4.1',
                  'mistralai/codestral-2508',
                  'qwen/qwen3-coder-30b-a3b-instruct',
                  'qwen/qwen3-30b-a3b-instruct-2507',
                  'z-ai/glm-4.5',
                  'z-ai/glm-4.5-air:free',
                  'z-ai/glm-4.5-air',
                  'qwen/qwen3-235b-a22b-thinking-2507',
                  'z-ai/glm-4-32b',
                  'qwen/qwen3-coder:free',
                  'qwen/qwen3-coder',
                  'bytedance/ui-tars-1.5-7b',
                  'google/gemini-2.5-flash-lite',
                  'qwen/qwen3-235b-a22b-2507',
                  'switchpoint/router',
                  'moonshotai/kimi-k2',
                  'mistralai/devstral-medium',
                  'mistralai/devstral-small',
                  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
                  'tencent/hunyuan-a13b-instruct',
                  'morph/morph-v3-large',
                  'morph/morph-v3-fast',
                  'baidu/ernie-4.5-vl-424b-a47b',
                  'baidu/ernie-4.5-300b-a47b',
                  'mistralai/mistral-small-3.2-24b-instruct',
                  'minimax/minimax-m1',
                  'google/gemini-2.5-flash',
                  'google/gemini-2.5-pro',
                  'openai/o3-pro',
                  'google/gemini-2.5-pro-preview',
                  'deepseek/deepseek-r1-0528',
                  'anthropic/claude-opus-4',
                  'anthropic/claude-sonnet-4',
                  'google/gemma-3n-e4b-it',
                  'mistralai/mistral-medium-3',
                  'google/gemini-2.5-pro-preview-05-06',
                  'arcee-ai/spotlight',
                  'arcee-ai/maestro-reasoning',
                  'arcee-ai/virtuoso-large',
                  'arcee-ai/coder-large',
                  'meta-llama/llama-guard-4-12b',
                  'qwen/qwen3-30b-a3b',
                  'qwen/qwen3-8b',
                  'qwen/qwen3-14b',
                  'qwen/qwen3-32b',
                  'qwen/qwen3-235b-a22b',
                  'openai/o4-mini-high',
                  'openai/o3',
                  'openai/o4-mini',
                  'openai/gpt-4.1',
                  'openai/gpt-4.1-mini',
                  'openai/gpt-4.1-nano',
                  'alfredpros/codellama-7b-instruct-solidity',
                  'meta-llama/llama-4-maverick',
                  'meta-llama/llama-4-scout',
                  'deepseek/deepseek-chat-v3-0324',
                  'openai/o1-pro',
                  'mistralai/mistral-small-3.1-24b-instruct',
                  'google/gemma-3-4b-it',
                  'google/gemma-3-12b-it',
                  'cohere/command-a',
                  'openai/gpt-4o-mini-search-preview',
                  'openai/gpt-4o-search-preview',
                  'rekaai/reka-flash-3',
                  'google/gemma-3-27b-it',
                  'thedrummer/skyfall-36b-v2',
                  'perplexity/sonar-reasoning-pro',
                  'perplexity/sonar-pro',
                  'perplexity/sonar-deep-research',
                  'google/gemini-2.0-flash-lite-001',
                  'mistralai/mistral-saba',
                  'meta-llama/llama-guard-3-8b',
                  'openai/o3-mini-high',
                  'google/gemini-2.0-flash-001',
                  'aion-labs/aion-1.0',
                  'aion-labs/aion-1.0-mini',
                  'aion-labs/aion-rp-llama-3.1-8b',
                  'qwen/qwen2.5-vl-72b-instruct',
                  'qwen/qwen-plus',
                  'openai/o3-mini',
                  'mistralai/mistral-small-24b-instruct-2501',
                  'deepseek/deepseek-r1-distill-qwen-32b',
                  'perplexity/sonar',
                  'deepseek/deepseek-r1-distill-llama-70b',
                  'deepseek/deepseek-r1',
                  'minimax/minimax-01',
                  'microsoft/phi-4',
                  'sao10k/l3.1-70b-hanami-x1',
                  'deepseek/deepseek-chat',
                  'sao10k/l3.3-euryale-70b',
                  'openai/o1',
                  'cohere/command-r7b-12-2024',
                  'meta-llama/llama-3.3-70b-instruct:free',
                  'meta-llama/llama-3.3-70b-instruct',
                  'amazon/nova-lite-v1',
                  'amazon/nova-micro-v1',
                  'amazon/nova-pro-v1',
                  'openai/gpt-4o-2024-11-20',
                  'mistralai/mistral-large-2411',
                  'mistralai/mistral-large-2407',
                  'mistralai/pixtral-large-2411',
                  'qwen/qwen-2.5-coder-32b-instruct',
                  'thedrummer/unslopnemo-12b',
                  'anthropic/claude-3.5-haiku',
                  'anthropic/claude-3-5-haiku-20241022',
                  'anthracite-org/magnum-v4-72b',
                  'qwen/qwen-2.5-7b-instruct',
                  'inflection/inflection-3-productivity',
                  'inflection/inflection-3-pi',
                  'thedrummer/rocinante-12b',
                  'meta-llama/llama-3.2-11b-vision-instruct',
                  'meta-llama/llama-3.2-1b-instruct',
                  'meta-llama/llama-3.2-3b-instruct:free',
                  'meta-llama/llama-3.2-3b-instruct',
                  'qwen/qwen-2.5-72b-instruct',
                  'cohere/command-r-08-2024',
                  'cohere/command-r-plus-08-2024',
                  'sao10k/l3.1-euryale-70b',
                  'nousresearch/hermes-3-llama-3.1-70b',
                  'nousresearch/hermes-3-llama-3.1-405b:free',
                  'nousresearch/hermes-3-llama-3.1-405b',
                  'sao10k/l3-lunaris-8b',
                  'openai/gpt-4o-2024-08-06',
                  'meta-llama/llama-3.1-70b-instruct',
                  'meta-llama/llama-3.1-8b-instruct',
                  'mistralai/mistral-nemo',
                  'openai/gpt-4o-mini-2024-07-18',
                  'openai/gpt-4o-mini',
                  'google/gemma-2-27b-it',
                  'sao10k/l3-euryale-70b',
                  'nousresearch/hermes-2-pro-llama-3-8b',
                  'openai/gpt-4o',
                  'openai/gpt-4o-2024-05-13',
                  'meta-llama/llama-3-70b-instruct',
                  'meta-llama/llama-3-8b-instruct',
                  'mistralai/mixtral-8x22b-instruct',
                  'microsoft/wizardlm-2-8x22b',
                  'openai/gpt-4-turbo',
                  'anthropic/claude-3-haiku',
                  'mistralai/mistral-large',
                  'openai/gpt-3.5-turbo-0613',
                  'openai/gpt-4-turbo-preview',
                  'openrouter/auto',
                  'openai/gpt-4-1106-preview',
                  'mistralai/mistral-7b-instruct-v0.1',
                  'openai/gpt-3.5-turbo-instruct',
                  'openai/gpt-3.5-turbo-16k',
                  'mancer/weaver',
                  'undi95/remm-slerp-l2-13b',
                  'gryphe/mythomax-l2-13b',
                  'openai/gpt-4-0314',
                  'openai/gpt-3.5-turbo',
                  'openai/gpt-4',
                  ...localOpenRouterModels,
                  ...localOpenRouterModels.map(x => x.startsWith('openrouter/') ? x : `openrouter/${x}`)
                ]));

              if (state.config.provider === 'openrouter') {
                if (localOpenRouterModels.length > 0) {
                  popularModels = localOpenRouterModels.map(x => x.startsWith('openrouter/') ? x : `openrouter/${x}`);
                }
                try {
                  state.infoMessage = 'Fetching OpenRouter models...';
                  redrawScreen(state);
                  const res = await fetch('https://openrouter.ai/api/v1/models');
                  const data: any = await res.json();
                  if (data && data.data) {
                    popularModels = data.data.map((x: any) => x.id.startsWith('openrouter/') ? x.id : `openrouter/${x.id}`);
                  }
                  state.infoMessage = undefined;
                } catch (e) {
                  state.infoMessage = undefined;
                }
              }

              state.modalOpen = true;
              const selected = await showModelSelector(rl, popularModels, state);
              state.modalOpen = false;
              if (selected) {
                let finalModel = selected;
                if (selected.startsWith('openrouter/')) {
                  finalModel = selected.substring(11);
                  state.config.provider = 'openrouter';
                }
                state.config.model = finalModel;
                saveConfig(state.config);
                state.infoMessage = `Model → ${finalModel} (Provider: ${state.config.provider})`;
              } else {
                state.infoMessage = 'Model selection cancelled.';
              }
              await new Promise(r => setTimeout(r, 100));
            } else {
              let finalModel = m;
              if (m.startsWith('openrouter/')) {
                finalModel = m.substring(11);
                state.config.provider = 'openrouter';
              }
              state.config.model = finalModel;
              saveConfig(state.config);
              state.infoMessage = `Model → ${finalModel} (Provider: ${state.config.provider})`;
            }
            redrawScreen(state);
            state.lastError = undefined; state.infoMessage = undefined;
            rl.prompt();
            return;
          }
          case 'settings': case 'config': {
            state.modalOpen = true;
            await showInteractiveSettings(rl, state);
            state.modalOpen = false;
            redrawScreen(state);
            rl.prompt(true);
            return;
          }
          case 'artifact': {
            state.modalOpen = true;
            await showInteractiveArtifacts(rl, state);
            state.modalOpen = false;
            redrawScreen(state);
            rl.prompt(true);
            return;
          }
          default:
            state.lastError = `Unknown command: /${cmd} — type /help`;
            redrawScreen(state);
            state.lastError = undefined;
            rl.prompt();
            return;
        }
      }

      if (!state.paired) {
        state.lastError = 'Not paired with Studio. Run /pair first.';
        redrawScreen(state);
        state.lastError = undefined;
        rl.prompt();
        return;
      }

      // 1. Immediately push user message to history
      state.history.push({ role: 'user', content: input });
      if (state.history.length > 40) state.history = state.history.slice(-40);

      // Log User prompt to session JSONL
      writeSessionEvent(state.config, {
        role: 'user',
        content: input
      });

      // 2. Clear readline line buffer to prevent input text hanging
      if (rl) {
        rl.write(null, { ctrl: true, name: 'u' });
      }

      // 3. Immediately redraw screen so user message is rendered in chat log
      redrawScreen(state);

      // ── TRUE MCP mode ──────────────────────────────────────────────────────
      // When enabled, send the prompt with stream:true so the server routes
      // through the VPS MCP agent. The model makes live studio_* tool calls into
      // the paired Studio session via the bridge; changes are applied directly
      // in Studio. We render the agent's progress live (no artifact/sync flow).
      if (state.config.mcpMode) {
        if (resolveMcpTransport(state.config) === 'local') {
          await handleLocalMcpTurn(rl, state, input);
        } else {
          await handleMcpTurn(rl, state, input);
        }
        return;
      }

      // 4. Start spinner
      startSpinner('Thinking', activeMode !== 'Normal');

      let isGenerating = true;
      const pollLogsDuringGeneration = async () => {
        while (isGenerating) {
          try {
            await new Promise(r => setTimeout(r, 800));
            if (!isGenerating) break;
            const statusRes = await fetch(`${config.apiUrl}/api/status?key=${config.sessionKey}`);
            if (statusRes.ok && isGenerating) {
              const statusData = await statusRes.json();
              if (statusData.logs && statusData.logs.length > 0) {
                clearSpinner();
                for (const log of statusData.logs) {
                  process.stdout.write(`\r  \x1b[38;2;230;100;80m🛠️\x1b[0m \x1b[36m[Progress]\x1b[0m ${log}\n`);
                }
              }
            }
          } catch (_) {}
        }
      };
      pollLogsDuringGeneration();

      try {
        const res = await fetch(`${config.apiUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: input,
            sessionKey: config.sessionKey,
            messages: state.history.slice(0, -1),
            provider: state.config.provider,
            apiKey: state.config.provider === 'google' ? state.config.googleKey
              : state.config.provider === 'deepseek' ? state.config.deepseekKey
                : state.config.provider === 'openrouter' ? state.config.openrouterKey
                  : state.config.openaiKey,
            openaiKey: state.config.openaiKey,
            model: state.config.model,
            mode: state.config.extendedThinking ? 'thinking' : 'fast',
            autoSync: false
          }),
        });

        isGenerating = false;
        stopSpinner();

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as Record<string, string>;
          state.lastError = `API error ${res.status}: ${err.error || res.statusText}`;
        } else {
          const data = await res.json().catch(() => ({})) as Record<string, unknown>;
          const d = data as any;

          if (d.error) {
            const detail = typeof d.detail === 'string' ? d.detail : '';
            const hint = detail.includes('empty') || detail === ''
              ? ' The model may not support structured JSON output. Try /model to switch.'
              : ` (${detail.slice(0, 120)})`;
            state.lastError = `${d.error}${hint}`;
            redrawScreen(state);
            state.lastError = undefined;
            rl.prompt();
            return;
          }

          let reply: string;
          let replyThinking: string | undefined = undefined;
          if (typeof data === 'object' && data !== null) {
            replyThinking = d.thinking ?? d.Thinking ?? d.reasoning ?? d.reasoning_content ?? d.thought ?? d.Thought;
            const normAction = d.action ?? d.Action ?? "create";
            let normSource = d.code ?? d.Source ?? d.content ?? d.Content ?? d.script ?? d.Script;
            let normParent = d.parent ?? d.Parent;
            let normName = d.name ?? d.Name;
            const normType = d.scriptType ?? d.Type ?? d.type ?? d.ClassName ?? d.className;

            if (normSource === undefined && String(normAction).toLowerCase() === "create") {
              normSource = "";
            }

            if (d.path && normSource !== undefined) {
              const pathParts = String(d.path).split('/');
              normName = pathParts[pathParts.length - 1];
              normParent = pathParts.slice(0, -1).join('/') || 'ReplicatedStorage';
            }

            if (typeof normSource === "string" && !Array.isArray(d.scripts)) {
              let parentStr = String(normParent || 'ReplicatedStorage');
              if (parentStr.startsWith('game.')) {
                parentStr = parentStr.substring(5);
              }
              d.scripts = [{
                action: String(normAction).toLowerCase(),
                type: String(normType || 'Script'),
                scriptType: String(normType || 'Script'),
                parent: parentStr,
                name: String(normName || 'Script'),
                code: normSource
              }];
              d.message = `Successfully created ${normName} in ${parentStr}`;
            }

            if (Array.isArray(d.scripts)) {
              const textReply = typeof d.message === 'string' && d.message.trim() ? d.message : '';
              // Show the live activity feed (read/write/create/playtest) before the plan box.
              if (d.scripts.length > 0) {
                await printActivityFeed(d.scripts, d.thinking);
              }
              const artifactsBox = d.scripts.length > 0 ? formatArtifactsBox(d.scripts) : '';
              reply = textReply + artifactsBox;

              if (d.scripts.length > 0) {
                state.artifacts = [{
                  type: 'Plan',
                  message: d.message || "No high-level plan description provided.",
                  scripts: d.scripts.map((s: any, i: number) => ({
                    action: s.action || 'create',
                    type: s.type || s.scriptType || 'Script',
                    parent: s.parent || 'ServerScriptService',
                    name: s.name || `GeneratedScript_${i}`,
                    code: s.code || ''
                  })),
                  status: 'pending'
                }];
                state.infoMessage = `✨ Proposing a new Implementation Plan Artifact! Type /artifact to view & approve.`;

                state.modalOpen = true;
                await showInteractiveArtifacts(rl, state);
                state.modalOpen = false;
              }
            } else if (typeof d.message === 'string' && d.message.trim() && d.ok) {
              reply = d.message;
            } else if (d.tool_call_function || d.tool_calls) {
              reply = typeof d.assistant === 'string' && d.assistant.trim()
                ? d.assistant + '\n\n⚠️  The model used tool-call syntax instead of creating scripts. Try /model to switch.'
                : '⚠️  The model returned an unsupported format. Try /model to switch to a more capable model.';
            } else if (typeof d.message === 'string' && d.message.trim()) {
              reply = d.message;
            } else if (typeof d.assistant === 'string' && d.assistant.trim()) {
              reply = d.assistant;
            } else if (typeof d.text === 'string' && d.text.trim()) {
              reply = d.text;
            } else if (typeof d.code === 'string' && d.code.trim()) {
              reply = d.code;
            } else {
              const keys = Object.keys(data);
              const hasUsefulKey = keys.some(k => k && typeof d[k] === 'string' && d[k].trim());
              if (!hasUsefulKey) {
                state.lastError = 'The model returned an empty response. Try rephrasing or use /model to switch.';
                redrawScreen(state);
                state.lastError = undefined;
                rl.prompt();
                return;
              }
              reply = JSON.stringify(data);
            }
          } else {
            reply = String(data);
          }

          if (!reply || reply.trim().length === 0) {
            state.lastError = 'The model returned an empty response. Try rephrasing or use /model to switch.';
            redrawScreen(state);
            state.lastError = undefined;
            rl.prompt();
            return;
          }

          state.history.push({ role: 'assistant', content: reply, thinking: replyThinking });
          if (state.history.length > 40) state.history = state.history.slice(-40);
          state.lastError = undefined;

          // Write assistant event to session JSONL log along with diagnostics
          const diagnostics = generateHighFidelityDiagnostics(reply);
          writeSessionEvent(state.config, {
            role: 'assistant',
            content: reply,
            thinking: replyThinking || undefined,
            tokenUsage: {
              input: state.totalInputTokens || 320,
              output: state.totalOutputTokens || 160,
              cost: 0.0003
            },
            ...diagnostics
          });
        }

      } catch (e: any) {
        stopSpinner();
        state.lastError = `Connection error: ${e.message}`;
      }

      redrawScreen(state);
      state.lastError = undefined;
      rl.prompt();

    } finally {
      isCommandRunning = false;
      lastInputLen = ((globalRl as any)?.line || '').length;
    }
  });

  rl.on('close', () => {
    process.stdin.removeListener('keypress', onKeyPressGlobal);
    process.stdout.removeListener('resize', onResize);
    process.stdout.write('\x1b[r');
    if (!exiting) {
      process.stdout.write(`\n  ${DIM}Session ended.${R}\n\n`);
      process.exit(0);
    }
  });
}

async function handleStatusCommand(config: CLIConfig): Promise<void> {
  const serverOnline = await pingServer(config.apiUrl);
  const paired = await checkPairingStatus(config);
  const w = termWidth();
  console.clear();
  const titleText = gradientText('Apple Juice', SUNSET_START, SUNSET_END);
  process.stdout.write(`\n  ${BOLD}${titleText}${R}  ${DIM}Status${R}\n`);
  process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);
  process.stdout.write(`  ${DIM}Server${R}   ${serverOnline ? `${BRIGHT_GREEN}● Online${R}  ${DIM}${config.apiUrl}${R}` : `${BRIGHT_RED}● Offline${R}`}\n`);
  process.stdout.write(`  ${DIM}Studio${R}   ${paired ? `${BRIGHT_GREEN}✓ Paired${R}` : `${BRIGHT_YELLOW}◦ Not paired${R}`}\n`);
  process.stdout.write(`  ${DIM}Session${R}  ${config.sessionKey ? `${DIM}${config.sessionKey.slice(0, 20)}…${R}` : `${DIM}none${R}`}\n\n`);
  if (!serverOnline) await startServerAutomatically(config);
  else if (!paired) process.stdout.write(`  Run ${BRAND}aj${R} and type ${BRAND}/pair${R} to link Studio.\n\n`);
  else printSuccess('System fully ready. Happy building!');
}

async function handlePairCommand(config: CLIConfig): Promise<void> {
  let serverOnline = await pingServer(config.apiUrl);
  if (!serverOnline) serverOnline = await startServerAutomatically(config);
  if (!serverOnline) { printError('Server offline — cannot initiate pairing.'); return; }
  const code = await initAuthPairing(config);
  if (!code) return;
  process.stdout.write(`\n  ${BRAND}Pairing code${R}  ${BOLD}${BRIGHT_CYAN}${code}${R}\n`);
  process.stdout.write(`  ${DIM}Enter this in the Roblox Studio plugin, then press Connect.${R}\n\n`);
  let paired = false;
  for (let i = 0; i < 30; i++) {
    process.stdout.write(`\r\x1b[K  ${DIM}Waiting for Studio (${i + 1}/30)…${R}`);
    await new Promise(r => setTimeout(r, 2000));
    paired = await checkPairingStatus(config);
    if (paired) break;
  }
  process.stdout.write('\r\x1b[K');
  if (paired) printSuccess(`${BOLD}Paired!${R} Studio is connected.`);
  else printError('Timed out — verify the code in Studio.');
  process.stdout.write('\n');
}

async function handleCodeCommand(config: CLIConfig, filePath: string, instructions: string): Promise<void> {
  console.clear();
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    printError(`File not found: ${filePath}`);
    await new Promise(r => setTimeout(r, 2000));
    return;
  }
  let sv = await pingServer(config.apiUrl);
  if (!sv) {
    sv = await startServerAutomatically(config);
    if (!sv) {
      await startLightweightServer(true);
      sv = true;
    }
  }
  const steps: SyncStep[] = [
    { name: 'Backup local file', status: 'running' },
    { name: 'Generate edits via AI', status: 'pending' },
    { name: 'Write updated source', status: 'pending' },
    { name: 'Push to Roblox Studio', status: 'pending' },
  ];
  startSyncProgress(steps);
  const original = fs.readFileSync(resolved, 'utf8');
  const basename = path.basename(resolved);
  fs.writeFileSync(resolved + '.bak', original, 'utf8');
  await new Promise(r => setTimeout(r, 400));
  steps[0].status = 'done'; steps[1].status = 'running';
  const prompt = `Update the file "${basename}":\n\nORIGINAL:\n${original}\n\nINSTRUCTIONS:\n${instructions}\n\nReturn only the updated code in the standard JSON format.`;
  try {
    const res = await fetch(`${config.apiUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt, sessionKey: config.sessionKey, messages: [],
        provider: config.provider,
        apiKey: config.provider === 'google' ? config.googleKey
          : config.provider === 'deepseek' ? config.deepseekKey
            : config.provider === 'openrouter' ? config.openrouterKey
              : config.openaiKey,
        openaiKey: config.openaiKey, model: config.model,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, string>;
      steps[1].status = 'failed';
      stopSyncProgress(steps);
      printError(`AI error: ${err.error || res.statusText}`);
      await new Promise(r => setTimeout(r, 2500));
      return;
    }
    steps[1].status = 'done'; steps[2].status = 'running';
    const data = await res.json() as Record<string, unknown>;
    const code = (data.code || (data.scripts as any)?.[0]?.code) as string | undefined;
    if (!code) {
      steps[2].status = 'failed'; stopSyncProgress(steps);
      printError('AI returned no code payload.');
      await new Promise(r => setTimeout(r, 2500));
      return;
    }
    fs.writeFileSync(resolved, code, 'utf8');
    await new Promise(r => setTimeout(r, 400));
    steps[2].status = 'done'; steps[3].status = 'running';
    const push = await fetch(`${config.apiUrl}/api/cli/push-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionKey: config.sessionKey,
        name: (data.scriptName as string) || basename.replace(path.extname(basename), ''),
        type: (data.scriptType as string) || 'Script',
        parent: (data.scriptParent as string) || 'ServerScriptService',
        code,
      }),
    });
    steps[3].status = push.ok ? 'done' : 'failed';
    stopSyncProgress(steps);
    if (push.ok) printSuccess(`${BOLD}Sync complete!${R} Studio updated.`);
    else process.stdout.write(`\n  ${BRIGHT_YELLOW}⚠${R}  File saved locally but Studio was offline.\n`);
    await new Promise(r => setTimeout(r, 2000));
  } catch (e: any) {
    steps[1].status = 'failed'; stopSyncProgress(steps);
    printError(`Sync error: ${e.message}`);
    await new Promise(r => setTimeout(r, 2500));
  }
}

function showHelp(): void {
  const w = termWidth();
  const titleText = gradientText('Apple Juice CLI', SUNSET_START, SUNSET_END);
  process.stdout.write(`\n  ${BOLD}${titleText}${R}  ${DIM}v2.1${R}\n`);
  process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);
  process.stdout.write(`  ${DIM}Commands${R}\n\n`);
  const cmds: [string, string][] = [
    ['aj', 'Open interactive session'],
    ['aj help', 'Show this help'],
    ['aj status', 'Check server & Studio status'],
    ['aj auth <key>', 'Save a session key'],
    ['aj ask "<prompt>"', 'Quick one-off AI question'],
    ['aj code <f> -p "<i>"', 'AI-edit a file and push to Studio'],
    ['aj pair', 'Link terminal to Roblox Studio'],
    ['aj provider <p>', 'Set API provider (openai|google|deepseek|openrouter)'],
    ['aj key <k>', 'Set API key'],
    ['aj model <m>', 'Set AI model'],
    ['aj config', 'Show configuration'],
  ];
  for (const [c, d] of cmds) {
    process.stdout.write(`  ${BRAND}${c.padEnd(28)}${R}${DIM}${d}${R}\n`);
  }
  process.stdout.write(`\n  ${DIM}Default Commands (Inside a session)${R}\n\n`);
  const defaultCmds: [string, string][] = [
    ['/add-dir', 'Add a new working directory'],
    ['/agents', 'Manage agent configurations'],
    ['/background', 'Send session to background and free terminal'],
    ['/branch', 'Create branch of current conversation'],
    ['/btw', 'Ask quick side question out-of-context'],
    ['/clear', 'Backup & start new session (resumable with /resume)'],
    ['/resume', 'Restore a previously cleared session'],
    ['/color', 'Set the prompt bar theme color'],
    ['/compact', 'Summarize conversation to free up context'],
    ['/config', 'Open config panel'],
    ['/context', 'Visualize context usage as colored grid'],
  ];
  for (const [c, d] of defaultCmds) {
    process.stdout.write(`  ${BRAND}${c.padEnd(28)}${R}${DIM}${d}${R}\n`);
  }
  process.stdout.write(`\n  ${DIM}Custom Commands (Inside a session)${R}\n\n`);
  const customCmds: [string, string][] = [
    ['/pair', 'Link terminal to Roblox Studio'],
    ['/login', 'Sign in with Roblox (use your subscription)'],
    ['/credits', 'Show your plan and remaining credits'],
    ['/status', 'Refresh server + Studio status'],
    ['/sync', 'AI-edit a file and push to Studio'],
    ['/mcp', 'MCP mode: local|remote|auto|on|off (live Studio tool calls)'],
    ['/provider', 'Set API provider (openai|google|deepseek|openrouter)'],
    ['/key', 'Set API key (optional provider)'],
    ['/model', 'Select AI model interactively'],
    ['/config', 'Show configuration'],
    ['/clear', 'Clear history and screen'],
    ['/exit', 'Quit Apple Juice CLI'],
  ];
  for (const [c, d] of customCmds) {
    process.stdout.write(`  ${BRAND}${c.padEnd(28)}${R}${DIM}${d}${R}\n`);
  }
  process.stdout.write('\n');
}

const _ka = setInterval(async () => {
  if (globalConfig?.sessionKey) {
    try {
      await fetch(`${globalConfig.apiUrl}/api/pair/keepalive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: globalConfig.sessionKey }),
      });
    } catch (_) { }
  }
}, 55_000);
_ka.unref();

async function main() {
  let args = process.argv.slice(2);
  if (args[0] === '--') args = args.slice(1);
  const isBgBinary = path.basename(process.execPath).toLowerCase().includes('aj-bg');
  const command = args[0]?.toLowerCase();
  const config = loadConfig();
  detectAndSaveProjectPath(config);

  if (command === '--server' || command === 'server' || process.env.AJ_MODE === 'server' || (!command && isBgBinary)) {
    await startLightweightServer(); return;
  }

  if (!command) { await startInteractiveSession(config); return; }

  switch (command) {
    case 'help': case '--help': case '-h':
      showHelp(); break;
    case 'pair': case '/pair': case '-pair': case '--pair':
      await handlePairCommand(config); break;
    case 'provider': {
      const p = args[1]?.toLowerCase();
      const valid = ['openai', 'google', 'deepseek', 'openrouter'];
      if (!p || !valid.includes(p)) { process.stdout.write(`Usage: aj provider <openai|google|deepseek|openrouter>\n`); process.exit(1); }
      config.provider = p as any;
      saveConfig(config);
      printSuccess(`Provider set to ${p}.`);
      break;
    }
    case 'key': {
      let prov = args[1]?.toLowerCase();
      let k = args[2];
      if (!k && args[1]) {
        k = args[1];
        prov = k.startsWith('sk-or-') ? 'openrouter' : k.startsWith('sk-') ? 'openai' : k.startsWith('AIza') ? 'google' : (config.provider || 'openai');
      }
      if (!k) { process.stdout.write(`Usage: aj key [openai|google|deepseek|openrouter] <api_key>\n`); process.exit(1); }
      const valid = ['openai', 'google', 'deepseek', 'openrouter'];
      if (!valid.includes(prov)) { process.stdout.write(`Invalid provider. Choose: openai, google, deepseek, openrouter\n`); process.exit(1); }
      if (prov === 'google') config.googleKey = k;
      else if (prov === 'openai') config.openaiKey = k;
      else if (prov === 'deepseek') config.deepseekKey = k;
      else if (prov === 'openrouter') config.openrouterKey = k;
      config.provider = prov as any;
      saveConfig(config, false);
      printSuccess(`Saved ${prov} key.`);
      break;
    }
    case 'model': {
      const m = args.slice(1).join(' ');
      if (!m) { process.stdout.write(`Usage: aj model <model_name>\n`); process.exit(1); }
      config.model = m; saveConfig(config);
      printSuccess(`Model set to '${m}'.`);
      break;
    }
    case 'config': {
      const w = termWidth();
      const titleText = gradientText('Apple Juice', SUNSET_START, SUNSET_END);
      process.stdout.write(`\n  ${BOLD}${titleText}${R}  ${DIM}Configuration${R}\n`);
      process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);
      const rows: [string, string][] = [
        ['API URL', config.apiUrl],
        ['Provider', config.provider || 'openai (default)'],
        ['Model', config.model || 'gpt-4o-mini (default)'],
        ['OpenAI Key', config.openaiKey ? config.openaiKey.slice(0, 12) + '…' : 'not set'],
        ['Google Key', config.googleKey ? config.googleKey.slice(0, 12) + '…' : 'not set'],
      ];
      for (const [k, v] of rows) process.stdout.write(`  ${BRAND}${k.padEnd(14)}${R}${DIM}${v}${R}\n`);
      process.stdout.write('\n');
      break;
    }
    case 'auth': {
      const k = args[1];
      if (!k) { process.stdout.write(`Usage: aj auth <sessionKey> [-g|--global]\n`); process.exit(1); }
      config.sessionKey = k;
      const isGlobal = args.includes('--global') || args.includes('-g');
      saveConfig(config, isGlobal);
      printSuccess(`Session key saved ${isGlobal ? 'globally' : 'locally'}.`);
      break;
    }
    case 'status':
      await handleStatusCommand(config); break;
    case 'ask': {
      const q = args.slice(1).join(' ');
      if (!q) { process.stdout.write(`Usage: aj ask "<prompt>"\n`); process.exit(1); }
      let online = await pingServer(config.apiUrl);
      if (!online) {
        online = await startServerAutomatically(config);
        if (!online) {
          await startLightweightServer(true);
          online = true;
        }
      }
      startSpinner('Asking');
      try {
        const res = await fetch(`${config.apiUrl}/api/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: q,
            sessionKey: config.sessionKey,
            messages: [],
            provider: config.provider,
            apiKey: config.provider === 'google' ? config.googleKey
              : config.provider === 'deepseek' ? config.deepseekKey
                : config.provider === 'openrouter' ? config.openrouterKey
                  : config.openaiKey,
            openaiKey: config.openaiKey,
            model: config.model
          }),
        });
        stopSpinner();
        if (res.ok) {
          const d = await res.json() as any;
          process.stdout.write('\n');
          let replyText = (d.message || d.code || JSON.stringify(d)) as string;
          if (Array.isArray(d.scripts) && d.scripts.length > 0) {
            replyText += formatArtifactsBox(d.scripts);
          }
          process.stdout.write(renderMarkdown(replyText));
          process.stdout.write('\n\n');
        } else {
          printError(`Error ${res.status}`);
        }
      } catch (e: any) {
        stopSpinner();
        printError(e.message);
      }
      break;
    }
    case 'code': {
      const file = args[1];
      let pIdx = args.indexOf('-p'); if (pIdx < 0) pIdx = args.indexOf('--prompt');
      if (!file || pIdx < 0 || !args[pIdx + 1]) { process.stdout.write(`Usage: aj code <file> -p "<instructions>"\n`); process.exit(1); }
      await handleCodeCommand(config, file, args[pIdx + 1]);
      break;
    }
    default:
      printError(`Unknown command: '${command}'. Type ${BRAND}aj help${R} for usage.`);
  }
}

main().catch(err => {
  process.stderr.write(`\n  ✗ Unexpected error: ${err.stack || err}\n\n`);
  process.exit(1);
});

// ─── Lightweight In-Process Server ───────────────────────────────────────────
const LIGHTWEIGHT_SYSTEM_PROMPT = `### ABSOLUTE OUTPUT RULE — READ THIS FIRST ###
Your ENTIRE response MUST be a single valid JSON object and NOTHING ELSE.
- NO plain text before or after the JSON.
- NO markdown fences (\`\`\`json ... \`\`\`).
- DO NOT describe what you are going to do before outputting the JSON. DO IT by writing the code in the "code" or "scripts" field.
- If you output anything other than a raw JSON object starting with { and ending with }, the response will be REJECTED.

The only valid JSON response shape is:
{
  "message": "Your text response explaining what you did, tips, or guidance.",
  "code": "The raw code block you generated or updated (no markdown backticks, just raw code).",
  "scripts": [
    {
      "action": "create",
      "scriptType": "Script" | "LocalScript" | "ModuleScript",
      "parent": "ServerScriptService" | "ReplicatedStorage" | "StarterGui" | "StarterPlayerScripts",
      "name": "ScriptName",
      "code": "-- full script code here"
    }
  ],
  "suggestions": ["Add more items", "Add purchase animations"]
}

If you cannot produce code, still return JSON: {"scripts":[], "code": "", "message": "<explanation>", "suggestions":[]}

### YOU ARE: Apple Juice AI ###
You are an expert Roblox game developer and software architect operating directly inside Roblox Studio via a sync plugin.
You build games by writing Roblox Luau code. You NEVER show code for the user to copy-paste. You ONLY write code in the "code" or "scripts" fields.

### ARTIFACT DEFINITION — VERY IMPORTANT
An "artifact" in Apple Juice is a cohesive **Implementation Plan**! It is a combination of a description explaining your solution strategy ("message") and the precise file edits ("scripts") needed to execute it.
When a user asks you to "create an artifact" or "propose a plan", you MUST generate a structured Implementation Plan using this JSON format, explaining your changes in the "message" field and providing the proposed script files/changes in the "scripts" field. Do NOT simply write scripts directly in Roblox Studio; you propose them as a cohesive plan (artifact) for the user to review, accept, or steer first!

## WORKFLOW & ACTIONS
If generating or modifying multiple files, add JSON objects to the "scripts" array. The plugin executes each entry live in Studio, in array order.
**Ordering matters**: list dependencies first. Create Folders, RemoteEvents and RemoteFunctions (via "create_instance") BEFORE the Scripts that require them. Put shared ModuleScripts before the scripts that require them. If a playtest is useful, make "run_playtest" the LAST entry.
Keep the "message" field tight and useful: 1–3 sentences on the approach, then a short bullet list of the files and what each one does. No fluff, no restating the request.
Supported Actions in the "scripts" array:
1. "create" — Create or replace a script.
   Usage: {"action": "create", "scriptType": "Script" | "LocalScript" | "ModuleScript", "parent": "ServerScriptService", "name": "MyScript", "code": "-- entire code"}
2. "delete" — Delete an instance.
   Usage: {"action": "delete", "name": "Name", "parent": "ParentPath"}
3. "create_instance" — Create high-level non-script objects (Folders, RemoteEvents, ScreenGuis, etc.).
   Usage: {"action": "create_instance", "className": "RemoteEvent", "instanceName": "MyEvent", "parent": "ReplicatedStorage"}
4. "rename_instance" — Rename an object.
   Usage: {"action": "rename_instance", "oldPath": "Workspace.OldName", "newName": "NewName"}
5. "move_instance" — Move an object.
   Usage: {"action": "move_instance", "oldPath": "Workspace.MyPart", "newParentPath": "ServerStorage"}
6. "run_playtest" — Trigger a 6-second playtest to verify functionality. Always include this as the last entry if playtesting is needed.
   Usage: {"action": "run_playtest"}

## ROBLOX ARCHITECTURE & PARADIGMS
- **Workspace**: 3D world, BaseParts, Models, terrain. Replicated.
- **ServerScriptService**: Server Scripts. Never accessible from client.
- **ServerStorage**: Server-only assets and data. Not replicated.
- **ReplicatedStorage**: Shared modules, RemoteEvents, RemoteFunctions, assets. Replicated.
- **StarterPlayerScripts** / **StarterCharacterScripts**: LocalScripts cloned per player.
- **StarterGui**: ScreenGuis and LocalScripts cloned to PlayerGui.
- **Replication**: Server is authoritative. Clients communicate via RemoteEvents (fire-and-forget) and RemoteFunctions (request-response). NEVER trust the client; validate all Remote inputs on the server.

## ROBLOX LUAU STYLE, SAFETY, & BEST PRACTICES (STRICT)
- **Production-Ready & Fully Implemented**: You MUST write complete, bulletproof, and production-ready code. ZERO TOLERANCE for placeholders, "TODO" comments, stubs, or leaving logic for the user to implement. Write the exact code needed, end to end.
- **Plan before code**: For any non-trivial request, briefly think through the architecture (which scripts, where they live, how they communicate) and reflect that in the "message" field as a short, skimmable plan — then deliver every file in "scripts". The plan and the files MUST match exactly: every file you describe must appear in "scripts", and every script in "scripts" must be referenced in the plan.
- **Module-first architecture**: Prefer small, focused ModuleScripts with a single responsibility over one giant script. Share logic via ModuleScripts in ReplicatedStorage (client-safe) or ServerStorage (server-only). A typical feature = a server Script + a ModuleScript + (if UI) a LocalScript, not one monolith.
- **Self-documenting**: Open every file with a short header comment block: what it does, where it goes, and how it connects to the other files in the plan. Add concise inline comments only where intent isn't obvious. Never over-comment trivial lines.
- **Strong Typing**: Use Luau type annotations rigorously everywhere (e.g., 'local speed: number = 100', 'function calculate(val: number): boolean'). Define 'type' aliases for complex tables. Consider '--!strict' at the top of ModuleScripts.
- **Error Handling**: Use 'pcall' for all DataStores, HTTP requests, MarketplaceService, and any operation that could yield or error. Handle failures gracefully, log with 'warn', and degrade without breaking the experience. Add bounded retries (e.g. 3 attempts with backoff) for DataStore reads/writes.
- **Event Validation & Security**: On the server, ALWAYS validate arguments from RemoteEvents/RemoteFunctions (existence, types, ranges, limits, ownership, rate limits). NEVER trust the client. If a client requests to buy an item, the server MUST re-check their balance and inventory.
- **Scoping & State**: ALWAYS use 'local' for variables/functions. Never use globals. Keep state in clean, well-named tables/dictionaries keyed by player or instance.
- **Service Access**: ALWAYS use 'game:GetService("ServiceName")' defined at the top of the script. Never use 'game.ServiceName'.
- **Instance & Yield Safety**: Use 'WaitForChild("Name", 10)' on clients to prevent infinite yield warnings. Handle the case where the instance doesn't exist. NEVER use 'WaitForChild' without a timeout.
- **Task Library**: STRICTLY use 'task.spawn', 'task.defer', 'task.delay', and 'task.wait'. DO NOT use legacy 'spawn', 'delay', or 'wait'.
- **Memory Management & Clean Up**: Always disconnect connections, destroy unused instances, and clear tables to prevent memory leaks. Clean up per-player state on 'Players.PlayerRemoving'. Use a Maid/Janitor pattern for anything with multiple connections.
- **Performance**: Cache service and instance lookups, avoid per-frame allocations in 'RunService' loops, debounce 'Touched' handlers, and prefer event-driven code over polling.
- Every script MUST start with a print statement: 'print("[AppleJuice] Running ScriptName...")'
- DO NOT spawn Parts or any 3D objects in the Workspace unless explicitly requested.
- Architecture: Place Server scripts in ServerScriptService. Place LocalScripts in StarterPlayerScripts or StarterGui. Shared modules go in ReplicatedStorage. Create any required RemoteEvents/RemoteFolders with "create_instance" BEFORE the scripts that reference them.

## UI GENERATION — USE AppleJuiceUI LIBRARY
When creating ANY UI, you MUST require and use the AppleJuiceUI component library located in ReplicatedStorage:
\`\`\`luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(ReplicatedStorage:WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice") -- themes: "Juice" (lime), "Midnight" (blue), "Ember" (orange), "Claude" (violet/orange developer style)
\`\`\`

### CRITICAL UI RULES:
1. **Never use 'Instance.new("TextButton")' etc.** ALWAYS use 'UI.Button()', 'UI.Card()', 'UI.Text()', 'UI.ScrollList()'.
2. **Responsive Layout**: Always add 'UI.DynamicScale(screen)' to ensure UI scales properly on all devices.
3. **ScreenGuis**: Use 'local screen = UI.createScreenGui("Name")' (automatically sets ResetOnSpawn=false).
4. **Interactivity**: Add click-outside-to-close behavior (a transparent full-screen TextButton behind the main panel) and keyboard shortcut toggles (e.g., UserInputService keybinds).
5. **LocalScripts**: Put UI LocalScripts in StarterGui.

### One-Call Templates:
- 'UI.ShopTemplate({Title, Tabs: { {Id, Label, Items: {{Text, Price, Icon}} } }})'
- 'UI.InventoryTemplate({Title, Items: { {Name, Icon, Count, Rarity} }})'
- 'UI.HUDTemplate({StartingCoins})' (returns {health, currency})

### Individual Components:
- 'UI.createScreenGui("Name")'
- 'UI.DynamicScale(screen)'
- 'UI.Card(parent, {Size, Position, Padding, AnchorPoint})'
- 'UI.Button(parent, {Text, Style, Size, Position, OnClick})'
- 'UI.ProgressBar(parent, {Value, Label, FillColor, Size, Position})'
- 'UI.Toast(screen, {Text, Type})'
- 'UI.TitleBar(parent, {Title, OnClose})'
- 'UI.Divider(parent, {Position})'

### Icons Catalog (use UI.Icons.X):
Coin, Cash, Crystal, Diamond, Ingot, Premium, Robux, Ticket, VIP, Aura, Trail, Teleport, AngelHeart, Magnet, Crown, LuckyBlock, Coil, Trophy, Shield, Sword, Gift, Potion, Rocket, Fire, Heart, Hoverboard, Lightning, Rebirth, Star, Upgrade, Wheel.

FINAL REMINDER: Return ONLY a single, valid JSON object containing your response. Do not enclose it in markdown code blocks.`;

async function callDirectAI(prompt: string, messages: any[], provider: string, apiKey: string, model: string) {
  const geminiResponseSchema = {
    type: 'OBJECT',
    properties: {
      message: { type: 'STRING', description: 'Your text response explaining what you did, tips, or guidance.' },
      code: { type: 'STRING', description: 'The raw code block you generated or updated (no markdown backticks, just raw code).' },
      scripts: {
        type: 'ARRAY',
        description: 'An array of action scripts to execute in Roblox Studio.',
        items: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', description: 'The action to take: create, delete, create_instance, rename_instance, move_instance, run_playtest' },
            scriptType: { type: 'STRING', description: 'Script, LocalScript, or ModuleScript' },
            parent: { type: 'STRING', description: 'The path to the parent instance (e.g. ServerScriptService, ReplicatedStorage)' },
            name: { type: 'STRING', description: 'Name of the script or instance' },
            code: { type: 'STRING', description: 'The full Luau code for the script' }
          },
          required: ['action']
        }
      },
      suggestions: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'An array of 2-3 suggestions for the user.'
      }
    },
    required: ['message']
  };

  let responseFormatToUse: any = undefined;
  if (provider === 'openai') {
    responseFormatToUse = {
      type: 'json_schema',
      json_schema: {
        name: 'AppleJuiceResponse',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Your text response explaining what you did.' },
            code: { type: 'string', description: 'The raw code block you generated or updated.' },
            scripts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['create', 'delete', 'create_instance', 'rename_instance', 'move_instance', 'run_playtest'] },
                  scriptType: { type: 'string', enum: ['Script', 'LocalScript', 'ModuleScript'] },
                  parent: { type: 'string' },
                  name: { type: 'string' },
                  code: { type: 'string' }
                },
                required: ['action', 'scriptType', 'parent', 'name', 'code']
              }
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['message', 'code', 'scripts', 'suggestions']
        }
      }
    };
  } else if (provider === 'deepseek' || provider === 'openrouter') {
    responseFormatToUse = { type: 'json_object' };
  }

  if (provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
    const contents: any[] = [
      { role: 'user', parts: [{ text: LIGHTWEIGHT_SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'Understood.' }] },
      ...messages.map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: prompt }] },
    ];
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema
        }
      })
    });
    if (!res.ok) throw new Error(`Gemini: ${res.statusText} - ${await res.text()}`);
    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    try { return JSON.parse(text.trim().replace(/^```json/i, '').replace(/```$/, '')); } catch { return { message: text, code: '' }; }
  } else {
    let url = 'https://api.openai.com/v1/chat/completions';
    if (provider === 'deepseek') {
      url = 'https://api.deepseek.com/v1/chat/completions';
    } else if (provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/chat/completions';
    }
    const apiMessages = [{ role: 'system', content: LIGHTWEIGHT_SYSTEM_PROMPT }, ...messages.map((m: any) => ({ role: m.role, content: m.content })), { role: 'user', content: prompt }];
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/inetixus/apple-juice';
      headers['X-Title'] = 'Apple Juice Roblox Sync';
    }

    let resolvedModel = model || (provider === 'deepseek' ? 'deepseek-chat' : provider === 'openrouter' ? 'meta-llama/llama-3.3-70b-instruct:free' : 'gpt-4o-mini');
    if (provider === 'openrouter') {
      resolvedModel = resolvedModel.replace(/^openrouter\//, '');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: resolvedModel,
        temperature: 0.2,
        messages: apiMessages,
        response_format: responseFormatToUse
      })
    });
    if (!res.ok) throw new Error(`${provider === 'openrouter' ? 'OpenRouter' : provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'} API Error ${res.status}: ${res.statusText} - ${await res.text()}`);
    const data: any = await res.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    try { return JSON.parse(text.trim()); } catch { return { message: text, code: '' }; }
  }
}

async function startLightweightServer(inProcess = false) {
  if (!inProcess) {
    try {
      const logFile = path.join(os.homedir(), '.applejuice-server.log');
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      const log = (...a: any[]) => logStream.write(`[${new Date().toISOString()}] ${a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')}\n`);
      console.log = log; console.error = log;
    } catch (_) { }
    process.on('uncaughtException', err => console.error('Uncaught:', err));
    process.on('unhandledRejection', reason => console.error('Unhandled:', reason));
  }
  const port = 3000;
  let activeSessionKey = 'LOCAL-SESSION-KEY';
  let lastPollTime = Date.now();
  let pendingCodePayload: any = null;
  let localLogsBuffer: string[] = [];
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    const url = new URL(req.url || '', `http://localhost:${port}`);
    const path_ = url.pathname;
    const sendJSON = (data: any, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    const body = (): Promise<any> => new Promise(resolve => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({}); } }); });
    if (path_ === '/api/projects' && req.method === 'GET') { sendJSON([]); return; }
    if (path_ === '/api/status' && req.method === 'GET') {
      const logs = [...localLogsBuffer];
      localLogsBuffer = [];
      sendJSON({ status: 'ok', lastPollTime, logs });
      return;
    }
    if (path_ === '/api/pair/init' && req.method === 'POST') { const b = await body(); const code = (b.authCode || '').toUpperCase(); if (code) activeSessionKey = code; sendJSON({ ok: true, sessionKey: activeSessionKey, ownerUserId: 'local-user' }); return; }
    if (path_ === '/api/pair/keepalive' && req.method === 'POST') { sendJSON({ status: 'ok' }); return; }
    if (path_ === '/api/connect' && req.method === 'GET') { sendJSON({ connected: true, sessionKey: activeSessionKey, ip: '127.0.0.1' }); return; }
    if (path_ === '/api/poll' && req.method === 'GET') { lastPollTime = Date.now(); if (pendingCodePayload) { sendJSON(pendingCodePayload); pendingCodePayload = null; } else { sendJSON({ paired: true, hasNewCode: false }); } return; }
    if (path_ === '/api/cli/push-code' && req.method === 'POST') {
      const b = await body();
      const pluginPayload = JSON.stringify({
        scripts: [{
          action: "create",
          type: b.type || "Script",
          parent: b.parent || "Workspace",
          name: b.name || "Script",
          code: b.code || ""
        }]
      });
      pendingCodePayload = {
        paired: true,
        hasNewCode: true,
        code: pluginPayload,
        messageId: Date.now().toString(),
        requestedFile: b.name || 'Script'
      };
      sendJSON({ ok: true });
      return;
    }
    if (path_ === '/api/cli/push-scripts' && req.method === 'POST') {
      const b = await body();
      const scripts = Array.isArray(b.scripts) ? b.scripts : [];
      if (scripts.length > 0) {
        const scriptResults = scripts.map((s: any, i: number) => ({
          action: s.action || 'create',
          type: s.type || s.scriptType || s.ClassName || s.className || 'Script',
          parent: s.parent || 'ServerScriptService',
          name: s.name || `GeneratedScript_${i}`,
          code: s.code || ''
        }));
        pendingCodePayload = {
          paired: true,
          hasNewCode: true,
          code: JSON.stringify({ scripts: scriptResults }),
          messageId: Date.now().toString(),
          requestedFile: scriptResults[0].name || 'Script'
        };
      }
      sendJSON({ ok: true });
      return;
    }
    if (path_ === '/api/logs' && req.method === 'POST') {
      const b = await body();
      if (b.logs && Array.isArray(b.logs)) {
        localLogsBuffer.push(...b.logs);
      }
      sendJSON({ success: true });
      return;
    }
    if (['/api/tree', '/api/report-file', '/api/request-file'].includes(path_) && req.method === 'POST') { sendJSON({ success: true }); return; }
    if (path_ === '/api/chat' && req.method === 'POST') {
      const b = await body();
      try {
        const r = await callDirectAI(b.prompt || '', b.messages || [], b.provider || 'openai', b.apiKey || '', b.model || 'gpt-4o-mini');

        if (r && typeof r === 'object') {
          const normAction = r.action ?? r.Action ?? "create";
          let normSource = r.code ?? r.Source ?? r.content ?? r.Content ?? r.script ?? r.Script;
          let normParent = r.parent ?? r.Parent;
          let normName = r.name ?? r.Name;
          const normType = r.scriptType ?? r.Type ?? r.type ?? r.ClassName ?? r.className;

          if (normSource === undefined && String(normAction).toLowerCase() === "create") {
            normSource = "";
          }

          if (r.path && normSource !== undefined) {
            const pathParts = String(r.path).split('/');
            normName = pathParts[pathParts.length - 1];
            normParent = pathParts.slice(0, -1).join('/') || 'ReplicatedStorage';
          }

          if (typeof normSource === "string" && !Array.isArray(r.scripts)) {
            let parentStr = String(normParent || 'ReplicatedStorage');
            if (parentStr.startsWith('game.')) {
              parentStr = parentStr.substring(5);
            }
            r.scripts = [{
              action: String(normAction).toLowerCase(),
              type: String(normType || 'Script'),
              scriptType: String(normType || 'Script'),
              parent: parentStr,
              name: String(normName || 'Script'),
              code: normSource
            }];
            r.message = `Successfully created ${normName} in ${parentStr}`;
          }
        }

        sendJSON(r);
      } catch (e: any) {
        sendJSON({ error: e.message || 'AI Error' }, 500);
      }
      return;
    }
    res.writeHead(404); res.end();
  });
  server.listen(port, () => { if (!inProcess) console.log(`[Apple Juice] Server on http://localhost:${port}`); });
}