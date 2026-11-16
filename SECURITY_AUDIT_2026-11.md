# Security Audit — JunctionRelay_Protocols

- **Audit date:** 2026-11-16
- **Yardstick:** the 2026-11-15 audit scale (High / Medium / Low, defined below)
- **Repository:** `catapultcase/JunctionRelay_Protocols`
- **Commit audited:** `e455db8` ("Remove rpc-host from SDK — host asset, not plugin asset"), which is `origin/main` at audit time
- **Type:** read-only source review. No existing file was changed; this report is the only artifact added. It does not claim to fix anything — every item is a *proposed* fix only.

## Severity scale (2026-11-15 yardstick)

- **High** — an unauthenticated or remote attacker gets code execution, credentials, or an auth bypass.
- **Medium** — the attacker needs some access or a user action, or the impact is limited.
- **Low** — hardening, or the attacker needs local or admin access.

## Summary of findings

| Severity | Count |
|----------|-------|
| High     | 0     |
| Medium   | 3     |
| Low      | 4     |

| ID | Severity | Title | Location |
|----|----------|-------|----------|
| M1 | Medium | Plugins are executed with no signature/integrity check on drop-in zips or a runtime-chosen entry path | `README.md:213-221`, `README.md:230-238`, `plugins/*/package.json:20`, `packages/protocol/src/index.ts:320` |
| M2 | Medium | Path traversal in the pack script output path and zip entry names (unvalidated `payloadName`) | `scripts/pack.mjs:14,119-120` (also `29-30`) |
| M3 | Medium | No size/shape limits on RPC input; arbitrary handler params accepted | `packages/sdk/src/PayloadPlugin.ts:46-55,74,85,127` |
| L1 | Low    | Handler dispatch has no allowlist — inherited `Object.prototype` members are reachable | `packages/sdk/src/PayloadPlugin.ts:120-128` |
| L2 | Low    | Error serialization can leak internals/config to stdout and stderr logs | `packages/sdk/src/PayloadPlugin.ts:53,100` |
| L3 | Low    | Every non-`fieldsToSend` config key (incl. `__proto__` footgun) is copied into the emitted payload | `plugins/junctionrelay.jr-protocol/src/index.ts:12-21,226` |
| L4 | Low    | Dev dependency `esbuild@0.27.3` in an advisory range (GHSA-g7r4-m6w7-qqqr) | `package.json:devDependencies`, `package-lock.json` (`node_modules/esbuild`) |

## Scope and method

Read-only review of every tracked file. The repo is a small npm workspaces monorepo:

- `packages/protocol` — `@junctionrelay/payload-protocol`: types, constants, JSON-RPC shapes.
- `packages/sdk` — `@junctionrelay/payload-sdk`: the `PayloadPlugin` stdin/stdout JSON-RPC loop and helpers.
- `plugins/*` — three payload plugins (jr-protocol, raw-json, xsd-protocol): pure data transforms.
- `scripts/pack.mjs` — builds a plugin `.zip` from `package.json` + `dist/index.js`.

Manual reading of all source, plus targeted searches for: `require(` / dynamic `import()` / `eval` / `new Function`, `child_process`/`spawn`/`exec`, `fs` writes and path joins, `http`/`https`/`net`/`tls`/`fetch`/sockets, `rejectUnauthorized`/`NODE_TLS`, and secret material. `gitleaks` (v8.24.0) run over git history and over the working tree. `npm ci` + `npm run build` + `npm test` run on `main` and on the audit branch.

**Important architectural boundary.** This repo is the *plugin* side and the SDK library only. The process that actually **loads** a plugin — the `rpc-host.mjs` that does `node rpc-host.mjs dist/index.js` and performs the dynamic `import()` of the manifest `entry` — is a host asset and is **not in this repo** (it was removed in the audited commit `e455db8`; the loader is referenced at `README.md:234`, `README.md:263`, `packages/sdk/src/index.ts:1` and `packages/sdk/README.md:60`, but the file is absent). Likewise the transport, the JR Prefix binary framing, the URL/MQTT connections, and the code that reads a server-side config and feeds sensor dictionaries are all in the external **Server / XSD host**, not here. Findings that depend on that host code are marked *unconfirmed* and the out-of-repo file is named.

## Trust model

A payload plugin is a child process. The host spawns it and talks JSON-RPC 2.0 over its **stdin/stdout** (`PayloadPlugin.startRpc`, `packages/sdk/src/PayloadPlugin.ts:45-68`). There is **no authentication, MAC, or replay protection on this channel**: whatever is written to the plugin's stdin is executed as an RPC call, and stdout is trusted as the result. `sensors`, `config`, `profile`, and `context` all arrive from the host inside RPC `params` (`packages/sdk/src/PayloadPlugin.ts:127` casts `params` straight to `HandlerParams` with no validation). Anything that can write to that pipe — the host itself, or a malicious host / transport feeding the plugin — is therefore fully trusted by the plugin. Real-world exposure to a *remote* attacker runs through the external host, which is out of scope for this repo.

