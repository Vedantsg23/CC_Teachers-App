import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initPwa } from './app/pwa';
import './index.css';

initPwa();

const EXPECTED = new Set(['AccessError', 'NotFoundError']);

createRoot(document.getElementById('root')!, {
  // Access-denied / not-found are expected (e.g. another class's link) and are
  // shown to the teacher by the page's error boundary — don't log them.
  onCaughtError(error, info) {
    if (error instanceof Error && EXPECTED.has(error.name)) return;
    console.error(error, info.componentStack);
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
