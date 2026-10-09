import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

const here = import.meta.dirname;

/**
 * Single-file build: the whole calculator as one self-contained HTML file
 * (no server needed). Next.js routing is replaced by a small in-memory router.
 * Build with `npm run build:single` → dist-single/index.html
 */
export default defineConfig({
  root: here,
  base: './',
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  resolve: {
    alias: [
      { find: 'next/link', replacement: path.resolve(here, 'shims/next-link.tsx') },
      { find: 'next/navigation', replacement: path.resolve(here, 'shims/next-navigation.ts') },
      { find: '@', replacement: path.resolve(here, '../src') },
    ],
  },
  build: {
    outDir: path.resolve(here, '../dist-single'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000,
    reportCompressedSize: false,
  },
  logLevel: 'warn',
});
