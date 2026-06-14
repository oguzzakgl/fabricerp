const fs = require('fs');
const lines = fs.readFileSync('c:/Users/ouz/Desktop/fabricerp/frontend/src/pages/Accounts/index.tsx', 'utf8').split('\n');
const line = lines[234]; // line 235 is 0-indexed 234
console.log('Line 235:', line);
for (let i = 0; i < line.length; i++) {
  console.log(`Char at ${i}: ${line[i]} (code: ${line.charCodeAt(i)})`);
}
