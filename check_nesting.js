const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ide-layout.tsx', 'utf8');

const stack = [];
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    let char = line[j];
    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, line: i + 1, col: j + 1 });
    } else if (char === '}' || char === ')' || char === ']') {
      if (stack.length === 0) {
        console.log(`Unmatched closing char '${char}' on Line ${i + 1}, col ${j + 1}`);
        process.exit(1);
      }
      const top = stack.pop();
      const match = (top.char === '{' && char === '}') ||
                    (top.char === '(' && char === ')') ||
                    (top.char === '[' && char === ']');
      if (!match) {
        console.log(`Mismatched bracket: opened '${top.char}' on Line ${top.line}, col ${top.col} but closed with '${char}' on Line ${i + 1}, col ${j + 1}`);
        process.exit(1);
      }
    }
  }
}

if (stack.length > 0) {
  const top = stack.pop();
  console.log(`Unclosed bracket '${top.char}' opened on Line ${top.line}, col ${top.col}`);
} else {
  console.log("Brackets are 100% perfectly nested!");
}
