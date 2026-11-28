# Changelog

## 1.0.3 (2026-11-27)

1.0.2 does not build as a dependency. Pin 1.0.3 instead.

### Fixed

- A consumer that links `//:pkg` through Bazel can build it. On 1.0.2,
  `//:bundle` failed with "[UNRESOLVED_ENTRY] Cannot resolve entry module
  dist/index.js" when this module was an external module. js_run_binary runs
  the tool in the root of the output tree, and the bare paths it passed
  missed this module's files under `external/<repo>/` (TIN-8919).
- `//:bundle` now passes `$(RULEDIR)/dist/index.js` and `$(RULEDIR)/bundle`,
  and `scripts/bundle.mjs` resolves them against the exec root. The same
  paths work when this module is the root module.
- The fast-xml-parser floor refuses a prerelease or a build of 5.12.0, such
  as 5.12.0-beta. Only a plain release at 5.12.0 or later passes.

### Added

- A CI job builds `//:pkg` from `e2e/consumer`, a separate Bazel module that
  takes this repository as an external module through `local_path_override`.
  Its `//:consumer_test` imports the linked package by name and parses a
  multistatus response.
- New test `//:bundle_notices_test`, run in CI. It covers each refusal of
  the notices step: no bundled npm package, no fast-xml-parser, a
  fast-xml-parser under 5.12.0, a prerelease of 5.12.0 and a package that
  states no licence.

### Changed

- The notices code moves from `scripts/bundle.mjs` to
  `scripts/bundle-notices.mjs`, so the test runs it without rolldown. The
  package contents, exports and types are unchanged.

### Migration

1. Re-pin: `bazel_dep(name = "tummycrypt_tinyland_caldav_client", version = "1.0.3")`
   and the xoxd-ai/bazel-registry commit that lists it.

## 1.0.2 (2026-11-27)

### Fixed

- A consumer that links `//:pkg` through Bazel and runs its tests on a
  sandboxed remote runner can load the package. Its tests failed with
  "Cannot find package 'fast-xml-parser'" imported from the linked 1.0.1
  package. rules_js links a package's npm dependencies next to it with
  relative symlinks into this module's external repository. Those resolve in
  the exec root, but not in a remote test's runfiles tree (TIN-8919).
- `dist/index.js` is now one ES module, bundled by rolldown 1.2.14, that
  carries fast-xml-parser 5.12.0 and the 7 packages it uses. The package
  needs only Node built-ins at run time. The build fails if the bundle keeps
  any other runtime import.
- The bundled fast-xml-parser 5.12.0 carries the fix for the low advisory
  GHSA-474x-hrwr-fgx4. The build fails if it would bundle an older version,
  or if the bundle carries no npm package at all.
- `dist/THIRD_PARTY_NOTICES.md` names each bundled package with its version,
  author and MIT licence, and carries the licence text the package ships.
  @nodable/entities 3.1.0 ships no licence file, so its entry gives the
  licence its package.json states.
- New test `//:pkg_test`, run in CI: a scratch consumer with only the built
  package in its node_modules imports it by name, builds a `CalendarClient`
  and parses a multistatus response. It also checks that the notices name
  fast-xml-parser 5.12.0 or later. On the 1.0.1 package it fails with the
  same "Cannot find package 'fast-xml-parser'" error.

### Changed

- fast-xml-parser moves from `dependencies` to `devDependencies`, since the
  bundle carries it. The package lists no runtime npm dependency, and
  `//:pkg` no longer links one next to itself in a consumer. A fast-xml-parser
  update now reaches consumers through a caldav-client release.
- Exports, types and behaviour are unchanged. The declarations stay one
  `.d.ts` file per source file.

### Migration

1. Re-pin: `bazel_dep(name = "tummycrypt_tinyland_caldav_client", version = "1.0.2")`
   and the xoxd-ai/bazel-registry commit that lists it.
2. A consumer that added fast-xml-parser to its own lockfile only for this
   package can drop it.

## 1.0.1 (2026-10-15)

### Security

