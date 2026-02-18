# @junctionrelay/payload-sdk

SDK for building JunctionRelay payload plugins. Handles all JSON-RPC communication — you just write the handler logic.

## Install

```bash
npm install @junctionrelay/payload-sdk
```

## Usage

```typescript
import type { PayloadPluginConfig, HandlerParams } from '@junctionrelay/payload-sdk';

export default {
  metadata: {
    payloadName: 'yourname.my-format',
    displayName: 'My Format',
    description: 'What this format does',
    category: 'Custom',
    emoji: '📦',
    messageTypes: {
      readings: { trigger: 'periodic', description: 'Flat sensor dictionary' },
    },
    outputContentType: 'application/json',
    outputDescription: 'Description of the output',
    authorName: 'Your Name',
  },

  handlers: {
    readings: async ({ sensors, context }: HandlerParams) => {
      const result: Record<string, unknown> = { timestamp: context.timestamp };
      for (const [tag, sensor] of Object.entries(sensors)) {
        result[tag] = sensor.value;
      }
      return { payload: result, contentType: 'application/json' };
    },

    getOutputSchema: async () => ({
      description: 'Flat JSON object with sensor tags as keys and raw values',
      example: { timestamp: 1771257808745, cpu_usage_total: 45.2, gpu_temp: 72 },
    }),
  },
} satisfies PayloadPluginConfig;
```

## What the SDK Handles

