import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { EdgeFlagsProvider } from '../src/provider.js';
import { useFlag, useConfig, useEdgeFlags } from '../src/hooks.js';
import { createMockClient } from '@edgeflags/sdk';
import type { EdgeFlags } from '@edgeflags/sdk';

afterEach(cleanup);

function FlagDisplay({ flagKey, defaultValue }: { flagKey: string; defaultValue?: any }) {
  const value = useFlag(flagKey, defaultValue);
  return <div data-testid="flag">{String(value)}</div>;
}

function ConfigDisplay({ configKey, defaultValue }: { configKey: string; defaultValue?: any }) {
  const value = useConfig(configKey, defaultValue);
  return <div data-testid="config">{String(value)}</div>;
}

function ClientAccess() {
  const ef = useEdgeFlags();
  return <div data-testid="ready">{String(ef.isReady)}</div>;
}

describe('useFlag', () => {
  it('reads flag from client', () => {
    const client = createMockClient({ flags: { dark: true } });

    const { getByTestId } = render(
      <EdgeFlagsProvider client={client}>
        <FlagDisplay flagKey="dark" />
      </EdgeFlagsProvider>,
    );
    expect(getByTestId('flag').textContent).toBe('true');
  });

  it('returns default when flag missing', () => {
    const client = createMockClient({ flags: {} });

    const { getByTestId } = render(
      <EdgeFlagsProvider client={client}>
        <FlagDisplay flagKey="missing" defaultValue={false} />
      </EdgeFlagsProvider>,
    );
    expect(getByTestId('flag').textContent).toBe('false');
  });
});

describe('useConfig', () => {
  it('reads config from client', () => {
    const client = createMockClient({ configs: { limit: 42 } });

    const { getByTestId } = render(
      <EdgeFlagsProvider client={client}>
        <ConfigDisplay configKey="limit" />
      </EdgeFlagsProvider>,
    );
    expect(getByTestId('config').textContent).toBe('42');
  });

  it('returns default when config missing', () => {
    const client = createMockClient({ configs: {} });

    const { getByTestId } = render(
      <EdgeFlagsProvider client={client}>
        <ConfigDisplay configKey="missing" defaultValue={99} />
      </EdgeFlagsProvider>,
    );
    expect(getByTestId('config').textContent).toBe('99');
  });
});

describe('useEdgeFlags', () => {
  it('returns client instance', () => {
    const client = createMockClient({ flags: { a: true } });

    const { getByTestId } = render(
      <EdgeFlagsProvider client={client}>
        <ClientAccess />
      </EdgeFlagsProvider>,
    );
    expect(getByTestId('ready').textContent).toBe('true');
  });

  it('throws without provider', () => {
    expect(() => {
      render(<ClientAccess />);
    }).toThrow('useEdgeFlags must be used within an EdgeFlagsProvider');
  });
});
