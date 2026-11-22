import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// API_TARGET lets a second copy run against another API port (e.g. tests on :8795).
const backend = process.env.API_TARGET || 'http://localhost:8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/uploads': { target: backend, changeOrigin: true },
      '/l/': { target: backend, changeOrigin: true },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/uploads': { target: backend, changeOrigin: true },
      '/l/': { target: backend, changeOrigin: true },
    },
  },
  // The manifest lets scripts/sc-budget.mjs measure what the Goods route loads (slice 9 budget).
  build: { target: 'es2022', chunkSizeWarningLimit: 1600, manifest: true },
});
