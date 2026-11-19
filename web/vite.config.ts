import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const backend = 'http://localhost:8787';

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
    },
  },
  preview: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/uploads': { target: backend, changeOrigin: true },
    },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
});
