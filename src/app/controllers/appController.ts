import { resolveRouteContext } from '../routing/urlRouter.ts';
import { handleProtectedFlow } from './protectedController.tsx';
import { handlePublicFlow } from './publicController.tsx';
import { handleShowcaseFlow } from './showcaseController.tsx';

export async function bootstrapApp(): Promise<void> {
  const ctx = resolveRouteContext(new URL(window.location.href));

  if (ctx.subdomainMode === 'showcase') {
    handleShowcaseFlow(ctx);
    return;
  }

  if (ctx.subdomainMode === 'public') {
    await handlePublicFlow(ctx);
    return;
  }

  await handleProtectedFlow(ctx);
}
