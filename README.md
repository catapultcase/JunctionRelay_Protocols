# JunctionRelay Protocols

Plugin-based payload protocol system for JunctionRelay. Each protocol plugin transforms sensor data into a specific output format. Plugins communicate with the host (Server or XSD) over JSON-RPC 2.0 via stdin/stdout.

Plugins are discovered automatically — no host code changes required. Place a built plugin folder in the protocols directory, restart the app, and it appears in the UI.

## Repository Structure

```
packages/
  protocol/   @junctionrelay/payload-protocol — types, interfaces, constants
  sdk/        @junctionrelay/payload-sdk — PayloadPlugin class + helpers
plugins/
  junctionrelay.jr-protocol/    Protocol — JR sensor + config payload format
  junctionrelay.xsd-protocol/   Protocol — XSD dictionarySensors format
  junctionrelay.raw-json/       Data — pass-through flat sensor dictionary
```

## Prerequisites

- **Node.js 18+** — required for building and packing plugins
- All commands work on Windows, macOS, and Linux — no WSL or Git Bash needed on Windows

## Creating a Plugin

### 1. Copy the reference plugin

Copy `plugins/junctionrelay.raw-json/` to a new folder. This can be anywhere on your filesystem — plugins do NOT need to live inside this monorepo.

**macOS / Linux:**
```bash
cp -r plugins/junctionrelay.raw-json /path/to/my-plugin
cd /path/to/my-plugin
```

**Windows (PowerShell):**
```powershell
Copy-Item -Recurse plugins\junctionrelay.raw-json C:\path\to\my-plugin
cd C:\path\to\my-plugin
```

### 2. Edit `package.json`

Update the `junctionrelay` manifest — this is how the host app discovers your plugin:

```json
{
  "name": "@yourname/plugin-my-format",
  "version": "1.0.0",
  "description": "My custom payload format",
  "type": "module",
  "main": "dist/index.js",
  "junctionrelay": {
    "type": "payload",
    "payloadName": "yourname.my-format",
    "entry": "dist/index.js",
    "displayName": "My Format",
    "description": "What this payload format does",
    "category": "Custom",
    "emoji": "📦",
    "outputContentType": "application/json",
    "outputDescription": "Description of the output format",
    "authorName": "Your Name"
  },
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js"
  },
  "dependencies": {
    "@junctionrelay/payload-sdk": "1.0.0"
  }
}
```

**Required manifest fields:**
- `junctionrelay.type` must be `"payload"`
- `junctionrelay.payloadName` — namespaced identifier (e.g. `"yourname.my-format"`)
- `junctionrelay.entry` points to the built JavaScript bundle
- `junctionrelay.displayName` — human-readable name shown in the UI
- `junctionrelay.description` — short description
- `junctionrelay.category` — UI grouping (e.g. `"Protocol"`, `"Data"`, `"Monitoring"`, `"IoT"`, `"Custom"`)
- `junctionrelay.emoji` — icon shown next to the plugin name
- `junctionrelay.outputContentType` — MIME type of the output
- `junctionrelay.outputDescription` — human-readable format description

**Optional fields:**
- `junctionrelay.fields.configurable` — config keys the user can set
- `junctionrelay.defaults` — default values for configurable fields
- `junctionrelay.profiles` — named profiles this protocol supports (e.g. `['lvgl-grid', 'matrix']`)
- `junctionrelay.jrPrefix` — whether JR Prefix binary framing is enabled for new payloads (default: `true`)
- `junctionrelay.setupInstructions` — steps shown to the user during setup
- `junctionrelay.authorName` — display name shown in the management tab

### 3. Write your plugin

A plugin exports a default config object with metadata and handler functions:

```typescript
import type { PayloadPluginConfig, TransformParams } from '@junctionrelay/payload-sdk';

export default {
  metadata: {
    payloadName: 'yourname.my-format',
    displayName: 'My Format',
    description: 'What this payload format does',
    category: 'Custom',
    emoji: '📦',
    outputContentType: 'application/json',
    outputDescription: 'Description of the output',
    authorName: 'Your Name',
  },

  async transform({ sensors, config, context }: TransformParams) {
    const result: Record<string, unknown> = {};
    for (const [tag, sensor] of Object.entries(sensors)) {
      result[tag] = sensor.value;
    }
    return { payload: result, contentType: 'application/json' };
  },
} satisfies PayloadPluginConfig;
```