---

## Findings

### M1 — Plugins executed with no signature/integrity check (Medium, confirmed in design; loader out of scope)

- **Where:** `README.md:213-221` (drop a `.zip` into the protocols directory; "the app automatically extracts the zip on next startup and deletes the zip file"), `README.md:230-238` (`Host spawns: node rpc-host.mjs dist/index.js`), manifest entry field `plugins/junctionrelay.raw-json/package.json:20` (`"entry": "dist/index.js"`), and its schema `packages/protocol/src/index.ts:320` (`entry: string`).
- **What goes wrong:** the payload plugin model is "drop code in a folder and it runs." The `junctionrelay.entry` string is a runtime-chosen module path that the host imports; nothing in this repo validates it against an allowlist, checks a publisher, verifies a signature/hash, or rejects `../`. Dropping a plugin — or editing one on disk — yields arbitrary code execution inside the host's process (the plugin bundle is fully inlined JS the host `import()`s and whose `startRpc()` the host calls).
- **What an attacker needs:** write access to the protocols directory (`%APPDATA%\JunctionRelay\protocols\`, `/app/data/protocols/`) or the ability to get a user to install a plugin `.zip`. This is local / user-action, which is why it is Medium rather than High.
- **Confirmed / unconfirmed:** the execution model is **confirmed** from the README and manifest schema; the concrete `import()` and extraction code is in the external host (`rpc-host.mjs`) and is **unconfirmed** here.
- **Proposed fix:** sign plugin bundles and have the host verify a trusted publisher + recorded hash, and restrict `entry` to a canonical relative path inside the plugin directory, before any code is executed.

### M2 — Path traversal in pack script (Medium, confirmed)

- **Where:** `scripts/pack.mjs:14` (`const pluginName = pkg.junctionrelay?.payloadName;`), used unchecked in the write path `scripts/pack.mjs:119-120` (`const zipFile = join(pluginDir, `${pluginName}.zip`); writeFileSync(zipFile, zipData);`) and in zip entry names `scripts/pack.mjs:29-30` (`` `${pluginName}/package.json` ``).
- **What goes wrong:** `payloadName` is taken verbatim from a plugin's `package.json` and used to build a filesystem path with no validation. Unlike `PayloadPlugin` (`packages/sdk/src/PayloadPlugin.ts:31`) and the protocol (`PLUGIN_ID_PATTERN`, `packages/protocol/src/index.ts:15`), `pack.mjs` never applies `PLUGIN_ID_PATTERN`. A `payloadName` such as `../../../../tmp/x` makes `join(pluginDir, ...)` escape `pluginDir` and `writeFileSync` write the zip outside it; the same value names the zip entries, so the produced archive contains traversal paths that a naive extractor would follow (zip-slip on the host side).
- **What an attacker needs:** get a maintainer/user to run `npm run pack` on an attacker-supplied plugin folder (the script trusts `package.json`), i.e. attacker-supplied content + a build action by the victim.
- **Confirmed / unconfirmed:** the write-path traversal in `pack.mjs` is **confirmed**. The extraction-side impact depends on the host's unzip code, which is out of scope (**unconfirmed**).
- **Proposed fix:** validate `pluginName` against the already-exported `PLUGIN_ID_PATTERN` and reject any value containing a path separator or `..` before it is used in `join()` or as a zip entry name.

### M3 — No size/shape limits on RPC input (Medium, confirmed)

- **Where:** `packages/sdk/src/PayloadPlugin.ts:46-55` (`readline` over stdin, one line per message, no max length), `:74` (`JSON.parse(line)` over the whole line), `:85`/`:127` (`params ?? {}` then cast straight to `HandlerParams` and passed to the handler).
- **What goes wrong:** each request is an unbounded single line with no cap and no schema check. A peer that can write to the plugin's stdin can send a very large or deeply nested JSON value to exhaust memory (DoS), and can invoke any handler with an arbitrarily shaped `sensors`/`config` object (e.g. huge sensor dictionaries). `config`/`sensors` are attacker-influenced for any plugin that trusts their structure.
- **What an attacker needs:** access to the stdin pipe, i.e. control of the host or a malicious host/transport that feeds the plugin — some access, so Medium.
- **Confirmed / unconfirmed:** **confirmed** in the SDK; the actual data reaching stdin is produced by the out-of-scope host.
- **Proposed fix:** cap the per-message byte size, and validate `params` against the `HandlerParams` shape (bounded key/entry counts) before dispatching.

### L1 — Handler dispatch has no allowlist; inherited members reachable (Low, confirmed)

- **Where:** `packages/sdk/src/PayloadPlugin.ts:120-128` (`const handler = this.config.handlers[method]; if (!handler) { throw METHOD_NOT_FOUND } ... return handler(handlerParams)`).
- **What goes wrong:** the "does this method exist" test is plain truthiness on `this.config.handlers[method]`. Because plugin `handlers` maps are ordinary object literals, lookups for names inherited from `Object.prototype` (`constructor`, `toString`, `valueOf`, …) are truthy, so `dispatch` calls them with attacker-supplied `params` instead of returning *Method not found*. This is not code execution (the resolved values are `Object`/`Object.prototype` builtins) and the return values are inert, so impact is limited — but the guard is not the intended allowlist and lets a peer poke at unexpected callables.
- **What an attacker needs:** stdin access (as in M3).
- **Confirmed / unconfirmed:** **confirmed**.
- **Proposed fix:** restrict dispatch to the plugin's declared `messageTypes` keys plus a fixed utility allowlist (`getOutputSchema`, `validate`), or use a `Object.create(null)`-backed map and a `Map.has()` membership test.

### L2 — Error serialization can leak internals/config (Low, unconfirmed)

- **Where:** `packages/sdk/src/PayloadPlugin.ts:100` (RPC error `message: err instanceof Error ? err.message : String(err)` is returned to the host on stdout) and `:53` (`process.stderr.write(\`[plugin] Unhandled error: ${err}\n\`)`, which `README.md:243` says the host captures as plugin logs).
- **What goes wrong:** a thrown error's message is echoed back to the host and written to logs. If a plugin handler throws with a message that embeds part of `config` — which for other integrations can carry tokens/credentials — that value is surfaced in the RPC response and the log stream. No token is logged by this repo's own code, so this is a hardening item about the generic path.
- **What an attacker needs:** ability to read the RPC responses or the captured plugin logs.
- **Confirmed / unconfirmed:** **unconfirmed** — depends on how a (third-party) plugin throws; the SDK's own handlers do not.
- **Proposed fix:** return generic error messages on the RPC channel and only serialize the full error to stderr behind an explicit debug flag.

### L3 — Full config echoed into emitted payload (Low, confirmed)

- **Where:** `plugins/junctionrelay.jr-protocol/src/index.ts:12-21` (`buildSettings`) and its use at `:226`. It copies **every** config key except `fieldsToSend` (`HOST_KEYS`, `:4-6`) into the outgoing `settings` object (`:15` `if (HOST_KEYS.has(key)) continue;` … `:18` `settings[key] = value;`).
- **What goes wrong:** whatever the host places in the payload instance config is transmitted verbatim to the device / every consumer of the payload stream, so a secret stored in config (e.g. an MQTT password) is disclosed to whoever receives the payload. As a secondary footgun, `settings[key] = value` with a key literally named `__proto__` reassigns the `settings` object's prototype rather than adding a field (harmless for `JSON.stringify` output but surprising).
- **What an attacker needs:** access to the emitted payload stream (eavesdrop on the transport to the device, or a downstream consumer).
- **Confirmed / unconfirmed:** **confirmed** in the code.
- **Proposed fix:** emit an explicit allowlist of per-profile settings keys (from `profileConfigs`) instead of copying all of `config`, and skip `__proto__`/non-own keys.

### L4 — `esbuild` dev dependency in an advisory range (Low, confirmed)

- **Where:** root `package.json` `devDependencies.esbuild` (`^0.27.3`) and `package-lock.json` (`node_modules/esbuild` → `0.27.3`).
- **What goes wrong:** `npm audit` reports one advisory — **GHSA-g7r4-m6w7-qqqr**, "esbuild allows arbitrary file read when running the development server on Windows", affecting `esbuild 0.27.3 - 0.28.0`. It is a **devDependency**; the repo's build uses `esbuild ... --bundle` (see each plugin `package.json` `build` script), not the `serve` dev server that the advisory concerns, and the issue is Windows-specific — so exposure here is limited.
- **What an attacker needs:** the vulnerable dev server would have to be run (which this repo never does).
- **Confirmed / unconfirmed:** **confirmed** via `npm audit` from the committed lockfile.
- **Proposed fix:** bump `esbuild` to `>=0.28.2` in the root devDependency and refresh the lockfile (note: `npm audit fix --force` flags this as a breaking major change, so review before applying).

---

## Areas checked with no finding

- **Dynamic `require`/`import`, `eval`, `new Function` in first-party code:** none in `packages/**/src`, `plugins/**/src`, or `scripts/pack.mjs`. The only `require(` in the tree is the static `node -e "require('fs')"` inside each plugin's `clean` npm script. The only *dynamic* import (the plugin `entry` path) lives in the out-of-scope host — see M1.
- **Outbound connections to caller-chosen hosts/URLs (SSRF):** no `http`/`https`/`net`/`dgram`/`tls`/`fetch`/`axios`/`WebSocket` usage anywhere in first-party code; the only URLs are the `repository.url` git links in `package.json`. Plugins return JSON only; they never dial a URL. MQTT topic/service fields in `SENSOR_FIELDS` are inert data here — the connection is made by the host, not this repo.
- **TLS / certificate checks disabled:** no TLS code in the repo, so no `rejectUnauthorized:false` or `NODE_TLS_REJECT_UNAUTHORIZED` to flag.
- **Buffer lengths / binary frame parsing (JR Prefix):** the 8-byte `[payload_length:4][message_type:2][routing:2]` header is described in `packages/sdk/README.md:272-289` but is applied and parsed by the **host**, not here; plugin code only emits/reads JSON. No length-parsing code exists in this repo to overflow. (Flagged for the host audit: a 4-byte `payload_length` should be bounds-checked against the real buffer.)
- **Process spawn / file writes (besides M2):** the SDK/plugins never spawn a process or touch `fs`. The only `fs` writer is `scripts/pack.mjs` (M2). The plugin `clean` scripts (`fs.rmSync('dist', …)`) operate on a fixed relative path.
- **Tokens/keys written to logs / secrets committed:** `gitleaks` v8.24.0 over full git history reported **no leaks**, and a `--no-git` scan of the working tree (excluding `node_modules`, `dist`, lockfile) reported **no leaks**. A manual keyword sweep (`api[_-]?key`, `secret`, `password`, `token`, `private key`, `bearer`, `ghp_`, `github_pat_`, `AKIA`, `xox*`, `sk-`) across all tracked non-lockfile files found nothing. `.env`/key files are not present and `dist/` + `node_modules/` are gitignored. See L2 for the one *indirect* (config→error→log) path, which is unconfirmed.

## Dependencies

- **Lockfile:** present — `package-lock.json` at the repo root (lockfileVersion 3). All external packages resolve to `https://registry.npmjs.org` (the only non-registry `resolved` entries are the five local workspaces `packages/*` and `plugins/*`). No git/tarball/http tarballs.
- **`npm audit` (runs from the lockfile):** 1 total advisory — **1 low** (`esbuild`, GHSA-g7r4-m6w7-qqqr; see L4), 0 moderate / high / critical. Command: `npm audit` → exits non-zero (advisory present); the report above is verbatim from it.
- **Install scripts in `package.json` files:** none. No root, `packages/*`, or `plugins/*` manifest defines `preinstall`/`postinstall`/`install`. The only lifecycle-ish scripts are `build`, `clean`, and `pack` (developer-invoked, reviewed above).
- **Install scripts in the lockfile:** exactly two packages carry `hasInstallScript: true` — `esbuild` (`0.27.3`) and `fsevents` (`2.3.3`, optional/macOS). Both are the expected native platform-bootstrap postinstalls of well-known packages; neither is a first-party workspace. Note that `npm ci` runs these scripts; consider `npm ci --ignore-scripts` for the plugin build if the esbuild/fsevents install steps are not needed (esbuild uses its install script to fetch the platform binary, so this must be verified before adopting).

## Secrets

No committed secrets were found. `gitleaks` (history + working tree) reported no leaks and the manual keyword sweep across tracked files was clean. There are no `.env`, private-key, or credential files in the tree, and no hardcoded token/API key in any source, config, or README. Accordingly there is no file/line/kind to report. (The only credential-adjacent risk is behavioral — config values reaching error logs, L2 — not a stored secret.)

## Test status

Test command: `npm ci && npm run build && npm test`.

- **On the audit branch (this report's PR branch): PASS.** `npm ci` succeeds; `npm run build` succeeds (tsc builds `protocol` then `sdk`; esbuild bundles all three plugins); `npm test` exits 0.
- **On `main` (`e455db8`): PASS.** Same command, same result.

The repository defines **no automated tests**: `npm test` runs `npm test --workspaces --if-present` (root `package.json`), and no workspace declares a `test` script, so **zero tests run and exit code 0 — that is this repo's expected pass**. There is therefore nothing to weaken or skip; the meaningful check is that the build compiles cleanly, which it does on both `main` and the branch.

---

*Read-only audit. No existing file was modified; only this report was added. Nothing here claims a fix has been applied — each "Proposed fix" is a recommendation for the maintainers.*
