const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'pages');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));
let count = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace the static string with the animated interactive string for hexagonProps
  if (content.includes('before:!bg-[rgba(255,255,255,0.03)] after:!bg-[#08080e]')) {
    content = content.replace(
      /before:!bg-\[rgba\(255,255,255,0\.03\)\] after:!bg-\[#08080e\]/g, 
      'before:!bg-[rgba(255,255,255,0.05)] after:!bg-[#08080e] hover:before:!bg-[rgba(124,106,247,0.6)] duration-300 transition-colors'
    );
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
    count++;
  }
}
console.log(`Successfully applied animation logic to ${count} files globally.`);
