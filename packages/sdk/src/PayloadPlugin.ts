import * as readline from 'node:readline';
import type {
  PayloadMetadata,
  TransformParams,
  TransformResult,
  OutputSchema,
  ValidationResult,
  HealthCheckResult,
  JsonRpcRequest,
  JsonRpcResponse,
} from '@junctionrelay/payload-protocol';
import { JSON_RPC_ERRORS, PLUGIN_ID_PATTERN } from '@junctionrelay/payload-protocol';

export interface PayloadPluginConfig {
  metadata: PayloadMetadata;

  transform(params: TransformParams): Promise<TransformResult>;
  transformConfig?(params: TransformParams & { layoutConfig?: Record<string, unknown> }): Promise<TransformResult>;
  getOutputSchema?(profile?: string): Promise<OutputSchema>;
  validate?(config: Record<string, unknown>): Promise<ValidationResult>;
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
    switch (method) {
      case 'getMetadata':
        return this.config.metadata;

      case 'transform': {
        const transformParams = params as unknown as TransformParams;
        return this.config.transform(transformParams);
      }

      case 'transformConfig': {
        const configParams = params as unknown as TransformParams & { layoutConfig?: Record<string, unknown> };
        if (this.config.transformConfig) {
          return this.config.transformConfig(configParams);
        }
        throw Object.assign(new Error('transformConfig not implemented'), {
          code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
        });
      }

      case 'getOutputSchema': {
        const profile = params.profile as string | undefined;
        if (this.config.getOutputSchema) {
          return this.config.getOutputSchema(profile);
        }
        return { description: 'No schema available', example: null };
      }

      case 'validate': {
        const config = params.config as Record<string, unknown> | undefined;
        if (this.config.validate) {
          return this.config.validate(config ?? {});
        }
        return { valid: true };
      }

      case 'healthCheck':
        return {
          healthy: true,
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
        } satisfies HealthCheckResult;

      default:
        throw Object.assign(new Error(`Method not found: ${method}`), {
          code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
        });
    }
  }

  private writeResponse(response: JsonRpcResponse): void {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}
