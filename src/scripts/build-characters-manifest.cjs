// scripts/build-characters-manifest.cjs
const { readdirSync, writeFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..', '..', 'public', 'avatars');
const out = { characters: {} };

for (const entry of readdirSync(base, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const files = readdirSync(join(base, entry.name)).filter(f =>
    /\.(png|jpg|jpeg)$/i.test(f)
  );

  out.characters[entry.name] = files;
}

writeFileSync(join(base, 'index.json'), JSON.stringify(out, null, 2));
console.log('✅ Wrote public/avatars/index.json');
