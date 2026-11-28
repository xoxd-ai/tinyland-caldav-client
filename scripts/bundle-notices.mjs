// Third-party notices for the bundle that scripts/bundle.mjs writes
// (TIN-8919). This module needs only Node built-ins, so
// //:bundle_notices_test can run it without rolldown.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// 5.12.0 fixes GHSA-474x-hrwr-fgx4. Refuse to freeze an older copy.
export const MIN_FAST_XML_PARSER = [5, 12, 0];

const NODE_MODULES = '/node_modules/';
const VERSION_PART = /^(0|[1-9][0-9]*)$/;
const LICENCE_FILE = /^(license|licence|copying)/i;

// Returns the package directory that holds a bundled module, or null for a
// module outside node_modules.
export function packageRoot(moduleId) {
  const at = moduleId.lastIndexOf(NODE_MODULES);
  if (at < 0) return null;
  const rest = moduleId.slice(at + NODE_MODULES.length).split('/');
  const depth = rest[0].startsWith('@') ? 2 : 1;
  return moduleId.slice(0, at + NODE_MODULES.length) + rest.slice(0, depth).join('/');
}

// Returns [major, minor, patch] for a plain release version. Returns null for
// anything else, so a prerelease such as 5.12.0-beta or a version with build
// metadata never meets the floor.
export function releaseParts(version) {
  if (typeof version !== 'string') return null;
  const parts = version.split('.');
  if (parts.length !== 3 || !parts.every((part) => VERSION_PART.test(part))) return null;
  return parts.map((part) => Number(part));
}

export function atLeast(version, minimum) {
  const parts = releaseParts(version);
  if (parts === null) return false;
  for (let i = 0; i < minimum.length; i += 1) {
    if (parts[i] !== minimum[i]) return parts[i] > minimum[i];
  }
  return true;
}

function licenceText(root) {
  const name = readdirSync(root).find((file) => LICENCE_FILE.test(file));
  return name ? readFileSync(join(root, name), 'utf8').trim() : null;
}

function authorOf(manifest) {
  const { author } = manifest;
  if (!author) return 'not stated';
  return typeof author === 'string' ? author : author.name;
}

// One notice per bundled npm package, taken from its own package.json and,
// when it ships one, its licence file. Throws when the notices cannot stand
// for the bundle.
export function collectNotices(moduleIds) {
  const roots = new Set();
  for (const moduleId of moduleIds) {
    const root = packageRoot(moduleId);
    if (root) roots.add(root);
  }

  const notices = [];
  for (const root of [...roots].sort()) {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (!manifest.license) {
      throw new Error(`${manifest.name}@${manifest.version} states no licence`);
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
  checkNotices(notices);
  return notices;
}

// The bundle exists to carry fast-xml-parser 5.12.0 or later. An empty list
// means the package resolution changed under us, so the notices would cover
// nothing.
export function checkNotices(notices) {
  if (notices.length === 0) {
    throw new Error('the bundle carries no npm package, so it has no notices to write');
  }
  const parser = notices.find((notice) => notice.name === 'fast-xml-parser');
  if (!parser) {
    throw new Error('the bundle does not carry fast-xml-parser');
  }
  if (!atLeast(parser.version, MIN_FAST_XML_PARSER)) {
    throw new Error(
      `the bundle carries fast-xml-parser ${parser.version}, which is not a release at or above ${MIN_FAST_XML_PARSER.join('.')}`,
    );
  }
}

export function renderNotices(notices) {
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
  return lines.join('\n');
}
