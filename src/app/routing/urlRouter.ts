import { SUBDOMAINS } from '../config/envConfig.ts';

export type SubdomainMode = 'public' | 'showcase' | 'protected';
export type PageType = 'splash' | 'vr' | 'planner' | 'other';

export interface RouteContext {
  url: URL;
  subdomainMode: SubdomainMode;
  pageType: PageType;
  isVrPage: boolean;
  isPlannerPage: boolean;
  isProtectedAppPage: boolean;
  isSplashPage: boolean;
}

export function isIpHostname(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith('[');
}

export function isWorkersDevHostname(hostname: string): boolean {
  return hostname.endsWith('.workers.dev');
}

export function isSingleHostEnvironment(hostname: string): boolean {
  return isIpHostname(hostname) || isWorkersDevHostname(hostname);
}

export function hasProtectedHostname(hostname: string): boolean {
  return (
    hostname === 'savia.sangreylirios.space' ||
    hostname.startsWith(`${SUBDOMAINS.PROTECTED}.`) ||
    hostname.includes(`.${SUBDOMAINS.PROTECTED}.`)
  );
}

export function hasShowcaseHostname(hostname: string): boolean {
  return (
    hostname === 'horoscopo.sangreylirios.space' ||
    hostname.startsWith(`${SUBDOMAINS.SHOWCASE}.`) ||
    hostname.includes(`.${SUBDOMAINS.SHOWCASE}.`)
  );
}

export function isProtectedSubdomain(url: URL): boolean {
  return (
    hasProtectedHostname(url.hostname) || url.searchParams.get('subdomain') === SUBDOMAINS.PROTECTED
  );
}

export function isShowcaseSubdomain(url: URL): boolean {
  return (
    hasShowcaseHostname(url.hostname) || url.searchParams.get('subdomain') === SUBDOMAINS.SHOWCASE
  );
}

export function resolveRouteContext(url: URL): RouteContext {
  const isVrPage = url.pathname.includes('vr');
  const isPlannerPage = url.pathname.includes('planner');
  const isProtectedAppPage = isVrPage || isPlannerPage;
  const isSplashPage = url.pathname === '/' || url.pathname.endsWith('index.html');

  let subdomainMode: SubdomainMode = 'public';
  if (isShowcaseSubdomain(url)) {
    subdomainMode = 'showcase';
  } else if (isProtectedSubdomain(url)) {
    subdomainMode = 'protected';
  }

  let pageType: PageType = 'other';
  if (isPlannerPage) {
    pageType = 'planner';
  } else if (isVrPage) {
    pageType = 'vr';
  } else if (isSplashPage) {
    pageType = 'splash';
  }

  return {
    url,
    subdomainMode,
    pageType,
    isVrPage,
    isPlannerPage,
    isProtectedAppPage,
    isSplashPage,
  };
}

export function getSaviaOrigin(url: URL): string {
  if (hasProtectedHostname(url.hostname) || isSingleHostEnvironment(url.hostname)) {
    return url.origin;
  }
  const portPart = url.port ? `:${url.port}` : '';
  const previewMatch = url.hostname.match(/^([^.]+)\.(sangreylirios\.space)$/i);
  if (previewMatch && previewMatch[1] !== SUBDOMAINS.SHOWCASE) {
    return `${url.protocol}//${previewMatch[1]}.${SUBDOMAINS.PROTECTED}.${previewMatch[2]}${portPart}`;
  }
  const baseHost = url.hostname.replace(new RegExp(`^${SUBDOMAINS.SHOWCASE}\\.`), '');
  return `${url.protocol}//${SUBDOMAINS.PROTECTED}.${baseHost}${portPart}`;
}

export function getSaviaUrl(path: string, url: URL): string {
  const saviaOrigin = getSaviaOrigin(url);
  const target = new URL(path, saviaOrigin);
  if (!hasProtectedHostname(target.hostname)) {
    target.searchParams.set('subdomain', SUBDOMAINS.PROTECTED);
  } else {
    target.searchParams.delete('subdomain');
  }
  return target.toString();
}

export function getMainHomeUrl(url: URL): string {
  if (isSingleHostEnvironment(url.hostname)) {
    return `${url.origin}/`;
  }
  const host = url.hostname
    .replace(/^(horoscopo|savia)\./, '')
    .replace(/\.(horoscopo|savia)\./, '.');
  const portPart = url.port ? `:${url.port}` : '';
  return `${url.protocol}//${host}${portPart}/`;
}

export function withSubdomainParam(path: string, url: URL): string {
  const subdomainParam = url.searchParams.get('subdomain');
  if (
    (subdomainParam === SUBDOMAINS.PROTECTED && !hasProtectedHostname(url.hostname)) ||
    (subdomainParam === SUBDOMAINS.SHOWCASE && !hasShowcaseHostname(url.hostname))
  ) {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}subdomain=${subdomainParam}`;
  }
  return path;
}

export function hasClerkSearchParams(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (key.startsWith('__clerk_')) {
      return true;
    }
  }
  return false;
}

export function hasPossibleClerkSessionIndicators(): boolean {
  return (
    document.cookie.includes('__session') ||
    document.cookie.includes('__client_uat') ||
    document.referrer.includes('accounts.') ||
    document.referrer.includes('clerk.')
  );
}

/**
 * Clean Clerk's temporary handshake query params from the address bar without reloading
 */
export function stripClerkHandshakeParams(url: URL): void {
  if (url.searchParams.has('__clerk_db_jwt') || url.searchParams.has('__clerk_synced')) {
    url.searchParams.delete('__clerk_db_jwt');
    url.searchParams.delete('__clerk_synced');
    const cleanSearch = url.searchParams.toString();
    window.history.replaceState({}, '', url.pathname + (cleanSearch ? `?${cleanSearch}` : ''));
  }
}
