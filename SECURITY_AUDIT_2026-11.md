# Security Audit — JunctionRelay_Protocols — 2026-11

Date: 2026-11-16
Scope: this repository only — `packages/protocol`, `packages/sdk`, `plugins/*` (jr-protocol, xsd-protocol, raw-json), `scripts/pack.mjs`, all package manifests, README/SDK docs, `package-lock.json`, and the full git history (single commit, 37 objects, 26 tracked files, all plain text).
Method: read-only review of tracked source, manifests and lockfile; review of the whole git object history for committed secrets; local execution of the repository's own build and test commands; `npm audit` (online, `--package-lock-only` and `--offline`); targeted runtime probes of the SDK request handler run against the checked-out source.
Severity yardstick: the same one used by the 2026-11-15 audit set (`0_Documentation/10_Security` in `JunctionRelay_Build_Scripts`) — High for remotely reachable auth/code-execution-class flaws with low prerequisites, Medium for weaknesses that need a LAN/adjacent position, a config write or user interaction, Low for robustness, hardening and supply-chain hygiene.

**This audit changed no code.** No production file, test file, fixture, manifest, lockfile or build output was added, modified or deleted; nothing in this report has been fixed. It is a report only.

This report contains no secret values. It lists locations, kinds of issue, severity, attacker prerequisites, confirmation status and one-line fixes.

## Summary

| Severity | Findings |
| --- | --- |
| High | 0 |
| Medium | 1 |
| Low | 8 |
| Total | 9 |

## Findings

### P-01 — Medium — All payload-instance settings are forwarded unfiltered into the device config payload

- Location: `plugins/junctionrelay.jr-protocol/src/index.ts:12-21` (`buildSettings`, copy at `:18`), invoked at `:226`, emitted into the payload at `:240`; the only exclusion list is `HOST_KEYS` at `:4-6`, which holds `fieldsToSend` alone.
- Kind: untrusted/over-broad input handling plus information disclosure. Whatever the host stores in a payload instance's `config` is copied key-for-key (including nested objects and arrays, unvalidated and untyped) into the `settings` object of the `config` payload that is written to the transport at every connect — serial, raw TCP or any other link, which are the transports this protocol is documented for (`README.md:249`).
- Attacker would need: passive read access to the link between the host and the device (a hostile serial tap, a raw-TCP listener or a compromised intermediate) to read whatever the operator or the host has put in the payload configuration; or, to inject, the ability to write payload configuration (a malicious plugin manifest can declare arbitrary `profileConfigs` field keys — nothing in `PayloadFieldDefinition`, `packages/protocol/src/index.ts:264-274`, restricts key names or types), which then reaches device firmware unfiltered.
- Confirmation: the passthrough is confirmed in code — there is no allowlist of declared manifest fields, no type check and no key filter beyond `fieldsToSend`. Whether any secret is exposed today is **unconfirmed**: the 87 fields declared across the nine profiles in `plugins/junctionrelay.jr-protocol/package.json` contain no credential-like field, and what the host itself injects into `config` is outside this repository.
- Suggested fix: build `settings` from the profile's declared `profileConfigs` keys (an allowlist), coerce each value to its declared type, and drop every other key.

### P-02 — Low — SDK uses the JSON-RPC request envelope without validating it

- Location: `packages/sdk/src/PayloadPlugin.ts:70-104` (`JSON.parse` at `:74`, `request.method` at `:85`, `request.id` at `:88` and `:97`).
- Kind: untrusted input handling / robustness. Any parsed JSON value is treated as an object with `method`, `params` and `id`. A line containing `null` throws a `TypeError` while building the error response, so nothing is answered and the failure only reaches stderr (`:53`); `"str"` and `[1,2]` produce `{"jsonrpc":"2.0","error":...}` responses with **no `id`**, which are not valid JSON-RPC responses; a numeric `method` is echoed back into the error message. Handler arguments (`params`) are also passed through with a bare cast at `:127` and are never checked against `HandlerParams`.
- Attacker would need: the ability to write lines to a plugin's stdin — the parent host, or any local process that can reach the pipe/stdio of the spawned plugin.
- Confirmation: confirmed in code and reproduced by invoking `handleLine` directly with `null`, `"str"`, `[1,2]`, `{}` and a numeric `method`.
- Suggested fix: after `JSON.parse`, require a non-null object with a string `method`, an object `params` and a `string|number|null` `id`, and otherwise reply `INVALID_REQUEST` (`-32600`) with `id: null`.

