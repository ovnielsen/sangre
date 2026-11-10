export interface SplashContentData {
  titleLines: readonly string[];
  vrButtonLabel: string;
  plannerButtonLabel: string;
  footerText: string;
}

export interface NavLabelsData {
  home: string;
  vrTour: string;
  plantPlanner: string;
}

export interface SessionErrorContentData {
  heading: string;
  description: string;
  retryLabel: string;
  retryHref: string;
}

export const SPLASH_CONTENT: SplashContentData = {
  titleLines: ['Sangre', 'y', 'Lirios'],
  vrButtonLabel: 'VR',
  plannerButtonLabel: 'PLANNER',
  footerText: 'A project by Miu Horemans & Ofelia © 2026 ',
};

export const NAV_LABELS: NavLabelsData = {
  home: 'HOME',
  vrTour: 'VR TOUR',
  plantPlanner: '3D PLANT PLANNER',
};

export const SESSION_ERROR_CONTENT: SessionErrorContentData = {
  heading: 'Session synchronization failed',
  description:
    "Your browser blocked Clerk's cookies on this domain or the preview iframe is active.",
  retryLabel: 'Retry on root page',
  retryHref: '/',
};
