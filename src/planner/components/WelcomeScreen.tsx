import { useEffect } from 'react';
import { useGlbLoadingProgress } from '../hooks/useProtectedGLTF.ts';

export interface WelcomeScreenProps {
  isOpen: boolean;
  isSceneReady: boolean;
  readOnly?: boolean;
  onEnter: () => void;
}

export function WelcomeScreen({
  isOpen,
  isSceneReady,
  readOnly = false,
  onEnter,
}: WelcomeScreenProps) {
  const loadingProgress = useGlbLoadingProgress(isSceneReady);

  useEffect(() => {
    if (!isOpen || !isSceneReady) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Escape') {
        event.preventDefault();
        onEnter();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSceneReady, onEnter]);

  if (!isOpen) return null;

  return (
    <div
      className="cs-buy-overlay cs-welcome-overlay"
      data-testid="welcome-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome & Controls Guide"
    >
      <div className="cs-buy-window cs-welcome-window">
        <header className="cs-buy-header">
          <div className="cs-buy-title">
            <span className="cs-buy-icon">❖</span>
            <span>3D PLANT PLANNER // CONTROLS & INSTRUCTIONS</span>
          </div>
          <div className="cs-buy-subtitle">
            {isSceneReady ? 'SCENE READY // 100%' : `LOADING SCENE... ${loadingProgress}%`}
          </div>
        </header>

        <div className="cs-welcome-body">
          <div className="cs-controls-grid">
            <section className="cs-control-card">
              <div className="cs-section-label">MOVEMENT & CAMERA</div>
              <div className="cs-control-list">
                <div className="cs-control-row">
                  <span className="cs-key-badge">W A S D / ARROWS</span>
                  <span className="cs-control-desc">Walk & strafe around the building</span>
                </div>
                <div className="cs-control-row">
                  <span className="cs-key-badge">SPACE</span>
                  <span className="cs-control-desc">Jump</span>
                </div>
                <div className="cs-control-row">
                  <span className="cs-key-badge">MOUSE</span>
                  <span className="cs-control-desc">360° camera look (click scene to lock)</span>
                </div>
                <div className="cs-control-row">
                  <span className="cs-key-badge">{readOnly ? 'ESC' : 'Q / ESC'}</span>
                  <span className="cs-control-desc">Release / toggle free mouse cursor</span>
                </div>
                {readOnly && (
                  <>
                    <div className="cs-control-row">
                      <span className="cs-key-badge">P</span>
                      <span className="cs-control-desc">
                        Toggle Pencil Draft (Toon + Sketch Outline) building style
                      </span>
                    </div>
                    <div className="cs-control-row">
                      <span className="cs-key-badge">H</span>
                      <span className="cs-control-desc">Reopen this controls guide anytime</span>
                    </div>
                  </>
                )}
              </div>
            </section>

            {!readOnly && (
              <>
                <section className="cs-control-card">
                  <div className="cs-section-label">PLANT POSITION</div>
                  <div className="cs-control-list">
                    <div className="cs-control-row">
                      <span className="cs-key-badge">B / TAB</span>
                      <span className="cs-control-desc">Open Plant Buy Menu (keys 1–7 to select)</span>
                    </div>
                    <div className="cs-control-row">
                      <span className="cs-key-badge">E / CLICK</span>
                      <span className="cs-control-desc">Grab hovered plant or drop with gravity</span>
                    </div>
                    <div className="cs-control-row">
                      <span className="cs-key-badge">SHIFT + E / CLICK</span>
                      <span className="cs-control-desc">Pin & snap held plant onto a wall</span>
                    </div>
                  </div>
                </section>

                <section className="cs-control-card">
                  <div className="cs-section-label">SAVE & LOAD LAYOUTS</div>
                  <div className="cs-control-list">
                    <div className="cs-control-row">
                      <span className="cs-key-badge">M</span>
                      <span className="cs-control-desc">Open Start & Save Menu (3 slots per user)</span>
                    </div>
                    <div className="cs-control-row">
                      <span className="cs-key-badge">F5 / F9</span>
                      <span className="cs-control-desc">Quick Save / Quick Load Slot #1</span>
                    </div>
                    <div className="cs-control-row">
                      <span className="cs-key-badge">H</span>
                      <span className="cs-control-desc">Reopen this controls guide anytime</span>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>

          <div className="cs-welcome-footer">
            <div className="cs-loading-status" data-testid="welcome-loading-status">
              <div className="cs-loading-label">
                <span>{isSceneReady ? 'SCENE READY' : 'LOADING SCENE...'}</span>
                <span className="cs-loading-percent" data-testid="welcome-loading-percent">
                  {loadingProgress}%
                </span>
              </div>
              <div
                className="cs-loading-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={loadingProgress}
              >
                <div
                  className={`cs-loading-fill ${isSceneReady ? 'is-ready' : 'is-loading'}`}
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              className="cs-spawn-btn cs-enter-btn"
              data-testid="welcome-enter-btn"
              disabled={!isSceneReady}
              onClick={onEnter}
            >
              {isSceneReady ? 'ENTER PLANNER [ENTER]' : `LOADING SCENE (${loadingProgress}%)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