### P-03 — Low — Handler lookup walks the prototype chain, so non-declared methods can be invoked

- Location: `packages/sdk/src/PayloadPlugin.ts:120` (`this.config.handlers[method]`), called at `:128`.
- Kind: missing allowlist on a dispatcher. Any method name resolves through `Object.prototype`, so `method: "constructor"` returns an object, `"toString"` returns a string and `"hasOwnProperty"` / `"isPrototypeOf"` throw — all of them bypassing the `Method not found` guard at `:121` and the plugin's own handler code, and all of them invoked with attacker-supplied `params`.
- Attacker would need: the same as P-02 — write access to the plugin's stdin.
- Confirmation: confirmed by running `dispatch()` on the checked-out SDK with `constructor`, `toString`, `hasOwnProperty`, `__proto__` and `isPrototypeOf`; the first two returned values, the next two threw, none returned `-32601`.
- Suggested fix: look the handler up with `Object.prototype.hasOwnProperty.call(this.config.handlers, method)` (or hold the handlers in a `Map`) and reject everything else with `METHOD_NOT_FOUND`.

### P-04 — Low — No size cap or backpressure on request lines read from stdin

- Location: `packages/sdk/src/PayloadPlugin.ts:46-49` (`readline.createInterface` on `process.stdin`) and `:51-55`.
- Kind: resource exhaustion. Request lines are buffered whole with no maximum length, no per-line budget and no request rate limit; a single very large line is held in memory and then duplicated by `JSON.parse`. This is the plugin-side analogue of the uncapped-body-reader class already recorded for the hosts.
- Attacker would need: the ability to write to the plugin's stdin (the host, or a local process attached to the child stdio). Payloads are normally small JSON lines, so the practical trigger is a hostile or malfunctioning host.
- Confirmation: confirmed in code; no cap exists anywhere in the SDK.
- Suggested fix: reject lines longer than a fixed bound (for example 1 MB) with `PARSE_ERROR` before parsing, and count/deny request volume above a threshold.

### P-05 — Low — A sensor tag named `__proto__` reassigns the prototype of the output object

- Location: `packages/sdk/src/helpers.ts:36` (`result[tag] = sensor`), `plugins/junctionrelay.jr-protocol/src/index.ts:268`, `plugins/junctionrelay.xsd-protocol/src/index.ts:22`, `plugins/junctionrelay.raw-json/src/index.ts:22`.
- Kind: prototype pollution surface / silent data loss on object keys derived from external data. Sensor tags arrive as JSON object keys from the host (`JSON.parse` does create a real own `__proto__` key), and are then used as computed keys on plain `{}` objects. Measured behaviour: with an object value (`helpers.ts:36`, jr-protocol, xsd-protocol) the returned object's prototype is replaced by that sensor object and the tag disappears from the serialized output; with a primitive value (raw-json) the assignment is silently dropped.
- Attacker would need: the ability to introduce a sensor whose tag is exactly `__proto__` upstream of the host. That origin is outside this repository and is therefore **unconfirmed** here; collector-produced tags in this ecosystem are derived from external sources. No global pollution occurs — the touched object is created per call — so the impact is a dropped/garbled sensor entry and a record with an unexpected prototype handed back to the host.
- Confirmation: the assignment pattern and the measured per-object behaviour are confirmed in code (reproduced with a `JSON.parse`d sensors dictionary). The upstream tag origin is unconfirmed.
- Suggested fix: create these accumulators with `Object.create(null)` (or `new Map()`), or skip tags that are not own-safe names.

