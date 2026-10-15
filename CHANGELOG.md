# Changelog

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
