# JunctionRelay Protocols - Security Audit 2026-11

Date: 2026-11-16
Repository: `JunctionRelay_Protocols`
Base commit: `e455db8`
Scope: `packages/protocol`, `packages/sdk`, all `plugins/*` (`jr-protocol`, `raw-json`, `xsd-protocol`), `scripts/pack.mjs`, `README.md` files, and the dependency lockfile. This is a read-only audit and changes no code.

Severity scale: the same scale as the 2026-11-15 audit and the sibling Collectors 2026-11 report.
- **High**: an unauthenticated remote attacker can compromise the system or get secrets.
- **Medium**: an attacker who controls config or the network can leak credentials or reach internal services.
- **Low**: the attacker needs host-level, local or developer access, the issue affects dev tooling only, or the impact is limited to robustness or defence in depth.

Trust model: the host (Server or XSD) spawns each plugin as a child process and talks JSON-RPC 2.0 over stdin/stdout. Sensor data and plugin config come from the host. The plugin's output payload is sent to devices. The host-side loader (`rpc-host.mjs`) is no longer in this repository (it was removed in `e455db8`), so it is out of scope here.

## Summary

| Severity | Count |
|---|---:|
| High | 0 |
| Medium | 0 |
| Low | 5 |

## Findings

| ID | Sev | Finding (file:line) | Attacker needs | Confirmed | Suggested fix |
|---|---|---|---|---|---|
| P1 | Low | `junctionrelay.payloadName` from the plugin's `package.json` is not validated before it is used in zip entry names and in the output path. A value such as `../x` writes the zip outside the plugin directory and creates `../`-prefixed (zip-slip) entries. `scripts/pack.mjs:14`, `29-30`, `119-120` | Control of a plugin's `package.json`, plus a victim who runs `npm run pack` on it. | Confirmed: running pack with `payloadName` `../escaped` wrote `../escaped.zip` containing `../escaped/package.json` and `../escaped/dist/index.js`. | Reject any `payloadName` that does not match `PLUGIN_ID_PATTERN` before building the zip. |
| P2 | Low | The JSON-RPC dispatcher looks up `this.config.handlers[method]` with a plain property lookup, so inherited `Object.prototype` members count as handlers. Instead of `METHOD_NOT_FOUND`, `constructor` echoes the params back, `toString` returns `"[object Undefined]"`, and `valueOf`/`__proto__` give internal TypeErrors. `packages/sdk/src/PayloadPlugin.ts:120-128` | Ability to write JSON-RPC lines to the plugin's stdin (the host, or anything that can make the host forward an arbitrary method name). No code execution was found; the impact is unexpected behaviour and a wrong error contract. | Confirmed by sending these method names to a running plugin. | Dispatch only if `Object.hasOwn(handlers, method) && typeof handlers[method] === 'function'`; otherwise return `METHOD_NOT_FOUND`. |
| P3 | Low | Parsed requests are not shape-checked. A valid JSON line that is not an object (for example `null`) makes `request.method` throw, and the catch block then throws again on `request.id`. No response is written, so the host's pending request hangs until the host's own timeout. `method`, `params` and `jsonrpc` are also never type-checked. `packages/sdk/src/PayloadPlugin.ts:74`, `85`, `97` | Ability to write to the plugin's stdin (host-level). The effect is denial of service of a single request. | Confirmed: sending `null` logged `Unhandled error: TypeError ...` and produced no response. Later requests were still served. | After `JSON.parse`, check that the value is a non-null object with a string `method`. If not, return `INVALID_REQUEST` with `id: null`. |
| P4 | Low | `jr-protocol`'s `buildSettings` copies every config key except `fieldsToSend` into the `config` payload sent to devices. There is no allowlist against the declared `profileConfigs` fields. A `__proto__` key replaces the prototype of the local `settings` object. Checked: this does not pollute the global prototype, and the key is dropped from the JSON output. `plugins/junctionrelay.jr-protocol/src/index.ts:12-21` (line 18), used at `226` | Ability to add keys to the payload instance config, or a future host that stores sensitive values in payload config; those values would then go to every device on the stream. | Pass-through confirmed. Exposure of secrets is unconfirmed: none of the current `profileConfigs` fields is sensitive. | Build `settings` from an allowlist of the active profile's declared field keys, and skip `__proto__`, `constructor` and `prototype`. |
| P5 | Low | `npm audit` reports a low advisory for the dev-only `esbuild` 0.27.3 dependency: GHSA-g7r4-m6w7-qqqr, arbitrary file read when the dev server runs on Windows (affected range `>=0.27.3 <0.28.1`). `npm audit --offline` reports 0, because there is no local advisory cache. The online audit reports the advisory. `package.json:16`, `package-lock.json:16`, `493-498` | Ability to reach an esbuild dev server running on Windows. The repo only uses `esbuild` for one-shot bundling (`build` scripts) and never starts the dev server, and esbuild is not shipped in plugin bundles. | Dependency advisory confirmed. Exploitability in this repo is unconfirmed and unlikely. | Raise the `esbuild` range to `>=0.28.1` and refresh the lockfile when convenient. |

