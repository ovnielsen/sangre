import { SplashView } from '../views/SplashView.tsx';

export interface PublicSplashPageProps {
  url: URL;
}

export function PublicSplashPage({ url }: PublicSplashPageProps) {
  return <SplashView url={url} showButtons={false} />;
}
