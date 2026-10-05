import { Clerk } from '@clerk/clerk-js';
import { ui } from '@clerk/ui'

// Replace with your actual Clerk Publishable Key or inject via Vite env (VITE_CLERK_PUBLISHABLE_KEY)
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerk = new Clerk(clerkPublishableKey);

async function init() {
  await clerk.load({ui});

  const isProtectedPage = window.location.pathname.startsWith('/vr');
  const isLoginPage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');

  if (clerk.user) {
    // User is logged in
    if (isLoginPage) {
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
    // User is NOT logged in
    if (isProtectedPage) {
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

