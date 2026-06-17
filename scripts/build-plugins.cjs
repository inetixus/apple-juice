#!/usr/bin/env node
/**
 * Generate plugin/AppleJuiceSyncCLI.lua from the canonical plugin/AppleJuiceSync.lua.
 *
 * The two Studio plugins share one engine (executeMcpCommand, all the studio_*
 * tools, the playtest system, etc.). They differ ONLY in a small config block
 * delimited by AJ_CONFIG_START / AJ_CONFIG_END. This script copies the canonical
 * file and swaps that block for the CLI variant, so the two can never drift.
 *
 * Run:  node scripts/build-plugins.cjs
 */

const fs = require("fs");
const path = require("path");

const PLUGIN_DIR = path.join(__dirname, "..", "plugin");
const SRC = path.join(PLUGIN_DIR, "AppleJuiceSync.lua");
const OUT = path.join(PLUGIN_DIR, "AppleJuiceSyncCLI.lua");

const START = "-- ╔═══ AJ_CONFIG_START";
const END_MARK = "AJ_CONFIG_END ═";

// The CLI variant's config block (everything between the START and END banners,
// exclusive of the banner lines themselves is replaced — we replace the WHOLE
// region including banners for simplicity).
const CLI_CONFIG_BLOCK = `-- ╔═══ AJ_CONFIG_START ═══════════════════════════════════════════════════════╗
-- GENERATED FILE — DO NOT EDIT BY HAND.
-- This is the CLI variant of AppleJuiceSync.lua, produced by
-- scripts/build-plugins.cjs. Edit plugin/AppleJuiceSync.lua (the canonical
-- engine) and re-run \`node scripts/build-plugins.cjs\`.
local AJ_CONFIG = {
\ttoolbarName = "Apple Juice AI Sync (CLI)",
\twidgetTitle = "Apple Juice AI Sync (CLI)",
\tversion = "v2.0.0-cli",
\tvariant = "cli",
\t-- The CLI runs the Apple Juice app locally and serves it on the loopback
\t-- address. Use 127.0.0.1 (NOT localhost) — Roblox Studio's HttpService often
\t-- fails to resolve "localhost" but reaches the loopback IP fine. FIXED: there
\t-- is no URL box in the widget.
\tserverUrl = "http://127.0.0.1:3000",
\ttoggleButtonId = "AppleJuiceAISyncCLIToggle",
\ttoggleButtonTooltip = "Toggle Apple Juice AI Sync (CLI)",
\twidgetId = "AppleJuiceAISyncCLIWidget",
\ttagline = "Linked to your local \`aj\` terminal.",
\t-- The local CLI server auto-pairs on /api/connect, so NO code is needed and
\t-- no manual-code box is shown.
\tshowManualCode = false,
\trequireManualCode = false,
}
-- ╚═══ AJ_CONFIG_END ═════════════════════════════════════════════════════════╝`;

function main() {
  const src = fs.readFileSync(SRC, "utf8");

  const startIdx = src.indexOf(START);
  if (startIdx === -1) {
    console.error("ERROR: AJ_CONFIG_START banner not found in AppleJuiceSync.lua");
    process.exit(1);
  }
  // Find the end banner line and include the rest of that line.
  const endMarkIdx = src.indexOf(END_MARK, startIdx);
  if (endMarkIdx === -1) {
    console.error("ERROR: AJ_CONFIG_END banner not found in AppleJuiceSync.lua");
    process.exit(1);
  }
  const endLineEnd = src.indexOf("\n", endMarkIdx);
  if (endLineEnd === -1) {
    console.error("ERROR: malformed AJ_CONFIG_END banner");
    process.exit(1);
  }

  const before = src.slice(0, startIdx);
  const after = src.slice(endLineEnd); // includes the trailing newline + rest
  const out = before + CLI_CONFIG_BLOCK + after;

  fs.writeFileSync(OUT, out, "utf8");
  console.log(`Generated ${path.relative(path.join(__dirname, ".."), OUT)} from AppleJuiceSync.lua`);
  console.log(`  ${out.length} bytes`);
}

main();
