import { loadClerkInstance } from '../auth/clerkService.ts';
import { PublicSplashPage } from '../pages/PublicSplashPage.tsx';
import { renderAppRegion } from '../pages/shellRenderer.tsx';
import {
  getSaviaUrl,
  hasClerkSearchParams,
  hasPossibleClerkSessionIndicators,
  type RouteContext,
} from '../routing/urlRouter.ts';

/**
 * Public domain (sangreylirios.space):
 * only the title splash is public; VR & Planner are restricted to savia.*
 */
export async function handlePublicFlow(ctx: RouteContext): Promise<void> {
  const { url, isProtectedAppPage } = ctx;

  // If Clerk redirected back to the root domain with __clerk_* ticket/handshake params, forward to savia.*
  if (hasClerkSearchParams(url)) {
    window.location.replace(getSaviaUrl(`${url.pathname}${url.search}${url.hash}`, url));
    return;
  }

  if (isProtectedAppPage) {
    window.location.replace('/');
    return;
  }

  renderAppRegion(<PublicSplashPage url={url} />);

  // If signup/auth just completed on Clerk Account Portal and redirected to the apex domain, redirect to savia.*
  if (hasPossibleClerkSessionIndicators()) {
    const { clerk, saviaRootHref } = await loadClerkInstance(url);
    if (clerk.user) {
      window.location.replace(saviaRootHref);
    }
  }
}
