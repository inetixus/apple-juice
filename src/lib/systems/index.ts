/**
 * Apple Juice Master Systems Database
 * ====================================
 * A comprehensive library of production-ready Roblox gameplay system templates.
 * Each system is modular, config-first, and integrates with AppleJuiceUI.
 *
 * The AI references these templates when generating code for specific game mechanics.
 * Each system includes: Config table, ModuleScript skeleton, and UI integration points.
 */

export { ECONOMY_SYSTEM } from "./economy";
export { ROUND_SYSTEM } from "./rounds";
export { NPC_SYSTEM } from "./npc-dialogue";
export { PLACEMENT_SYSTEM } from "./placement";
export { FARMING_SYSTEM } from "./farming";
export { PET_SYSTEM } from "./pets";
export { COMBAT_SYSTEM } from "./combat";
export { VEHICLE_SYSTEM } from "./vehicles";
export { DAILY_REWARDS_SYSTEM } from "./daily-rewards";
export { LEADERBOARD_SYSTEM } from "./leaderboard";
export { TRADING_SYSTEM } from "./trading";
export { QUEST_SYSTEM } from "./quests";
export { WEATHER_SYSTEM } from "./weather";
export { CRAFTING_SYSTEM } from "./crafting";
export { ABILITIES_SYSTEM } from "./abilities";
export { MAP_VOTING_SYSTEM } from "./map-voting";
export { BLOCK_BUILDING_SYSTEM } from "./block-building";

// Small focused drop-in scripts (kill bricks, teleporters, sprint, tools, etc.)
export {
  SCRIPT_SNIPPETS,
  getRelevantSnippets,
  buildSnippetsContextBlock,
  type ScriptSnippet,
} from "./snippets";

import { ECONOMY_SYSTEM } from "./economy";
import { ROUND_SYSTEM } from "./rounds";
import { NPC_SYSTEM } from "./npc-dialogue";
import { PLACEMENT_SYSTEM } from "./placement";
import { FARMING_SYSTEM } from "./farming";
import { PET_SYSTEM } from "./pets";
import { COMBAT_SYSTEM } from "./combat";
import { VEHICLE_SYSTEM } from "./vehicles";
import { DAILY_REWARDS_SYSTEM } from "./daily-rewards";
import { LEADERBOARD_SYSTEM } from "./leaderboard";
import { TRADING_SYSTEM } from "./trading";
import { QUEST_SYSTEM } from "./quests";
import { WEATHER_SYSTEM } from "./weather";
import { CRAFTING_SYSTEM } from "./crafting";
import { ABILITIES_SYSTEM } from "./abilities";
import { MAP_VOTING_SYSTEM } from "./map-voting";
import { BLOCK_BUILDING_SYSTEM } from "./block-building";

export interface SystemTemplate {
  name: string;
  category: string;
  description: string;
  keywords: string[];
  serverCode: string;
  clientCode?: string;
  sharedCode?: string;
}

const ALL_SYSTEMS: SystemTemplate[] = [
  ECONOMY_SYSTEM,
  ROUND_SYSTEM,
  NPC_SYSTEM,
  PLACEMENT_SYSTEM,
  FARMING_SYSTEM,
  PET_SYSTEM,
  COMBAT_SYSTEM,
  VEHICLE_SYSTEM,
  DAILY_REWARDS_SYSTEM,
  LEADERBOARD_SYSTEM,
  TRADING_SYSTEM,
  QUEST_SYSTEM,
  WEATHER_SYSTEM,
  CRAFTING_SYSTEM,
  ABILITIES_SYSTEM,
  MAP_VOTING_SYSTEM,
  BLOCK_BUILDING_SYSTEM,
];

/**
 * Finds the best matching system template(s) for a given prompt.
 */
export function getRelevantSystems(prompt: string): SystemTemplate[] {
  const lower = prompt.toLowerCase();
  const scored = ALL_SYSTEMS.map((sys) => {
    const score = sys.keywords.reduce(
      (acc, kw) => acc + (lower.includes(kw) ? 2 : 0),
      0,
    );
    return { sys, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((s) => s.sys);
}

/**
 * Builds a system prompt context block with relevant system templates.
 */
export function buildSystemsContextBlock(prompt: string): string {
  const systems = getRelevantSystems(prompt);
  if (systems.length === 0) return "";

  let block = `\n\n## MASTER SYSTEM TEMPLATES\nUse these production-ready patterns as your foundation. Customize Config values to match the user's request.\n`;

  for (const sys of systems) {
    block += `\n### ${sys.name} (${sys.category})\n${sys.description}\n`;
    block += `\`\`\`luau\n-- SERVER: ${sys.name}\n${sys.serverCode}\n\`\`\`\n`;
    if (sys.clientCode) {
      block += `\`\`\`luau\n-- CLIENT: ${sys.name}\n${sys.clientCode}\n\`\`\`\n`;
    }
  }

  block += `\nADAPT these templates to the user's specific request. Change Config values, add/remove features as needed. Do NOT copy verbatim.\n`;
  return block;
}
