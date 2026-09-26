import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /* See tests/stubs/server-only.ts. The real package throws on import
         outside React's `react-server` condition, which vitest never sets,
         so any test reaching a server-only module died on import. The
         boundary is still enforced by `next build` and by
         tests/server-only-boundary.test.ts, neither of which this affects. */
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
});
