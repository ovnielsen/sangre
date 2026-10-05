// main.js
import { Clerk } from '@clerk/clerk-js';
import {ui} from '@clerk/ui';

const clerk = new Clerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

async function init() {
  // 1. Let Clerk complete its handshake and process ?__clerk_* URL parameters
  await clerk.load({ui});

  const url = new URL(window.location.href);
  const isProtectedPage = url.pathname.includes('vr');
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

    // Mount user profile/logout controls on protected page
    document.getElementById('app').innerHTML = `
        <div id="user-button"></div>
      `
    const userBtn = document.getElementById('user-button');
    if (userBtn) {
      clerk.mountUserButton(userBtn);
    }
  } else {
    if (isProtectedPage) {
      sessionStorage.setItem('auth_redirect_count', String(redirectCount + 1));
      window.location.replace('/');
      return;
    }

    // Mount sign-in component on login page
      document.getElementById('app').innerHTML = `
        <div id="waitlist"></div>
      `
    const waitlistDiv = document.getElementById('waitlist');
    if (waitlistDiv) {
      clerk.mountWaitlist(waitlistDiv, {
        afterSignInUrl: '/vr.html',
        afterSignUpUrl: '/vr.html',
      });
    }
  }
}

init();