### P-06 — Low — Pack script interpolates the unvalidated plugin name into archive entry names and the output path

- Location: `scripts/pack.mjs:14` (`pluginName` read from `junctionrelay.payloadName`, only checked for presence at `:16-19`), used as the archive entry prefix at `:29-30` and as the output filename at `:119`.
- Kind: path traversal (CWE-22) in a build tool, plus ZIP-slip entry names. `PLUGIN_ID_PATTERN` exists in this very repository (`packages/protocol/src/index.ts:15`) and is not applied. A manifest with, for example, `payloadName: "../../tmp/demo"` makes `:119` write `demo.zip` outside the plugin directory, and makes the archive contain entries whose names traverse out of the extraction root — which matters because the documented install path extracts these archives automatically (`README.md:211-221`).
- Attacker would need: to hand a crafted `package.json`/plugin tree to a maintainer or CI job that runs `npm run pack` (the README tells plugin authors to copy a plugin folder and edit the manifest, `README.md:26-44`). It is a developer/CI-side issue, not something a running host reaches.
- Confirmation: confirmed in this repository that the name is used unvalidated in both the entry names and the output path. Whether the consuming host re-validates entry names during extraction is **unconfirmed** — that code is not in this repository (the 2026-11-15 XSD audit records entry containment as host-side, finding X6).
- Suggested fix: validate `payloadName` against `PLUGIN_ID_PATTERN` before packing and reject any entry name or output path that resolves outside the plugin directory.

### P-07 — Low — Low-severity esbuild advisory in a development dependency

- Location: `package.json:16` (`"esbuild": "^0.27.3"`), `package-lock.json:493-498` (installed 0.27.3, `dev: true`, `hasInstallScript: true`).
- Kind: dependency risk. `npm audit --package-lock-only` reports GHSA-g7r4-m6w7-qqqr — "esbuild allows arbitrary file read when running the development server on Windows" — affecting 0.27.3 through 0.28.0; the proposed fix is 0.28.2 (semver-major). It is a devDependency only (also pulled in transitively by `tsx`), it is never bundled into plugin output, and this repository only uses the esbuild CLI in bundle mode, never its dev server.
- Attacker would need: local use of the esbuild development server on Windows, i.e. a maintainer workstation scenario, not a plugin consumer or a device.
- Confirmation: confirmed by online `npm audit` against the committed lockfile. `npm audit --offline` reports "found 0 vulnerabilities" here because the offline advisory cache is unavailable, so an offline audit gives a false negative and `--omit=dev` also reports none.
- Suggested fix: bump esbuild to 0.28.2 in `package.json`, regenerate the lockfile and rebuild.

### P-08 — Low — Plugin builds outside the monorepo are not pinned by this lockfile

- Location: `README.md:194-198` (documented standalone plugin build: plain `npm install` + `npm run build` in the copied plugin folder) with the SDK dependency declared at `plugins/junctionrelay.jr-protocol/package.json:651`, `plugins/junctionrelay.raw-json/package.json:38` and `plugins/junctionrelay.xsd-protocol/package.json:39`.
- Kind: supply-chain/build-reproducibility. The committed root lockfile covers only the monorepo build; a standalone plugin folder has no lockfile, so its `@junctionrelay/payload-sdk@1.0.0` (and the esbuild used to bundle it, which has an install script) is resolved live from the registry at build time, with whatever transitive versions the registry returns that day, and is then inlined into `dist/index.js` that ships to devices.
- Attacker would need: registry, mirror or network-path position during such an unfrozen install (the same prerequisite as a dependency-confusion or compromised-tarball attack), or a compromised published SDK version.
- Confirmation: confirmed in the docs and manifests; no per-plugin lockfile is tracked and no integrity/SBOM artifact is produced by the documented flow.
- Suggested fix: ship a template lockfile (or an `npm ci` step plus `--omit=dev` bundling) with the plugin template and record the SDK version actually inlined in each bundle.

### P-09 — Low — Packaged plugins carry no integrity or signature, and the documented install path auto-extracts and runs them

