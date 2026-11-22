import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { startOffline } from './lib/offline';

startOffline();

// Offline cold start: the service worker (web/public/sw.js) caches the app shell, production builds only. In dev
// (vite on :5173, which `vite preview` also uses) any worker left over from a preview is removed so it can't serve a
// stale shell.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => reg.active?.postMessage({ type: 'cc-warm', lang: document.documentElement.lang, urls: performance.getEntriesByType('resource').map((e) => e.name) }))
        .catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
