import { publishShowcaseSession } from '../auth/sessionBridge.ts';
import { ShowcaseShellPage } from '../pages/ShowcaseShellPage.tsx';
import { renderNavRegion } from '../pages/shellRenderer.tsx';
import { type RouteContext, withSubdomainParam } from '../routing/urlRouter.ts';

/**
 * Public showcase subdomain (horoscopo.sangreylirios.space):
 * read-only planner without Clerk auth
 */
export function handleShowcaseFlow(ctx: RouteContext): void {
  const { url, isPlannerPage } = ctx;

  if (!isPlannerPage) {
    window.location.replace(withSubdomainParam('/planner.html', url));
    return;
  }

  renderNavRegion(<ShowcaseShellPage url={url} />);
  publishShowcaseSession();
}