- stdin/stdout JSON-RPC 2.0 framing
- Method routing (`getMetadata`, `healthCheck`, and all plugin-defined handlers)
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
import type { HandlerParams, TransformResult, PayloadMetadata } from '@junctionrelay/payload-sdk';
```

## Fields To Send (Sensor Field Filtering)

Most protocol plugins let users choose which sensor fields appear in the output. The SDK provides the `SENSOR_FIELDS` constant — the canonical list of every field available on a `SensorEntry` — so plugins can define the UI and apply filtering consistently.

### Available sensor fields

The full field list mirrors the Server's `Model_Sensor` — every field that the host's `BuildSensorData` can serialize. Grouped by category:

**Core** (default: value + unit on)

| Field | Default | Description |
|-------|---------|-------------|
| `value` | on | The sensor reading (numeric formatted to `decimalPlaces`, or string) |
| `unit` | on | Unit of measurement (°C, %, MB, etc.) |
| `decimalPlaces` | off | Number of decimal places for numeric formatting |
| `displayValue` | off | Pre-formatted value for direct display |

**Identity & Metadata**

| Field | Description |
|-------|-------------|
| `id` | Database primary key |
| `originalId` | Reference to original sensor before cloning |
| `name` | Sensor display name |
| `externalId` | Identifier from the external data source |
| `sensorType` | Type classification (temperature, utilization, clock, etc.) |
| `category` | Sensor category (cpu, memory, gpu, disk, etc.) |
| `componentName` | Hardware component name (CPU Package, GPU Core, etc.) |
| `deviceName` | Name of the device that owns this sensor |
| `formula` | Optional calculation formula applied to the raw value |
| `lastUpdated` | UTC timestamp of the most recent value update |

**Relationships**

| Field | Description |
|-------|-------------|
| `junctionId` | Foreign key to the parent junction |
| `junctionDeviceLinkId` | Link to junction–device association |
| `junctionCollectorLinkId` | Link to junction–collector association |
| `deviceId` | Foreign key to the source device |
| `serviceId` | Foreign key to the source service |
| `collectorId` | Foreign key to the source collector |
| `sensorOrder` | Display/processing sort order |

**MQTT**

| Field | Description |
|-------|-------------|
| `mqttServiceId` | MQTT service this sensor publishes to |
| `mqttTopic` | MQTT topic path for this sensor |
| `mqttQoS` | MQTT Quality of Service level (0, 1, or 2) |

**Status Flags**

| Field | Description |
|-------|-------------|
| `isMissing` | Whether sensor data is currently unavailable |
| `isStale` | Whether the reading is older than the staleness threshold |
| `isSelected` | Whether the sensor is selected in the UI |
| `isVisible` | Whether the sensor is visible in layouts |

**Custom Attributes**

| Field | Description |
|-------|-------------|
| `customAttribute1`–`customAttribute10` | 10 user-defined custom attribute slots |

**Source Tracing**

| Field | Description |
|-------|-------------|
| `pollerSource` | Which collector produced this reading (psutil, hwinfo, etc.) |
| `rawLabel` | Original sensor label before tag normalization |

### 1. Declare the UI in `package.json`

Add a `fieldsToSend` field to every profile's field groups. Use the `SENSOR_FIELDS` constant as the source of truth for the options and defaults:

```json
{
  "name": "Fields To Send",
  "fields": [
    {
      "key": "fieldsToSend",
      "type": "checkboxGroup",
      "label": "Sensor Fields to Send",
      "default": ["value", "unit"],
      "options": [
        { "value": "value", "label": "Value" },
        { "value": "unit", "label": "Unit" },
        { "value": "decimalPlaces", "label": "Decimal Places" },
        { "value": "displayValue", "label": "Display Value" },
        { "value": "id", "label": "ID" },
        { "value": "originalId", "label": "Original ID" },
        { "value": "name", "label": "Name" },
        { "value": "externalId", "label": "External ID" },
        { "value": "sensorType", "label": "Sensor Type" },
        { "value": "category", "label": "Category" },
        { "value": "componentName", "label": "Component Name" },
        { "value": "deviceName", "label": "Device Name" },
        { "value": "formula", "label": "Formula" },
        { "value": "lastUpdated", "label": "Last Updated" },
        { "value": "junctionId", "label": "Junction ID" },
        { "value": "junctionDeviceLinkId", "label": "Junction Device Link ID" },
        { "value": "junctionCollectorLinkId", "label": "Junction Collector Link ID" },
        { "value": "deviceId", "label": "Device ID" },
        { "value": "serviceId", "label": "Service ID" },
        { "value": "collectorId", "label": "Collector ID" },
        { "value": "sensorOrder", "label": "Sensor Order" },
        { "value": "mqttServiceId", "label": "MQTT Service ID" },
        { "value": "mqttTopic", "label": "MQTT Topic" },
        { "value": "mqttQoS", "label": "MQTT QoS" },
        { "value": "isMissing", "label": "Is Missing" },
        { "value": "isStale", "label": "Is Stale" },
        { "value": "isSelected", "label": "Is Selected" },
        { "value": "isVisible", "label": "Is Visible" },
        { "value": "customAttribute1", "label": "Custom Attribute 1" },
        { "value": "customAttribute2", "label": "Custom Attribute 2" },
        { "value": "customAttribute3", "label": "Custom Attribute 3" },
        { "value": "customAttribute4", "label": "Custom Attribute 4" },
        { "value": "customAttribute5", "label": "Custom Attribute 5" },
        { "value": "customAttribute6", "label": "Custom Attribute 6" },
        { "value": "customAttribute7", "label": "Custom Attribute 7" },
        { "value": "customAttribute8", "label": "Custom Attribute 8" },
        { "value": "customAttribute9", "label": "Custom Attribute 9" },
        { "value": "customAttribute10", "label": "Custom Attribute 10" },
        { "value": "pollerSource", "label": "Poller Source" },
        { "value": "rawLabel", "label": "Raw Label" }
      ]
    }
  ]
}
```

The host renders this as a checkbox group in the profile settings UI. The user's selections are stored in `config.fieldsToSend` as a string array (e.g. `["value", "unit", "category"]`).

### 2. Exclude `fieldsToSend` from payload output

`fieldsToSend` is a host/UI concern — it controls how sensor data is shaped, but should not appear in the serialized output. Add it to a `HOST_KEYS` set and filter it out of your settings object:

```typescript
const HOST_KEYS = new Set(['fieldsToSend']);

