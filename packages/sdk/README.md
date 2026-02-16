# @junctionrelay/payload-sdk

SDK for building JunctionRelay payload plugins. Handles all JSON-RPC communication — you just write the transform logic.

## Install

```bash
npm install @junctionrelay/payload-sdk
```

## Usage

```typescript
import type { PayloadPluginConfig, TransformParams } from '@junctionrelay/payload-sdk';

export default {
  metadata: {
    payloadName: 'yourname.my-format',
    displayName: 'My Format',
    description: 'What this format does',
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

## What the SDK Handles

- stdin/stdout JSON-RPC 2.0 framing
- Method routing (`getMetadata`, `transform`, `transformConfig`, `getOutputSchema`, `validate`, `healthCheck`)
- Health check responses
- Error serialization
- Graceful shutdown on SIGTERM
- Logging via `process.stderr` (keeps stdout clean for protocol)

## Exports

```typescript
// Base class (used by rpc-host.mjs, not by plugin authors directly)
import { PayloadPlugin } from '@junctionrelay/payload-sdk';

// Helpers
import { buildSensorArray, formatValue, filterSensorsByTags } from '@junctionrelay/payload-sdk';

// Types (re-exported from @junctionrelay/payload-protocol)
import type { TransformParams, TransformResult, PayloadMetadata } from '@junctionrelay/payload-sdk';
```

## Key Difference from Collectors

Payload plugins are **stateless** — every `transform()` call receives all needed context. There is no `configure()` step, no session management, and no persistent state. This makes the plugin protocol simpler than collectors.

## Dependencies & Bundling

**Plugins must be self-contained.** Use esbuild to inline all npm packages into a single `dist/index.js`. No `node_modules` at runtime.

```
my-plugin/
├── package.json
├── dist/index.js          ← esbuild bundle (SDK + deps inlined)
```

Build command:

```bash
esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js
```

## License

MIT
