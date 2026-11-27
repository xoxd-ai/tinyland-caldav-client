// Bundles the compiled library into one ES module that carries its npm
// runtime dependencies (TIN-8919).
//
// A Bazel consumer links //:pkg with npm_link_package. rules_js links the
// package's npm dependencies next to it with relative symlinks that point
// into this module's external repository. Those symlinks resolve in the exec
// root but not in a remote test's runfiles tree, so a consumer test on remote
// execution could not find fast-xml-parser. With the dependency inside the
// bundle, the package needs nothing but Node built-ins at run time.
//
// Usage: node scripts/bundle.mjs <entry.js> <out-dir>
// Writes <out-dir>/index.js and <out-dir>/THIRD_PARTY_NOTICES.md.

import { builtinModules } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rolldown } from 'rolldown';

const [entry, outDir] = process.argv.slice(2);
if (!entry || !outDir) {
  console.error('usage: node scripts/bundle.mjs <entry.js> <out-dir>');
  process.exit(2);
}

// Type-only in-house imports are erased by tsc. If one ever survives as a
// runtime import, the build fails below instead of bundling a second copy.
const EXTERNAL = ['@tummycrypt/tinyland-calendar'];
const BUILTINS = new Set(builtinModules);

function isBuiltin(id) {
  return id.startsWith('node:') || BUILTINS.has(id);
}

const bundle = await rolldown({
  input: resolve(entry),
  platform: 'node',
  external: (id) => isBuiltin(id) || EXTERNAL.includes(id),
});

const { output } = await bundle.generate({
  format: 'esm',
  // calendar-client.ts also loads fast-xml-parser with a dynamic import.
  // Keep everything in the one file the package exports.
  codeSplitting: false,
  comments: { legal: true },
});
await bundle.close();

const chunks = output.filter((item) => item.type === 'chunk');
if (chunks.length !== 1) {
  console.error(`expected one chunk, got ${chunks.length}`);
  process.exit(1);
}
const [chunk] = chunks;

// A dynamic import inlined into this chunk is listed under its own file name.
const leftover = [...chunk.imports, ...chunk.dynamicImports].filter(
  (id) => id !== chunk.fileName && !isBuiltin(id),
);
if (leftover.length > 0) {
  console.error(`the bundle still imports ${leftover.join(', ')} at run time`);
  process.exit(1);
}

// One notice per bundled npm package, taken from its own package.json and,
// when it ships one, its licence file.
const NODE_MODULES = '/node_modules/';

function packageRoot(moduleId) {
  const at = moduleId.lastIndexOf(NODE_MODULES);
  if (at < 0) return null;
  const rest = moduleId.slice(at + NODE_MODULES.length).split('/');
  const depth = rest[0].startsWith('@') ? 2 : 1;
  return moduleId.slice(0, at + NODE_MODULES.length) + rest.slice(0, depth).join('/');
}

function licenceText(root) {
  const name = readdirSync(root).find((file) => /^(license|licence|copying)/i.test(file));
  return name ? readFileSync(join(root, name), 'utf8').trim() : null;
}

const roots = new Set();
for (const moduleId of Object.keys(chunk.modules)) {
  const root = packageRoot(moduleId);
  if (root) roots.add(root);
}

function authorOf(manifest) {
  const { author } = manifest;
  if (!author) return 'not stated';
  return typeof author === 'string' ? author : author.name;
}

const notices = [];
for (const root of [...roots].sort()) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!manifest.license) {
    console.error(`${manifest.name}@${manifest.version} states no licence`);
    process.exit(1);
  }
  notices.push({
    name: manifest.name,
    version: manifest.version,
    license: manifest.license,
    author: authorOf(manifest),
    text: licenceText(root),
  });
}
notices.sort((a, b) => a.name.localeCompare(b.name));

const lines = [
  '# Third-party notices',
  '',
  'dist/index.js bundles these npm packages. Each keeps its own licence.',
  '',
];
for (const notice of notices) {
  lines.push(`## ${notice.name} ${notice.version}`, '');
  lines.push(`Licence: ${notice.license}. Author: ${notice.author}.`, '');
  if (notice.text) {
    lines.push('```text', notice.text, '```', '');
  } else {
    lines.push('The package ships no licence file. Its package.json states the licence above.', '');
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.js'), chunk.code);
writeFileSync(join(outDir, 'THIRD_PARTY_NOTICES.md'), lines.join('\n'));
console.log(`bundled ${notices.map((n) => `${n.name}@${n.version}`).join(', ')}`);
