import type { PayloadPluginConfig, TransformParams } from '@junctionrelay/payload-sdk';

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
  },

  async transform({ sensors, context }: TransformParams) {
    const dictionarySensors: Record<string, object> = {};
    for (const [tag, s] of Object.entries(sensors)) {
      dictionarySensors[tag] = {
        value: s.value,
        unit: s.unit,
        displayValue: s.displayValue,
        pollerSource: s.pollerSource,
        rawLabel: s.rawLabel,
      };
    }
    return {
      payload: {
        type: 'xsd_sensor',
        screenId: context.screenId,
        dictionarySensors,
        unmappedSensors: {},
        timestamp: context.timestamp,
      },
      contentType: 'application/json',
    };
  },

  async getOutputSchema() {
    return {
      description: 'XSD sensor payload with dictionarySensors structure',
      example: {
        type: 'xsd_sensor',
        screenId: 'xsd',
        dictionarySensors: {
          cpu_usage_total: { value: 45.2, unit: '%', displayValue: '45.2', pollerSource: 'psutil', rawLabel: 'usage_total' },
        },
        unmappedSensors: {},
        timestamp: 1771257808745,
      },
    };
  },
} satisfies PayloadPluginConfig;