function buildSettings(config: Record<string, unknown>): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (HOST_KEYS.has(key)) continue;
    if (value === false || value === 0 || value === '' || value == null) continue;
    settings[key] = value;
  }
  return settings;
}
```

### 3. Parse and apply in your handler

Read `config.fieldsToSend`, fall back to `['value', 'unit']` if unset, and filter each sensor entry to only include the selected fields:

```typescript
import { SENSOR_FIELDS } from '@junctionrelay/payload-sdk';

function parseFieldsToSend(config: Record<string, unknown>): string[] {
  const raw = config.fieldsToSend;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(f => String(f).toLowerCase());
  }
  // Fallback: fields marked as default in SENSOR_FIELDS
  return SENSOR_FIELDS.filter(f => f.default).map(f => f.key);
}

function buildSensorData(
  sensor: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const field of fields) {
    // Special case: format numeric values using decimalPlaces
    if (field === 'value') {
      const val = sensor.value;
      const dp = typeof sensor.decimalPlaces === 'number' ? sensor.decimalPlaces : 2;
      entry.value = typeof val === 'number' ? val.toFixed(dp) : String(val);
      continue;
    }
    // All other fields: include if present on the sensor (null-check only)
    const camelKey = SENSOR_FIELDS.find(f => f.key.toLowerCase() === field)?.key ?? field;
    if (sensor[camelKey] != null) {
      entry[camelKey] = sensor[camelKey];
    }
  }
  return entry;
}

// In your sensor handler:
const fields = parseFieldsToSend(config);
const sensorDict: Record<string, unknown[]> = {};
for (const [tag, sensor] of Object.entries(sensors)) {
  sensorDict[tag] = [buildSensorData(sensor as Record<string, unknown>, fields)];
}
```

The default (`["value", "unit"]`) matches `SENSOR_FIELDS` entries where `default: true`. This ensures new payloads produce sensible output before the user customizes anything. The full `SENSOR_FIELDS` constant (41 fields) is the canonical reference — import it to generate `package.json` options or to validate user selections at runtime.

## JR Prefix (Transport Framing)

The JR Prefix is an optional 8-byte binary header prepended to payloads for transports that don't provide built-in framing (raw serial, raw TCP). It allows receivers to determine payload boundaries, message types, and routing without parsing the JSON body.

**Header format** (little-endian, 8 bytes total):

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 4 bytes | `payload_length` | Byte length of the JSON payload that follows |
| 4 | 2 bytes | `message_type` | DATA (0x0001) for config/sensor, COMMAND (0x0002) for stop/control |
| 6 | 2 bytes | `routing` | LOCAL (0x0000), GATEWAY (0x0001), or SCREEN (0x0100 + screen_id) |

**How it works:**

- The **host** applies the prefix, not the plugin. Plugins output clean JSON; the host wraps it based on the user's per-payload "Include JR Prefix" toggle.
- When enabled, **all** message types (config, sensor, stop) get the prefix.
- Plugins don't need to do anything special to support JR Prefix — it's transparent.

**Manifest default:**

Plugins declare whether JR Prefix is enabled or disabled for new payloads via `jrPrefix` in `package.json`:

```json
{
  "junctionrelay": {
    "type": "payload",
    "payloadName": "yourname.my-format",
    "jrPrefix": true,
    ...
  }
}
```

- `"jrPrefix": true` — new payloads created with this protocol have JR Prefix **enabled** (default if omitted)
- `"jrPrefix": false` — new payloads created with this protocol have JR Prefix **disabled**

The user can always override this per-payload via the JR Prefix toggle in the Configure Payload UI.

## Key Difference from Collectors

Payload plugins are **stateless** — every handler call receives all needed context. There is no `configure()` step, no session management, and no persistent state. This makes the plugin protocol simpler than collectors.

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
