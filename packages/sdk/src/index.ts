// PayloadPlugin is exported for rpc-host.mjs (Server child-process mode).
// Plugin authors should NOT instantiate it — just `export default { metadata, ... } satisfies PayloadPluginConfig`.
export { PayloadPlugin } from './PayloadPlugin.js';
export type { PayloadPluginConfig } from './PayloadPlugin.js';
export { buildSensorArray, formatValue, filterSensorsByTags } from './helpers.js';
export * from '@junctionrelay/payload-protocol';
