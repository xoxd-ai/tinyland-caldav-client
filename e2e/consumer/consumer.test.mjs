// Imports @tummycrypt/tinyland-caldav-client the way a downstream Bazel
// module does: npm_link_package links //:pkg of the external module into this
// workspace's node_modules, and nothing else is installed (TIN-8919).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = '@tummycrypt/tinyland-caldav-client';
const mod = await import(PACKAGE);

const client = new mod.CalendarClient('http://localhost:5232');
assert.equal(typeof client.queryEvents, 'function');

// This parse runs the fast-xml-parser that the bundle carries.
const hrefs = mod.extractHrefsFromPropfind(`<D:multistatus xmlns:D="DAV:">
  <D:response><D:href>/cal/one.ics</D:href></D:response>
  <D:response><D:href>/cal/</D:href></D:response>
  <D:response><D:href>/cal/two.ics</D:href></D:response>
</D:multistatus>`);
assert.deepEqual(hrefs, ['/cal/one.ics', '/cal/two.ics']);

const distDir = dirname(fileURLToPath(import.meta.resolve(PACKAGE)));
const manifest = JSON.parse(readFileSync(join(distDir, '..', 'package.json'), 'utf8'));
assert.equal(manifest.name, PACKAGE);
assert.equal(manifest.dependencies, undefined, 'the package lists no runtime npm dependencies');
assert.ok(
  existsSync(join(distDir, 'THIRD_PARTY_NOTICES.md')),
  'the package ships the notices for what it bundles',
);
console.log(`ok: ${PACKAGE}@${manifest.version} builds and loads as an external module`);
