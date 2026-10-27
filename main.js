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

function isProtectedSubdomain(url) {
  return (
    url.hostname === 'savia.sangreylirios.space' ||
    url.hostname.startsWith('savia.') ||
    url.searchParams.get('subdomain') === 'savia'
  );
}

function withSubdomainParam(path, url) {
  if (url.searchParams.get('subdomain') === 'savia' && !url.hostname.startsWith('savia.')) {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}subdomain=savia`;
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
      <h1 class="splash-title">sangre y lirios</h1>
      ${
        showButtons
          ? `<div class="splash-actions">
               <a href="${vrHref}" class="splash-btn">VR</a>
               <a href="${plannerHref}" class="splash-btn">PLANNER</a>
             </div>`
          : ''
      }
    </main>
  `;
}

async function init() {
  const url = new URL(window.location.href);
  const isVrPage = url.pathname.includes('vr');
  const isPlannerPage = url.pathname.includes('planner');
  const isProtectedAppPage = isVrPage || isPlannerPage;
  const isSplashPage = url.pathname === '/' || url.pathname.endsWith('index.html');
  const onProtectedSubdomain = isProtectedSubdomain(url);

  // Public domain (sangreylirios.space): only the title splash is public; VR & Planner are restricted to savia.*
  if (!onProtectedSubdomain) {
    if (isProtectedAppPage) {
      window.location.replace('/');
      return;
    }
    renderSplash({ showButtons: false, url });
    return;
  }

  // Protected subdomain (savia.sangreylirios.space): require Clerk auth
  const clerk = new Clerk(publishableKey);

  // 1. Let Clerk complete its handshake and process ?__clerk_* URL parameters
  await clerk.load({ ui });

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
      window.location.replace(rootHref);
      return;
    }

    // Mount waitlist / sign-in component on protected subdomain root before showing protected splash
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.innerHTML = `
        <div id="waitlist"></div>
      `;
      const waitlistDiv = document.getElementById('waitlist');
      if (waitlistDiv) {
        clerk.mountWaitlist(waitlistDiv, {
          afterSignInUrl: rootHref,
          afterSignUpUrl: rootHref,
        });
      }
    }
  }
}

init();
