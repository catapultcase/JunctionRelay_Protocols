import type { PayloadPluginConfig, HandlerParams } from '@junctionrelay/payload-sdk';

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
    config: async ({ config, profile }: HandlerParams) => {
      // Phase 2b: full extraction from Service_Manager_Payloads_Config.cs
      return {
        payload: { type: 'config', profile: profile ?? 'lvgl-grid', config },
        contentType: 'application/json',
      };
    },

    sensor: async ({ sensors, config, profile, context }: HandlerParams) => {
      // Phase 2b: full extraction from Service_Manager_Payloads_Sensor.cs
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

    stop: async ({ context }: HandlerParams) => ({
      payload: { type: 'stop', screenId: context.screenId, timestamp: context.timestamp },
      contentType: 'application/json',
    }),

    getOutputSchema: async ({ profile }: HandlerParams) => ({
      description: `JR Protocol output for ${profile ?? 'lvgl-grid'} profile`,
      example: { type: 'sensor', screenId: 'default', profile: profile ?? 'lvgl-grid', sensors: {}, timestamp: 0 },
    }),
  },
} satisfies PayloadPluginConfig;
