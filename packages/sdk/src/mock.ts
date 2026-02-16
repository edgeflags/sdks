import type { FlagValue, EdgeFlagsOptions } from './types.js';
import { EdgeFlags } from './client.js';

export interface MockOptions {
  flags?: Record<string, FlagValue>;
  configs?: Record<string, unknown>;
}

export function createMockClient(options: MockOptions = {}): EdgeFlags {
  const client = new EdgeFlags({
    token: 'mock_token',
    baseUrl: 'http://localhost',
    _mock: {
      flags: options.flags ?? {},
      configs: options.configs ?? {},
    },
  } as EdgeFlagsOptions & { _mock: { flags: Record<string, FlagValue>; configs: Record<string, unknown> } });

  return client;
}
