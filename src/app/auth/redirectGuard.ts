import { AUTH_REDIRECT_STORAGE_KEY, MAX_AUTH_REDIRECTS } from '../config/envConfig.ts';

export function getRedirectCount(): number {
  return parseInt(sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY) || '0', 10);
}

export function isRedirectLimitExceeded(): boolean {
  return getRedirectCount() > MAX_AUTH_REDIRECTS;
}

export function incrementRedirectCount(): void {
  const nextCount = getRedirectCount() + 1;
  sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, String(nextCount));
}

export function resetRedirectCount(): void {
  sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
}
