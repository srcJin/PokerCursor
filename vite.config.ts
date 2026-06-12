import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const cryptoShim = path.resolve(rootDir, 'src/shims/crypto.ts');

/** poker-ts uses Node crypto.randomInt — patch for browser hackathon build. */
function pokerTsBrowserFix(): Plugin {
  return {
    name: 'poker-ts-browser-fix',
    transform(code, id) {
      if (!id.includes('poker-ts') || !code.includes('randomInt')) {
        return null;
      }

      return code
        .replace(/var crypto_1 = require\("crypto"\);?\n?/g, '')
        .replace(/crypto_1\.randomInt\(([^)]+)\)/g, 'Math.floor(Math.random() * ($1))');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  plugins: [
    react(),
    pokerTsBrowserFix(),
    nodePolyfills({
      include: ['assert'],
      overrides: {
        crypto: cryptoShim,
      },
    }),
  ],
  resolve: {
    alias: {
      crypto: cryptoShim,
    },
  },
  optimizeDeps: {
    include: ['poker-ts/dist/facade/poker.js'],
    rolldownOptions: {
      resolve: {
        alias: {
          crypto: cryptoShim,
        },
      },
    },
  },
});
