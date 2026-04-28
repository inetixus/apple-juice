const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'dashboard-client.tsx');
const source = fs.readFileSync(filePath, 'utf8');

const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const diags = ts.getSyntacticDiagnostics(sf);

if (diags.length === 0) {
  console.log('No syntactic diagnostics from TypeScript parser.');
  process.exit(0);
}

for (const d of diags) {
  const { line, character } = sf.getLineAndCharacterOfPosition(d.start || 0);
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  console.log(`${filePath}:${line+1}:${character+1} ${msg}`);
}

process.exit(1);
