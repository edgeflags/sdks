import { useContext } from 'react';
import type { FlagValue, EdgeFlags } from '@edgeflags/sdk';
import { EdgeFlagsContext } from './context.js';

export function useEdgeFlags(): EdgeFlags {
  const { client } = useContext(EdgeFlagsContext);
  if (!client) {
    throw new Error('useEdgeFlags must be used within an EdgeFlagsProvider');
  }
  return client;
}

export function useFlag(key: string, defaultValue?: FlagValue): FlagValue | undefined {
  const { client, version: _version } = useContext(EdgeFlagsContext);
  if (!client) return defaultValue;
  const value = client.flag(key);
  return value === undefined ? defaultValue : value;
}

export function useConfig<T = unknown>(key: string, defaultValue?: T): T | undefined {
  const { client, version: _version } = useContext(EdgeFlagsContext);
  if (!client) return defaultValue;
  const value = client.config(key);
  return (value === undefined ? defaultValue : value) as T | undefined;
}
