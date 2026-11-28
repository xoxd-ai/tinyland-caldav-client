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
//
// js_run_binary starts this tool in the root of the output tree, while
// //:bundle passes exec-root paths built from $(RULEDIR). Those paths include
// external/<repo>/ when this module is a dependency of another module, so
// they resolve against the exec root that the js_binary launcher exports.
// Outside Bazel they resolve against the working directory.

import { builtinModules } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rolldown } from 'rolldown';
import { collectNotices, renderNotices } from './bundle-notices.mjs';

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

const base = process.env.JS_BINARY__EXECROOT || process.cwd();
const entryPath = resolve(base, entry);
const outPath = resolve(base, outDir);

const bundle = await rolldown({
  input: entryPath,
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

let notices;
try {
  notices = collectNotices(Object.keys(chunk.modules));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

mkdirSync(outPath, { recursive: true });
writeFileSync(join(outPath, 'index.js'), chunk.code);
writeFileSync(join(outPath, 'THIRD_PARTY_NOTICES.md'), renderNotices(notices));
console.log(`bundled ${notices.map((n) => `${n.name}@${n.version}`).join(', ')}`);
