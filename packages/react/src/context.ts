import { createContext } from 'react';
import type { EdgeFlags } from '@edgeflags/sdk';

export interface EdgeFlagsContextValue {
  client: EdgeFlags | null;
  version: number;
}

export const EdgeFlagsContext = createContext<EdgeFlagsContextValue>({
  client: null,
  version: 0,
});
