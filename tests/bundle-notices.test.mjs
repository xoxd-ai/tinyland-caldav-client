// Tests for scripts/bundle-notices.mjs, run by //:bundle_notices_test with
// plain Node (TIN-8919). Each case builds a small node_modules tree in a
// scratch directory and passes module ids from it, the way bundle.mjs passes
// the ids of the modules that rolldown put into the chunk.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  atLeast,
  checkNotices,
  collectNotices,
  MIN_FAST_XML_PARSER,
  releaseParts,
  renderNotices,
} from '../scripts/bundle-notices.mjs';

const scratch = mkdtempSync(join(process.env.TEST_TMPDIR || tmpdir(), 'bundle-notices-'));
let trees = 0;

// Writes one package per entry and returns the id of a module in each.
function tree(packages) {
  trees += 1;
  const nodeModules = join(scratch, `tree-${trees}`, 'node_modules');
  return packages.map(({ name, version, license = 'MIT', licenceFile }) => {
    const root = join(nodeModules, ...name.split('/'));
    mkdirSync(join(root, 'lib'), { recursive: true });
    const manifest = { name, version, author: 'Example Author' };
    if (license) manifest.license = license;
    writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
    if (licenceFile) writeFileSync(join(root, 'LICENSE'), licenceFile);
    const moduleId = join(root, 'lib', 'index.js');
    writeFileSync(moduleId, 'export {};\n');
    return moduleId;
  });
}

const SOURCE = join(scratch, 'dist', 'index.js');

test('refuses a bundle that carries no npm package', () => {
  assert.throws(() => collectNotices([]), /carries no npm package/);
  assert.throws(() => collectNotices([SOURCE]), /carries no npm package/);
  assert.throws(() => checkNotices([]), /carries no npm package/);
});

test('refuses a bundle that does not carry fast-xml-parser', () => {
  const ids = tree([{ name: 'strnum', version: '2.1.0' }, { name: '@nodable/entities', version: '3.1.0' }]);
  assert.throws(() => collectNotices([SOURCE, ...ids]), /does not carry fast-xml-parser/);
});

test('refuses fast-xml-parser under 5.12.0', () => {
  for (const version of ['5.11.9', '5.2.5', '4.5.3', '0.0.0']) {
    const ids = tree([{ name: 'fast-xml-parser', version }]);
    assert.throws(
      () => collectNotices(ids),
      new RegExp(`fast-xml-parser ${version.replaceAll('.', '\\.')}, which is not a release at or above 5\\.12\\.0`),
      version,
    );
  }
});

test('refuses a prerelease or build of 5.12.0 and malformed versions', () => {
  for (const version of ['5.12.0-beta', '5.12.0-beta.1', '5.12.0-rc.0', '5.12.0+build.7', '5.12', '05.12.0', 'v5.12.0', '']) {
    const ids = tree([{ name: 'fast-xml-parser', version }]);
    assert.throws(() => collectNotices(ids), /not a release at or above 5\.12\.0/, version);
    assert.equal(atLeast(version, MIN_FAST_XML_PARSER), false, version);
  }
  assert.equal(releaseParts('5.12.0-beta'), null);
  assert.equal(releaseParts(undefined), null);
});

test('accepts fast-xml-parser 5.12.0 and later releases', () => {
  for (const version of ['5.12.0', '5.12.1', '5.13.0', '6.0.0', '10.0.0']) {
    const ids = tree([
      { name: 'fast-xml-parser', version, licenceFile: 'MIT License\n\nCopyright Example Author\n' },
      { name: '@nodable/entities', version: '3.1.0' },
      { name: 'strnum', version: '2.1.0' },
    ]);
    const notices = collectNotices([SOURCE, ...ids, ids[0]]);
    assert.deepEqual(
      notices.map((notice) => `${notice.name}@${notice.version}`),
      ['@nodable/entities@3.1.0', `fast-xml-parser@${version}`, 'strnum@2.1.0'],
    );
    const text = renderNotices(notices);
    assert.ok(text.includes(`## fast-xml-parser ${version}\n`), version);
    assert.ok(text.includes('Copyright Example Author'));
    assert.ok(text.includes('The package ships no licence file.'));
  }
  assert.deepEqual(releaseParts('5.12.0'), [5, 12, 0]);
});

test('refuses a bundled package that states no licence', () => {
  const ids = tree([
    { name: 'fast-xml-parser', version: '5.12.0' },
    { name: 'strnum', version: '2.1.0', license: null },
  ]);
  assert.throws(() => collectNotices(ids), /strnum@2\.1\.0 states no licence/);
});
