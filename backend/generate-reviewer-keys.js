const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(__dirname, '..', '.local-secrets');
const outputPath = path.join(outputDir, 'reviewer-keys.txt');
const entries = [1, 2, 3].map(index => (
  `reviewer-${index}:${crypto.randomBytes(32).toString('base64url')}`
));

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, [
  '# Paste the value below into Railway REVIEWER_API_KEYS.',
  '# Keep this file private. It is excluded from Git.',
  '',
  `REVIEWER_API_KEYS=${entries.join(',')}`,
  '',
  '# Individual reviewer credentials:',
  ...entries,
  '',
].join('\n'), { encoding: 'utf8', mode: 0o600 });

console.log(outputPath);
