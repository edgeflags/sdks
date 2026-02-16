import { useState, useEffect, useRef, useMemo } from 'react';
import { EdgeFlags } from '@edgeflags/sdk';
import type { EvaluationContext, EdgeFlagsOptions } from '@edgeflags/sdk';
import { EdgeFlagsContext } from './context.js';

export interface EdgeFlagsProviderProps {
  children: React.ReactNode;
  client?: EdgeFlags;
  token?: string;
  baseUrl?: string;
  context?: EvaluationContext;
  pollingInterval?: number;
  transport?: EdgeFlagsOptions['transport'];
  bootstrap?: EdgeFlagsOptions['bootstrap'];
  debug?: boolean;
}

export function EdgeFlagsProvider({
  children,
  client: externalClient,
  token,
  baseUrl,
  context,
  pollingInterval,
  transport,
  bootstrap,
  debug,
}: EdgeFlagsProviderProps) {
  const [version, setVersion] = useState(0);
  const clientRef = useRef<EdgeFlags | null>(null);
  const ownsClientRef = useRef(false);

  const client = useMemo(() => {
    if (externalClient) {
      ownsClientRef.current = false;
      return externalClient;
    }

    if (!token || !baseUrl) return null;

    const ef = new EdgeFlags({
      token,
      baseUrl,
      context,
      pollingInterval,
      transport,
      bootstrap,
      debug,
    });
    ownsClientRef.current = true;
    return ef;
    // Only recreate when identity props change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalClient, token, baseUrl]);

  useEffect(() => {
    if (!client) return;
    clientRef.current = client;

    const unsub = client.on('change', () => {
      setVersion((v) => v + 1);
    });

    if (ownsClientRef.current) {
      client.init().catch(() => {
        // Error emitted via 'error' event
      });
    }

    return () => {
      unsub();
      if (ownsClientRef.current) {
        client.destroy();
      }
    };
  }, [client]);

  const value = useMemo(() => ({ client, version }), [client, version]);

  return (
    <EdgeFlagsContext value={value}>
      {children}
    </EdgeFlagsContext>
  );
}
