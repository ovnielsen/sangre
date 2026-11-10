import type { Clerk } from '@clerk/clerk-js';
import { type RefObject, useEffect, useRef } from 'react';
import {
  type ClerkRedirectOptions,
  mountUnauthenticatedEntry,
  mountUserProfileButton,
} from '../auth/clerkService.ts';

export function useClerkUserButtonMount(clerk?: Clerk): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!clerk || !containerRef.current) return;
    mountUserProfileButton(clerk, containerRef.current);
  }, [clerk]);

  return containerRef;
}

export function useClerkUnauthenticatedMount(
  clerk: Clerk,
  url: URL,
  saviaRootHref: string,
  redirectOptions: ClerkRedirectOptions
): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    mountUnauthenticatedEntry(clerk, containerRef.current, url, saviaRootHref, redirectOptions);
  }, [clerk, url, saviaRootHref, redirectOptions]);

  return containerRef;
}
