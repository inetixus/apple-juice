const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'dashboard-client.tsx');
const source = fs.readFileSync(filePath, 'utf8');

const program = ts.createProgram([filePath], {
  jsx: ts.JsxEmit.React,
  allowJs: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
});

const diags = ts.getPreEmitDiagnostics(program);

if (diags.length === 0) {
  console.log('No syntactic diagnostics from TypeScript program.');
  process.exit(0);
}

for (const d of diags) {
  const file = d.file;
  const { line, character } = file ? file.getLineAndCharacterOfPosition(d.start || 0) : { line: 0, character: 0 };
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  const fileName = file ? file.fileName : filePath;
  console.log(`${fileName}:${line+1}:${character+1} ${msg}`);
}

process.exit(1);
