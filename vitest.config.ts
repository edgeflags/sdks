import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'sdk',
          root: 'packages/sdk',
          include: ['__tests__/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'react',
          root: 'packages/react',
          include: ['__tests__/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
