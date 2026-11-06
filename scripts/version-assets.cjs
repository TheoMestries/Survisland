// Run before committing/deploying: node scripts/version-assets.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sourceFiles = fs.readdirSync(root).filter(name => /\.(html|js|css|php)$/.test(name)).sort();
function assets(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? assets(file) : [path.relative(root, file).replace(/\\/g, '/')];
  }).sort();
}
const normalize = text => text.replace(/\r\n/g, '\n').replace(/\?v=[a-f0-9]+(?=["'])/g, '');
const digest = crypto.createHash('sha256');
for (const file of [...sourceFiles, ...assets(path.join(root, 'assets'))]) {
  const bytes = fs.readFileSync(path.join(root, file));
  digest.update(file + '\0');
  digest.update(/\.(html|js|css|php|svg)$/.test(file) ? normalize(bytes.toString('utf8')) : bytes);
  digest.update('\0');
}
const version = digest.digest('hex').slice(0, 16);
let changed = 0;
for (const file of sourceFiles.filter(name => /\.(html|js|css)$/.test(name))) {
  const filename = path.join(root, file);
  const source = fs.readFileSync(filename, 'utf8');
  const updated = source.replace(/(["'])([^"'\s<>]+\.(?:js|css|svg|png|webp|jpe?g|gif)(?:\?v=[a-f0-9]+)?)\1/g,
    (match, quote, url) => {
      if (/^(?:[a-z]+:|\/\/)/i.test(url)) return match;
      const asset = url.replace(/\?v=[a-f0-9]+$/, '');
      const target = path.resolve(root, asset);
      if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) return match;
      return `${quote}${asset}?v=${version}${quote}`;
    });
  if (updated !== source) { fs.writeFileSync(filename, updated); changed++; }
}
console.log(`Asset version ${version}: ${changed} file(s) updated.`);
