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

/** Sensor entry passed to transform() */
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

/** Input to transform() */
export interface TransformParams {
  sensors: Record<string, SensorEntry>;
  config: Record<string, unknown>;
  profile?: string;
  context: {
    screenId: string;
    timestamp: number;
    sensorSource: string;
    fullSync: boolean;
  };
}

/** Output from transform() */
export interface TransformResult {
  payload: unknown;
  contentType: string;
  metadata?: Record<string, unknown>;
}

/** Output schema description */
export interface OutputSchema {
  description: string;
  example: unknown;
  jsonSchema?: Record<string, unknown>;
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/** Health check result */
export interface HealthCheckResult {
  healthy: boolean;
  uptime: number;
}

// ============================================================================
// Plugin Metadata — returned by getMetadata
// ============================================================================

/** Plugin metadata (from manifest) */
export interface PayloadMetadata {
  payloadName: string;
  displayName: string;
  description: string;
  category: string;
  emoji: string;
  fields?: { configurable?: string[] };
  defaults?: Record<string, unknown>;
  profiles?: string[];
  outputContentType?: string;
  outputDescription?: string;
  setupInstructions?: { title: string; body: string }[];
  authorName?: string;
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
  outputContentType?: string;
  outputDescription?: string;
  setupInstructions?: { title: string; body: string }[];
  authorName?: string;
}

/** Discovered plugin (from host scanning) */
export interface DiscoveredPlugin {
  manifest: PayloadPluginManifest;
  directory: string;
  packageName: string;
  version: string;
}

// ============================================================================
// Method name constants
// ============================================================================

export type PayloadMethod =
  | 'getMetadata'
  | 'transform'
  | 'transformConfig'
  | 'getOutputSchema'
  | 'validate'
  | 'healthCheck';
