import { SPLASH_CONTENT } from '../data/shellData.ts';

export interface SplashHeroProps {
  showButtons?: boolean;
  vrHref: string;
  plannerHref: string;
}

export function SplashHero({ showButtons = false, vrHref, plannerHref }: SplashHeroProps) {
  return (
    <>
    <main className="splash-hero">
      {SPLASH_CONTENT.titleLines.map((line) => (
        <h1 key={line} className="splash-title">
          {line}
        </h1>
      ))}

      {showButtons && (
        <div className="splash-actions">
          <a href={vrHref} className="splash-btn">
            {SPLASH_CONTENT.vrButtonLabel}
          </a>
          <a href={plannerHref} className="splash-btn">
            {SPLASH_CONTENT.plannerButtonLabel}
          </a>
        </div>
      )}
    </main>
    </>
  );
}
