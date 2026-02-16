import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useContext } from 'react';
import { EdgeFlagsProvider } from '../src/provider.js';
import { EdgeFlagsContext } from '../src/context.js';
import { createMockClient } from '@edgeflags/sdk';

afterEach(cleanup);

function ClientStatus() {
  const { client } = useContext(EdgeFlagsContext);
  return <div data-testid="status">{client ? 'connected' : 'none'}</div>;
}

describe('EdgeFlagsProvider', () => {
  it('renders children', () => {
    const { getByText } = render(
      <EdgeFlagsProvider token="tok" baseUrl="http://localhost">
        <div>hello</div>
      </EdgeFlagsProvider>,
    );
    expect(getByText('hello')).toBeTruthy();
  });

  it('provides client via context when using external client', () => {
    const client = createMockClient({ flags: { a: true } });

    const { getByTestId } = render(
      <EdgeFlagsProvider client={client}>
        <ClientStatus />
      </EdgeFlagsProvider>,
    );
    expect(getByTestId('status').textContent).toBe('connected');
  });

  it('provides client from token/baseUrl props', () => {
    const { getByTestId } = render(
      <EdgeFlagsProvider token="tok" baseUrl="http://localhost">
        <ClientStatus />
      </EdgeFlagsProvider>,
    );
    expect(getByTestId('status').textContent).toBe('connected');
  });

  it('does not destroy external client on unmount', () => {
    const client = createMockClient({ flags: { a: true } });
    const { unmount } = render(
      <EdgeFlagsProvider client={client}>
        <div />
      </EdgeFlagsProvider>,
    );
    unmount();
    // external client should still work
    expect(client.flag('a')).toBe(true);
    expect(client.isReady).toBe(true);
  });
});
