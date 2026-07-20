const fs = require('fs');
const path = require('path');

const COLORS = {
  '#0d1526': 'var(--bg)',
  '#0a0f1e': 'var(--bg)',
  '#111827': 'var(--surface)',
  '#1a2236': 'var(--surface2)',
  '#1f2d45': 'var(--border)',
  '#6366f1': 'var(--accent)',
  '#8b5cf6': 'var(--accent2)',
  '#10b981': 'var(--green)',
  '#ef4444': 'var(--red)',
  '#f59e0b': 'var(--yellow)',
  '#f1f5f9': 'var(--text)',
  '#64748b': 'var(--muted)',
  '#3b82f6': 'var(--accent)', // Old blue variations
  '#60a5fa': 'var(--accent2)'
};

function walkSync(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walkSync(filepath, callback);
    } else if (stats.isFile() && (filepath.endsWith('.jsx') || filepath.endsWith('.js'))) {
      callback(filepath);
    }
  });
}

const HEX_REGEX = /#(0d1526|0a0f1e|111827|1a2236|1f2d45|6366f1|8b5cf6|10b981|ef4444|f59e0b|f1f5f9|64748b|3b82f6|60a5fa)([0-9a-fA-F]{2})?/gi;

function replaceColors(content) {
  return content.replace(HEX_REGEX, (match, hex, alpha) => {
    const base = `#${hex.toLowerCase()}`;
    const variable = COLORS[base];
    
    if (alpha) {
      // Convert hex alpha (e.g., '20' which is hex for 32 out of 255 -> roughly 12.5%, but let's just use percentage from hex loosely or color-mix).
      // Actually standard hex '20' is 32/255 = 12.5%.
      // Let's just use a map or parse it.
      const alphaVal = parseInt(alpha, 16);
      const percent = Math.round((alphaVal / 255) * 100);
      return `color-mix(in srgb, ${variable} ${percent}%, transparent)`;
    } else {
      return variable;
    }
  });
}

walkSync('./src', (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  const replaced = replaceColors(content);
  if (content !== replaced) {
    fs.writeFileSync(filepath, replaced, 'utf8');
    console.log(`Updated ${filepath}`);
  }
});

console.log("Replacement complete.");
