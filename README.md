# @tummycrypt/tinyland-caldav-client

CalDAV client for the Xandikos calendar server, with sync-token
(RFC 6578 `sync-collection`) support, iCal helpers and XML response parsers.

## Consume (Bazel only)

This package is distributed as the Bazel module
`tummycrypt_tinyland_caldav_client` from
[xoxd-ai/bazel-registry](https://github.com/xoxd-ai/bazel-registry). It is not
published to npm.

```starlark
bazel_dep(name = "tummycrypt_tinyland_caldav_client", version = "1.0.1")
```

Link `@tummycrypt_tinyland_caldav_client//:pkg` into your app's
`node_modules` with `npm_link_package`, then import
`@tummycrypt/tinyland-caldav-client`. Its in-house dependency
`tummycrypt_tinyland_calendar` (>= 1.0.0) arrives through the module graph.

## Develop

```bash
bazel build //:pkg //:typecheck
bazel test //...
pnpm install && pnpm test   # vitest outside Bazel also works
```

Bazel is the authority. `@tummycrypt/tinyland-calendar` resolves only through
the Bazel module graph, so a plain `pnpm typecheck` reports TS2307 for it (and one
cascading TS7006); use `bazel build //:typecheck`. Toolchain: TypeScript 7.0.2, Vite 8.3.3 and vitest
5.0.3, pinned exactly. See [CHANGELOG.md](CHANGELOG.md).
