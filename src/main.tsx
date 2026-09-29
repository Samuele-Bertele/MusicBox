import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

/*
 * Without this the browser treats IndexedDB as "best effort" and may evict the
 * whole library when the device runs low on space. Granted silently once the
 * app is installed or used regularly; harmless when refused.
 */
void navigator.storage?.persist?.().catch(() => undefined);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the app works fine without offline support */
    });
  });
}
