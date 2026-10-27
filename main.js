// main.js
import { Clerk } from '@clerk/clerk-js';
import { ui } from '@clerk/ui';

const DEV_FALLBACK_KEY = 'pk_test_Y29tcGxldGUta29kaWFrLTY5MDEuY2xlcmsuYWNjb3VudHMuZGV2JA';
const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.');

// Prevent Clerk "origin_invalid" on localhost if .env (pk_live_) was loaded instead of .env.dev (pk_test_)
const publishableKey =
  isLocalhost && envKey?.startsWith('pk_live_') ? DEV_FALLBACK_KEY : envKey;

const clerk = new Clerk(publishableKey);

async function init() {
  // 1. Let Clerk complete its handshake and process ?__clerk_* URL parameters
  await clerk.load({ ui });

  const url = new URL(window.location.href);
  const isVrPage = url.pathname.includes('vr');
  const isPlannerPage = url.pathname.includes('planner');
  const isProtectedPage = isVrPage || isPlannerPage;
  const isLoginPage = url.pathname === '/' || url.pathname.endsWith('index.html');

  // Clean Clerk's temporary handshake query params from the address bar without reloading
  if (url.searchParams.has('__clerk_db_jwt') || url.searchParams.has('__clerk_synced')) {
    url.searchParams.delete('__clerk_db_jwt');
    url.searchParams.delete('__clerk_synced');
    window.history.replaceState({}, '', url.pathname + url.search);
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

  // 3. Routing logic
  if (clerk.user) {
    sessionStorage.removeItem('auth_redirect_count');

    if (isLoginPage) {
      sessionStorage.setItem('auth_redirect_count', String(redirectCount + 1));
      window.location.replace('/vr.html');
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

    // Mount navigation switcher + Clerk user profile/logout controls on protected pages
    const navEl = document.getElementById('nav');
    if (navEl) {
      const switchHref = isPlannerPage ? '/vr.html' : '/planner.html';
      const switchLabel = isPlannerPage ? 'VR TOUR' : '3D PLANT PLANNER';
      navEl.innerHTML = `
        <div id="top-nav-bar">
          <a href="${switchHref}" class="nav-mode-link">${switchLabel}</a>
          <div id="user-button"></div>
        </div>
      `;
      const userBtn = document.getElementById('user-button');
      if (userBtn) {
        clerk.mountUserButton(userBtn);
      }
    }
  } else {
    if (isProtectedPage) {
      sessionStorage.setItem('auth_redirect_count', String(redirectCount + 1));
      window.location.replace('/');
      return;
    }

    // Mount sign-in component on login page
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.innerHTML = `
        <div id="waitlist"></div>
      `;
      const waitlistDiv = document.getElementById('waitlist');
      if (waitlistDiv) {
        clerk.mountWaitlist(waitlistDiv, {
          afterSignInUrl: '/vr.html',
          afterSignUpUrl: '/vr.html',
        });
      }
    }
  }
}

init();
