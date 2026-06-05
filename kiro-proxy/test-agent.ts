// Standalone proof-of-concept for the Stage 2 agentic engine.
//
// Run on the VPS:
//   cd /home/opc/kiro-proxy
//   npx ts-node test-agent.ts "add a script that gives players 100 coins when they join"
//
// It fakes a tiny project, runs kiro-cli agentically, then prints the diff as
// plugin script actions. If this works, the architecture is sound and we wire
// up the plugin + app. If not, we learn exactly how before building more.

import * as path from 'path';
import {
  materialize,
  readScriptFiles,
  diffToScripts,
  runAgent,
  type SnapshotEntry,
} from './agent';

const SESSION_DIR = path.join('/tmp', 'kiro-agent-test');
const LIB_PATH = process.env.KIRO_LIB_PATH || '/opt/kirolibs';

// A minimal fake project so the agent has something real to read.
const FAKE_SNAPSHOT: SnapshotEntry[] = [
  { path: 'ServerScriptService', className: 'ServerScriptService' },
  {
    path: 'ServerScriptService.GameManager',
    className: 'Script',
    source:
      'print("[AppleJuice] Running GameManager...")\n' +
      'local Players = game:GetService("Players")\n' +
      'Players.PlayerAdded:Connect(function(player)\n' +
      '\tprint(player.Name .. " joined")\n' +
      'end)\n',
  },
  { path: 'ReplicatedStorage', className: 'ReplicatedStorage' },
  {
    path: 'ReplicatedStorage.Config',
    className: 'ModuleScript',
    source: 'return {\n\tStartingCoins = 0,\n}\n',
  },
];

async function main() {
  const prompt = process.argv.slice(2).join(' ') ||
    'Add a script that gives each player 100 coins when they join.';
  const apiKey = process.env.KIRO_API_KEY || '';
  if (!apiKey) {
    console.error('KIRO_API_KEY is not set. Run: export KIRO_API_KEY=...');
    process.exit(1);
  }

  console.log('1. Materializing fake project at', SESSION_DIR);
  await materialize(SESSION_DIR, FAKE_SNAPSHOT);

  console.log('2. Snapshotting files before run...');
  const before = await readScriptFiles(SESSION_DIR);
  console.log('   files:', [...before.keys()]);

  console.log('3. Running agent with prompt:', JSON.stringify(prompt));
  const result = await runAgent(SESSION_DIR, prompt, {
    libPath: LIB_PATH,
    apiKey,
    timeoutMs: 240000,
  });
  console.log('   exit code:', result.code);
  if (result.stderr.trim()) console.log('   stderr:', result.stderr.trim());
  console.log('   --- agent stdout (first 1000 chars) ---');
  console.log(result.stdout.slice(0, 1000));
  console.log('   ----------------------------------------');

  console.log('4. Snapshotting files after run...');
  const after = await readScriptFiles(SESSION_DIR);
  console.log('   files:', [...after.keys()]);

  console.log('5. Diffing into plugin actions:');
  const actions = diffToScripts(before, after);
  if (actions.length === 0) {
    console.log('   NO CHANGES DETECTED — agent did not write files.');
  }
  for (const a of actions) {
    console.log(`   [${a.action}] ${a.type} ${a.parent}.${a.name}`);
    console.log('   ' + (a.code.split('\n')[0] || '').slice(0, 80));
  }

  console.log('\nDONE. Changed files:', actions.length);
}

main().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
