// main.js
import { Clerk } from '@clerk/clerk-js';
import { ui } from '@clerk/ui';

const DEV_FALLBACK_KEY = 'pk_test_Y29tcGxldGUta29kaWFrLTY5MDEuY2xlcmsuYWNjb3VudHMuZGV2JA';
const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname.endsWith('.localhost') ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.');

// Prevent Clerk "origin_invalid" on localhost if .env (pk_live_) was loaded instead of .env.dev (pk_test_)
const publishableKey =
  isLocalhost && envKey?.startsWith('pk_live_') ? DEV_FALLBACK_KEY : envKey;

function isIpHostname(hostname) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith('[');
}

function getSaviaOrigin(url) {
  if (url.hostname.startsWith('savia.') || isIpHostname(url.hostname)) {
    return url.origin;
  }
  const portPart = url.port ? `:${url.port}` : '';
  return `${url.protocol}//savia.${url.hostname}${portPart}`;
}

function getSaviaUrl(path, url) {
  const saviaOrigin = getSaviaOrigin(url);
  const target = new URL(path, saviaOrigin);
  if (!target.hostname.startsWith('savia.')) {
    target.searchParams.set('subdomain', 'savia');
  } else {
    target.searchParams.delete('subdomain');
  }
  return target.toString();
}

function hasClerkSearchParams(url) {
  for (const key of url.searchParams.keys()) {
    if (key.startsWith('__clerk_')) {
      return true;
    }
  }
  return false;
}

function isProtectedSubdomain(url) {
  return (
    url.hostname === 'savia.sangreylirios.space' ||
    url.hostname.startsWith('savia.') ||
    url.searchParams.get('subdomain') === 'savia'
  );
}

function isShowcaseSubdomain(url) {
  return (
    url.hostname === 'horoscopo.sangreylirios.space' ||
    url.hostname.startsWith('horoscopo.') ||
    url.searchParams.get('subdomain') === 'horoscopo'
  );
}