## Areas checked with no finding

| Area | Result |
|---|---|
| Secrets or credentials committed in the tree | None found. All tracked files were searched (excluding lockfile hashes) for password, secret, token, API key, bearer, private key, cloud access key and GitHub token patterns: no matches. No secret value is reproduced in this report. |
| Git history | The repository has a single commit, and the same search over the full patch history found nothing. |
| Command or process execution | No `child_process`, `exec`, `spawn` or shell use anywhere in `packages/`, `plugins/` or `scripts/`. Process spawning belongs to the host's `rpc-host.mjs`, which is not in this repo. |
| Unsafe deserialization or eval | No `eval`, `new Function`, dynamic `import()` of caller-supplied paths, or unsafe deserializer. The SDK uses only `JSON.parse` on stdin lines, and parse errors are caught and answered with `PARSE_ERROR`. The response is written with `JSON.stringify`, one line per message, so payload content cannot inject extra JSON-RPC frames. |
| Outbound HTTP / SSRF | None. No `fetch`, `http`/`https` request, socket or URL handling exists in any package or plugin. Plugins are pure transforms of host-supplied data. |
| TLS or certificate checks turned off | Not applicable: there is no network code. No `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized` or custom agent appears. |
| Path traversal (runtime) | Protocol, SDK and plugin runtime code touch no filesystem paths. `PayloadPluginManifest.entry` and `DiscoveredPlugin.directory` are type declarations only. Validating them is the host loader's job, which is out of scope here. The packaging-script issue is P1. |
| Untrusted input: sensor data and network data | Sensor tags and values are copied into output objects with `Object.entries` and string formatting only. Nothing is interpolated into code, paths or commands. `fieldsToSend` is matched against a fixed `switch`, so unknown field names are ignored. The handler-dispatch and request-shape issues are P2 and P3; the config pass-through is P4. |
| Plugin identity | The `PayloadPlugin` constructor rejects a `payloadName` that does not match `PLUGIN_ID_PATTERN` (`packages/sdk/src/PayloadPlugin.ts:31-35`). The pattern is anchored and has no nested quantifiers that could cause catastrophic backtracking. |
| Logging of tokens or keys | Nothing sensitive is logged. Stderr gets only fixed lifecycle messages, the plugin display name, and unhandled error text. Error responses carry only `err.message`. |
| Resource limits | `readline` buffers each stdin line without a size limit. Only the host writes to stdin, so this is not counted as a finding. |
| Dependency risk | `package-lock.json` (lockfileVersion 3) is present. All 34 resolved packages come from `https://registry.npmjs.org` and have integrity hashes. There are no third-party production dependencies, only the workspace packages; everything else is a dev dependency. Install scripts: `esbuild` (`postinstall` verifies or downloads its platform binary) and the optional `fsevents` (macOS only). Both are well-known packages. The only advisory is P5. |
| Shaders `serve.py` and `test.html` | Not present in this repository; this item is covered by the Shaders run. |

## Repository test status

The test command `set -e; npm ci; npm run build; npm test` passes on the base branch and on this branch. Note that no workspace defines a `test` script, so `npm test --workspaces --if-present` runs zero tests and passes vacuously. Adding tests is out of scope for this read-only audit and is a candidate for the follow-up tickets that fix P2 and P3.
