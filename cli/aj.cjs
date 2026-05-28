#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// cli/aj.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_os = __toESM(require("os"), 1);
var import_readline = __toESM(require("readline"), 1);
var import_child_process = require("child_process");
function rgb(r, g, b) {
  return `\x1B[38;2;${r};${g};${b}m`;
}
function gradient(text, colors) {
  let result = "";
  const len = text.length;
  const numColors = colors.length;
  if (numColors === 0) return text;
  if (numColors === 1) return rgb(colors[0][0], colors[0][1], colors[0][2]) + text;
  for (let i = 0; i < len; i++) {
    const totalSegments = numColors - 1;
    const position = i / Math.max(1, len - 1) * totalSegments;
    const segmentIndex = Math.floor(position);
    const localRatio = position - segmentIndex;
    const startColor = colors[Math.min(segmentIndex, numColors - 1)];
    const endColor = colors[Math.min(segmentIndex + 1, numColors - 1)];
    const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * localRatio);
    const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * localRatio);
    const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * localRatio);
    result += `\x1B[38;2;${r};${g};${b}m${text[i]}`;
  }
  result += "\x1B[0m";
  return result;
}
var PALETTE_ORANGE_YELLOW = [
  [255, 60, 0],
  // Vibrant Red-Orange
  [255, 130, 0],
  // Amber Orange
  [255, 210, 0]
  // Warm Yellow
];
var RESET = "\x1B[0m";
var BOLD = "\x1B[1m";
var DIM = "\x1B[90m";
var RED = "\x1B[91m";
var GREEN = "\x1B[92m";
var YELLOW = "\x1B[93m";
var CYAN = "\x1B[96m";
var BRIGHT_WHITE = "\x1B[97m";
var C_COMMENT = "\x1B[38;5;244m";
var C_STRING = "\x1B[38;5;78m";
var C_NUMBER = "\x1B[38;5;215m";
var C_KEYWORD = "\x1B[38;5;197m\x1B[1m";
var C_BUILTIN = "\x1B[38;5;75m";
var C_OPERATOR = "\x1B[38;5;116m";
var C_IDENTIFIER = "\x1B[38;5;253m";
var ASCII_ART = `
       \x1B[93m\\\x1B[0m
        \x1B[93m\\__\x1B[0m
       \x1B[97m/   \\\x1B[0m
      \x1B[97m/_____\\\x1B[0m
     \x1B[38;2;255;80;80m|\x1B[0m\x1B[90m\`-._.-'\x1B[0m\x1B[38;2;255;80;80m|\x1B[0m
     \x1B[38;2;255;90;70m|\x1B[0m       \x1B[38;2;255;90;70m|\x1B[0m
     \x1B[38;2;255;100;60m|_______|\x1B[0m
`;
function printHeader() {
  const artLines = ASCII_ART.split("\n").filter((l) => l.trim() !== "");
  const title = gradient("  A P P L E   J U I C E   C L I  ", PALETTE_ORANGE_YELLOW);
  const subtitle = `  \x1B[1m\x1B[38;2;0;230;255m\u{1F964} Premium Interactive TUI\x1B[0m`;
  const info = `  \x1B[90mZero-Friction Localhost-first Sync \u2022 v1.3.0\x1B[0m`;
  console.log("");
  for (let i = 0; i < artLines.length; i++) {
    let rightText = "";
    if (i === 1) rightText = title;
    if (i === 2) rightText = subtitle;
    if (i === 3) rightText = info;
    console.log(`     ${artLines[i]}${rightText}`);
  }
  console.log("");
}
var LOCAL_CONFIG_NAME = ".aj.json";
var GLOBAL_CONFIG_NAME = ".aj.json";
var getGlobalConfigPath = () => import_path.default.join(import_os.default.homedir(), GLOBAL_CONFIG_NAME);
var getLocalConfigPath = () => import_path.default.join(process.cwd(), LOCAL_CONFIG_NAME);
function loadConfig() {
  let config = {
    sessionKey: "",
    apiUrl: "http://localhost:3000",
    isFirstRun: true
  };
  const globalPath = getGlobalConfigPath();
  if (import_fs.default.existsSync(globalPath)) {
    try {
      const globalData = JSON.parse(import_fs.default.readFileSync(globalPath, "utf8"));
      config = { ...config, ...globalData, isFirstRun: false };
    } catch (e) {
    }
  }
  const localPath = getLocalConfigPath();
  if (import_fs.default.existsSync(localPath)) {
    try {
      const localData = JSON.parse(import_fs.default.readFileSync(localPath, "utf8"));
      config = { ...config, ...localData, isFirstRun: false };
    } catch (e) {
    }
  }
  if (config.sessionKey) {
    config.isFirstRun = false;
  }
  return config;
}
function saveConfig(config, isGlobal = false) {
  const configPath = isGlobal ? getGlobalConfigPath() : getLocalConfigPath();
  import_fs.default.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  return configPath;
}
async function pingServer(apiUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${apiUrl}/api/projects`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    return !!res && (res.status === 200 || res.status === 401);
  } catch (err) {
    return false;
  }
}
function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}
function padVisible(str, len, char = " ") {
  const visibleLen = stripAnsi(str).length;
  if (visibleLen >= len) return str;
  return str + char.repeat(len - visibleLen);
}
function highlightLuau(code) {
  const rules = [
    { type: "comment", regex: /^--\[\[[\s\S]*?\]\]|^--.*$/ },
    { type: "string", regex: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^\[\[[\s\S]*?\]\]/ },
    { type: "number", regex: /^\b0x[0-9a-fA-F]+\b|^\b\d+(?:\.\d+)?\b/ },
    { type: "keyword", regex: /^\b(and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while|continue|self)\b/ },
    { type: "builtin", regex: /^\b(print|warn|error|Instance|game|workspace|script|Vector3|Color3|CFrame|UDim2|task|math|string|table|pairs|ipairs|typeof|new|Connect|Wait|Clone|Destroy|GetService)\b/ },
    { type: "identifier", regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
    { type: "operator", regex: /^[+\-*/%^#=~<>.:;]/ },
    { type: "whitespace", regex: /^\s+/ },
    { type: "other", regex: /^./ }
  ];
  let highlighted = "";
  let index = 0;
  const len = code.length;
  while (index < len) {
    const sub = code.slice(index);
    let matched = false;
    for (const rule of rules) {
      const match = sub.match(rule.regex);
      if (match) {
        const val = match[0];
        index += val.length;
        matched = true;
        switch (rule.type) {
          case "comment":
            highlighted += `${C_COMMENT}${val}${RESET}`;
            break;
          case "string":
            highlighted += `${C_STRING}${val}${RESET}`;
            break;
          case "number":
            highlighted += `${C_NUMBER}${val}${RESET}`;
            break;
          case "keyword":
            highlighted += `${C_KEYWORD}${val}${RESET}`;
            break;
          case "builtin":
            highlighted += `${C_BUILTIN}${val}${RESET}`;
            break;
          case "operator":
            highlighted += `${C_OPERATOR}${val}${RESET}`;
            break;
          case "identifier":
            highlighted += `${C_IDENTIFIER}${val}${RESET}`;
            break;
          case "whitespace":
          case "other":
          default:
            highlighted += val;
            break;
        }
        break;
      }
    }
    if (!matched) {
      highlighted += sub[0];
      index++;
    }
  }
  return highlighted;
}
function renderMarkdown(text) {
  let textToParse = text;
  const count = (text.match(/```/g) || []).length;
  if (count % 2 === 1) {
    textToParse += "\n```";
  }
  const parts = textToParse.split(/(```[a-zA-Z]*\n[\s\S]*?\n```)/g);
  let result = "";
  for (const part of parts) {
    if (part.startsWith("```")) {
      const lines = part.split("\n");
      const firstLine = lines[0];
      const lang = firstLine.replace("```", "").trim().toLowerCase();
      const codeLines = lines.slice(1, -1);
      const code = codeLines.join("\n");
      const title = lang.toUpperCase() || "CODE";
      const borderTop = `  \x1B[90m\u256D\u2500\u2500\u2500\x1B[0m \x1B[1m\x1B[96m${title}\x1B[0m \x1B[90m${`\u2500`.repeat(70 - title.length)}\u256E\x1B[0m`;
      const borderBottom = `  \x1B[90m\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\x1B[0m`;
      result += `
${borderTop}
`;
      const highlighted = lang === "lua" || lang === "luau" ? highlightLuau(code) : code;
      const indented = highlighted.split("\n").map((line) => {
        return `  \x1B[90m\u2502\x1B[0m  ${line}`;
      }).join("\n");
      result += indented;
      result += `
${borderBottom}
`;
    } else {
      let rendered = part;
      rendered = rendered.replace(/\*\*(.*?)\*\*/g, `${BOLD}$1${RESET}`);
      rendered = rendered.replace(/\*(.*?)\*/g, `\x1B[3m$1${RESET}`);
      rendered = rendered.replace(/`(.*?)`/g, `\x1B[38;5;220m$1${RESET}`);
      result += rendered;
    }
  }
  return result;
}
function countTerminalLines(text, cols) {
  if (!cols) cols = 80;
  const lines = text.split("\n");
  let count = 0;
  for (const line of lines) {
    const stripped = stripAnsi(line);
    count += Math.max(1, Math.ceil(stripped.length / cols));
  }
  return count;
}
function drawDashboard(serverOnline, paired, config) {
  const width = 76;
  const statusStr = serverOnline ? `\x1B[92m\u25CF ONLINE\x1B[0m` : `\x1B[91m\u25CF OFFLINE\x1B[0m`;
  const pairStr = paired ? `\x1B[92m\u2714 CONNECTED\x1B[0m` : `\x1B[93m\u2716 NOT PAIRED\x1B[0m`;
  const keyStr = config.sessionKey ? `\x1B[96m${config.sessionKey.substring(0, 12)}...\x1B[0m` : `\x1B[90mnone\x1B[0m`;
  console.log(`  \x1B[90m\u256D\x1B[0m\x1B[90m${`\u2500`.repeat(width)}\x1B[0m\x1B[90m\u256E\x1B[0m`);
  const titleLine = `  \x1B[1m\u{1F964} SYSTEM STATUS & DIAGNOSTICS\x1B[0m`;
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m${titleLine}`, width + 9) + `\x1B[90m\u2502\x1B[0m`);
  console.log(`  \x1B[90m\u251C\x1B[0m\x1B[90m${`\u2500`.repeat(width)}\x1B[0m\x1B[90m\u2524\x1B[0m`);
  const serverLine = `    \x1B[1mServer Status:\x1B[0m      ${statusStr} \x1B[90m(at ${config.apiUrl})\x1B[0m`;
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m${serverLine}`, width + 28) + `\x1B[90m\u2502\x1B[0m`);
  const studioLine = `    \x1B[1mRoblox Studio:\x1B[0m      ${pairStr}`;
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m${studioLine}`, width + 20) + `\x1B[90m\u2502\x1B[0m`);
  const sessionLine = `    \x1B[1mActive Session:\x1B[0m     ${keyStr}`;
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m${sessionLine}`, width + 20) + `\x1B[90m\u2502\x1B[0m`);
  console.log(`  \x1B[90m\u251C\x1B[0m\x1B[90m${`\u2500`.repeat(width)}\x1B[0m\x1B[90m\u2524\x1B[0m`);
  const instructionLine = `    \x1B[90mType your prompt to ask AI, or \x1B[96m/help\x1B[90m to view commands.\x1B[0m`;
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m${instructionLine}`, width + 18) + `\x1B[90m\u2502\x1B[0m`);
  console.log(`  \x1B[90m\u2570\x1B[0m\x1B[90m${`\u2500`.repeat(width)}\x1B[0m\x1B[90m\u256F\x1B[0m\x1B[0m
`);
}
async function checkPairingStatus(config) {
  if (!config.sessionKey) return false;
  try {
    const res = await fetch(`${config.apiUrl}/api/status?key=${encodeURIComponent(config.sessionKey)}&t=${Date.now()}`);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    if (!data || data.status !== 'ok') return false;
    return !!data.lastPollTime && (Date.now() - data.lastPollTime < 10000);
  } catch (e) {
    return false;
  }
}
async function startServerAutomatically(config) {
  process.stdout.write(`\r
\u26A1 ${YELLOW}Local server is offline. Starting Next.js backend automatically...${RESET}
`);
  try {
    const child = (0, import_child_process.spawn)("npm", ["run", "dev"], {
      detached: true,
      stdio: "ignore",
      shell: true,
      cwd: process.cwd()
    });
    child.unref();
  } catch (e) {
    console.log(`\u274C ${RED}Failed to auto-start server: ${e.message}${RESET}
`);
    return false;
  }
  const maxRetries = 15;
  const retryInterval = 1e3;
  startSpinner("Booting Next.js server on http://localhost:3000");
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, retryInterval));
    const online = await pingServer(config.apiUrl);
    if (online) {
      stopSpinner();
      console.log(`\r
\u{1F7E2} ${GREEN}${BOLD}Server is online!${RESET} Successfully connected to ${CYAN}${config.apiUrl}${RESET}.
`);
      await new Promise((r) => setTimeout(r, 1200));
      return true;
    }
  }
  stopSpinner();
  console.log(`\r
\u26A0\uFE0F  ${YELLOW}Server startup is taking longer than expected. We will proceed anyway.${RESET}
`);
  await new Promise((r) => setTimeout(r, 2e3));
  return false;
}
async function runFirstTimeSetup(config) {
  console.clear();
  printHeader();
  const width = 76;
  console.log(`  \x1B[96m\u256D${`\u2500`.repeat(width)}\u256E\x1B[0m`);
  console.log(padVisible(`  \x1B[96m\u2502\x1B[0m  ${BOLD}${GREEN}\u{1F964} WELCOME TO THE APPLE JUICE SETUP WIZARD${RESET}`, width + 10) + `\x1B[96m\u2502\x1B[0m`);
  console.log(padVisible(`  \x1B[96m\u2502\x1B[0m  ${DIM}Let's pair your terminal with your workspace and Roblox Studio!${RESET}`, width + 10) + `\x1B[96m\u2502\x1B[0m`);
  console.log(`  \x1B[96m\u2570${`\u2500`.repeat(width)}\u256F\x1B[0m
`);
  console.log(`  ${BOLD}What is Apple Juice CLI?${RESET}`);
  console.log(`    It is a terminal-based development partner. It connects your`);
  console.log(`    local files, streams AI code edits, and syncs directly to Roblox Studio.`);
  console.log();
  console.log(`  ${BOLD}\x1B[96m[Step 1]\x1B[0m ${YELLOW}Check Local Next.js Server${RESET}`);
  let serverOnline = await pingServer(config.apiUrl);
  if (serverOnline) {
    console.log(`    \u{1F7E2} Local server detected running on ${CYAN}${config.apiUrl}${RESET}
`);
  } else {
    const started = await startServerAutomatically(config);
    if (started) {
      serverOnline = true;
    } else {
      console.log(`    \u{1F534} Local server not found. Please ensure Next.js is running.
`);
    }
  }
  console.log(`  ${BOLD}\x1B[96m[Step 2]\x1B[0m ${YELLOW}Pair with Roblox Studio${RESET}`);
  console.log(`    To link your active Roblox workspace:`);
  console.log(`    1. Open your project in Roblox Studio.`);
  console.log(`    2. Ensure the Apple Juice Roblox plugin is running.`);
  console.log(`    3. Copy your ${BRIGHT_WHITE}Session Key${RESET} from the dashboard page:`);
  console.log(`       ${CYAN}http://localhost:3000/dashboard${RESET}
`);
  const rl = import_readline.default.createInterface({ input: process.stdin, output: process.stdout });
  const askKey = () => new Promise((resolve) => {
    rl.question(`  ${BOLD}${CYAN}\u{1F964} Paste your Session Key here: ${RESET}`, resolve);
  });
  const key = (await askKey()).trim();
  rl.close();
  if (!key) {
    console.log(`
  \u274C ${RED}Setup incomplete. You can pair later using the ${CYAN}/pair${RED} command.${RESET}
`);
    await new Promise((r) => setTimeout(r, 2e3));
    return false;
  }
  console.log(`
  ${DIM}\u26A1 Validating session key against server...${RESET}`);
  try {
    const res = await fetch(`${config.apiUrl}/api/status?key=${encodeURIComponent(key)}&t=${Date.now()}`);
    if (res.ok) {
      config.sessionKey = key;
      config.isFirstRun = false;
      saveConfig(config);
      console.log(`
  \x1B[92m\u256D${`\u2550`.repeat(width)}\u256E\x1B[0m`);
      console.log(padVisible(`  \x1B[92m\u2502\x1B[0m  ${BOLD}\u{1F389} SETUP SUCCESSFUL!${RESET}`, width + 10) + `\x1B[92m\u2502\x1B[0m`);
      console.log(padVisible(`  \x1B[92m\u2502\x1B[0m  Your terminal is now paired and fully sync-enabled.`, width + 10) + `\x1B[92m\u2502\x1B[0m`);
      console.log(padVisible(`  \x1B[92m\u2502\x1B[0m  Config saved to: ${GREEN}${LOCAL_CONFIG_NAME}${RESET}`, width + 18) + `\x1B[92m\u2502\x1B[0m`);
      console.log(`  \x1B[92m\u2570${`\u2550`.repeat(width)}\u256F\x1B[0m
`);
      await new Promise((r) => setTimeout(r, 2500));
      return true;
    } else {
      console.log(`
  \u274C ${RED}Validation failed. The session key was rejected by the local server.${RESET}`);
      console.log(`     We will save it anyway, and you can change it with ${CYAN}/pair${RESET} inside the app.
`);
      config.sessionKey = key;
      config.isFirstRun = false;
      saveConfig(config);
      await new Promise((r) => setTimeout(r, 3e3));
      return true;
    }
  } catch (err) {
    console.log(`
  \u274C ${RED}Failed to validate (Local server unreachable).${RESET}`);
    console.log(`     Saving session key locally. We will attempt verification on next launch.
`);
    config.sessionKey = key;
    config.isFirstRun = false;
    saveConfig(config);
    await new Promise((r) => setTimeout(r, 3e3));
    return true;
  }
}
async function runPairingWizard(config) {
  console.clear();
  printHeader();
  const width = 76;
  console.log(`  \x1B[93m\u256D${`\u2500`.repeat(width)}\u256E\x1B[0m`);
  console.log(padVisible(`  \x1B[93m\u2502\x1B[0m  ${BOLD}${YELLOW}\u{1F511} APPLE JUICE PAIRING WIZARD${RESET}`, width + 10) + `\x1B[93m\u2502\x1B[0m`);
  console.log(padVisible(`  \x1B[93m\u2502\x1B[0m  ${DIM}Pair your terminal directly with Roblox Studio for instant sync.${RESET}`, width + 10) + `\x1B[93m\u2502\x1B[0m`);
  console.log(`  \x1B[93m\u2570${`\u2500`.repeat(width)}\u256F\x1B[0m
`);
  console.log(`  ${BOLD}To complete setup:${RESET}`);
  console.log(`    1. Run your Next.js application (${CYAN}npm run dev${RESET}).`);
  console.log(`    2. Open your project in Roblox Studio and run the Apple Juice plugin.`);
  console.log(`    3. Copy your ${YELLOW}Session Key${RESET} from the dashboard page.`);
  console.log(`       (${CYAN}http://localhost:3000/dashboard${RESET})
`);
  const rl = import_readline.default.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const askKey = () => new Promise((resolve) => {
    rl.question(`  ${BOLD}${CYAN}\u{1F964} Paste your Session Key: ${RESET}`, (answer) => {
      resolve(answer.trim());
    });
  });
  const key = await askKey();
  rl.close();
  if (!key) {
    console.log(`
  \u274C ${RED}Pairing cancelled. Session key is required.${RESET}
`);
    await new Promise((r) => setTimeout(r, 1500));
    return false;
  }
  console.log(`
  ${DIM}\u26A1 Verifying with Apple Juice backend...${RESET}`);
  try {
    const res = await fetch(`${config.apiUrl}/api/status?key=${encodeURIComponent(key)}&t=${Date.now()}`);
    if (res.ok) {
      config.sessionKey = key;
      config.isFirstRun = false;
      saveConfig(config);
      console.log(`
  \u2728 ${GREEN}${BOLD}Pairing Successful!${RESET} Connected to Studio.`);
      console.log(`     Saved configuration to: ${GREEN}${LOCAL_CONFIG_NAME}${RESET}
`);
      await new Promise((r) => setTimeout(r, 1800));
      return true;
    } else {
      console.log(`
  \u274C ${RED}Invalid Session Key. Verify key is correct and Roblox Plugin is active.${RESET}
`);
      await new Promise((r) => setTimeout(r, 2500));
      return false;
    }
  } catch (err) {
    console.log(`
  \u274C ${RED}Connection failed. Confirm your Next.js server is running on http://localhost:3000.${RESET}
`);
    await new Promise((r) => setTimeout(r, 2500));
    return false;
  }
}
var spinnerInterval = null;
function startSpinner(message) {
  const frames = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
  let i = 0;
  process.stdout.write("\n");
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r\x1B[K  \x1B[38;2;255;120;50m${frames[i]}\x1B[0m  \x1B[1m\x1B[37m${message}\x1B[0m`);
    i = (i + 1) % frames.length;
  }, 80);
}
function stopSpinner() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    process.stdout.write("\r\x1B[K");
  }
}
var progressLines = 0;
var syncInterval = null;
var currentSpinnerFrame = 0;
var spinnerFrames = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
function startSyncProgress(steps) {
  progressLines = 0;
  syncInterval = setInterval(() => {
    currentSpinnerFrame = (currentSpinnerFrame + 1) % spinnerFrames.length;
    drawSyncProgress(steps);
  }, 80);
}
function drawSyncProgress(steps) {
  const width = 76;
  let box = `  \x1B[96m\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u{1F964} Syncing Progress \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E\x1B[0m
`;
  for (const step of steps) {
    let icon = `\x1B[90m\u25CB\x1B[0m`;
    if (step.status === "done") {
      icon = `\x1B[92m\u2714\x1B[0m`;
    } else if (step.status === "failed") {
      icon = `\x1B[91m\u2716\x1B[0m`;
    } else if (step.status === "running") {
      icon = `\x1B[93m${spinnerFrames[currentSpinnerFrame]}\x1B[0m`;
    }
    const line = `  ${icon}  ${step.name}`;
    box += padVisible(`  \x1B[96m\u2502\x1B[0m ${line}`, width + 10) + `\x1B[96m\u2502\x1B[0m
`;
  }
  box += `  \x1B[96m\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F\x1B[0m`;
  if (progressLines > 0) {
    for (let i = 0; i < progressLines; i++) {
      process.stdout.write("\x1B[A\x1B[2K");
    }
  }
  process.stdout.write(box + "\n");
  progressLines = box.split("\n").length;
}
function stopSyncProgress(steps) {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  drawSyncProgress(steps);
  progressLines = 0;
}
function showHelp() {
  printHeader();
  console.log(`  \x1B[1mUSAGE:\x1B[0m`);
  console.log(`    \x1B[93maj\x1B[0m                      ${DIM}Enter Interactive TUI App (Recommended)${RESET}`);
  console.log(`    \x1B[93maj <command> [args]\x1B[0m     ${DIM}Run direct automated tasks${RESET}`);
  console.log(`
  \x1B[1mONE-OFF COMMANDS:\x1B[0m`);
  console.log(`    \x1B[92mauth <key>\x1B[0m             Pair your CLI with Roblox Studio`);
  console.log(`    \x1B[92mstatus\x1B[0m                 Check server and pairing health`);
  console.log(`    \x1B[92mask "<prompt>"\x1B[0m         Quick AI question`);
  console.log(`    \x1B[92mcode <file> -p "<p>"\x1B[0m   Quick file update & Studio sync`);
  console.log(`
  \x1B[1mTUI COMMANDS & SHORTCUTS (Inside interactive session):\x1B[0m`);
  console.log(`    \x1B[96m/status\x1B[0m                Redraw live health/pairing box`);
  console.log(`    \x1B[96m/pair\x1B[0m                  Launch Interactive Pairing Wizard`);
  console.log(`    \x1B[96m/sync <file> [p]\x1B[0m       Run dynamic code edits with live sync`);
  console.log(`    \x1B[96m/clear\x1B[0m                 Reset chat log & clear screen`);
  console.log(`    \x1B[96m/exit\x1B[0m                  Exit application`);
  console.log();
}
async function startInteractiveSession(config) {
  if (config.isFirstRun) {
    const success = await runFirstTimeSetup(config);
    if (!success) {
      config.isFirstRun = false;
    }
  }
  let serverOnline = await pingServer(config.apiUrl);
  if (!serverOnline) {
    const started = await startServerAutomatically(config);
    if (started) {
      serverOnline = true;
    }
  }
  let paired = await checkPairingStatus(config);
  console.clear();
  printHeader();
  drawDashboard(serverOnline, paired, config);
  if (!serverOnline) {
    console.log(`  ${RED}\u26A0\uFE0F  Local server offline. Run 'npm run dev' manually if auto-start failed.${RESET}
`);
  }
  const rl = import_readline.default.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `  \x1B[1m\x1B[38;2;255;120;50m\u{1F964} aj > \x1B[0m`
  });
  let messageHistory = [];
  let linesPrinted = 0;
  function clearLastPrinted() {
    if (linesPrinted > 0) {
      for (let i = 0; i < linesPrinted; i++) {
        process.stdout.write("\x1B[A\x1B[2K");
      }
      linesPrinted = 0;
      process.stdout.write("\r");
    }
  }
  function printStreamingResponse(text) {
    const cols = process.stdout.columns || 80;
    clearLastPrinted();
    const rendered = renderMarkdown(text);
    process.stdout.write(rendered);
    linesPrinted = countTerminalLines(rendered, cols);
  }
  rl.prompt();
  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input.startsWith("/")) {
      const parts = input.slice(1).split(" ");
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);
      switch (cmd) {
        case "exit":
        case "quit":
          console.log(`
  ${YELLOW}Goodbye! Keep juicing! \u{1F964}${RESET}
`);
          process.exit(0);
        case "clear":
        case "cls":
          messageHistory = [];
          console.clear();
          printHeader();
          drawDashboard(serverOnline, paired, config);
          console.log(`  ${GREEN}Chat log reset and screen cleared.${RESET}
`);
          break;
        case "help":
          console.log(`
  ${BOLD}Available TUI Shortcuts:${RESET}`);
          console.log(`    \x1B[96m/status\x1B[0m       Check connection health & redraw board`);
          console.log(`    \x1B[96m/pair\x1B[0m         Start dynamic Pairing Wizard`);
          console.log(`    \x1B[96m/sync <file>\x1B[0m   Apply AI edits & sync local file`);
          console.log(`    \x1B[96m/clear\x1B[0m        Reset active chat log`);
          console.log(`    \x1B[96m/exit\x1B[0m         Exit the interactive shell
`);
          break;
        case "status":
          serverOnline = await pingServer(config.apiUrl);
          paired = await checkPairingStatus(config);
          console.clear();
          printHeader();
          drawDashboard(serverOnline, paired, config);
          break;
        case "pair":
          rl.close();
          const pairedUp = await runPairingWizard(config);
          if (pairedUp) {
            paired = true;
          }
          await startInteractiveSession(config);
          return;
        case "sync":
          if (args[0]) {
            const prompt = args.slice(1).join(" ") || "Refactor and improve this Luau code";
            rl.close();
            await handleCodeCommand(config, args[0], prompt);
            await startInteractiveSession(config);
            return;
          } else {
            console.log(`
  \u274C ${RED}Usage: /sync <filePath> [edit prompt]${RESET}
`);
          }
          break;
        default:
          console.log(`
  \u274C ${RED}Unknown TUI shortcut: /${cmd}${RESET}
`);
      }
      rl.prompt();
      return;
    }
    if (!paired) {
      console.log(`
  \u274C ${RED}Not paired with Roblox Studio. Run ${CYAN}/pair${RED} to link instantly.${RESET}
`);
      rl.prompt();
      return;
    }
    startSpinner("Apple Juice AI is thinking...");
    try {
      const response = await fetch(`${config.apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input,
          sessionKey: config.sessionKey,
          messages: messageHistory
        })
      });
      stopSpinner();
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.log(`
  \u274C ${RED}Error: ${err.error || response.statusText}${RESET}
`);
      } else {
        process.stdout.write(`
  \u{1F964} \x1B[1m\x1B[92mApple Juice AI:\x1B[0m
`);
        linesPrinted = 0;
        let fullResponse = "";
        const body = response.body;
        if (!body) {
          throw new Error("Response body is empty");
        }
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line2 of lines) {
            if (line2.startsWith("data: ")) {
              const dataStr = line2.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const json = JSON.parse(dataStr);
                const text = json.choices?.[0]?.delta?.content || "";
                fullResponse += text;
                printStreamingResponse(fullResponse);
              } catch (e) {
              }
            }
          }
        }
        console.log("\n");
        messageHistory.push({ role: "user", content: input });
        messageHistory.push({ role: "assistant", content: fullResponse });
        if (messageHistory.length > 30) messageHistory = messageHistory.slice(-30);
      }
    } catch (err) {
      stopSpinner();
      console.log(`
  \u274C ${RED}Server communication failed: ${err.message}${RESET}
`);
    }
    rl.prompt();
  });
  rl.on("close", () => {
    console.log(`
  ${YELLOW}Goodbye! Keep juicing! \u{1F964}${RESET}
`);
    process.exit(0);
  });
}
async function handleStatusCommand(config) {
  console.clear();
  printHeader();
  const serverOnline = await pingServer(config.apiUrl);
  const paired = await checkPairingStatus(config);
  const width = 76;
  const statusStr = serverOnline ? `\x1B[92m\u25CF ONLINE\x1B[0m` : `\x1B[91m\u25CF OFFLINE\x1B[0m`;
  const pairStr = paired ? `\x1B[92m\u2714 CONNECTED\x1B[0m` : `\x1B[93m\u2716 NOT PAIRED\x1B[0m`;
  const keyStr = config.sessionKey ? `\x1B[96m${config.sessionKey.substring(0, 12)}...\x1B[0m` : `\x1B[90mnone\x1B[0m`;
  console.log(`  \x1B[90m\u256D${`\u2500`.repeat(width)}\u256E\x1B[0m`);
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m  ${BOLD}APPLE JUICE SYSTEM DIAGNOSTICS${RESET}`, width + 10) + `\x1B[90m\u2502\x1B[0m`);
  console.log(`  \x1B[90m\u251C${`\u2500`.repeat(width)}\u2524\x1B[0m`);
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m  \u{1F310} Local Server  : ${statusStr} \x1B[90m(at ${config.apiUrl})\x1B[0m`, width + 28) + `\x1B[90m\u2502\x1B[0m`);
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m  \u{1F50C} Roblox Studio : ${pairStr}`, width + 20) + `\x1B[90m\u2502\x1B[0m`);
  console.log(padVisible(`  \x1B[90m\u2502\x1B[0m  \u{1F511} Session Token : ${keyStr}`, width + 20) + `\x1B[90m\u2502\x1B[0m`);
  console.log(`  \x1B[90m\u2570${`\u2500`.repeat(width)}\u256F\x1B[0m
`);
  if (!serverOnline) {
    const started = await startServerAutomatically(config);
    if (!started) {
      console.log(`  ${RED}\u26A0\uFE0F  Diagnostics: Server offline. Please run 'npm run dev' manually.${RESET}
`);
    }
  } else if (!paired) {
    console.log(`  ${YELLOW}\u26A0\uFE0F  Diagnostics: Unpaired with Studio. Type 'aj' to run the Pairing Wizard.${RESET}
`);
  } else {
    console.log(`  \u{1F7E2} ${GREEN}System fully armed and ready to sync code. Happy building!${RESET}
`);
  }
}
async function handleCodeCommand(config, filePath, promptInstructions) {
  console.clear();
  printHeader();
  const resolvedPath = import_path.default.resolve(process.cwd(), filePath);
  if (!import_fs.default.existsSync(resolvedPath)) {
    console.log(`
  \u274C ${RED}Error: File not found: ${filePath}${RESET}
`);
    await new Promise((r) => setTimeout(r, 2e3));
    return;
  }
  let serverOnline = await pingServer(config.apiUrl);
  if (!serverOnline) {
    const started = await startServerAutomatically(config);
    if (!started) {
      console.log(`
  \u274C ${RED}Error: Code sync requires local Next.js server to be active.${RESET}
`);
      await new Promise((r) => setTimeout(r, 3e3));
      return;
    }
  }
  const steps = [
    { name: "Create local script backup", status: "running" },
    { name: "Consult Apple Juice AI for code crafting", status: "pending" },
    { name: "Update local source files", status: "pending" },
    { name: "Inject changes directly into Roblox Studio", status: "pending" }
  ];
  startSyncProgress(steps);
  const originalCode = import_fs.default.readFileSync(resolvedPath, "utf8");
  const basename = import_path.default.basename(resolvedPath);
  import_fs.default.writeFileSync(resolvedPath + ".bak", originalCode, "utf8");
  await new Promise((r) => setTimeout(r, 500));
  steps[0].status = "done";
  steps[1].status = "running";
  const finalPrompt = `Update the file "${basename}":

ORIGINAL SOURCE CODE:
${originalCode}

INSTRUCTIONS:
${promptInstructions}

Perform the edit and return ONLY the full updated code within standard "code" JSON format.`;
  try {
    const response = await fetch(`${config.apiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: finalPrompt,
        sessionKey: config.sessionKey,
        messages: []
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      steps[1].status = "failed";
      stopSyncProgress(steps);
      console.log(`
  \u274C ${RED}AI Compilation Failed: ${err.error || response.statusText}${RESET}
`);
      await new Promise((r) => setTimeout(r, 3e3));
      return;
    }
    steps[1].status = "done";
    steps[2].status = "running";
    const data = await response.json();
    const updatedCode = data.code || data.scripts && data.scripts[0]?.code;
    if (!updatedCode) {
      steps[2].status = "failed";
      stopSyncProgress(steps);
      console.log(`
  \u274C ${RED}Formatting Error: AI did not return code payload.${RESET}
`);
      await new Promise((r) => setTimeout(r, 3e3));
      return;
    }
    import_fs.default.writeFileSync(resolvedPath, updatedCode, "utf8");
    await new Promise((r) => setTimeout(r, 500));
    steps[2].status = "done";
    steps[3].status = "running";
    const pushRes = await fetch(`${config.apiUrl}/api/cli/push-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: config.sessionKey,
        name: data.scriptName || basename.replace(import_path.default.extname(basename), ""),
        type: data.scriptType || "Script",
        parent: data.scriptParent || "ServerScriptService",
        code: updatedCode
      })
    });
    if (pushRes.ok) {
      steps[3].status = "done";
      stopSyncProgress(steps);
      console.log(`
  \u{1F680} ${GREEN}${BOLD}Roblox Studio Sync Complete!${RESET} Saved changes and updated Studio workspace.
`);
      await new Promise((r) => setTimeout(r, 2e3));
    } else {
      steps[3].status = "failed";
      stopSyncProgress(steps);
      console.log(`
  \u26A0\uFE0F  ${YELLOW}Studio Plugin was offline. Saved local file but skipped live injection.${RESET}
`);
      await new Promise((r) => setTimeout(r, 3500));
    }
  } catch (err) {
    steps[1].status = "failed";
    stopSyncProgress(steps);
    console.log(`
  \u274C ${RED}Error during sync routine: ${err.message}${RESET}
`);
    await new Promise((r) => setTimeout(r, 3500));
  }
}
async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();
  const config = loadConfig();
  if (!command) {
    await startInteractiveSession(config);
    return;
  }
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    case "auth": {
      const key = args[1];
      if (!key) {
        console.log(`Usage: aj auth <sessionKey> [-g|--global]`);
        process.exit(1);
      }
      config.sessionKey = key;
      const isGlobal = args.includes("--global") || args.includes("-g");
      saveConfig(config, isGlobal);
      console.log(`
  \u2728 ${GREEN}Pairing key successfully saved ${isGlobal ? "globally" : "locally"}!${RESET}
`);
      break;
    }
    case "status":
      await handleStatusCommand(config);
      break;
    case "ask": {
      const prompt = args[1];
      if (!prompt) {
        console.log(`Usage: aj ask "<your prompt>"`);
        process.exit(1);
      }
      console.clear();
      printHeader();
      let serverOnline = await pingServer(config.apiUrl);
      if (!serverOnline) {
        const started = await startServerAutomatically(config);
        if (!started) {
          console.log(`  \u274C ${RED}Error: Local server must be active to ask queries.${RESET}
`);
          process.exit(1);
        }
      }
      console.log(`  ${DIM}\u{1F9E0} Sending quick query to Apple Juice AI...${RESET}
`);
      try {
        const res = await fetch(`${config.apiUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, sessionKey: config.sessionKey, messages: [] })
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`
  \u{1F9E0} \x1B[1m\x1B[92mResponse:\x1B[0m
`);
          console.log(renderMarkdown(data.message || data.code || JSON.stringify(data)));
          console.log();
        } else {
          console.log(`  \u274C ${RED}Server responded with error code: ${res.status}${RESET}
`);
        }
      } catch (e) {
        console.log(`  \u274C ${RED}Communication error: ${e.message}${RESET}
`);
      }
      break;
    }
    case "code": {
      const file = args[1];
      let pIdx = args.indexOf("-p");
      if (pIdx === -1) pIdx = args.indexOf("--prompt");
      if (!file || pIdx === -1 || !args[pIdx + 1]) {
        console.log(`Usage: aj code <file> -p "<instructions>"`);
        process.exit(1);
      }
      await handleCodeCommand(config, file, args[pIdx + 1]);
      break;
    }
    default:
      console.log(`
  \u274C ${RED}Unknown command: '${command}'. Type 'aj help' for details.${RESET}
`);
  }
}
main().catch((err) => {
  console.error("\n  \u274C Unexpected error:", err);
  process.exit(1);
});
