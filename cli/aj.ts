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

let globalConfig: CLIConfig | null = null;
let globalRl: readline.Interface | null = null;

let localOpenRouterModels: string[] = [];
try {
  const candidates = [
    path.join(__dirname, 'modellist.txt'),
    path.join(__dirname, '../cli/modellist.txt'),
    path.join(process.cwd(), 'cli/modellist.txt'),
    path.join(path.dirname(process.execPath), 'cli/modellist.txt'),
    path.join(path.dirname(process.execPath), 'modellist.txt'),
  ];
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
}

interface SyncStep {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SessionState {
  serverOnline: boolean;
  paired: boolean;
  history: ChatMessage[];
  config: CLIConfig;
  lastError?: string;
  infoMessage?: string;
  pairingCode?: string;
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

// Apple Juice brand — premium terracotta
const BRAND = '\x1b[38;2;204;107;73m';
const BRAND_DIM = '\x1b[38;2;130;70;50m';
const BRAND_B = '\x1b[38;2;230;120;80m';

// Syntax highlight
const C_COMMENT = '\x1b[38;5;244m';
const C_STRING = '\x1b[38;5;78m';
const C_NUMBER = '\x1b[38;5;215m';
const C_KEYWORD = '\x1b[38;5;197m\x1b[1m';
const C_BUILTIN = '\x1b[38;5;75m';
const C_OPERATOR = '\x1b[38;5;116m';
const C_IDENTIFIER = '\x1b[38;5;253m';

// ─── ANSI Utilities ──────────────────────────────────────────────────────────
function stripAnsi(s: string): string {
  return s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function termWidth(): number {
  return Math.min(process.stdout.columns || 80, 120);
}

function padRight(text: string, visLen: number): string {
  const vis = stripAnsi(text).length;
  return text + ' '.repeat(Math.max(0, visLen - vis));
}

function drawHorizontalLineWithText(leftText: string, rightText?: string): string {
  const w = process.stdout.columns || 80;
  const leftTextPart = leftText ? ` ${leftText} ` : '';
  const rightTextPart = rightText ? ` ${rightText} ` : '';
  const leftLen = stripAnsi(leftTextPart).length;
  const rightLen = stripAnsi(rightTextPart).length;
  const leftLines = 3;
  const remaining = w - leftLines - leftLen - rightLen - 4;
  if (remaining <= 0) {
    return `${BRAND_DIM}${'─'.repeat(w)}${R}`;
  }
  return `${BRAND_DIM}${'─'.repeat(leftLines)}${R}${leftTextPart}${BRAND_DIM}${'─'.repeat(remaining)}${R}${rightTextPart}${BRAND_DIM}────${R}`;
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
  } catch (_) {}
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
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

let _spinInterval: NodeJS.Timeout | null = null;

function getSpinnerColor(frame: number): string {
  const colors = [
    '\x1b[38;2;204;107;73m', // Terracotta
    '\x1b[38;2;220;125;90m',
    '\x1b[38;2;235;145;110m',
    '\x1b[38;2;250;165;130m',
    '\x1b[38;2;235;145;110m',
    '\x1b[38;2;220;125;90m'
  ];
  return colors[frame % colors.length];
}

function startSpinner(msg: string): void {
  let frame = 0;
  const startTime = Date.now();
  process.stdout.write('\n');
  _spinInterval = setInterval(() => {
    const s = SPIN_FRAMES[frame % SPIN_FRAMES.length];
    const color = getSpinnerColor(frame);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r\x1b[K  ${color}${s}${R}  ${BOLD}${WHITE}${msg}${R}  ${DIM}[${elapsedSec}s]${R}`);
    frame++;
  }, 80);
}

function stopSpinner(): void {
  if (_spinInterval) { clearInterval(_spinInterval); _spinInterval = null; }
  process.stdout.write('\r\x1b[K');
}

// ─── Sync Progress ────────────────────────────────────────────────────────────
const SF = SPIN_FRAMES;
let _sfFrame = 0;
let _sfInterval: NodeJS.Timeout | null = null;
let _sfLines = 0;
let _sfStartTime = 0;
let _sfStepTimes: Record<string, { start?: number; elapsed?: number }> = {};

function _drawSync(steps: SyncStep[]): void {
  // Track timing
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

  // Draw header line
  const headerText = ` ${BOLD}${gradientText('Syncing to Roblox Studio', SUNSET_START, SUNSET_END)}${R} `;
  const rawHeaderLen = 'Syncing to Roblox Studio'.length + 2;
  const sideLineLen = Math.max(0, Math.floor((w - rawHeaderLen - 12) / 2));
  const rightSideLineLen = Math.max(0, w - rawHeaderLen - sideLineLen - 12);
  
  lines.push(`  ${BRAND}╭${'─'.repeat(sideLineLen)}${headerText}${BRAND}${'─'.repeat(rightSideLineLen)} [${overallElapsed}s] ╮${R}`);

  // Draw steps
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

  // Draw separator
  lines.push(`  ${BRAND}├${'─'.repeat(w + 2)}┤${R}`);

  // Draw progress bar line
  const barWidth = Math.max(10, w - 24);
  const filledLen = Math.round(barWidth * ratio);
  const emptyLen = barWidth - filledLen;
  const filledBar = `\x1b[38;2;255;160;30m${'█'.repeat(filledLen)}\x1b[0m`;
  const emptyBar = `\x1b[90m${'░'.repeat(emptyLen)}\x1b[0m`;
  const percentStr = `${Math.round(ratio * 100)}%`.padStart(4);
  const progressBar = `${filledBar}${emptyBar}  ${BRAND}${percentStr}${R}`;
  const progressLine = `  ${BRAND}│${R}  ${progressBar}`;
  lines.push(padRight(progressLine, w + 12) + `${BRAND}│${R}`);

  // Draw footer line
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
  'Calculating', 'Compiling', 'Computing', 'Deciphering', 'Generating', 'Hashing', 'Inferring', 'Orchestrating', 'Processing', 'Synthesizing', 'Reticulating',
  'Cerebrating', 'Cogitating', 'Considering', 'Contemplating', 'Deliberating', 'Envisioning', 'Musing', 'Philosophising', 'Pondering', 'Puzzling', 'Ruminating',
  'Baking', 'Brewing', 'Caramelizing', 'Concocting', 'Fermenting', 'Flambéing', 'Frosting', 'Julienning', 'Kneading', 'Marinating', 'Simmering', 'Tempering', 'Zesting',
  'Cascading', 'Catapulting', 'Fluttering', 'Gallivanting', 'Galloping', 'Levitating', 'Orbiting', 'Scurrying', 'Slithering', 'Swooping', 'Undulating', 'Whirlpooling',
  "Beboppin'", 'Boondoggling', 'Booping', 'Dilly-dallying', 'Discombobulating', 'Flibbertigibbeting', 'Lollygagging', 'Shenaniganing', 'Skedaddling', 'Tomfoolering',
  'Architecting', 'Composing', 'Crafting', 'Creating', 'Cultivating', 'Embellishing', 'Forging', 'Forming', 'Hatching', 'Manifesting', 'Sketching', 'Sprouting'
];

function getReasoningPhase(elapsed: number): string {
  const idx = Math.floor(elapsed / 2.0);
  const seed = (idx * 13 + 7) % STATUS_VERBS.length;
  return STATUS_VERBS[seed] + '...';
}

function formatArtifactsBox(scripts: any[]): string {
  const lines: string[] = ['']; // Empty line for padding

  for (const s of scripts) {
    const action = String(s.action || 'create').toLowerCase();
    let typeLabel = s.type || s.scriptType || s.className || 'Instance';
    let nameLabel = s.name || s.instanceName || 'Unnamed';
    let pathLabel = s.parent || s.newParentPath || '';

    if (action === 'delete') {
      lines.push(`  ${DIM}🛠️  Deleted ${nameLabel} from ${pathLabel}${R}`);
    } else if (action === 'run_playtest') {
      lines.push(`  ${DIM}▶  Running Roblox Studio Playtest...${R}`);
    } else if (action === 'rename_instance' || action === 'move_instance') {
      lines.push(`  ${DIM}📦 Moved ${s.oldPath || ''} ➔ ${s.newParentPath || s.newName || ''}${R}`);
    } else {
      // Create / Edit
      let sizeStr = '';
      if (s.code) {
        const sizeBytes = s.code.length;
        sizeStr = sizeBytes > 1024 ? `${(sizeBytes/1024).toFixed(1)} KB` : `${sizeBytes} B`;
        sizeStr = ` ${DIM}(${s.code.split('\n').length} lines, ${sizeStr})${R}`;
      }
      lines.push(`  ${BRIGHT_GREEN}✓${R} ${DIM}Created${R} ${WHITE}${typeLabel}:${nameLabel}${R} ${DIM}in ${pathLabel}${R}${sizeStr}`);
    }
  }
  return lines.join('\n') + '\n';
}

// ─── Markdown / Syntax ───────────────────────────────────────────────────────
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

// ─── Header ──────────────────────────────────────────────────────────────────
function drawHeader(serverOnline: boolean, paired: boolean, config: CLIConfig): void {
  const w = termWidth();
  const titleText = gradientText('Apple Juice CLI', SUNSET_START, SUNSET_END);
  const projectLabel = `${DIM}active project:${R} ${WHITE}${path.basename(process.cwd())}${R}`;
  const engineVersion = `${DIM}v2.0.4${R}`;

  const leftPart = `  ${BOLD}${titleText}${R}  │  ${projectLabel}`;
  const gap = Math.max(1, w - stripAnsi(leftPart).length - stripAnsi(engineVersion).length - 4);

  // Row 1: App Title and Environmental Metadata
  process.stdout.write(`\x1b[1;1H\x1b[2K${leftPart}${' '.repeat(gap)}${engineVersion}\n`);

  // Row 2: Sleek, high-density structural divider line
  process.stdout.write(`\x1b[2;1H\x1b[2K  \x1b[38;2;65;65;65m${'─'.repeat(w - 4)}${R}\n`);

  // Row 3: Spacing layout line for structural padding
  process.stdout.write(`\x1b[3;1H\x1b[2K`);
}

// ─── Welcome Card ────────────────────────────────────────────────────────────
function drawWelcomeCard(state: SessionState): void {
  const col1W = 44;
  const col2W = 32;

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
  col1.push(padC(`${BOLD}Welcome back!${R}`, col1W));

  const green = '\x1b[38;2;46;204;113m';
  const stem = '\x1b[38;2;139;69;19m';
  const red = '\x1b[38;2;204;107;73m'; // terracotta
  const white = '\x1b[38;2;255;255;255m';
  const art = [
    `      ${stem}█${green}▄▀${R}`,
    `    ${red}▄█████▄${R}`,
    `   ${red}██${white}█${red}█████${R}`,
    `   ${red}█████████${R}`,
    `    ${red}▀█████▀${R}`
  ];
  for (const line of art) {
    col1.push(padC(line, col1W));
  }
  col1.push(padR('', col1W));

  const provider = state.config.provider || 'openai';
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
  col1.push(padC(`${DIM}${providerLabel} (128K context)${R}`, col1W));
  const shortenedCwd = process.cwd().replace(os.homedir(), '~');
  col1.push(padC(`${DIM}${shortenedCwd}${R}`, col1W));

  const col2: string[] = [];
  col2.push(padR(`${BOLD}${WHITE}Getting Started${R}`, col2W));
  col2.push(padR(`Type any prompt to ask the AI.`, col2W));
  col2.push(padR(`Prefix with ${BRAND}/${R} to run TUI commands:`, col2W));
  col2.push(padR(`  ${BRAND}/model${R}    Change AI Model`, col2W));
  col2.push(padR(`  ${BRAND}/sync${R}     Push files to Studio`, col2W));
  col2.push(padR(`  ${BRAND}/config${R}   View configuration`, col2W));
  col2.push('---');
  col2.push(padR(`${BOLD}${WHITE}What's new${R}`, col2W));
  col2.push(padR(`Server: ${state.serverOnline ? `${BRIGHT_GREEN}Online${R} ${DIM}(port 3000)${R}` : `${BRIGHT_RED}Offline${R}`}`, col2W));
  col2.push(padR(`Studio: ${state.paired ? `${BRIGHT_GREEN}Paired${R} ` : `${BRIGHT_YELLOW}Not paired${R}`}`, col2W));
  col2.push(padR(`Type ${BRAND}/help${R} for all commands`, col2W));

  const maxLines = Math.max(col1.length, col2.length);
  while (col1.length < maxLines) col1.push(padR('', col1W));
  while (col2.length < maxLines) col2.push(padR('', col2W));

  const rawTitle = ' Apple Juice Sync v2.0 ';
  const coloredTitle = gradientText(rawTitle, SUNSET_START, SUNSET_END);
  const rawTitleLen = rawTitle.length;
  const prefix = '───';
  const G_LINE = '\x1b[38;2;100;100;100m';
  const suffix = '─'.repeat(col1W + 2 - prefix.length - rawTitleLen);
  const col1Top = `${prefix}${coloredTitle}${G_LINE}${suffix}`;
  const col2Top = '─'.repeat(col2W + 2);

  // Jump directly to Row 5 so the welcome box doesn't overlap the pinned header frame
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

// ─── Footer ──────────────────────────────────────────────────────────────────
function drawFooter(serverOnline: boolean, paired: boolean): string {
  const hints = `${DIM}?${R} ${DIM}for shortcuts${R}`;
  const srv = serverOnline ? `${BRIGHT_GREEN}● server${R}` : `${DIM}◦ server${R}`;
  const std = paired ? `${BRIGHT_GREEN}✓ studio${R}` : `${BRIGHT_YELLOW}◦ studio${R}`;
  const rightStatus = `${srv} · ${std}`;
  const w = termWidth();
  const gap = Math.max(1, w - stripAnsi(hints).length - stripAnsi(rightStatus).length - 4);
  return `  ${hints}${' '.repeat(gap)}${rightStatus}\n                                                               ${DIM}© apple juice · /sync${R}\n\n\n`;
}

// ─── Message rendering ────────────────────────────────────────────────────────
function printUserMsg(text: string): void {
  // Claude style: Bold muted text for name, slightly dimmed user input, indented
  const indentedText = text.split('\n').join('\n  ');
  process.stdout.write(`\n  ${BOLD}${WHITE}You${R}\n  ${DIM}${indentedText}${R}\n`);
}

function printAssistantMsg(text: string): void {
  // Detect if the text is a JSON envelope and extract the inner message
  let displayText = text.trim();
  if (displayText.startsWith('{') && displayText.endsWith('}')) {
    try {
      const parsed = JSON.parse(displayText);
      // Prefer known fields in order of preference
      if (typeof parsed.assistant === 'string') displayText = parsed.assistant;
      else if (typeof parsed.text === 'string') displayText = parsed.text;
      else if (typeof parsed.message === 'string') displayText = parsed.message;
      else if (typeof parsed.code === 'string') displayText = parsed.code;
    } catch (e) {
      // Not valid JSON, keep original text
    }
  }
  // Claude style: Brand color text for the AI name, no background block
  process.stdout.write(`\n  ${BOLD}${BRAND}Apple Juice${R}\n`);
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



// ─── Full-screen redraw ───────────────────────────────────────────────────────
function redrawScreen(state: SessionState): void {
  const rows = process.stdout.rows || 24;

  // Fallback for tiny terminals
  if (rows < 10) {
    console.clear();
    drawHeader(state.serverOnline, state.paired, state.config);
    if (state.history.length === 0) drawWelcomeCard(state);
    if (state.history.length > 0) {
      const last = state.history[state.history.length - 1];
      if (last.role === 'assistant') {
        const prev = state.history[state.history.length - 2];
        if (prev?.role === 'user') printUserMsg(prev.content);
        printAssistantMsg(last.content);
      }
    }
    if (globalRl) globalRl.prompt(true);
    return;
  }

  // 1. Reset terminal margins completely to paint the whole screen
  process.stdout.write('\x1b[r');
  console.clear();

  // 2. Draw the Frozen Header at the absolute top of the terminal screen
  process.stdout.write('\x1b[1;1H');
  drawHeader(state.serverOnline, state.paired, state.config);

  // 3. LOCK SCROLL MARGINS: Start at Row 4, end right above the bottom menu boundaries
  process.stdout.write(`\x1b[4;${rows - 4}r`);

  // 4. Position the cursor at the top of the scroll viewport to drop history
  process.stdout.write('\x1b[4;1H');

  if (state.history.length === 0) {
    drawWelcomeCard(state);
  } else {
    // Print full chat history sequentially into the scrolling container
    for (const msg of state.history) {
      if (msg.role === 'user') printUserMsg(msg.content);
      else printAssistantMsg(msg.content);
    }
  }

  if (state.lastError) printError(state.lastError);
  if (state.infoMessage) printInfo(state.infoMessage);

  if (globalRl) {
    globalRl.prompt(true);
  }
}


// ─── Config ───────────────────────────────────────────────────────────────────
const getGlobalConfigPath = () => path.join(os.homedir(), '.aj.json');
const getLocalConfigPath = () => path.join(process.cwd(), '.aj.json');

function loadConfig(): CLIConfig {
  const config: CLIConfig = { sessionKey: '', apiUrl: 'http://localhost:3000', isFirstRun: true };
  try {
    const g = getGlobalConfigPath();
    if (fs.existsSync(g)) Object.assign(config, JSON.parse(fs.readFileSync(g, 'utf8')), { isFirstRun: false });
  } catch (_) { }
  try {
    const l = getLocalConfigPath();
    if (fs.existsSync(l)) Object.assign(config, JSON.parse(fs.readFileSync(l, 'utf8')));
  } catch (_) { }
  if (config.sessionKey) config.isFirstRun = false;
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

// ─── Network ──────────────────────────────────────────────────────────────────
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

// ─── Server auto-start ────────────────────────────────────────────────────────
async function startServerAutomatically(config: CLIConfig): Promise<boolean> {
  process.stdout.write(`\n  ${BRAND}⚡${R}  Starting local server…\n`);
  try {
    const isPkg = typeof (process as any).pkg !== 'undefined';
    let cmd = 'node';
    let args = [...process.execArgv, process.argv[1] || '', 'server'];
    if (isPkg) {
      const dir = path.dirname(process.execPath);
      const bgExe = path.join(dir, 'aj-bg.exe');
      cmd = fs.existsSync(bgExe) ? bgExe : process.execPath;
      args = ['server'];
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
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await pingServer(config.apiUrl)) {
      stopSpinner();
      printSuccess(`Server online at ${BRAND}${config.apiUrl}${R}`);
      await new Promise(r => setTimeout(r, 600));
      return true;
    }
  }
  stopSpinner();
  process.stdout.write(`\n  ${BRIGHT_YELLOW}⚠${R}  Server still starting — proceeding.\n`);
  await new Promise(r => setTimeout(r, 1200));
  return false;
}

// ─── Auth pairing ─────────────────────────────────────────────────────────────
async function generateAuthCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(0, chars.length)];
  return code;
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

// ─── Interactive Tabbed Help ─────────────────────────────────────────────────
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
      ['/color', 'Set the prompt bar color for this session'],
      ['/compact', 'Free up context by summarizing the conversation so far'],
      ['/config', 'Open config panel'],
      ['/context', 'Visualize current context usage as a colored grid'],
    ],
    customCommands: [
      ['/pair', 'Link terminal to Roblox Studio'],
      ['/status', 'Refresh server + Studio status'],
      ['/sync', 'AI-edit a file and push to Studio'],
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
    process.stdout.write(`  ${BOLD}Apple Juice Sync v2.0${R}\n\n`);
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

    // Stub out rl._ttyWrite so the main readline instance ignores all keys
    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => {};

    drawHelpTab(tabIndex, helpData);

    const openedAt = Date.now();
    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\x1b[r');
        process.exit(0);
      }

      // Ignore rapid enter/return keypresses to prevent enter-key propagation from the slash command submission
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
      // Restore rl key handling
      rl._ttyWrite = origTtyWrite;
    }

    process.stdin.on('keypress', onKeypress);
  });
}

async function showModelSelector(rl: any, models: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let query = '';
    let selectedIndex = 0;
    let filtered = [...models];

    const origTtyWrite = rl._ttyWrite;
    rl._ttyWrite = () => {};

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    const openedAt = Date.now();

    function draw() {
      console.clear();
      process.stdout.write(`\n  ${BOLD}Select AI model${R}\n`);
      process.stdout.write(`  Search: ${query}\n\n`);

      const MAX_VISIBLE = 10;
      let startIdx = 0;
      let endIdx = filtered.length;

      if (filtered.length > MAX_VISIBLE) {
        startIdx = Math.max(0, selectedIndex - Math.floor(MAX_VISIBLE / 2));
        endIdx = startIdx + MAX_VISIBLE;
        if (endIdx > filtered.length) {
          endIdx = filtered.length;
          startIdx = Math.max(0, endIdx - MAX_VISIBLE);
        }
      }

      if (startIdx > 0) {
        process.stdout.write(`    ↑ ...\n`);
      }

      for (let i = startIdx; i < endIdx; i++) {
        if (i === selectedIndex) {
          process.stdout.write(`  > \x1b[36m${filtered[i]}\x1b[0m\n`);
        } else {
          process.stdout.write(`    ${filtered[i]}\n`);
        }
      }

      if (endIdx < filtered.length) {
        process.stdout.write(`    ↓ ...\n`);
      }

      process.stdout.write('\n  Use ↑/↓ to select, Enter to confirm, Esc to cancel\n');
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
    }

    process.stdin.on('keypress', onKeypress);
  });
}

// ─── Interactive session ──────────────────────────────────────────────────────
async function startInteractiveSession(config: CLIConfig): Promise<void> {
  globalConfig = config;

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

  const state: SessionState = { serverOnline, paired, history: [], config, pairingCode };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    completer: (line: string) => {
      const allCmds: { command: string; label: string; description: string; category: string }[] = [
        { command: '/pair', label: '/pair', description: 'Link terminal to Roblox Studio', category: 'Connection' },
        { command: '/status', label: '/status', description: 'Refresh server + Studio pairing status', category: 'System' },
        { command: '/sync', label: '/sync <file>', description: 'AI-edit a file and push to Studio', category: 'Code' },
        { command: '/provider', label: '/provider <p>', description: 'Set API provider (openai|google)', category: 'AI' },
        { command: '/key', label: '/key <k>', description: 'Set API key for current provider', category: 'AI' },
        { command: '/model', label: '/model', description: 'Set AI model interactively', category: 'AI' },
        { command: '/config', label: '/config', description: 'Show current configuration', category: 'System' },
        { command: '/clear', label: '/clear', description: 'Clear screen and history', category: 'Chat' },
        { command: '/help', label: '/help', description: 'Show all available commands', category: 'Chat' },
        { command: '/exit', label: '/exit', description: 'Quit Apple Juice CLI', category: 'System' },
      ];

      const parts = line.trim().split(' ');
      const cmdPart = parts[0];

      const modelSuggestions = (state.config.availableModels && state.config.availableModels.length > 0)
        ? state.config.availableModels
        : [
          'gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1-preview',
          'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro',
          'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus',
          'deepseek-chat', 'deepseek-coder', 'deepseek-v3', 'deepseek-r1',
          'openrouter/anthropic/claude-3.5-sonnet', 'openrouter/google/gemini-2.5-pro',
          'openrouter/deepseek/deepseek-r1', 'openrouter/meta-llama/llama-3.1-405b-instruct',
          'openrouter/meta-llama/llama-3-8b-instruct:free',
          ...localOpenRouterModels.map(m => m.startsWith('openrouter/') ? m : `openrouter/${m}`)
        ];
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

  function getModePill(mode: 'Normal' | 'Plan' | 'Auto'): string {
    if (mode === 'Plan') return `\x1b[38;2;160;110;235m[ Plan ]\x1b[0m \x1b[38;2;204;107;73m›\x1b[0m `;
    if (mode === 'Auto') return `\x1b[38;2;60;185;120m[ Auto ]\x1b[0m \x1b[38;2;204;107;73m›\x1b[0m `;
    return `\x1b[38;2;140;140;140m[ Normal ]\x1b[0m \x1b[38;2;204;107;73m›\x1b[0m `;
  }

  function updatePromptAndRedraw() {
    rl.prompt(true);
    (rl as any)._refreshLine();
  }

  // Keypress listener to capture Shift+Tab (Z sequence or shift+tab tab)
  const onKeyPressGlobal = (ch: any, key: any) => {
    if (exiting || isCommandRunning) return;
    if (key && (key.name === 'backtab' || (key.name === 'tab' && key.shift) || key.sequence === '\x1b[Z')) {
      const modes: ('Normal' | 'Plan' | 'Auto')[] = ['Normal', 'Plan', 'Auto'];
      const currentIdx = modes.indexOf(activeMode);
      activeMode = modes[(currentIdx + 1) % modes.length];
      updatePromptAndRedraw();
    }
  };
  process.stdin.on('keypress', onKeyPressGlobal);

  const originalPrompt = rl.prompt.bind(rl);
  rl.prompt = (preserveCursor?: boolean) => {
    const rState = (state as any);
    const rows = process.stdout.rows || 24;
    const w = termWidth();
    if (rows >= 10) {
      // 1. Draw structured top border at rows - 3 with contextual command hints embedded
      process.stdout.write(`\x1b[${rows - 3};1H\x1b[2K`);
      const shortcutsHint = ` ${DIM}Press ${R}${BRAND}[Tab]${R}${DIM} for commands · ${R}${BRAND}[Shift+Tab]${R}${DIM} to toggle agents · ${R}${BRAND}[Ctrl+C]${R}${DIM} to exit${R} `;
      const linePadding = Math.max(0, Math.floor((w - stripAnsi(shortcutsHint).length) / 2));
      const rightPadding = Math.max(0, w - stripAnsi(shortcutsHint).length - linePadding);
      process.stdout.write(
        `\x1b[38;2;65;65;65m${'─'.repeat(linePadding)}${R}` +
        shortcutsHint +
        `\x1b[38;2;65;65;65m${'─'.repeat(rightPadding)}${R}`
      );

      // 2. Draw bottom border at rows - 1
      process.stdout.write(`\x1b[${rows - 1};1H\x1b[2K${BRAND_DIM}${'─'.repeat(w)}${R}`);

      // 3. Draw detailed status bar at rows
      process.stdout.write(`\x1b[${rows};1H\x1b[2K`);
      const modelLabel = state.config.provider === 'google' ? 'Google (128K)' : (state.config.model || 'gpt-4o-mini');
      const folderLabel = `📁 ${path.basename(process.cwd())}`;
      const gitLabel = `🔀 ${getGitBranch()}`;
      const contextLabel = getContextBar(state.history);
      
      const srv = rState.serverOnline ? `${BRIGHT_GREEN}● server${R}` : `${DIM}◦ server${R}`;
      const std = rState.paired ? `${BRIGHT_GREEN}✓ studio${R}` : `${BRIGHT_YELLOW}◦ studio${R}`;
      
      const leftPart = `${modelLabel} | ${folderLabel} | ${gitLabel} | ${srv} · ${std}`;
      const rightPart = contextLabel;
      
      process.stdout.write(drawHorizontalLineWithText(leftPart, rightPart));

      // 4. Move to input prompt row (rows - 2), clear line
      process.stdout.write(`\x1b[${rows - 2};1H\x1b[2K`);
    }
    rl.setPrompt(getModePill(activeMode));
    originalPrompt(preserveCursor);
  };

  // Resize listener to adjust margins dynamically
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
      // Draw origin is rows - 3 - slashListLines (just above the hint divider at rows-3)
      const startRow = rows - 3 - slashListLines;
      for (let i = 0; i < slashListLines; i++) {
        process.stdout.write(`\x1b[${startRow + i};1H\x1b[2K`);
      }
      slashListLines = 0;
      // Restore cursor to input line
      const inputRow = rows - 2;
      process.stdout.write(`\x1b[${inputRow};1H`);
    }
  }

  const COMMANDS_LIST = [
    { command: '/pair', label: '/pair', description: 'Link terminal to Roblox Studio', category: 'Connection' },
    { command: '/status', label: '/status', description: 'Refresh server + Studio pairing status', category: 'System' },
    { command: '/sync', label: '/sync <file>', description: 'AI-edit a file and push to Studio', category: 'Code' },
    { command: '/provider', label: '/provider <p>', description: 'Set API provider (openai|google|deepseek|openrouter)', category: 'AI' },
    { command: '/key', label: '/key [p] <k>', description: 'Set API key (optional provider)', category: 'AI' },
    { command: '/model', label: '/model', description: 'Select AI model interactively', category: 'AI' },
    { command: '/config', label: '/config', description: 'Show current configuration', category: 'System' },
    { command: '/clear', label: '/clear', description: 'Clear screen and history', category: 'Chat' },
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
    );

    const rows = process.stdout.rows || 24;
    const w = Math.min(72, termWidth() - 4);

    if (filtered.length === 0) {
      const totalRows = 2;
      slashListLines = totalRows;
      const startRow = rows - 2 - totalRows;
      
      process.stdout.write(`\x1b[${startRow};1H\x1b[2K  ${DIM}No matching commands for "/${query}"${R}`);
      process.stdout.write(`\x1b[${startRow + 1};1H\x1b[2K  ${DIM}${'─'.repeat(40)}${R}`);

      // Restore cursor to input line
      const pill = getModePill(activeMode);
      const pillLen = stripAnsi(pill).length;
      const col = 1 + pillLen + ((globalRl as any).cursor || 0);
      process.stdout.write(`\x1b[${rows - 2};${col}H`);
      return;
    }

    const groups: Record<string, typeof COMMANDS_LIST> = {};
    for (const cmd of filtered) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }

    const lines: string[] = [];
    lines.push(`  ${DIM}${'─'.repeat(w)}${R}`);
    for (const [cat, cmds] of Object.entries(groups)) {
      lines.push(`  ${DIM}${cat.toUpperCase()}${R}`);
      for (const cmd of cmds) {
        const isExact = cmd.command.toLowerCase() === query.toLowerCase() || !query;
        const cmdDisplay = isExact ? `${BOLD}${BRAND}${cmd.label}${R}` : `${BRAND}${cmd.label}${R}`;
        lines.push(`  ${cmdDisplay}${' '.repeat(Math.max(1, 20 - stripAnsi(cmd.label).length))}${DIM}${cmd.description}${R}`);
      }
    }
    lines.push(`  ${DIM}${'─'.repeat(w)}${R}`);

    slashListLines = lines.length;
    // Draw just above the hint divider line (rows-3); overlay grows upward
    const startRow = rows - 3 - slashListLines;

    for (let i = 0; i < lines.length; i++) {
      process.stdout.write(`\x1b[${startRow + i};1H\x1b[2K${lines[i]}`);
    }

    // Restore cursor to the actual input line (rows-2) after the mode pill
    const pill = getModePill(activeMode);
    const pillLen = stripAnsi(pill).length;
    const col = 1 + pillLen + ((globalRl as any).cursor || 0);
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
      }
    }
  }, 100);
  slashCheckInterval.unref();

  // ─── Override redrawScreen to clear slash list before redraw ────────────
  const origRedraw = redrawScreen;
  redrawScreen = (s: SessionState) => {
    if (slashActive) { clearSlashListLocal(); slashActive = false; }
    origRedraw(s);
  };

  // Claude Code uses custom prompt glyphs
  rl.setPrompt(' ');

  // Heartbeat: keep status fresh
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
      // Early-return for blank/bare-slash input — no scroll, no extra space
      if (!input || input === '/') {
        rl.prompt(true);
        return;
      }

      // Only push the scroll region down once we know there's real content
      const rows = process.stdout.rows || 24;
      if (rows >= 10) {
        process.stdout.write(`\x1b[${rows - 4};1H\n\n`);
      } else {
        process.stdout.write('\n\n');
      }

      // ── Slash commands ──────────────────────────────────────────────────────
      if (input.startsWith('/') || input === '?') {
        const allCmds = ['/pair', '/status', '/sync', '/clear', '/key', '/model', '/config', '/help', '/exit'];
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
          case 'clear': case 'cls':
            state.history = [];
            state.lastError = undefined;
            state.infoMessage = undefined;
            redrawScreen(state);
            rl.prompt();
            return;
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
                : [
                  'gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1-preview',
                  'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro',
                  'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus',
                  'deepseek-chat', 'deepseek-coder', 'deepseek-v3', 'deepseek-r1',
                  'openrouter/anthropic/claude-3.5-sonnet', 'openrouter/google/gemini-2.5-pro',
                  'openrouter/deepseek/deepseek-r1', 'openrouter/meta-llama/llama-3.1-405b-instruct',
                  'openrouter/meta-llama/llama-3-8b-instruct:free',
                  ...localOpenRouterModels.map(x => x.startsWith('openrouter/') ? x : `openrouter/${x}`)
                ];

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
                  // Fallback to local list on error
                  state.infoMessage = undefined;
                }
              }

              state.modalOpen = true;
              const selected = await showModelSelector(rl, popularModels);
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
          case 'config': {
            console.clear();
            const w = termWidth();
            const titleText = gradientText('Apple Juice', SUNSET_START, SUNSET_END);
            process.stdout.write(`\n  ${BOLD}${titleText}${R}  ${DIM}Configuration${R}\n`);
            process.stdout.write(`  ${DIM}${'─'.repeat(w - 4)}${R}\n\n`);
            const rows: [string, string][] = [
              ['API URL', state.config.apiUrl],
              ['Provider', state.config.provider || 'openai (default)'],
              ['Model', state.config.model || 'gpt-4o-mini (default)'],
              ['OpenAI Key', state.config.openaiKey ? state.config.openaiKey.slice(0, 12) + '…' : 'not set'],
              ['Google Key', state.config.googleKey ? state.config.googleKey.slice(0, 12) + '…' : 'not set'],
            ];
            for (const [k, v] of rows) {
              process.stdout.write(`  ${BRAND}${k.padEnd(14)}${R}${DIM}${v}${R}\n`);
            }
            process.stdout.write('\n');
            rl.prompt();
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

      // ── Not paired guard ────────────────────────────────────────────────────
      if (!state.paired) {
        state.lastError = 'Not paired with Studio. Run /pair first.';
        redrawScreen(state);
        state.lastError = undefined;
        rl.prompt();
        return;
      }

      // ── AI Chat ─────────────────────────────────────────────────────────────
      let spinFrame = 0;
      const startTime = Date.now();
      process.stdout.write('\n');
      const thinking = setInterval(() => {
        const s = SPIN_FRAMES[spinFrame % SPIN_FRAMES.length];
        const elapsed = (Date.now() - startTime) / 1000;
        const elapsedSec = elapsed.toFixed(1);
        const phase = getReasoningPhase(elapsed);
        // Claude style: brand spinner, dimmed reasoning phase text
        process.stdout.write(`\r\x1b[K  ${BRAND}${s}${R}  ${DIM}${phase} [${elapsedSec}s]${R}`);
        spinFrame++;
      }, 80);

      try {
        const res = await fetch(`${config.apiUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: input,
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

        clearInterval(thinking);
        process.stdout.write('\r\x1b[K');

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as Record<string, string>;
          state.lastError = `API error ${res.status}: ${err.error || res.statusText}`;
        } else {
          const data = await res.json().catch(() => ({})) as Record<string, unknown>;
          const d = data as any;

          // ── Server-side error (502, 429, etc.) ──────────────────────────────
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
          if (typeof data === 'object' && data !== null) {
            // Normalize hallucinated or alternative formats (including capitalized keys, standalone script/Script, and ClassName)
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

            // Case 1: Correct Apple Juice format — has a scripts array
            if (Array.isArray(d.scripts)) {
              const textReply = typeof d.message === 'string' && d.message.trim() ? d.message : '';
              const artifactsBox = d.scripts.length > 0 ? formatArtifactsBox(d.scripts) : '';
              reply = textReply + artifactsBox;

            // Case 2: Single-script success path
            } else if (typeof d.message === 'string' && d.message.trim() && d.ok) {
              reply = d.message;

            // Case 3: Model hallucinated a tool-call format
            } else if (d.tool_call_function || d.tool_calls) {
              reply = typeof d.assistant === 'string' && d.assistant.trim()
                ? d.assistant + '\n\n⚠️  The model used tool-call syntax instead of creating scripts. Try /model to switch.'
                : '⚠️  The model returned an unsupported format. Try /model to switch to a more capable model.';

            // Case 4: Plain text fields
            } else if (typeof d.message === 'string' && d.message.trim()) {
              reply = d.message;
            } else if (typeof d.assistant === 'string' && d.assistant.trim()) {
              reply = d.assistant;
            } else if (typeof d.text === 'string' && d.text.trim()) {
              reply = d.text;
            } else if (typeof d.code === 'string' && d.code.trim()) {
              reply = d.code;

            // Case 5: Useless / empty JSON (e.g. {"":""} or {})
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

          state.history.push({ role: 'user', content: input });
          state.history.push({ role: 'assistant', content: reply });
          if (state.history.length > 40) state.history = state.history.slice(-40);
          state.lastError = undefined;
        }

      } catch (e: any) {
        clearInterval(thinking);
        process.stdout.write('\r\x1b[K');
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

// ─── One-off commands ─────────────────────────────────────────────────────────
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
  process.stdout.write(`\n  ${BOLD}${titleText}${R}  ${DIM}v2.0${R}\n`);
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
  process.stdout.write(`\n  ${DIM}Inside a session${R}\n\n`);
  const inner: [string, string][] = [
    ['/pair', 'Link to Studio'],
    ['/status', 'Refresh status'],
    ['/sync <f> [p]', 'Sync a file to Studio'],
    ['/provider <p>', 'Set API provider'],
    ['/key [p] <k>', 'Set API key (optional provider)'],
    ['/model', 'Select AI model interactively'],
    ['/config', 'Show config'],
    ['/clear', 'Clear history'],
    ['/exit', 'Exit'],
    ['?', 'Show commands'],
  ];
  for (const [c, d] of inner) {
    process.stdout.write(`  ${BRAND}${c.padEnd(28)}${R}${DIM}${d}${R}\n`);
  }
  process.stdout.write('\n');
}

// ─── Keepalive ────────────────────────────────────────────────────────────────
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

// ─── Entry point ──────────────────────────────────────────────────────────────
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
  process.stderr.write(`\n  ✗ Unexpected error: ${err}\n\n`);
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

## WORKFLOW & ACTIONS
If generating or modifying multiple files, add JSON objects to the "scripts" array. The plugin executes each entry live in Studio.
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

## ROBLOX LUAU STYLE & SAFETY
- **Strong Typing**: Use Luau type annotations where appropriate (e.g. \`local speed: number = 100\`, type assertions \`x :: type\`).
- **Operators**: Use compound assignments like \`+=\`, \`-=\`, \`..=\`, and ternary expressions \`if a then b else c\`.
- **Scoping**: ALWAYS use \`local\` for variables and functions. Never declare global variables.
- **Service Access**: ALWAYS use \`game:GetService("ServiceName")\` instead of \`game.ServiceName\`.
- **Instance Safety**: Use \`WaitForChild("Name", timeout)\` or \`FindFirstChild\` on clients to prevent infinite yield warnings.
- **Task Library**: STRICTLY use \`task.spawn\`, \`task.defer\`, \`task.delay\`, and \`task.wait\` instead of legacy \`spawn\`, \`delay\`, \`wait\`.
- **Clean Up**: Always disconnect connections, destroy instances, and clean up threads when destroyed to prevent memory leaks.
- **Full Implementation**: ZERO TOLERANCE for placeholders, TODOs, or leaving parts for the user to implement. Write the complete, robust, production-ready code.
- Every script MUST start with a print statement: \`print("[AppleJuice] Running ScriptName...")\`
- INFINITE YIELD GUARD: NEVER use WaitForChild() without a timeout (e.g., use \`WaitForChild("Name", 5)\`).
- DO NOT spawn Parts or any 3D objects in the Workspace unless the user explicitly asks you to create physical 3D objects.
- Place Scripts in ServerScriptService and LocalScripts in StarterPlayerScripts or StarterGui. Never put scripts directly in the Workspace.

## UI GENERATION — USE AppleJuiceUI LIBRARY
When creating ANY UI, you MUST require and use the AppleJuiceUI component library located in ReplicatedStorage:
\`\`\`luau
local UI = require(game:GetService("ReplicatedStorage"):WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice") -- themes: "Juice" (lime), "Midnight" (blue), "Ember" (orange), "Claude" (violet/orange developer style)
\`\`\`

### One-Call Templates:
- \`UI.ShopTemplate({Title, Tabs: { {Id, Label, Items: {{Text, Price, Icon}} } }})\`
- \`UI.InventoryTemplate({Title, Items: { {Name, Icon, Count, Rarity} }})\`
- \`UI.HUDTemplate({StartingCoins})\` (returns {health, currency})

### Individual Components:
- \`UI.createScreenGui("Name")\`
- \`UI.DynamicScale(screen)\`
- \`UI.Card(parent, {Size, Position})\`
- \`UI.Button(parent, {Text, Style, OnClick})\`
- \`UI.ProgressBar(parent, {Value, Label, FillColor})\`
- \`UI.Toast(screen, {Text, Type})\`

### Icons Catalog (use UI.Icons.X):
Coin, Cash, Crystal, Diamond, Ingot, Premium, Robux, Ticket, VIP, Aura, Trail, Teleport, AngelHeart, Magnet, Crown, LuckyBlock, Coil, Trophy, Shield, Sword, Gift, Potion, Rocket, Fire, Heart, Hoverboard, Lightning, Rebirth, Star, Upgrade, Wheel.

FINAL REMINDER: Return ONLY a single, valid JSON object containing your response. Do not enclose it in markdown code blocks.`;
async function callDirectAI(prompt: string, messages: any[], provider: string, apiKey: string, model: string) {
  // Define strict JSON Schema for Gemini
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

  // Define strict JSON Schema for OpenAI / OpenRouter
  const openaiResponseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'AppleJuiceResponse',
      strict: false, // Set to false to accommodate some OpenRouter providers that do not support strict mode
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
              required: ['action']
            }
          },
          suggestions: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['message']
      }
    }
  };

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
    const headers = {
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
        response_format: openaiResponseFormat
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
    if (path_ === '/api/status' && req.method === 'GET') { sendJSON({ status: 'ok', lastPollTime }); return; }
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
    if (['/api/logs', '/api/tree', '/api/report-file', '/api/request-file'].includes(path_) && req.method === 'POST') { sendJSON({ success: true }); return; }
    if (path_ === '/api/chat' && req.method === 'POST') {
      const b = await body();
      try {
        const r = await callDirectAI(b.prompt || '', b.messages || [], b.provider || 'openai', b.apiKey || '', b.model || 'gpt-4o-mini');
        
        // Normalize and queue the scripts payload for Roblox Studio plugin polling
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

          if (Array.isArray(r.scripts) && r.scripts.length > 0) {
            const scriptResults = r.scripts.map((s: any, i: number) => ({
              action: s.action || 'create',
              type: s.type || s.scriptType || 'Script',
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