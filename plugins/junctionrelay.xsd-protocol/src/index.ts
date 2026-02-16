import type { PayloadPluginConfig, TransformParams, SensorEntry, ValidationResult } from '@junctionrelay/payload-sdk';

export default {
  metadata: {
    payloadName: 'junctionrelay.xsd-protocol',
    displayName: 'XSD Protocol',
    description: 'XSD dictionarySensors format for device communication',
    category: 'Protocol',
    emoji: '📡',
    outputContentType: 'application/json',
    outputDescription: 'XSD sensor payload with dictionarySensors/unmappedSensors structure',
    authorName: 'JunctionRelay',
    fields: { configurable: ['unmappedSensors'] },
  },

  async transform({ sensors, config, context }: TransformParams) {
    const dictionarySensors: Record<string, object> = {};
    for (const [tag, s] of Object.entries(sensors)) {
      dictionarySensors[tag] = {
        value: s.value,
        unit: s.unit || '',
        displayValue: s.displayValue ?? `${s.value}`,
        pollerSource: s.pollerSource || 'unknown',
        rawLabel: s.rawLabel || tag,
      };
    }

    const unmappedSensors: Record<string, object> = {};
    const unmapped = config.unmappedSensors as Record<string, SensorEntry> | undefined;
    if (unmapped) {
      for (const [key, s] of Object.entries(unmapped)) {
        unmappedSensors[key] = {
          value: s.value,
          unit: s.unit || '',
          pollerSource: s.pollerSource || 'unknown',
          rawLabel: s.rawLabel || key,
        };
      }
    }

    return {
      payload: {
        type: 'xsd_sensor',
        screenId: context.screenId,
        dictionarySensors,
        unmappedSensors,
        sensorSource: context.sensorSource,
        timestamp: context.timestamp,
      },
      contentType: 'application/json',
    };
  },

  async validate(config: Record<string, unknown>): Promise<ValidationResult> {
    if (config.unmappedSensors !== undefined && (typeof config.unmappedSensors !== 'object' || config.unmappedSensors === null || Array.isArray(config.unmappedSensors))) {
      return { valid: false, errors: ['unmappedSensors must be a Record<string, SensorEntry> if provided'] };
    }
    return { valid: true };
  },

  async getOutputSchema() {
    return {
      description: 'XSD sensor payload with dictionarySensors/unmappedSensors structure',
      example: {
        type: 'xsd_sensor',
        screenId: 'xsd',
        dictionarySensors: {
          cpu_usage_total: { value: 45.2, unit: '%', displayValue: '45.2', pollerSource: 'psutil', rawLabel: 'usage_total' },
        },
        unmappedSensors: {
          gpu_temp: { value: 72, unit: '°C', pollerSource: 'nvidia-smi', rawLabel: 'GPU Temperature' },
        },
        sensorSource: 'local',
        timestamp: 1771257808745,
      },
    };
  },
} satisfies PayloadPluginConfig;
