import { extractUserIdentity, loadClerkInstance } from '../auth/clerkService.ts';
import {
  incrementRedirectCount,
  isRedirectLimitExceeded,
  resetRedirectCount,
} from '../auth/redirectGuard.ts';
import { publishAuthenticatedUserSession } from '../auth/sessionBridge.ts';
import { SUBDOMAINS } from '../config/envConfig.ts';
import {
  ProtectedAuthenticatedNavPage,
  ProtectedSplashPage,
  ProtectedWaitlistPage,
} from '../pages/ProtectedShellPage.tsx';
import {
  renderAppRegion,
  renderNavRegion,
  renderSessionSyncErrorPage,
} from '../pages/shellRenderer.tsx';
import {
  getSaviaUrl,
  isIpHostname,
  type RouteContext,
  stripClerkHandshakeParams,
} from '../routing/urlRouter.ts';

/**
 * Protected subdomain (savia.sangreylirios.space):
 * require Clerk auth before granting access to VR or 3D Plant Planner
 */
export async function handleProtectedFlow(ctx: RouteContext): Promise<void> {
  const { url, isProtectedAppPage, isPlannerPage, isSplashPage } = ctx;

  // 1. Let Clerk complete its handshake and process ?__clerk_* URL parameters
  const { clerk, saviaRootHref, redirectOptions } = await loadClerkInstance(url);

  // Clean Clerk's temporary handshake query params from the address bar without reloading
  stripClerkHandshakeParams(url);

  // 2. Loop prevention guard (stops crashes if cookies are blocked)
  if (isRedirectLimitExceeded()) {
    resetRedirectCount();
    renderSessionSyncErrorPage();
    return;
  }

  // 3. Routing logic on protected subdomain
  const userIdentity = extractUserIdentity(clerk);

  if (userIdentity) {
    resetRedirectCount();

    // Ensure authenticated users on ?subdomain=savia are redirected onto the savia.* hostname
    if (!url.hostname.startsWith(`${SUBDOMAINS.PROTECTED}.`) && !isIpHostname(url.hostname)) {
      window.location.replace(getSaviaUrl(`${url.pathname}${url.search}${url.hash}`, url));
      return;
    }

    // Signal to the React Three Fiber planner and VR pages that Clerk authentication succeeded
    publishAuthenticatedUserSession(userIdentity);

    if (isSplashPage) {
      renderAppRegion(<ProtectedSplashPage url={url} />);
    }

    // Mount React top navigation switcher + Clerk user profile/logout controls on protected pages
    renderNavRegion(
      <ProtectedAuthenticatedNavPage
        clerk={clerk}
        url={url}
        isProtectedAppPage={isProtectedAppPage}
        isPlannerPage={isPlannerPage}
      />
    );
    return;
  }

  if (isProtectedAppPage) {
    incrementRedirectCount();
    window.location.replace(saviaRootHref);
    return;
  }

  // Mount sign-up (when completing waitlist ticket/invitation) or waitlist page on protected subdomain root
  renderAppRegion(
    <ProtectedWaitlistPage
      clerk={clerk}
      url={url}
      saviaRootHref={saviaRootHref}
      redirectOptions={redirectOptions}
    />
  );
}
