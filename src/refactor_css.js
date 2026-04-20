const fs = require('fs');
const path = require('path');

try {
  const GLOBALS = [
    "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');",
    "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');",
    "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');",
    "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');"
  ];

  const DIRS = [
    path.join(__dirname, 'pages'),
    path.join(__dirname, 'components')
  ];

  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.jsx')) {
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8');

        const styleMatch = content.match(/const styles \= `([\s\S]*?)`;/);
        if (styleMatch) {
          console.log("Processing:", file);
          let rawCss = styleMatch[1];
          for (const gl of GLOBALS) {
            rawCss = rawCss.replace(gl, '');
          }
          rawCss = rawCss.replace(/:root\s*{[\s\S]*?}/, '');
          rawCss = rawCss.replace(/body\s*{[\s\S]*?}/, '');
          rawCss = rawCss.replace(/@keyframes fadeUp\s*{[\s\S]*?}/, '');
          rawCss = rawCss.replace(/^\s*[\r\n]/gm, '\n').trim();

          const cssFileName = file.replace('.jsx', '.css');
          fs.writeFileSync(path.join(dir, cssFileName), rawCss);

          // Replace in JSX
          content = content.replace(styleMatch[0], `import './${cssFileName}';`);
          content = content.replace(/<style dangerouslySetInnerHTML={{ __html: styles }} \/>/g, '');
          // Remove if newlines got left behind
          content = content.replace(/<style\s+dangerouslySetInnerHTML={{ __html: styles }}\s*\/>/g, '');

          // Remove empty lines where style var used to be
          fs.writeFileSync(filePath, content);
          console.log("Written:", cssFileName);
        }
      }
    }
  }
} catch (e) {
  console.error(e);
}
