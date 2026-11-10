import type { Clerk } from '@clerk/clerk-js';
import type { ClerkRedirectOptions } from '../auth/clerkService.ts';
import { TopNavBar } from '../components/TopNavBar.tsx';
import { useRouteNavigation } from '../hooks/useRouteNavigation.ts';
import { SplashView } from '../views/SplashView.tsx';
import { WaitlistView } from '../views/WaitlistView.tsx';

export interface ProtectedAuthenticatedNavPageProps {
  clerk: Clerk;
  url: URL;
  isProtectedAppPage: boolean;
  isPlannerPage: boolean;
}

export function ProtectedAuthenticatedNavPage({
  clerk,
  url,
  isProtectedAppPage,
  isPlannerPage,
}: ProtectedAuthenticatedNavPageProps) {
  const { rootHref, switchHref, switchLabel } = useRouteNavigation(url, isPlannerPage);

  if (isProtectedAppPage) {
    return (
      <TopNavBar
        homeHref={rootHref}
        secondaryLink={{ href: switchHref, label: switchLabel }}
        clerk={clerk}
      />
    );
  }

  return <TopNavBar clerk={clerk} />;
}

export interface ProtectedSplashPageProps {
  url: URL;
}

export function ProtectedSplashPage({ url }: ProtectedSplashPageProps) {
  return <SplashView url={url} showButtons={true} />;
}

export interface ProtectedWaitlistPageProps {
  clerk: Clerk;
  url: URL;
  saviaRootHref: string;
  redirectOptions: ClerkRedirectOptions;
}

export function ProtectedWaitlistPage({
  clerk,
  url,
  saviaRootHref,
  redirectOptions,
}: ProtectedWaitlistPageProps) {
  return (
    <WaitlistView
      clerk={clerk}
      url={url}
      saviaRootHref={saviaRootHref}
      redirectOptions={redirectOptions}
    />
  );
}
