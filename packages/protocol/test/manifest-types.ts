import type { PayloadMetadata, PayloadPluginManifest } from '../src/index.js';

const manifestPrefixDisabled: PayloadPluginManifest = {
  type: 'payload',
  payloadName: 'junctionrelay.xsd-protocol',
  entry: 'dist/index.js',
  displayName: 'XSD Protocol',
  description: 'XSD dictionarySensors format',
  category: 'Protocol',
  emoji: '📡',
  jrPrefix: false,
};

const manifestPrefixEnabled: PayloadPluginManifest = {
  type: 'payload',
  payloadName: 'junctionrelay.jr-protocol',
  entry: 'dist/index.js',
  displayName: 'JR Protocol',
  description: 'JunctionRelay Server protocol',
  category: 'Protocol',
  emoji: '🔌',
  jrPrefix: true,
};

const manifestPrefixOmitted: PayloadPluginManifest = {
  type: 'payload',
  payloadName: 'junctionrelay.raw-json',
  entry: 'dist/index.js',
  displayName: 'Raw JSON',
  description: 'Pass-through flat sensor dictionary',
  category: 'Data',
  emoji: '📋',
};

const metadataPrefixDisabled: PayloadMetadata = {
  payloadName: 'junctionrelay.xsd-protocol',
  displayName: 'XSD Protocol',
  description: 'XSD dictionarySensors format',
  category: 'Protocol',
  emoji: '📡',
  jrPrefix: false,
};

const metadataPrefixEnabled: PayloadMetadata = {
  payloadName: 'junctionrelay.jr-protocol',
  displayName: 'JR Protocol',
  description: 'JunctionRelay Server protocol',
  category: 'Protocol',
  emoji: '🔌',
  jrPrefix: true,
};

const metadataPrefixOmitted: PayloadMetadata = {
  payloadName: 'junctionrelay.raw-json',
  displayName: 'Raw JSON',
  description: 'Pass-through flat sensor dictionary',
  category: 'Data',
  emoji: '📋',
};

const manifestWrongPrefixType: PayloadPluginManifest = {
  type: 'payload',
  payloadName: 'junctionrelay.bad-protocol',
  entry: 'dist/index.js',
  displayName: 'Bad Protocol',
  description: 'jrPrefix must be a boolean',
  category: 'Protocol',
  emoji: '🚫',
  // @ts-expect-error jrPrefix is typed as boolean, not string
  jrPrefix: 'no',
};

const metadataWrongPrefixType: PayloadMetadata = {
  payloadName: 'junctionrelay.bad-protocol',
  displayName: 'Bad Protocol',
  description: 'jrPrefix must be a boolean',
  category: 'Protocol',
  emoji: '🚫',
  // @ts-expect-error jrPrefix is typed as boolean, not string
  jrPrefix: 'no',
};

export {
  manifestPrefixDisabled,
  manifestPrefixEnabled,
  manifestPrefixOmitted,
  metadataPrefixDisabled,
  metadataPrefixEnabled,
  metadataPrefixOmitted,
  manifestWrongPrefixType,
  metadataWrongPrefixType,
};
