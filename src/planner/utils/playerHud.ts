export type HudMode =
  | 'idle'
  | 'hover'
  | 'hover-pinned'
  | 'grabbed'
  | 'wall-snap'
  | 'free';

const HUD_PROMPTS: Record<HudMode, string> = {
  idle: '',
  hover: '[E] Grab & move with object   •   [Q] Free pointer to drag',
  'hover-pinned':
    'Wall-Snapped Plant — [E / Click] Release (Fall with Gravity)   •   [Q] Free pointer',
  grabbed:
    'Holding — [E / Click] Drop (Gravity)   •   [Shift+E / Shift+Click] Snap to Wall   •   [Q] Free pointer',
  'wall-snap':
    'Wall Snap Ready — [Shift+E / Shift+Click] Snap to Wall   •   [E / Click] Drop with Gravity',
  free: 'Free Pointer Mode — Hold click & drag object   •   [Q] Lock pointer (FPS)',
};

export function updateHudState(mode: HudMode): void {
  const crosshair = document.getElementById('fps-crosshair');
  const prompt = document.getElementById('fps-prompt');

  if (crosshair) {
    crosshair.dataset.mode = mode;
  }
  if (prompt) {
    prompt.textContent = HUD_PROMPTS[mode];
  }
}

export function updateHudPinnedCount(pinnedCount: number): void {
  const crosshair = document.getElementById('fps-crosshair');
  if (crosshair) {
    crosshair.dataset.pinnedCount = String(pinnedCount);
  }
}
