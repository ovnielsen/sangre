import { SPLASH_CONTENT } from '../data/shellData.ts';

export function SplashFooter() {
  return (
    <footer className="splash-footer">
      <p>{SPLASH_CONTENT.footerText}</p>
    </footer>
  );
}
