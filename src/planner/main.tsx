import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

declare global {
  interface Window {
    __CLERK_AUTHENTICATED__?: boolean;
  }
}

function mountPlanner() {
  const rootEl = document.getElementById('root');
  if (!rootEl || rootEl.dataset.mounted === 'true') return;
  rootEl.dataset.mounted = 'true';

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

if (window.__CLERK_AUTHENTICATED__) {
  mountPlanner();
} else {
  window.addEventListener('clerk:authenticated', mountPlanner, { once: true });
}
