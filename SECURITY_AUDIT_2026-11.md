# Security Audit — JunctionRelay_Protocols — 2026-11

Date: 2026-11-16
Scope: this repository only (packages/protocol, packages/sdk, plugins/*, scripts/, package manifests/lockfile). Generated `dist/` output and `node_modules/` are gitignored and were not part of the committed tree.
Method: read-only review of tracked source and manifests, local execution of the SDK and pack script against controlled inputs, and offline/online `npm audit` checks.

This report contains no secret values. It lists locations, kinds of issue, severity, attacker prerequisites, confirmation status, and suggested fixes.

## Summary

| Severity | Findings |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 3 |
| Total | 3 |

## Findings

### F-01 — Low — Unvalidated `payloadName` used in pack output path and ZIP entry names

- Location: `scripts/pack.mjs:14`, `:22-30`, `:119-120`
- Kind: path traversal / ZIP-slip risk. `junctionrelay.payloadName` is used without validation in the output filename and in archive entry names, so `..` segments can write the zip outside the plugin directory and produce entries that escape the extraction root. The fixed `dist/index.js` path is also read through symlinks without checking the target.
- Attacker would need: the ability to supply a malicious plugin `package.json`/plugin tree to a maintainer or CI process that runs `npm run pack`. Whether the consuming host sanitizes ZIP entry names during extraction is unconfirmed because that code is not in this repository.
- Confirmation: confirmed in this repository by inspection and at runtime. A plugin manifest with `payloadName` set to `../../escaped` produced a zip outside the plugin directory whose entries were `../../escaped/package.json` and `../../escaped/dist/index.js`.
- Suggested fix: validate `payloadName` with `PLUGIN_ID_PATTERN`, reject absolute paths and `..` segments, contain the resolved output path inside the plugin directory, reject symlinks for the packaged files, and validate ZIP entry names before writing.

### F-02 — Low — SDK does not validate the JSON-RPC envelope before use

- Location: `packages/sdk/src/PayloadPlugin.ts:74`, `:85`, `:97`, `:120-128`
- Kind: untrusted input handling / robustness. After `JSON.parse`, the SDK assumes the value is an object with `method`, `params`, and `id`. A `null` line causes an uncaught exception while constructing the error response, so no JSON-RPC error is returned. A primitive or a request with no method produces `METHOD_NOT_FOUND` with a missing/undefined id instead of `INVALID_REQUEST`. Handler dispatch uses `handlers[method]`, so inherited `Object.prototype` members such as `constructor` or `toString` are treated as handlers rather than being rejected.
- Attacker would need: the ability to write lines to a plugin's stdin (the parent host or another local process with access to the pipe).
- Confirmation: confirmed in code and at runtime. A `null` line threw `Cannot read properties of null (reading 'id')`; a JSON string line produced a JSON-RPC error without an id; `{"jsonrpc":"2.0","id":1}` produced `Method not found: undefined`.
- Suggested fix: validate that the parsed value is an object, `jsonrpc` is `"2.0"`, `method` is a string, `params` is an object, and `id` is a string/number/null; otherwise return `INVALID_REQUEST` (`-32600`). Look up handlers only as own properties (for example `Object.hasOwn`).

### F-03 — Low — esbuild advisory in development dependency

- Location: `package.json:16`; `package-lock.json:493-534` (`hasInstallScript` at `:498`)
- Kind: dependency risk. `npm audit` reports GHSA-g7r4-m6w7-qqqr (low): esbuild's development server allows arbitrary file read on Windows. esbuild is a devDependency (also pulled in by tsx) and is not bundled into runtime plugin code; it declares an install script.
- Attacker would need: local use of the affected esbuild development server on Windows, not a remote plugin consumer.
- Confirmation: confirmed by online `npm audit` against the installed dependency tree. `npm audit --offline` reported no advisories because the offline advisory database was unavailable. `npm audit --omit=dev` reported no advisories, so the production dependency set is unaffected.
- Suggested fix: upgrade esbuild to at least 0.28.1 (the audit proposes 0.28.2) and rebuild.

## Areas checked with no findings

- Committed secrets or credentials: none found in tracked files. There are no `.env`, key, certificate, or credential files in the tree. Package-lock integrity hashes are not secrets. No values are reproduced here.
- Outbound HTTP to caller-chosen URLs (SSRF): no HTTP client usage in the repository (no `fetch`, `http`, or `https` imports), and no caller-chosen URLs. The only URLs are fixed repository metadata URLs in manifests and documentation.
- TLS or certificate checks turned off: no TLS/certificate code exists, and nothing disables verification.
- Unsafe deserialization or eval: no `eval`, `new Function`, dynamic import/require of input, unsafe YAML load, or pickle-style deserialization. Parsing is limited to `JSON.parse` for stdin lines and `package.json`. The `node -e` clean scripts contain fixed code and no user input.
- Command or process execution: the SDK only reads stdin, writes stdout/stderr, and exits; there is no `child_process`, `spawn`, `exec`, or shell use. `scripts/pack.mjs` uses only `fs` and `zlib`. Package scripts use fixed commands.
- Path traversal: plugin handlers use no filesystem paths. The pack script is covered by F-01. No configuration-derived filesystem paths exist.
- Logging of tokens or keys: no token/key logging found. The SDK writes the plugin display name, stdin/SIGTERM notices, and unhandled error messages to stderr; JSON-RPC errors return handler error messages. Request params and configuration are not logged.
- Untrusted network and plugin data: sensor, config, and context values are serialized with `JSON.stringify`; they are not passed to eval, a shell, a URL, or a filesystem path. Unknown `fieldsToSend` names are ignored. Malformed handler params throw and are returned as JSON-RPC errors (the envelope-level issue is F-02). The shipped profiles expose only presentation/layout fields, not credentials.
- Plugin configuration: the JR protocol filters host-only keys and parses `fieldsToSend` as an array or legacy comma-separated string; other config values are echoed into the payload by design. The XSD and raw-json plugins do not consume config. No path, command, URL, or credential handling is present.
- Dependency risk: a lockfile is present (`lockfileVersion` 3) and registry packages include `resolved` and `integrity`; workspace packages are local links. Online `npm audit` reports only the low esbuild advisory in F-03; offline `npm audit` reports no advisories because the offline advisory database was unavailable. Install scripts are declared by esbuild (development tooling) and optional fsevents (darwin-only); workspace packages declare none.
- Protocol package: constants and TypeScript types only; no I/O or security-sensitive runtime behavior.
- SDK helpers: array building, string formatting, and tag filtering only; no security-sensitive behavior.
- Shaders `serve.py`/`test.html`: not part of this repository; covered by the JunctionRelay_Shaders run.

## Test status

`set -e; npm ci; npm run build; npm test` passes unchanged on the base branch. `npm ci` reports one low vulnerability (F-03). No workspace defines a test script, so `npm test --workspaces --if-present` runs zero tests and exits successfully; there were no pre-existing test failures. No code or test files were changed; this PR adds only this report.
