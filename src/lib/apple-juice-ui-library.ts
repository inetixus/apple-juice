import { readFileSync } from "fs";
import { join } from "path";

// Read the Luau library source at build time
let _cachedSource: string | null = null;

export function getAppleJuiceUISource(): string {
  if (_cachedSource) return _cachedSource;
  try {
    _cachedSource = readFileSync(
      join(process.cwd(), "src", "lib", "AppleJuiceUI.luau"),
      "utf-8",
    );
  } catch {
    // Fallback: return a minimal stub if file not found
    _cachedSource = `local UI = {} function UI.theme() return {bg=Color3.fromRGB(26,26,46),surface=Color3.fromRGB(35,35,55),accent=Color3.fromRGB(204,255,0),text=Color3.fromRGB(255,255,255),corner=12,font=Enum.Font.GothamBold} end return UI`;
  }
  return _cachedSource;
}

/**
 * Detects if a prompt is UI-related and the library should be auto-deployed.
 */
const UI_KEYWORDS = [
  "gui", "ui", "interface", "button", "menu", "hud", "screen",
  "shop", "store", "inventory", "dialog", "modal", "popup",
  "notification", "toast", "bar", "health", "scoreboard",
  "leaderboard", "settings", "lobby", "frame", "scroll",
  "card", "panel", "dashboard", "overlay", "widget", "tab",
  "voting", "round", "timer", "countdown", "score", "winner",
];

export function isUIRelatedPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return UI_KEYWORDS.some((w) => lower.includes(w));
}
