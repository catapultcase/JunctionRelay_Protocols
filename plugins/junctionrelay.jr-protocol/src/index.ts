import type { PayloadPluginConfig, HandlerParams } from '@junctionrelay/payload-sdk';

// Keys that are host/UI concerns — excluded from the config settings output
const HOST_KEYS = new Set([
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
  sensor: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field) {
      case 'value': {
        // Format numeric values as strings for consistency (matches Server's F{DecimalPlaces})
        const val = sensor.value;
        const dp = typeof sensor.decimalPlaces === 'number' ? sensor.decimalPlaces : 2;
        entry.value = typeof val === 'number' ? val.toFixed(dp) : String(val);
        break;
      }
      case 'unit':
        entry.unit = sensor.unit ?? '';
        break;
      case 'decimalplaces':
        if (sensor.decimalPlaces != null) entry.decimalPlaces = sensor.decimalPlaces;
        break;
      case 'displayvalue':
        if (sensor.displayValue != null) entry.displayValue = sensor.displayValue;
        break;

      // Identity & metadata
      case 'id':
        if (sensor.id != null) entry.id = sensor.id;
        break;
      case 'originalid':
        if (sensor.originalId != null) entry.originalId = sensor.originalId;
        break;
      case 'name':
        if (sensor.name != null) entry.name = sensor.name;
        break;
      case 'externalid':
        if (sensor.externalId != null) entry.externalId = sensor.externalId;
        break;
      case 'sensortype':
        if (sensor.sensorType != null) entry.sensorType = sensor.sensorType;
        break;
      case 'category':
        if (sensor.category != null) entry.category = sensor.category;
        break;
      case 'componentname':
        if (sensor.componentName != null) entry.componentName = sensor.componentName;
        break;
      case 'devicename':
        if (sensor.deviceName != null) entry.deviceName = sensor.deviceName;
        break;
      case 'formula':
        if (sensor.formula != null) entry.formula = sensor.formula;
        break;
      case 'lastupdated':
        if (sensor.lastUpdated != null) entry.lastUpdated = sensor.lastUpdated;
        break;

      // Relationship IDs
      case 'junctionid':
        if (sensor.junctionId != null) entry.junctionId = sensor.junctionId;
        break;
      case 'junctiondevicelinkid':
        if (sensor.junctionDeviceLinkId != null) entry.junctionDeviceLinkId = sensor.junctionDeviceLinkId;
        break;
      case 'junctioncollectorlinkid':
        if (sensor.junctionCollectorLinkId != null) entry.junctionCollectorLinkId = sensor.junctionCollectorLinkId;
        break;
      case 'deviceid':
        if (sensor.deviceId != null) entry.deviceId = sensor.deviceId;
        break;
      case 'serviceid':
        if (sensor.serviceId != null) entry.serviceId = sensor.serviceId;
        break;
      case 'collectorid':
        if (sensor.collectorId != null) entry.collectorId = sensor.collectorId;
        break;
      case 'sensororder':
        if (sensor.sensorOrder != null) entry.sensorOrder = sensor.sensorOrder;
        break;

      // MQTT
      case 'mqttserviceid':
        if (sensor.mqttServiceId != null) entry.mqttServiceId = sensor.mqttServiceId;
        break;
      case 'mqtttopic':
        if (sensor.mqttTopic != null) entry.mqttTopic = sensor.mqttTopic;
        break;
      case 'mqttqos':
        if (sensor.mqttQoS != null) entry.mqttQoS = sensor.mqttQoS;
        break;

      // Status flags
      case 'ismissing':
        if (sensor.isMissing != null) entry.isMissing = sensor.isMissing;
        break;
      case 'isstale':
        if (sensor.isStale != null) entry.isStale = sensor.isStale;
        break;
      case 'isselected':
        if (sensor.isSelected != null) entry.isSelected = sensor.isSelected;
        break;
      case 'isvisible':
        if (sensor.isVisible != null) entry.isVisible = sensor.isVisible;
        break;

      // Custom attributes
      case 'customattribute1':
        if (sensor.customAttribute1 != null) entry.customAttribute1 = sensor.customAttribute1;
        break;
      case 'customattribute2':
        if (sensor.customAttribute2 != null) entry.customAttribute2 = sensor.customAttribute2;
        break;
      case 'customattribute3':
        if (sensor.customAttribute3 != null) entry.customAttribute3 = sensor.customAttribute3;
        break;
      case 'customattribute4':
        if (sensor.customAttribute4 != null) entry.customAttribute4 = sensor.customAttribute4;
        break;
      case 'customattribute5':
        if (sensor.customAttribute5 != null) entry.customAttribute5 = sensor.customAttribute5;
        break;
      case 'customattribute6':
        if (sensor.customAttribute6 != null) entry.customAttribute6 = sensor.customAttribute6;
        break;
      case 'customattribute7':
        if (sensor.customAttribute7 != null) entry.customAttribute7 = sensor.customAttribute7;
        break;
      case 'customattribute8':
        if (sensor.customAttribute8 != null) entry.customAttribute8 = sensor.customAttribute8;
        break;
      case 'customattribute9':
        if (sensor.customAttribute9 != null) entry.customAttribute9 = sensor.customAttribute9;
        break;
      case 'customattribute10':
        if (sensor.customAttribute10 != null) entry.customAttribute10 = sensor.customAttribute10;
        break;

      // XSD-specific
      case 'pollersource':
        if (sensor.pollerSource != null) entry.pollerSource = sensor.pollerSource;
        break;
      case 'rawlabel':
        if (sensor.rawLabel != null) entry.rawLabel = sensor.rawLabel;
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
