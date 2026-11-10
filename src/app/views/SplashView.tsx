import ShaderBg from '../components/ShaderBg.tsx';
import { SplashFooter } from '../components/SplashFooter.tsx';
import { SplashHero } from '../components/SplashHero.tsx';
import { useRouteNavigation } from '../hooks/useRouteNavigation.ts';

export interface SplashViewProps {
  url: URL;
  showButtons?: boolean;
}

export function SplashView({ url, showButtons = false }: SplashViewProps) {
  const { vrHref, plannerHref } = useRouteNavigation(url, false);

  return (
    <>
      <ShaderBg/>
      <SplashHero showButtons={showButtons} vrHref={vrHref} plannerHref={plannerHref} />
      <SplashFooter />
    </>
  );
}
