import type { Clerk } from '@clerk/clerk-js';
import type { ClerkRedirectOptions } from '../auth/clerkService.ts';
import { useClerkUnauthenticatedMount } from '../hooks/useClerkMount.ts';

export interface WaitlistViewProps {
  clerk: Clerk;
  url: URL;
  saviaRootHref: string;
  redirectOptions: ClerkRedirectOptions;
}

export function WaitlistView({
  clerk,
  url,
  saviaRootHref,
  redirectOptions,
}: WaitlistViewProps) {
  const waitlistRef = useClerkUnauthenticatedMount(
    clerk,
    url,
    saviaRootHref,
    redirectOptions
  );

  return <div id="waitlist" ref={waitlistRef} />;
}
