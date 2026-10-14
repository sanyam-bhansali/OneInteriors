import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

/* Tests import a few pure files from the Expo app (mobile/src: strings, types).
   Vite would look up mobile/tsconfig.json for them, which extends
   `expo/tsconfig.base` — a package CI never installs (it installs the web app
   only), so those suites failed to load on CI. Handing esbuild the web app's
   own compiler options as a string makes it use them for every file and skip
   the per-folder lookup. */
const rootTsconfig = JSON.parse(readFileSync(new URL('./tsconfig.json', import.meta.url), 'utf8')) as { compilerOptions?: Record<string, unknown> };

export default defineConfig({
  esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: rootTsconfig.compilerOptions ?? {} }) },
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