- Location: `scripts/pack.mjs:118-121` (writes `<payloadName>.zip` with no checksum, manifest signature or provenance) and `README.md:203-221`, which documents dropping that zip into a protocols directory that "the app automatically extracts on next startup and deletes the zip file"; the packaged entry point is executable code declared as a free-form string in the manifest (`packages/protocol/src/index.ts:320`, `entry: string`).
- Kind: supply chain / trust model. A payload plugin is code execution by design — a zip placed in the protocols directory runs as the host user — and nothing in the packaging chain owned by this repository gives the operator a way to tell a signed artifact from a hand-built one. Combined with an `entry` value that is not constrained by any type or pattern here, an archive can name any relative script to load.
- Attacker would need: write access to the protocols directory (any process or user account that can write there, including a malware foothold on the workstation), or the ability to get a user to install a plugin from an untrusted source.
- Confirmation: confirmed in this repository that no integrity or signature artifact is generated or checked, and that `entry` is an unconstrained string in the manifest type. Host-side extraction, entry containment and signature handling are **unconfirmed** here — they live in Server/XSD, and entry containment is already recorded there as X6.
- Suggested fix: emit a checksum and (when a signing key is configured) a detached signature alongside each `.zip`, document the expected values, and validate `entry` against a plugin-relative pattern before packing.

## Areas checked with no findings

- **Committed secrets or credentials:** none. A full-tree pattern sweep of all 26 tracked files (secrets, API keys, tokens, passwords, private-key blocks, cloud key formats, JWT-shaped strings, Authorization/Bearer values) matched nothing, and no binary files are tracked. Every package/lockfile URL is a public registry or repository URL. No values are reproduced anywhere in this report because there are none.
- **Secrets in git history:** the repository has a single commit and 37 git objects in total; all were enumerated and the same sweep over their contents found nothing. Nothing was ever committed and removed.
- **Credential-shaped configuration fields:** none of the 87 `profileConfigs` fields declared across the nine profiles in `plugins/junctionrelay.jr-protocol/package.json`, nor any field in the other two manifests, is a secret, token, URL or endpoint field; the plugin manifests hold display metadata and layout/appearance defaults only.
- **SSRF / outbound HTTP:** none anywhere. No plugin, the SDK or the protocol package imports `http`, `https`, `fetch`, `net`, `dgram`, `tls`, `dns` or any HTTP client — payload plugins are pure in-process transforms (grep for network sinks returns nothing in `packages/*/src` or `plugins/*/src`). The 2026-11-15 audit's SSRF class therefore does not occur in this repository.
- **Command or process execution:** none in `packages/*/src`, `plugins/*/src` or `scripts/`. `scripts/pack.mjs` only uses `fs`/`path`/`zlib`. The `clean` scripts run `node -e` with a fixed literal string (`plugins/*/package.json`), and the `build` scripts invoke the pinned local esbuild binary with fixed arguments — no shell string interpolation, no user-controlled command, argument or path.
- **Unsafe deserialization or eval:** no `eval`, `new Function`, `Function(...)`, `vm`, dynamic `import()` of a runtime value, `require(variable)`, YAML/pickle/object-stream decoding anywhere. The only deserialization is `JSON.parse` of a stdin line (`packages/sdk/src/PayloadPlugin.ts:74`) and of the plugin's own `package.json` (`scripts/pack.mjs:12`), which cannot execute code; envelope weaknesses are P-02/P-03 rather than code execution.
- **TLS / certificate checks:** no TLS is used or configured anywhere in the repository, and nothing sets `rejectUnauthorized`, `NODE_TLS_REJECT_UNAUTHORIZED` or an equivalent bypass. Transport protection is a host/transport concern and is out of this repository (the JR Prefix framing note at `README.md:247-253` describes framing only, not security).
- **Logging of tokens or keys:** no logging of configuration values, and nothing to log — no credentials exist here. The SDK writes only a fixed ready/shutdown banner and `err.message`/`String(err)` to stderr (`packages/sdk/src/PayloadPlugin.ts:53`, `:58`, `:63`, `:67`) and plugin-generated error messages into JSON-RPC error responses (`:99-101`). Handler exceptions thrown by third-party plugins could in principle embed a value in their message; no plugin in this repository does.
- **Path traversal (other than P-06):** all filesystem access is fixed and relative — `scripts/pack.mjs:12`, `:21`, `:29` read `package.json` and `dist/index.js` under `process.cwd()`; no plugin reads files, and no handler accepts a path from config or sensor data.
- **Sensor-data handling in output builders:** `buildSensorData` (`plugins/junctionrelay.jr-protocol/src/index.ts:43-189`) is a closed `switch` allowlist over the 40 fields declared in `SENSOR_FIELDS` (`packages/protocol/src/index.ts:135-189`), so a caller-supplied `fieldsToSend` value (`:28-37`) cannot read arbitrary properties off a `SensorEntry`; unrecognised names fall through and emit nothing.
- **Protocol package:** `packages/protocol/src/index.ts` is constants and TypeScript types only — no I/O, no runtime behaviour of security consequence. `PLUGIN_ID_PATTERN` (`:15`) is correct and rejects traversal-shaped names; note that it is applied only inside the `PayloadPlugin` constructor (`packages/sdk/src/PayloadPlugin.ts:29-38`), and since the last commit removed `rpc-host.mjs` from the SDK nothing in this repository instantiates that class, so enforcement in production depends on the host.
- **Dependency risk (beyond P-07/P-08):** a lockfile is present (`package-lock.json`, lockfileVersion 3) and `npm ci` runs from it cleanly. All 34 registry entries carry both `resolved` and `integrity`; the remaining 5 entries are local workspace links with no integrity, which is correct. The runtime plugin dependency graph is empty apart from the workspace SDK — there are no third-party production dependencies at all. Install scripts exist only for `esbuild` (dev) and the optional `darwin`-only `fsevents`; every `@esbuild/*` platform package is an optional, OS-scoped binary with no script.
- **Build output and generated files:** `dist/` and `*.tgz` are gitignored and none are tracked, so no build output is in the tree; the locally present bundles were regenerated by the build and match their sources.
- **Docs consistency (not a finding):** `README.md:263` and `package-lock.json:625-627` still reference the `rpc-host` bin that the last commit removed from the SDK, so the documented quick-start command names a file that no longer exists; the stale lockfile `bin` entry would create a dangling `node_modules/.bin` link. Documentation/hygiene only, listed for the record.
- **`serve.py` and `test.html`:** not part of this repository; they belong to `JunctionRelay_Shaders` and are covered by that repository's audit run.

