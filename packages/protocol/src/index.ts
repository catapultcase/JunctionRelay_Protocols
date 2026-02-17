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

/**
 * Sensor entry in the flat dictionary passed to handlers.
 * Mirrors Server's Model_Sensor — every field that can appear in `fieldsToSend`.
 * SensorTag is the dictionary key, not a field on this interface.
 */
export interface SensorEntry {
  // Core reading
  value: string | number | boolean;
  unit: string;
  decimalPlaces?: number;
  displayValue?: string;

  // Identity & metadata
  id?: number;
  originalId?: number;
  name?: string;
  externalId?: string;
  sensorType?: string;
  category?: string;
  componentName?: string;
  deviceName?: string;
  formula?: string;
  lastUpdated?: string;

  // Relationship IDs
  junctionId?: number;
  junctionDeviceLinkId?: number;
  junctionCollectorLinkId?: number;
  deviceId?: number;
  serviceId?: number;
  collectorId?: number;
  sensorOrder?: number;

  // MQTT
  mqttServiceId?: number;
  mqttTopic?: string;
  mqttQoS?: number;

  // Status flags
  isMissing?: boolean;
  isStale?: boolean;
  isSelected?: boolean;
  isVisible?: boolean;

  // Custom attributes
  customAttribute1?: string;
  customAttribute2?: string;
  customAttribute3?: string;
  customAttribute4?: string;
  customAttribute5?: string;
  customAttribute6?: string;
  customAttribute7?: string;
  customAttribute8?: string;
  customAttribute9?: string;
  customAttribute10?: string;

  // Source tracing
  pollerSource?: string;
  rawLabel?: string;
}

/**
 * Catalog of all sensor fields available in SensorEntry.
 * Matches Server's BuildSensorData switch in Service_Manager_Payloads_Sensor.cs.
 * Plugins use this to define which fields appear in their output
 * via the `fieldsToSend` config (checkboxGroup field type).
 *
 * Each entry has:
 * - `key` — the camelCase field name on SensorEntry
 * - `label` — human-readable display name
 * - `description` — what the field contains
 * - `default` — whether this field is included by default
 * - `group` — logical grouping for UI organization
 */
