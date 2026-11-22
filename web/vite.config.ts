import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// API_TARGET lets a second copy run against another API port (e.g. tests on :8795).
const backend = process.env.API_TARGET || 'http://localhost:8787';

// Offline cold start: after the build, write the build id and the files to precache into dist/sw.js (copied from
// web/public/sw.js). Precached: the entry chunk with its imports and CSS, and every lazy screen chunk; language
// overlays (src/locales/*) and the call SDK (node_modules) are left to the worker's cache-on-first-use.
function swManifest(): Plugin {
  let outDir = 'dist';
  let files: string[] = [];
  return {
    name: 'sw-manifest',
    apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    generateBundle(_opts, bundle) {
      files = Object.values(bundle)
        .filter((f) => f.fileName.startsWith('assets/') && !f.fileName.endsWith('.map'))
        .filter((f) => !(f.type === 'chunk' && f.facadeModuleId && /[\\/](locales|node_modules)[\\/]/.test(f.facadeModuleId)))
        .map((f) => '/' + f.fileName)
        .sort();
    },
    closeBundle() {
      const sw = path.join(outDir, 'sw.js');
      if (!fs.existsSync(sw)) return;
      const index = path.join(outDir, 'index.html');
      const html = fs.existsSync(index) ? fs.readFileSync(index, 'utf8') : '';
      const build = crypto.createHash('sha1').update(files.join('\n') + html).digest('hex').slice(0, 12);
      const line = `self.__SW_BUILD__ = ${JSON.stringify(build)};\nself.__SW_PRECACHE__ = ${JSON.stringify(files)};`;
      fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace('/*__SW_MANIFEST__*/', line));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), swManifest()],
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