**Key points:**
- Plugins are **stateless** — every `transform()` call receives all needed context (sensors, config, profile, context).
- The `PayloadPluginConfig` type is the full interface. Use `satisfies` for type checking without wrapping in a class.
- `transform()` is the only required handler. All others are optional.
- No `configure()` or session management — payloads are simpler than collectors.

### Fields To Send

Most protocol plugins should let users choose which sensor fields appear in the output. The SDK exports `SENSOR_FIELDS` — the canonical list of all fields available on a `SensorEntry` (value, unit, displayValue, pollerSource, rawLabel, category, sensorType, componentName) — with labels, descriptions, and defaults.

To support this:
1. Add a `fieldsToSend` `checkboxGroup` field to your profile's field groups in `package.json` (default: `["value", "unit"]`)
2. Exclude `fieldsToSend` from your payload output (it's a host/UI concern)
3. Read `config.fieldsToSend` in your sensor handler and filter each `SensorEntry` to only the selected fields

See the [SDK README](packages/sdk/README.md#fields-to-send-sensor-field-filtering) for the full pattern with code examples.

### Handler methods

| Method | Signature | Called When |
|--------|-----------|------------|
| `transform` | `(params: TransformParams) => Promise<TransformResult>` | Host needs to transform sensor data into the output format |
| `transformConfig` | `(params: TransformParams & { layoutConfig? }) => Promise<TransformResult>` | Host needs to transform config/layout data |
| `getOutputSchema` | `(profile?: string) => Promise<OutputSchema>` | Host requests the output format description |
| `validate` | `(config: Record<string, unknown>) => Promise<ValidationResult>` | Host validates user-provided config |

### 4. Build

**Inside the monorepo** — run from the repo root so protocol and SDK are built first:

```bash
npm install
npm run build
```

To build a single plugin after the initial build:

```bash
npm run build -w plugins/junctionrelay.my-plugin
```

**Outside the monorepo** — run from your plugin directory:

```bash
npm install
npm run build
```

Both produce `dist/index.js` — a single ESM bundle with all npm dependencies inlined.

### 5. Pack and Deploy

Build and pack in one step:

```bash
npm run build && npm run pack
```

This produces `<name>.zip` containing `<name>/package.json` and `<name>/dist/index.js`.

Drop the `.zip` file into the protocols directory:

| App | Path |
|-----|------|
| **Server (Windows)** | `%APPDATA%\JunctionRelay\protocols\` |
| **Server (Docker)** | `/app/data/protocols/` |
| **XSD (Windows)** | `%APPDATA%\JunctionRelay_XSD\protocols\` |

The app automatically extracts the zip on next startup and deletes the zip file.

## How It Works

**Discovery** (startup — no code execution):
```
Host reads package.json → extracts metadata from "junctionrelay" section → registers type
```

**Runtime** (when a junction needs a payload transform):
```
Host (Server or XSD)                Plugin (subprocess)
  │                                     │
  ├── Spawns: node rpc-host.mjs dist/index.js
  │                                     ├── Prints "[plugin] ready" to stderr
  ├── stdin: transform ────────────────►│
  │◄──────────────── stdout: {payload} ─┤
  │        ... (repeats per send) ...   │
```

- **Metadata comes from `package.json`** — no process spawning needed at discovery time
- Communication is **JSON-RPC 2.0** over stdin/stdout (one JSON object per line)
- Plugins log to **stderr** (the host captures these as plugin logs)
- The SDK handles all JSON-RPC parsing, dispatching, and error handling
- Payload plugins are **stateless** — no session management, no `configure()` step

### JR Prefix

The host can optionally prepend an 8-byte binary framing header (`[payload_length:4][message_type:2][routing:2]`, little-endian) to each payload. This is configurable per payload via the "Include JR Prefix" toggle and is used for transports without built-in framing (raw serial, raw TCP). Plugins don't need to handle this — the host applies it transparently.

Plugins declare the default via `"jrPrefix": true` or `"jrPrefix": false` in their `package.json` manifest. If omitted, defaults to enabled. The user can override per-payload in the UI.

See the [SDK README](packages/sdk/README.md) for header format details.

## Quick Start (Testing)

```bash
# Install dependencies and build all plugins
npm install
npm run build

# Test a plugin manually via JSON-RPC
echo '{"jsonrpc":"2.0","method":"getMetadata","params":{},"id":1}' | node packages/sdk/bin/rpc-host.mjs plugins/junctionrelay.raw-json/dist/index.js
```

## License

MIT
