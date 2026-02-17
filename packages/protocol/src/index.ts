// ============================================================================
// Protocol Constants
// ============================================================================

export const PROTOCOL_VERSION = '1.0.0';

/**
 * Regex for validating namespaced plugin identifiers.
 * Format: `<namespace>.<name>` — both segments lowercase kebab-case.
 * Examples: `junctionrelay.jr-protocol`, `yourname.custom-format`
 *
 * All payload plugins use this pattern — there are no native (un-namespaced)
 * payload formats, unlike collectors which have a few native exceptions.
 */
export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Returns true if the given payload name is a valid plugin identifier (has a dot namespace).
 */
export function isPluginPayloadName(name: string): boolean {
  return PLUGIN_ID_PATTERN.test(name);
}

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
} as const;

// ============================================================================
// JSON-RPC 2.0 Message Types
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id: number | string;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// Payload-Specific Types
// ============================================================================

/** Sensor entry in the flat dictionary passed to handlers */
export interface SensorEntry {
  value: string | number | boolean;
  unit: string;
  displayValue: string;
  pollerSource: string;
  rawLabel: string;
  category?: string;
  sensorType?: string;
  componentName?: string;
}

/**
 * Catalog of all sensor fields available in SensorEntry.
 * Plugins use this to define which fields appear in their output
 * via the `fieldsToSend` config (checkboxGroup field type).
 *
 * Each entry has:
 * - `key` — the camelCase field name on SensorEntry
 * - `label` — human-readable display name
 * - `description` — what the field contains
 * - `default` — whether this field is included by default
 */
export const SENSOR_FIELDS = [
  { key: 'value',         label: 'Value',          description: 'The sensor reading (numeric formatted to 2 decimals, or string)', default: true },
  { key: 'unit',          label: 'Unit',           description: 'Unit of measurement (°C, %, MB, etc.)',                          default: true },
  { key: 'displayValue',  label: 'Display Value',  description: 'Pre-formatted value for direct display',                         default: false },
  { key: 'pollerSource',  label: 'Poller Source',  description: 'Which collector produced this reading (psutil, hwinfo, etc.)',    default: false },
  { key: 'rawLabel',      label: 'Raw Label',      description: 'Original sensor label before tag normalization',                 default: false },
  { key: 'category',      label: 'Category',       description: 'Sensor category (cpu, memory, gpu, disk, etc.)',                 default: false },
  { key: 'sensorType',    label: 'Sensor Type',    description: 'Type classification (temperature, utilization, clock, etc.)',     default: false },
  { key: 'componentName', label: 'Component Name', description: 'Hardware component name (CPU Package, GPU Core, etc.)',           default: false },
] as const;

/** Input to every handler in the handlers map */
export interface HandlerParams {
  /** Flat sensor dictionary keyed by sensorTag */
  sensors: Record<string, SensorEntry>;
  /** Plugin-specific configuration (from payload instance settings) */
  config: Record<string, unknown>;
  /** Optional Profile name — selects a named preset within the Protocol */
  profile?: string;
  /** Context provided by the host */
  context: {
    screenId: string;
    timestamp: number;
    /** 'local' | 'remote' — where sensor data originated */
    sensorSource: string;
    /** Whether this is a full sync vs incremental update */
    fullSync: boolean;
    /** The handler name being invoked (matches the key in handlers map) */
    messageType: string;
  };
}

/** Output from message type handlers (connect, periodic, disconnect) */
export interface TransformResult {
  /** The transformed payload — any JSON-serializable value */
  payload: unknown;
  /** MIME type of the output (e.g., 'application/json', 'text/plain') */
  contentType: string;
  /** Optional metadata for the host (routing hints, topic names, etc.) */
  metadata?: Record<string, unknown>;
}

/** Output schema description (from getOutputSchema utility handler) */
export interface OutputSchema {
  description: string;
  example: unknown;
  jsonSchema?: Record<string, unknown>;
}

/** Validation result (from validate utility handler) */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/** Health check result (built into SDK, not plugin-authored) */
export interface HealthCheckResult {
  healthy: boolean;
  uptime: number;
}

// ============================================================================
// Message Type Declaration
// ============================================================================

/** Declares when a handler should be called by the host */
export interface MessageTypeDeclaration {
  /** Lifecycle trigger: when the host calls this handler */
  trigger: 'connect' | 'periodic' | 'disconnect' | 'on-change' | 'on-demand' | 'once';
  /** Human-readable description of what this handler does */
  description?: string;
}

// ============================================================================
// Profile Configuration Field Definitions
// ============================================================================

/** Option for select-type fields */
export interface PayloadFieldOption {
  value: string;
  label: string;
}

/** Single field definition within a profile config group */
export interface PayloadFieldDefinition {
  key: string;
  type: 'text' | 'number' | 'boolean' | 'color' | 'select' | 'slider' | 'json' | 'checkboxGroup';
  label: string;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: PayloadFieldOption[];
  description?: string;
}

/** Group of related fields (renders as one accordion section) */
export interface PayloadFieldGroup {
  name: string;
  description?: string;
  fields: PayloadFieldDefinition[];
}

/** Per-profile configuration schema */
export interface PayloadProfileConfig {
  fieldGroups: PayloadFieldGroup[];
}

// ============================================================================
// Plugin Metadata — returned by getMetadata
// ============================================================================

/** Plugin metadata (from manifest + returned by getMetadata) */
export interface PayloadMetadata {
  payloadName: string;
  displayName: string;
  description: string;
  category: string;
  emoji: string;
  fields?: { configurable?: string[] };
  defaults?: Record<string, unknown>;
  profiles?: string[];
  /** Handler map declaration — keys are handler names, values are trigger metadata */
  messageTypes?: Record<string, MessageTypeDeclaration>;
  outputContentType?: string;
  outputDescription?: string;
  setupInstructions?: { title: string; body: string }[];
  authorName?: string;
  /** Per-profile field group definitions for configuration UI */
  profileConfigs?: Record<string, PayloadProfileConfig>;
}

// ============================================================================
// Plugin Manifest & Discovery
// ============================================================================

/** Manifest shape in package.json.junctionrelay */
export interface PayloadPluginManifest {
  type: 'payload';
  payloadName: string;
  entry: string;
  displayName: string;
  description: string;
  category: string;
  emoji: string;
  fields?: { configurable?: string[] };
  defaults?: Record<string, unknown>;
  profiles?: string[];
  /** Handler map declaration — keys are handler names, values are trigger metadata */
  messageTypes?: Record<string, MessageTypeDeclaration>;
  outputContentType?: string;
  outputDescription?: string;
  setupInstructions?: { title: string; body: string }[];
  authorName?: string;
  /** Per-profile field group definitions for configuration UI */
  profileConfigs?: Record<string, PayloadProfileConfig>;
}

/** Discovered plugin (from host scanning) */
export interface DiscoveredPlugin {
  manifest: PayloadPluginManifest;
  directory: string;
  packageName: string;
  version: string;
}