- `fast-xml-parser` floor raised from `^5.0.0` to `^5.11.2`, and the lockfile
  now resolves fast-xml-parser 5.11.2 with fast-xml-builder 1.3.1 (1.0.0 locked
  fast-xml-builder 1.1.5, affected by GitHub advisories for <= 1.1.6). Bazel
  consumers provide fast-xml-parser from their own lockfile, so they should
  resolve it at >= 5.11.2 as well. No API change; prefer 1.0.1 over 1.0.0.

## 1.0.0 (2026-10-15)

Major release under the 2026-10-08 estate uplift (RU1, RU6, RU8, RU10, RU13).
The runtime API is unchanged from 0.2.3; the toolchain, the in-house
dependency channel and the distribution channel change.

### Changed (breaking for build and distribution, not for the runtime API)

- Toolchain: TypeScript 7.0.2 (native compiler), Vite 8.3.3 and vitest 5.0.3,
  pinned exactly. Bazel builds use `aspect_rules_ts` 3.10.1 with the
  `typescript` extension at 7.0.2 (`transpiler = "tsc"`), and a new
  `//:typecheck` target is the TypeScript 7 type check.
- `tsconfig.json` lists `"types": ["node"]` explicitly, because TypeScript 6+
  no longer loads every `@types/*` package by default. `@types/node` moves to
  `^22.20.5` to match `engines.node >= 22`.
- `@tummycrypt/tinyland-calendar` comes from
  `bazel_dep(name = "tummycrypt_tinyland_calendar", version = "1.0.0")`
  (was 0.2.3), linked with `npm_link_package`. It is a type-only import and
  has no npm dependency entry.
- Distribution is Bazel only (RU6): consume the module with
  `bazel_dep(name = "tummycrypt_tinyland_caldav_client", version = "1.0.0")`
  from xoxd-ai/bazel-registry and link
  `@tummycrypt_tinyland_caldav_client//:pkg` with `npm_link_package`. The
  package is marked `private`; the publish workflow, `publishConfig` and
  `prepublishOnly` are removed (RU8). Nothing on npmjs or GitHub Packages is
  unpublished; those versions are deprecated in favour of the Bazel module.
- CI moves to ci-templates `js-bazel-package.yml` v3.2.1 and runs every check
  through Bazel. The stale committed `dist/` (a 0.2.x build) is removed from
  git; Bazel builds it.
- Repository metadata points at xoxd-ai/tinyland-caldav-client.

### Migration

1. Re-pin: `bazel_dep(name = "tummycrypt_tinyland_caldav_client", version = "1.0.0")`
   and pin the xoxd-ai/bazel-registry commit that carries it. This also lifts
   `tummycrypt_tinyland_calendar` to at least 1.0.0 through minimal version
   selection. Both modules keep `compatibility_level` 1.
2. Replace any `@tummycrypt/tinyland-caldav-client` npm or GitHub Packages
   dependency (and any `pnpm.overrides` entry for it) with the Bazel module
   linked through `npm_link_package`.
3. Exports, types and behaviour are the same as 0.2.3; no source change is
   needed in consumers. Declarations are now emitted by TypeScript 7, so a
   consumer type-checking against them should use TypeScript 7.0.2 as well.

### Known gap

- A plain `pnpm typecheck` outside Bazel reports TS2307 for
  `@tummycrypt/tinyland-calendar` (plus one cascading TS7006 in
  `ical-utils.ts`), because that package resolves only through the Bazel
  module graph. `bazel build //:typecheck` is the authoritative type check and
  is clean. `pnpm test` works outside Bazel (the import is type-only).

## 0.2.3

- Standalone repo release (Bazel registry module
  `tummycrypt_tinyland_caldav_client` 0.2.3). No source change from 0.2.2.

## 0.2.2

- Roll forward published package versions so the next release re-establishes
  npm artifact truth for the current repo contents.
- Updated dependencies: `@tummycrypt/tinyland-calendar` 0.2.2.

## 0.2.1

- Strip `.js.map` sourcemaps from published packages and resolve
  `workspace:*` dependencies to real version ranges.
- Updated dependencies: `@tummycrypt/tinyland-calendar` 0.2.1.
