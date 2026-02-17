import type { PayloadPluginConfig, HandlerParams } from '@junctionrelay/payload-sdk';

export default {
  metadata: {
    payloadName: 'junctionrelay.xsd-protocol',
    displayName: 'XSD Protocol',
    description: 'JunctionRelay XSD dictionarySensors format for device communication',
    category: 'Protocol',
    emoji: '📡',
    outputContentType: 'application/json',
    outputDescription: 'XSD sensor payload with dictionarySensors/unmappedSensors structure',
    authorName: 'JunctionRelay',
    messageTypes: {
      sensor: { trigger: 'periodic', description: 'XSD dictionarySensors sensor stream' },
    },
  },

  handlers: {
    sensor: async ({ sensors, context }: HandlerParams) => {
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

      return {
        payload: {
          type: 'xsd_sensor',
          screenId: context.screenId,
          dictionarySensors,
          unmappedSensors: {},
          sensorSource: context.sensorSource,
          timestamp: context.timestamp,
        },
        contentType: 'application/json',
      };
    },

    getOutputSchema: async () => ({
      description: 'XSD sensor payload with dictionarySensors/unmappedSensors structure',
      example: {
        type: 'xsd_sensor',
        screenId: 'xsd',
        dictionarySensors: {
          cpu_usage_total: { value: 45.2, unit: '%', displayValue: '45.2', pollerSource: 'psutil', rawLabel: 'usage_total' },
        },
        unmappedSensors: {},
        sensorSource: 'local',
        timestamp: 1771257808745,
      },
    }),
  },
} satisfies PayloadPluginConfig;