export const SENSOR_FIELDS = [
  // Core reading
  { key: 'value',          label: 'Value',            description: 'The sensor reading (numeric formatted to decimal places, or string)',  default: true,  group: 'Core' },
  { key: 'unit',           label: 'Unit',             description: 'Unit of measurement (°C, %, MB, etc.)',                               default: true,  group: 'Core' },
  { key: 'decimalPlaces',  label: 'Decimal Places',   description: 'Number of decimal places for numeric formatting',                     default: false, group: 'Core' },
  { key: 'displayValue',  label: 'Display Value',    description: 'Pre-formatted value for direct display',                              default: false, group: 'Core' },

  // Identity & metadata
  { key: 'id',             label: 'ID',               description: 'Database primary key',                                                default: false, group: 'Identity' },
  { key: 'originalId',     label: 'Original ID',      description: 'Reference to original sensor before cloning',                         default: false, group: 'Identity' },
  { key: 'name',           label: 'Name',             description: 'Sensor display name',                                                default: false, group: 'Identity' },
  { key: 'externalId',     label: 'External ID',      description: 'Identifier from the external data source',                            default: false, group: 'Identity' },
  { key: 'sensorType',     label: 'Sensor Type',      description: 'Type classification (temperature, utilization, clock, etc.)',          default: false, group: 'Identity' },
  { key: 'category',       label: 'Category',         description: 'Sensor category (cpu, memory, gpu, disk, etc.)',                      default: false, group: 'Identity' },
  { key: 'componentName',  label: 'Component Name',   description: 'Hardware component name (CPU Package, GPU Core, etc.)',                default: false, group: 'Identity' },
  { key: 'deviceName',     label: 'Device Name',      description: 'Name of the device that owns this sensor',                            default: false, group: 'Identity' },
  { key: 'formula',        label: 'Formula',          description: 'Optional calculation formula applied to the raw value',                default: false, group: 'Identity' },
  { key: 'lastUpdated',    label: 'Last Updated',     description: 'UTC timestamp of the most recent value update',                       default: false, group: 'Identity' },

  // Relationship IDs
  { key: 'junctionId',              label: 'Junction ID',               description: 'Foreign key to the parent junction',                default: false, group: 'Relationships' },
  { key: 'junctionDeviceLinkId',    label: 'Junction Device Link ID',   description: 'Link to junction–device association',               default: false, group: 'Relationships' },
  { key: 'junctionCollectorLinkId', label: 'Junction Collector Link ID',description: 'Link to junction–collector association',             default: false, group: 'Relationships' },
  { key: 'deviceId',                label: 'Device ID',                 description: 'Foreign key to the source device',                  default: false, group: 'Relationships' },
  { key: 'serviceId',               label: 'Service ID',                description: 'Foreign key to the source service',                 default: false, group: 'Relationships' },
  { key: 'collectorId',             label: 'Collector ID',              description: 'Foreign key to the source collector',               default: false, group: 'Relationships' },
  { key: 'sensorOrder',             label: 'Sensor Order',              description: 'Display/processing sort order',                     default: false, group: 'Relationships' },

  // MQTT
  { key: 'mqttServiceId',  label: 'MQTT Service ID',  description: 'MQTT service this sensor publishes to',                               default: false, group: 'MQTT' },
  { key: 'mqttTopic',      label: 'MQTT Topic',       description: 'MQTT topic path for this sensor',                                     default: false, group: 'MQTT' },
  { key: 'mqttQoS',        label: 'MQTT QoS',         description: 'MQTT Quality of Service level (0, 1, or 2)',                          default: false, group: 'MQTT' },

  // Status flags
  { key: 'isMissing',      label: 'Is Missing',       description: 'Whether sensor data is currently unavailable',                        default: false, group: 'Status' },
  { key: 'isStale',        label: 'Is Stale',         description: 'Whether the reading is older than the staleness threshold',            default: false, group: 'Status' },
  { key: 'isSelected',     label: 'Is Selected',      description: 'Whether the sensor is selected in the UI',                            default: false, group: 'Status' },
  { key: 'isVisible',      label: 'Is Visible',       description: 'Whether the sensor is visible in layouts',                            default: false, group: 'Status' },

  // Custom attributes
  { key: 'customAttribute1',  label: 'Custom Attribute 1',  description: 'User-defined custom attribute slot 1',                          default: false, group: 'Custom' },
  { key: 'customAttribute2',  label: 'Custom Attribute 2',  description: 'User-defined custom attribute slot 2',                          default: false, group: 'Custom' },
  { key: 'customAttribute3',  label: 'Custom Attribute 3',  description: 'User-defined custom attribute slot 3',                          default: false, group: 'Custom' },
  { key: 'customAttribute4',  label: 'Custom Attribute 4',  description: 'User-defined custom attribute slot 4',                          default: false, group: 'Custom' },
  { key: 'customAttribute5',  label: 'Custom Attribute 5',  description: 'User-defined custom attribute slot 5',                          default: false, group: 'Custom' },
  { key: 'customAttribute6',  label: 'Custom Attribute 6',  description: 'User-defined custom attribute slot 6',                          default: false, group: 'Custom' },
  { key: 'customAttribute7',  label: 'Custom Attribute 7',  description: 'User-defined custom attribute slot 7',                          default: false, group: 'Custom' },
  { key: 'customAttribute8',  label: 'Custom Attribute 8',  description: 'User-defined custom attribute slot 8',                          default: false, group: 'Custom' },
  { key: 'customAttribute9',  label: 'Custom Attribute 9',  description: 'User-defined custom attribute slot 9',                          default: false, group: 'Custom' },
  { key: 'customAttribute10', label: 'Custom Attribute 10', description: 'User-defined custom attribute slot 10',                         default: false, group: 'Custom' },

  // Source tracing
  { key: 'pollerSource',   label: 'Poller Source',    description: 'Which collector produced this reading (psutil, hwinfo, etc.)',         default: false, group: 'Source' },
  { key: 'rawLabel',       label: 'Raw Label',        description: 'Original sensor label before tag normalization',                      default: false, group: 'Source' },
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
