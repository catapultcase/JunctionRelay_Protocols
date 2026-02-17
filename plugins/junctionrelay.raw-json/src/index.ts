import type { PayloadPluginConfig, HandlerParams } from '@junctionrelay/payload-sdk';

export default {
  metadata: {
    payloadName: 'junctionrelay.raw-json',
    displayName: 'Raw JSON',
    description: 'Pass-through flat sensor dictionary as JSON',
    category: 'Data',
    emoji: '📋',
    messageTypes: {
      readings: { trigger: 'periodic', description: 'Flat sensor dictionary' },
    },
    outputContentType: 'application/json',
    outputDescription: 'Flat JSON object with sensor tags as keys',
    authorName: 'JunctionRelay',
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