## Test status

No test, fixture, assertion or test-configuration file was touched, added, skipped or weakened by this audit — the repository contains no test files and no `test` script in any workspace.

- On the PR branch and on `main`, the repository's test command `set -e; npm ci; npm run build; npm test` succeeds identically: `npm ci` installs from the lockfile, `npm run build` compiles `packages/protocol`, `packages/sdk` and bundles all three plugins, and `npm test` (`npm test --workspaces --if-present`) matches no `test` script in any of the five workspaces, runs nothing, and exits 0.
- Both commands were executed in this run on the base commit and again with the audit document present, with the same result. Adding this file cannot change the outcome because it is Markdown only.
- There are therefore no pre-existing failures here to report, and nothing was fixed: the suite's emptiness (zero tests) is recorded as an observation, not a pass of any coverage.

## Pull request description

- Findings by severity: High 0, Medium 1, Low 8 (9 total), all recorded in `SECURITY_AUDIT_2026-11.md`.
- Test result for this repository: `set -e; npm ci; npm run build; npm test` passes (exit 0) on the PR branch and passes identically on `main`. `npm ci` and `npm run build` succeed; `npm test` runs no tests because no workspace declares a `test` script, so it exits 0 on both branches.
- Scope of the change: this PR adds the single file `SECURITY_AUDIT_2026-11.md` at the repository root and changes nothing else. It is a read-only audit report; it fixes nothing and the code it describes is unchanged.
