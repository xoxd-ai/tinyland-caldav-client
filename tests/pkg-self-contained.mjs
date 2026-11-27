// Package test for //:pkg (TIN-8919). Run by //:pkg_test with plain Node.
//
// A scratch consumer gets only the built package in its node_modules, the way
// a remote test sees a package linked from another Bazel module, and imports
// it by name. On 1.0.1 the import fails with "Cannot find package
// 'fast-xml-parser'", because the package needed a dependency that the
// consumer cannot reach. The bundled 1.0.2 package needs only Node built-ins.

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PACKAGE = '@tummycrypt/tinyland-caldav-client';

function findPackageDir(arg) {
  const bases = [process.cwd(), process.env.RUNFILES_DIR, process.env.JS_BINARY__RUNFILES]
    .filter(Boolean)
    .flatMap((base) => [base, join(base, '_main')]);
  for (const base of bases) {
    const candidate = resolve(base, arg);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
  }
  throw new Error(`cannot find the built package at ${arg}`);
}

// The proof holds only if no ancestor of the scratch consumer offers the
// dependency, as a developer checkout or a runner workspace might. Returns the
// path that offers it, or null.
function ancestorProviding(start, name) {
  let dir = start;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(candidate)) return candidate;
    if (dir === parse(dir).root) return null;
    dir = dirname(dir);
  }
}

function scratchConsumer() {
  const bases = [process.env.TEST_TMPDIR, tmpdir(), '/tmp'].filter(Boolean);
  const seen = [];
  for (const base of bases) {
    const leak = ancestorProviding(base, 'fast-xml-parser');
    if (leak === null) return mkdtempSync(join(base, 'caldav-consumer-'));
    seen.push(leak);
  }
  throw new Error(`every scratch directory can see fast-xml-parser (${seen.join(', ')}), so this test cannot prove anything`);
}

const packageDir = findPackageDir(process.argv[2] ?? 'pkg');
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
assert.equal(manifest.name, PACKAGE);

const consumer = scratchConsumer();
const linked = join(consumer, 'node_modules', ...PACKAGE.split('/'));
mkdirSync(dirname(linked), { recursive: true });
cpSync(packageDir, linked, { recursive: true, dereference: true });

const entry = join(consumer, 'consumer.mjs');
writeFileSync(entry, `export * from '${PACKAGE}';\n`);
const mod = await import(pathToFileURL(entry).href);

const client = new mod.CalendarClient('http://localhost:5232');
assert.equal(typeof client.queryEvents, 'function');

// This parse runs the bundled fast-xml-parser.
const hrefs = mod.extractHrefsFromPropfind(`<D:multistatus xmlns:D="DAV:">
  <D:response><D:href>/cal/one.ics</D:href></D:response>
  <D:response><D:href>/cal/</D:href></D:response>
  <D:response><D:href>/cal/two.ics</D:href></D:response>
</D:multistatus>`);
assert.deepEqual(hrefs, ['/cal/one.ics', '/cal/two.ics']);

assert.equal(manifest.dependencies, undefined, 'the package lists no runtime npm dependencies');
assert.ok(existsSync(join(linked, 'dist', 'THIRD_PARTY_NOTICES.md')), 'the package ships the notices for what it bundles');
console.log(`ok: ${PACKAGE}@${manifest.version} loads and parses with no other package installed`);
