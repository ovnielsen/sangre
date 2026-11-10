import { Clerk } from '@clerk/clerk-js';
import { ui } from '@clerk/ui';
import { getClerkPublishableKey } from '../config/envConfig.ts';
import { getSaviaOrigin, getSaviaUrl } from '../routing/urlRouter.ts';
import type { AuthenticatedUserIdentity } from './sessionBridge.ts';

export interface ClerkRedirectOptions {
  signInForceRedirectUrl: string;
  signInFallbackRedirectUrl: string;
  signUpForceRedirectUrl: string;
  signUpFallbackRedirectUrl: string;
}

export interface LoadedClerkContext {
  clerk: Clerk;
  saviaOrigin: string;
  saviaRootHref: string;
  redirectOptions: ClerkRedirectOptions;
}

export function buildClerkRedirectOptions(saviaRootHref: string): ClerkRedirectOptions {
  return {
    signInForceRedirectUrl: saviaRootHref,
    signInFallbackRedirectUrl: saviaRootHref,
    signUpForceRedirectUrl: saviaRootHref,
    signUpFallbackRedirectUrl: saviaRootHref,
  };
}

export async function loadClerkInstance(url: URL): Promise<LoadedClerkContext> {
  const publishableKey = getClerkPublishableKey();
  const saviaOrigin = getSaviaOrigin(url);
  const saviaRootHref = getSaviaUrl('/', url);
  const redirectOptions = buildClerkRedirectOptions(saviaRootHref);

  const clerk = new Clerk(publishableKey);
  await clerk.load({
    ui,
    ...redirectOptions,
    afterSignOutUrl: saviaRootHref,
    allowedRedirectOrigins: [window.location.origin, saviaOrigin],
  });

  return {
    clerk,
    saviaOrigin,
    saviaRootHref,
    redirectOptions,
  };
}

export function extractUserIdentity(clerk: Clerk): AuthenticatedUserIdentity | null {
  if (!clerk.user) return null;
  return {
    id: clerk.user.id,
    displayName:
      clerk.user.fullName ||
      clerk.user.username ||
      clerk.user.primaryEmailAddress?.emailAddress ||
      clerk.user.id,
  };
}

export function mountUserProfileButton(clerk: Clerk, container: HTMLElement | null): void {
  if (!container) return;
  clerk.mountUserButton(container as HTMLDivElement);
}

export function mountUnauthenticatedEntry(
  clerk: Clerk,
  container: HTMLElement | null,
  url: URL,
  saviaRootHref: string,
  redirectOptions: ClerkRedirectOptions
): void {
  if (!container) return;

  const hasInviteTicket =
    url.searchParams.has('__clerk_ticket') || url.searchParams.has('__clerk_invitation_token');

  if (hasInviteTicket) {
    clerk.mountSignUp(container as HTMLDivElement, {
      ...redirectOptions,
    });
    return;
  }

  const signInUrl = clerk.buildSignInUrl({
    redirectUrl: saviaRootHref,
    ...redirectOptions,
  });

  clerk.mountWaitlist(container as HTMLDivElement, {
    afterJoinWaitlistUrl: saviaRootHref,
    signInUrl,
  });
}
