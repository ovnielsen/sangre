import { useMemo } from 'react';
import { NAV_LABELS } from '../data/shellData.ts';
import { getMainHomeUrl, withSubdomainParam } from '../routing/urlRouter.ts';

export interface RouteNavigationLinks {
  rootHref: string;
  mainHomeHref: string;
  vrHref: string;
  plannerHref: string;
  switchHref: string;
  switchLabel: string;
}

export function useRouteNavigation(url: URL, isPlannerPage: boolean): RouteNavigationLinks {
  return useMemo(() => {
    const rootHref = withSubdomainParam('/', url);
    const mainHomeHref = getMainHomeUrl(url);
    const vrHref = withSubdomainParam('/vr.html', url);
    const plannerHref = withSubdomainParam('/planner.html', url);
    const switchHref = isPlannerPage ? vrHref : plannerHref;
    const switchLabel = isPlannerPage ? NAV_LABELS.vrTour : NAV_LABELS.plantPlanner;

    return {
      rootHref,
      mainHomeHref,
      vrHref,
      plannerHref,
      switchHref,
      switchLabel,
    };
  }, [url, isPlannerPage]);
}
