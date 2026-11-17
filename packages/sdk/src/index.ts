// PayloadPlugin is exported for rpc-host-protocols.mjs, the host's loader (Server child-process mode),
// which lives in the JunctionRelay_Server repo (JunctionRelay_Server/Resources) and not in this repo.
// Plugin authors should NOT instantiate it — just `export default { metadata, ... } satisfies PayloadPluginConfig`.
export { PayloadPlugin } from './PayloadPlugin.js';
export type { PayloadPluginConfig } from './PayloadPlugin.js';
export { buildSensorArray, formatValue, filterSensorsByTags } from './helpers.js';
export * from '@junctionrelay/payload-protocol';
