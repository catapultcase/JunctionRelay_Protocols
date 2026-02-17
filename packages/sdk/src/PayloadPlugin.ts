import * as readline from 'node:readline';
import type {
  PayloadMetadata,
  HandlerParams,
  HealthCheckResult,
  JsonRpcRequest,
  JsonRpcResponse,
} from '@junctionrelay/payload-protocol';
import { JSON_RPC_ERRORS, PLUGIN_ID_PATTERN } from '@junctionrelay/payload-protocol';

/**
 * Plugin config shape — what plugin authors export as `default`.
 *
 * - `metadata` — plugin identity, capabilities, and messageTypes declaration
 * - `handlers` — named handler functions. Message type handlers are declared
 *   in `metadata.messageTypes` with triggers (connect, periodic, disconnect).
 *   Utility handlers (getOutputSchema, validate) are also in this map but
 *   are NOT declared in messageTypes — hosts call them on-demand for UI.
 */
export interface PayloadPluginConfig {
  metadata: PayloadMetadata;
  handlers: Record<string, (params: HandlerParams) => Promise<unknown>>;
}

export class PayloadPlugin {
  private config: PayloadPluginConfig;
  private startTime: number;

  constructor(config: PayloadPluginConfig) {
    const name = config.metadata.payloadName;
    if (!PLUGIN_ID_PATTERN.test(name)) {
      throw new Error(
        `payloadName '${name}' must be namespaced dot-notation (e.g. 'junctionrelay.jr-protocol')`,
      );
    }
    this.config = config;
    this.startTime = Date.now();
  }

  /**
   * Start the JSON-RPC stdin/stdout listener.
   * Called by rpc-host.mjs for Server's child-process mode.
   * NOT called automatically — plugins are pure config exports.
   */
  startRpc(): void {
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    rl.on('line', (line: string) => {
      this.handleLine(line).catch((err) => {
        process.stderr.write(`[plugin] Unhandled error: ${err}\n`);
      });
    });

    rl.on('close', () => {
      process.stderr.write(`[plugin] stdin closed, shutting down\n`);
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      process.stderr.write(`[plugin] SIGTERM received, shutting down\n`);
      process.exit(0);
    });

    process.stderr.write(`[plugin] ${this.config.metadata.displayName} ready\n`);
  }

  private async handleLine(line: string): Promise<void> {
    let request: JsonRpcRequest;

    try {
      request = JSON.parse(line);
    } catch {
      this.writeResponse({
        jsonrpc: '2.0',
        id: 0,
        error: { code: JSON_RPC_ERRORS.PARSE_ERROR, message: 'Parse error' },
      });
      return;
    }

    try {
      const result = await this.dispatch(request.method, request.params ?? {});
      this.writeResponse({
        jsonrpc: '2.0',
        id: request.id,
        result,
      });
    } catch (err) {
      const code = typeof (err as { code?: unknown }).code === 'number'
        ? (err as { code: number }).code
        : JSON_RPC_ERRORS.SERVER_ERROR;
      this.writeResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code,
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  private async dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    // Built-in methods handled by the SDK, not plugin authors
    if (method === 'getMetadata') {
      return this.config.metadata;
    }

    if (method === 'healthCheck') {
      return {
        healthy: true,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      } satisfies HealthCheckResult;
    }

    // All other methods dispatch to the plugin's handlers map
    const handler = this.config.handlers[method];
    if (!handler) {
      throw Object.assign(new Error(`Method not found: ${method}`), {
        code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
      });
    }

    const handlerParams = params as unknown as HandlerParams;
    return handler(handlerParams);
  }

  private writeResponse(response: JsonRpcResponse): void {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}
