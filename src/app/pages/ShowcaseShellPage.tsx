import { TopNavBar } from '../components/TopNavBar.tsx';
import { useRouteNavigation } from '../hooks/useRouteNavigation.ts';

export interface ShowcaseShellPageProps {
  url: URL;
}

export function ShowcaseShellPage({ url }: ShowcaseShellPageProps) {
  const { mainHomeHref } = useRouteNavigation(url, true);

  return <TopNavBar homeHref={mainHomeHref} />;
}
