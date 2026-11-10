import type { Clerk } from '@clerk/clerk-js';
import { NAV_LABELS } from '../data/shellData.ts';
import { useClerkUserButtonMount } from '../hooks/useClerkMount.ts';

export interface TopNavLinkItem {
  href: string;
  label: string;
}

export interface TopNavBarProps {
  homeHref?: string;
  secondaryLink?: TopNavLinkItem;
  clerk?: Clerk;
}

export function TopNavBar({ homeHref, secondaryLink, clerk }: TopNavBarProps) {
  const userButtonRef = useClerkUserButtonMount(clerk);

  return (
    <div id="top-nav-bar">
      {homeHref && (
        <a href={homeHref} className="nav-mode-link">
          {NAV_LABELS.home}
        </a>
      )}
      {secondaryLink && (
        <a href={secondaryLink.href} className="nav-mode-link">
          {secondaryLink.label}
        </a>
      )}
      {clerk && <div id="user-button" ref={userButtonRef} />}
    </div>
  );
}
