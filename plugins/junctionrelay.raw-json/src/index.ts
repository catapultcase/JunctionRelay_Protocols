import type { PayloadPluginConfig, TransformParams } from '@junctionrelay/payload-sdk';

export default {
  metadata: {
    payloadName: 'junctionrelay.raw-json',
    displayName: 'Raw JSON',
    description: 'Pass-through flat sensor dictionary as JSON',
    category: 'Data',
    emoji: '📋',
    fields: { configurable: ['includeTimestamp', 'includeMetadata'] },
    defaults: { includeTimestamp: true, includeMetadata: false },
    outputContentType: 'application/json',
    outputDescription: 'Flat JSON object with sensor tags as keys',
    authorName: 'JunctionRelay',
  },

  async transform({ sensors, config, context }: TransformParams) {
    const result: Record<string, unknown> = {};
    if (config.includeTimestamp) result.timestamp = context.timestamp;
    if (config.includeMetadata) {
      result.screenId = context.screenId;
      result.sensorSource = context.sensorSource;
    }
    for (const [tag, sensor] of Object.entries(sensors)) {
      result[tag] = sensor.value;
    }
    return { payload: result, contentType: 'application/json' };
  },

  async getOutputSchema() {
    return {
      description: 'Flat JSON object with sensor tags as keys and raw values',
      example: { timestamp: 1771257808745, cpu_usage_total: 45.2, gpu_temp: 72 },
    };
  },
} satisfies PayloadPluginConfig;
