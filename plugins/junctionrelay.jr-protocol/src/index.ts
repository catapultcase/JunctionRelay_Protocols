import type { PayloadPluginConfig, HandlerParams } from '@junctionrelay/payload-sdk';

// Keys that are host/UI concerns — excluded from the config settings output
const HOST_KEYS = new Set([
  'includePrefixConfig',
  'includePrefixSensor',
  'fieldsToSend',
]);

/**
 * Filter config to only include output-relevant settings.
 * Mirrors Server's AddIfPresent logic: excludes falsy booleans, zero numbers, empty strings.
 */
function buildSettings(config: Record<string, unknown>): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (HOST_KEYS.has(key)) continue;
    // Skip falsy values (false, 0, '', null, undefined) — matches Server's AddIfPresent
    if (value === false || value === 0 || value === '' || value == null) continue;
    settings[key] = value;
  }
  return settings;
}

/**
 * Parse fieldsToSend config into a set of field names.
 * Accepts an array (from checkboxGroup) or a comma-separated string (legacy).
 * Default: ['value', 'unit'].
 */
function parseFieldsToSend(config: Record<string, unknown>): string[] {
  const raw = config.fieldsToSend;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(f => String(f).toLowerCase());
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map(f => f.trim().toLowerCase());
  }
  return ['value', 'unit'];
}

/**
 * Build sensor data entry filtered by fieldsToSend.
 * Field names use camelCase in output (matching codebase convention).
 */
function buildSensorData(
  sensor: { value: string | number | boolean; unit: string; displayValue: string; pollerSource: string; rawLabel: string; category?: string; sensorType?: string; componentName?: string },
  fields: string[],
): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field) {
      case 'value':
        // Format numeric values as strings for consistency
        entry.value = typeof sensor.value === 'number'
          ? sensor.value.toFixed(2)
          : String(sensor.value);
        break;
      case 'unit':
        entry.unit = sensor.unit || '';
        break;
      case 'displayvalue':
        entry.displayValue = sensor.displayValue ?? String(sensor.value);
        break;
      case 'category':
        if (sensor.category) entry.category = sensor.category;
        break;
      case 'sensortype':
        if (sensor.sensorType) entry.sensorType = sensor.sensorType;
        break;
      case 'componentname':
        if (sensor.componentName) entry.componentName = sensor.componentName;
        break;
      case 'pollersource':
        entry.pollerSource = sensor.pollerSource || '';
        break;
      case 'rawlabel':
        entry.rawLabel = sensor.rawLabel || '';
        break;
    }
  }
  return entry;
}

export default {
  metadata: {
    payloadName: 'junctionrelay.jr-protocol',
    displayName: 'JR Protocol',
    description: 'JunctionRelay Server protocol for device communication',
    category: 'Protocol',
    emoji: '🔌',
    profiles: ['lvgl-grid', 'lvgl-radio', 'lvgl-plotter', 'lvgl-astro', 'quad', 'matrix', 'neopixel', 'charlie', 'minimal'],
    messageTypes: {
      config: { trigger: 'connect', description: 'Device initialization payload' },
      sensor: { trigger: 'periodic', description: 'Real-time sensor values' },
      stop:   { trigger: 'disconnect', description: 'Stop signal to device' },
    },
    outputContentType: 'application/json',
    outputDescription: 'JR sensor/config payload for LVGL, matrix, and NeoPixel devices',
    authorName: 'JunctionRelay',
    // profileConfigs are defined in package.json and read at discovery time by the host.
    // They are not duplicated here — the host serves them via the /api/payloads/types endpoint.
  },

  handlers: {
    /**
     * Config handler — sent once when a stream/junction starts.
     *
     * Output structure:
     * {
     *   type: "config",
     *   screenId: "...",
     *   profile: "lvgl-grid",
     *   settings: { rows: 2, columns: 2, topMargin: 10, ... },
     *   layout: [{ id: "sensor_tag", label: "sensor_tag", unit: "%" }, ...]
     * }
     */
    config: async ({ sensors, config, profile, context }: HandlerParams) => {
      const activeProfile = profile ?? 'lvgl-grid';
      const settings = buildSettings(config);

      // Build layout array from assigned sensors
      const layout = Object.entries(sensors).map(([tag, s]) => ({
        id: tag,
        label: tag,
        unit: s.unit || '',
      }));

      return {
        payload: {
          type: 'config',
          screenId: context.screenId,
          profile: activeProfile,
          settings,
          layout,
        },
        contentType: 'application/json',
      };
    },

    /**
     * Sensor handler — sent every broadcast cycle with live sensor values.
     *
     * Output structure:
     * {
     *   type: "sensor",
     *   screenId: "...",
     *   sensors: {
     *     "cpu_temp": [{ value: "72.00", unit: "°C" }],
     *     "memory_used": [{ value: "16384.00", unit: "MB" }]
     *   }
     * }
     *
     * Each sensor value is wrapped in an array (matching Server convention).
     * Fields are filtered by the fieldsToSend config (default: "value,unit").
     */
    sensor: async ({ sensors, config, context }: HandlerParams) => {
      const fields = parseFieldsToSend(config);

      const sensorDict: Record<string, unknown[]> = {};
      for (const [tag, s] of Object.entries(sensors)) {
        sensorDict[tag] = [buildSensorData(s, fields)];
      }

      return {
        payload: {
          type: 'sensor',
          screenId: context.screenId,
          sensors: sensorDict,
        },
        contentType: 'application/json',
      };
    },

    stop: async ({ context }: HandlerParams) => ({
      payload: {
        type: 'stop',
        screenId: context.screenId,
        timestamp: context.timestamp,
      },
      contentType: 'application/json',
    }),

    getOutputSchema: async ({ profile }: HandlerParams) => ({
      description: `JR Protocol output for ${profile ?? 'lvgl-grid'} profile`,
      example: {
        config: {
          type: 'config',
          screenId: 'default',
          profile: profile ?? 'lvgl-grid',
          settings: { rows: 2, columns: 2, topMargin: 10, textColor: '#FFFF00' },
          layout: [
            { id: 'cpu_temp', label: 'cpu_temp', unit: '°C' },
            { id: 'memory_used', label: 'memory_used', unit: 'MB' },
          ],
        },
        sensor: {
          type: 'sensor',
          screenId: 'default',
          sensors: {
            cpu_temp: [{ value: '72.00', unit: '°C' }],
            memory_used: [{ value: '16384.00', unit: 'MB' }],
          },
        },
      },
    }),
  },
} satisfies PayloadPluginConfig;
