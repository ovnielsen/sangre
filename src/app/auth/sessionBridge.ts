export interface AuthenticatedUserIdentity {
  id: string;
  displayName: string;
}

declare global {
  interface Window {
    __CLERK_USER__?: AuthenticatedUserIdentity;
    __CLERK_AUTHENTICATED__?: boolean;
    __SHOWCASE_MODE__?: boolean;
  }
}

export function publishShowcaseSession(): void {
  window.__SHOWCASE_MODE__ = true;
  window.__CLERK_AUTHENTICATED__ = true;
  window.dispatchEvent(new CustomEvent('clerk:authenticated'));
}

export function publishAuthenticatedUserSession(user: AuthenticatedUserIdentity): void {
  window.__CLERK_USER__ = user;
  window.__CLERK_AUTHENTICATED__ = true;
  window.dispatchEvent(new CustomEvent('clerk:authenticated'));
}