function withSubdomainParam(path, url) {
  const subdomainParam = url.searchParams.get('subdomain');
  if (
    (subdomainParam === 'savia' && !url.hostname.startsWith('savia.')) ||
    (subdomainParam === 'horoscopo' && !url.hostname.startsWith('horoscopo.'))
  ) {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}subdomain=${subdomainParam}`;
  }
  return path;
}

function renderSplash({ showButtons = false, url }) {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  const vrHref = withSubdomainParam('/vr.html', url);
  const plannerHref = withSubdomainParam('/planner.html', url);

  appEl.innerHTML = `
    <main class="splash-hero">
      <h1 class="splash-title">Sangre</h1>
      <h1 class="splash-title">y</h1>
      <h1 class="splash-title">Lirios</h1>

      ${
        showButtons
          ? `<div class="splash-actions">
               <a href="${vrHref}" class="splash-btn">VR</a>
               <a href="${plannerHref}" class="splash-btn">PLANNER</a>
             </div>`
          : ''
      }
    </main>
    <footer class="splash-footer">
      <p>A project from Miu Horemans & Ofelia © 2026 </p>
    </footer>
  `;
}

async function init() {
  const url = new URL(window.location.href);
  const isVrPage = url.pathname.includes('vr');
  const isPlannerPage = url.pathname.includes('planner');
  const isProtectedAppPage = isVrPage || isPlannerPage;
  const isSplashPage = url.pathname === '/' || url.pathname.endsWith('index.html');
  const onProtectedSubdomain = isProtectedSubdomain(url);
  const onShowcaseSubdomain = isShowcaseSubdomain(url);

  // Public showcase subdomain (horoscopo.sangreylirios.space): read-only planner without Clerk auth
  if (onShowcaseSubdomain) {
    if (!isPlannerPage) {
      window.location.replace(withSubdomainParam('/planner.html', url));
      return;
    }
    window.__SHOWCASE_MODE__ = true;
    window.__CLERK_AUTHENTICATED__ = true;
    window.dispatchEvent(new CustomEvent('clerk:authenticated'));
    return;
  }

  const saviaOrigin = getSaviaOrigin(url);
  const saviaRootHref = getSaviaUrl('/', url);
  const clerkRedirectOptions = {
    signInForceRedirectUrl: saviaRootHref,
    signInFallbackRedirectUrl: saviaRootHref,
    signUpForceRedirectUrl: saviaRootHref,
    signUpFallbackRedirectUrl: saviaRootHref,
  };

  // Public domain (sangreylirios.space): only the title splash is public; VR & Planner are restricted to savia.*
  if (!onProtectedSubdomain) {
    // If Clerk redirected back to the root domain with __clerk_* ticket/handshake params, forward to savia.*
    if (hasClerkSearchParams(url)) {
      window.location.replace(getSaviaUrl(`${url.pathname}${url.search}${url.hash}`, url));
      return;
    }
    if (isProtectedAppPage) {
      window.location.replace('/');
      return;
    }
    renderSplash({ showButtons: false, url });

    // If signup/auth just completed on Clerk Account Portal and redirected to the apex domain, redirect to savia.*
    if (
      document.cookie.includes('__session') ||
      document.cookie.includes('__client_uat') ||
      document.referrer.includes('accounts.') ||
      document.referrer.includes('clerk.')
    ) {
      const publicClerk = new Clerk(publishableKey);
      await publicClerk.load({
        ui,
        ...clerkRedirectOptions,
        afterSignOutUrl: saviaRootHref,
        allowedRedirectOrigins: [window.location.origin, saviaOrigin],
      });
      if (publicClerk.user) {
        window.location.replace(saviaRootHref);
      }
    }
    return;
  }

  // Protected subdomain (savia.sangreylirios.space): require Clerk auth
  const clerk = new Clerk(publishableKey);

  // 1. Let Clerk complete its handshake and process ?__clerk_* URL parameters
  await clerk.load({
    ui,
    ...clerkRedirectOptions,
    afterSignOutUrl: saviaRootHref,
    allowedRedirectOrigins: [window.location.origin, saviaOrigin],
  });

  // Clean Clerk's temporary handshake query params from the address bar without reloading
  if (url.searchParams.has('__clerk_db_jwt') || url.searchParams.has('__clerk_synced')) {
    url.searchParams.delete('__clerk_db_jwt');
    url.searchParams.delete('__clerk_synced');
    const cleanSearch = url.searchParams.toString();
    window.history.replaceState({}, '', url.pathname + (cleanSearch ? `?${cleanSearch}` : ''));
  }

  // 2. Loop prevention guard (stops crashes if cookies are blocked)
  const redirectCount = parseInt(sessionStorage.getItem('auth_redirect_count') || '0', 10);
  if (redirectCount > 3) {
    sessionStorage.removeItem('auth_redirect_count');
    document.body.innerHTML = `
      <div style="font-family: sans-serif; padding: 2rem; max-width: 500px; margin: auto;">
        <h2>Session synchronization failed</h2>
        <p>Your browser blocked Clerk's cookies on this domain or the preview iframe is active.</p>
        <p><a href="/" onclick="sessionStorage.clear()">Retry on root page</a></p>
      </div>
    `;
    return;
  }

  const rootHref = withSubdomainParam('/', url);

  // 3. Routing logic on protected subdomain
  if (clerk.user) {
    sessionStorage.removeItem('auth_redirect_count');

    // Ensure authenticated users on ?subdomain=savia are redirected onto the savia.* hostname
    if (!url.hostname.startsWith('savia.') && !isIpHostname(url.hostname)) {
      window.location.replace(getSaviaUrl(`${url.pathname}${url.search}${url.hash}`, url));
      return;
    }

    // Signal to the React Three Fiber planner page that Clerk authentication succeeded and pass Clerk user identity
    window.__CLERK_USER__ = {
      id: clerk.user.id,
      displayName:
        clerk.user.fullName ||
        clerk.user.username ||
        clerk.user.primaryEmailAddress?.emailAddress ||
        clerk.user.id,
    };
    window.__CLERK_AUTHENTICATED__ = true;
    window.dispatchEvent(new CustomEvent('clerk:authenticated'));

    if (isSplashPage) {
      renderSplash({ showButtons: true, url });
    }

    // Mount navigation switcher + Clerk user profile/logout controls on protected pages
    const navEl = document.getElementById('nav');
    if (navEl) {
      if (isProtectedAppPage) {
        const switchHref = withSubdomainParam(isPlannerPage ? '/vr.html' : '/planner.html', url);
        const switchLabel = isPlannerPage ? 'VR TOUR' : '3D PLANT PLANNER';
        navEl.innerHTML = `
          <div id="top-nav-bar">
            <a href="${rootHref}" class="nav-mode-link">HOME</a>
            <a href="${switchHref}" class="nav-mode-link">${switchLabel}</a>
            <div id="user-button"></div>
          </div>
        `;
      } else {
        navEl.innerHTML = `
          <div id="top-nav-bar">
            <div id="user-button"></div>
          </div>
        `;
      }
      const userBtn = document.getElementById('user-button');
      if (userBtn) {
        clerk.mountUserButton(userBtn);
      }
    }
  } else {
    if (isProtectedAppPage) {
      sessionStorage.setItem('auth_redirect_count', String(redirectCount + 1));
      window.location.replace(saviaRootHref);
      return;
    }

    // Mount sign-up (when completing waitlist ticket/invitation) or waitlist component on protected subdomain root
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.innerHTML = `
        <div id="waitlist"></div>
      `;
      const waitlistDiv = document.getElementById('waitlist');
      if (waitlistDiv) {
        const hasInviteTicket =
          url.searchParams.has('__clerk_ticket') ||
          url.searchParams.has('__clerk_invitation_token');

        if (hasInviteTicket) {
          clerk.mountSignUp(waitlistDiv, {
            ...clerkRedirectOptions,
          });
        } else {
          const signInUrl = clerk.buildSignInUrl({
            redirectUrl: saviaRootHref,
            ...clerkRedirectOptions,
          });
          clerk.mountWaitlist(waitlistDiv, {
            afterJoinWaitlistUrl: saviaRootHref,
            signInUrl,
          });
        }
      }
    }
  }
}

init();
