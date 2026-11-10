const DEV_FALLBACK_KEY = 'pk_test_Y29tcGxldGUta29kaWFrLTY5MDEuY2xlcmsuYWNjb3VudHMuZGV2JA';

export const SUBDOMAINS = {
  PROTECTED: 'savia',
  SHOWCASE: 'horoscopo',
} as const;

export const AUTH_REDIRECT_STORAGE_KEY = 'auth_redirect_count';
export const MAX_AUTH_REDIRECTS = 3;

export function isLocalhostHost(hostname: string = window.location.hostname): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.')
  );
}

/**
 * Prevent Clerk "origin_invalid" on localhost if .env (pk_live_) was loaded instead of .env.dev (pk_test_)
 */
export function getClerkPublishableKey(): string {
  const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  if (isLocalhostHost() && envKey?.startsWith('pk_live_')) {
    return DEV_FALLBACK_KEY;
  }
  return envKey || DEV_FALLBACK_KEY;
}
