import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SessionSyncErrorView } from '../views/SessionSyncErrorView.tsx';

const mountedRoots = new WeakMap<Element, Root>();

function mountReactElement(containerId: string, element: ReactNode): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  let root = mountedRoots.get(container);
  if (!root) {
    root = createRoot(container);
    mountedRoots.set(container, root);
  }
  root.render(element);
}

export function renderAppRegion(element: ReactNode): void {
  mountReactElement('app', element);
}

export function renderNavRegion(element: ReactNode): void {
  mountReactElement('nav', element);
}

export function renderSessionSyncErrorPage(): void {
  let root = mountedRoots.get(document.body);
  if (!root) {
    document.body.innerHTML = '<div id="session-sync-error-root"></div>';
    const errorEl = document.getElementById('session-sync-error-root');
    if (!errorEl) return;
    root = createRoot(errorEl);
    mountedRoots.set(document.body, root);
  }
  root.render(<SessionSyncErrorView />);
}
