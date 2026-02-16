import type { PayloadPluginConfig, TransformParams } from '@junctionrelay/payload-sdk';

export default {
  metadata: {
    payloadName: 'junctionrelay.jr-protocol',
    displayName: 'JR Protocol',
    description: 'JunctionRelay Server protocol for device communication',
    category: 'Protocol',
    emoji: '🔌',
    profiles: ['lvgl-grid', 'lvgl-radio', 'lvgl-plotter', 'quad', 'matrix', 'neopixel'],
    outputContentType: 'application/json',
    outputDescription: 'JR sensor/config payload for LVGL, matrix, and NeoPixel devices',
    authorName: 'JunctionRelay',
  },

  async transform({ sensors, config, profile, context }: TransformParams) {
    // Phase 1: basic structure per profile
    // Phase 2: full extraction from Service_Manager_Payloads_Sensor.cs
    const sensorArray = Object.entries(sensors).map(([tag, s], i) => ({
      [`sensor_${i + 1}`]: { ...s, sensorTag: tag },
    }));
    return {
      payload: {
        type: 'sensor',
        screenId: context.screenId,
        profile: profile ?? 'lvgl-grid',
        sensors: Object.assign({}, ...sensorArray),
        timestamp: context.timestamp,
      },
      contentType: 'application/json',
    };
  },

  async transformConfig({ config, profile }) {
    // Phase 2: full extraction from Service_Manager_Payloads_Config.cs
    return {
      payload: { type: 'config', profile: profile ?? 'lvgl-grid', config },
      contentType: 'application/json',
    };
  },

  async getOutputSchema(profile?: string) {
    return {
      description: `JR Protocol output for ${profile ?? 'lvgl-grid'} profile`,
      example: { type: 'sensor', screenId: 'default', profile: profile ?? 'lvgl-grid', sensors: {}, timestamp: 0 },
    };
  },
} satisfies PayloadPluginConfig;
