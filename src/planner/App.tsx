import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { Physics } from '@react-three/cannon';

import './App.css';
import Main from './scenes/Main.tsx';
import { PlantBuyMenu } from './components/PlantBuyMenu.tsx';
import { StartMenu } from './components/StartMenu.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { PLANT_CATALOG, type PlantItem, type SpawnedPlant } from './data/plantCatalog.ts';
import {
  captureCurrentPlantLayout,
  getActiveClerkUser,
  loadUserSaveSlots,
  parseSavedPlantEntries,
  saveSlotForUser,
  type SavedPlantEntry,
} from './utils/plantSaveStorage.ts';

function detectShowcaseMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__SHOWCASE_MODE__) return true;
  const host = window.location.hostname;
  if (host === 'horoscopo.sangreylirios.space' || host.startsWith('horoscopo.')) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('subdomain') === 'horoscopo';
}

function safeRequestPointerLock(element?: Element | null) {
  try {
    const res = (element ?? document.querySelector('canvas'))?.requestPointerLock?.();
    if (res && typeof (res as Promise<unknown>).catch === 'function') {
      (res as Promise<unknown>).catch(() => {});
    }
  } catch {
    // Ignore pointer lock security rejections in headless/rapid-key environments
  }
}

function getDefaultPlants(): SpawnedPlant[] {
  return [
    {
      instanceId: `initial-monstera-${Date.now()}`,
      plant: PLANT_CATALOG[0],
      initialPosition: [-0.1, 1.5, 3.63],
      autoGrab: false,
      initialPinned: false,
    },
  ];
}

function App() {
  const [isShowcaseMode] = useState(() => detectShowcaseMode());
  const [isPencilDraft, setIsPencilDraft] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [spawnedPlants, setSpawnedPlants] = useState<SpawnedPlant[]>(() =>
    detectShowcaseMode() ? [] : getDefaultPlants()
  );

  const spawnPositionRef = useRef<[number, number, number]>([1, 1.55, -2.2]);

  const handleSceneReady = useCallback(() => {
    setIsSceneReady(true);
  }, []);

  const handleEnterFromWelcome = useCallback(() => {
    if (!isSceneReady) return;
    setIsWelcomeOpen(false);
    safeRequestPointerLock();
  }, [isSceneReady]);

  const toggleWelcome = useCallback(() => {
    setIsMenuOpen(false);
    setIsStartMenuOpen(false);
    setIsWelcomeOpen((prev) => {
      const next = !prev;
      if (next && document.pointerLockElement) {
        document.exitPointerLock?.();
      } else if (!next) {
        safeRequestPointerLock();
      }
      return next;
    });
  }, []);

  const togglePencilDraft = useCallback(() => {
    setIsPencilDraft((prev) => !prev);
  }, []);

  const toggleMenu = useCallback(() => {
    if (isShowcaseMode) return;
    setIsWelcomeOpen(false);
    setIsStartMenuOpen(false);
    setIsMenuOpen((prev) => {
      const next = !prev;
      if (next && document.pointerLockElement) {
        document.exitPointerLock?.();
      } else if (!next) {
        safeRequestPointerLock();
      }
      return next;
    });
  }, [isShowcaseMode]);

  const toggleStartMenu = useCallback(() => {
    if (isShowcaseMode) return;
    setIsWelcomeOpen(false);
    setIsMenuOpen(false);
    setIsStartMenuOpen((prev) => {
      const next = !prev;
      if (next && document.pointerLockElement) {
        document.exitPointerLock?.();
      } else if (!next) {
        safeRequestPointerLock();
      }
      return next;
    });
  }, [isShowcaseMode]);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
    safeRequestPointerLock();
  }, []);

  const handleCloseStartMenu = useCallback(() => {
    setIsStartMenuOpen(false);
    safeRequestPointerLock();
  }, []);

  const handleSelectPlant = useCallback((plant: PlantItem) => {
    if (isShowcaseMode) return;
    const [x, y, z] = spawnPositionRef.current;
    setSpawnedPlants((prev) => [
      ...prev.map((item) => (item.autoGrab ? { ...item, autoGrab: false } : item)),
      {
        instanceId: `${plant.id}-${Date.now()}-${prev.length}`,
        plant,
        initialPosition: [x, y, z],
        autoGrab: true,
        initialPinned: false,
      },
    ]);
    setIsMenuOpen(false);
    safeRequestPointerLock();
  }, [isShowcaseMode]);

  const handleLoadLayout = useCallback((entries: SavedPlantEntry[]) => {
    const batchTime = Date.now();
    const restored: SpawnedPlant[] = [];
    entries.forEach((entry, idx) => {
      const plantDef =
        PLANT_CATALOG.find((p) => p.id === entry.plantId) ?? PLANT_CATALOG[0];
      restored.push({
        instanceId: `restored-${plantDef.id}-${batchTime}-${idx}`,
        plant: plantDef,
        initialPosition: [entry.position[0], entry.position[1], entry.position[2]],
        autoGrab: false,
        initialPinned: Boolean(entry.pinned),
      });
    });
    setSpawnedPlants(restored);
    setIsStartMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!isShowcaseMode) return;
    let cancelled = false;

    fetch('/horoscopo-layout.json', { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const entries = parseSavedPlantEntries(json);
        if (entries.length > 0) {
          handleLoadLayout(entries);
        } else {
          setSpawnedPlants(getDefaultPlants());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpawnedPlants(getDefaultPlants());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handleLoadLayout, isShowcaseMode]);

  const handleClearScene = useCallback(() => {
    setSpawnedPlants([]);
  }, []);

  const handleResetDefault = useCallback(() => {
    setSpawnedPlants(getDefaultPlants());
    setIsStartMenuOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (event.code === 'KeyH') {
        if (!isSceneReady) return;
        event.preventDefault();
        toggleWelcome();
        return;
      }

      if (isShowcaseMode && event.code === 'KeyP') {
        event.preventDefault();
        togglePencilDraft();
        return;
      }

      if (isShowcaseMode) return;
      if (isWelcomeOpen && !isSceneReady) return;

      if (event.code === 'KeyB' || event.code === 'Tab') {
        event.preventDefault();
        toggleMenu();
        return;
      }

      if (event.code === 'KeyM') {
        event.preventDefault();
        toggleStartMenu();
        return;
      }

      if (event.code === 'F5') {
        event.preventDefault();
        const user = getActiveClerkUser();
        saveSlotForUser(user.id, 1, 'Quick Save Slot #1', captureCurrentPlantLayout());
        return;
      }

      if (event.code === 'F9') {
        event.preventDefault();
        const user = getActiveClerkUser();
        const slots = loadUserSaveSlots(user.id);
        if (slots[1]) {
          handleLoadLayout(slots[1].plants);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    handleLoadLayout,
    isSceneReady,
    isShowcaseMode,
    isWelcomeOpen,
    toggleMenu,
    togglePencilDraft,
    toggleStartMenu,
    toggleWelcome,
  ]);

  return (
    <>
      <Canvas camera={{ fov: 60, near: 0.1, far: 2000 }}>
        <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimuth={0.25} />
        <ambientLight intensity={isPencilDraft ? 0.75 : 1.0} />
        {isPencilDraft && (
          <hemisphereLight args={['#d8e4f0', '#6d8299', 0.65]} />
        )}
        <directionalLight position={[18, 32, 24]} intensity={isPencilDraft ? 0.9 : 0.45} />
        <Physics>
          <Main
            spawnedPlants={spawnedPlants}
            isMenuOpen={isWelcomeOpen || isMenuOpen || isStartMenuOpen}
            readOnly={isShowcaseMode}
            pencilDraft={isPencilDraft}
            spawnPositionRef={spawnPositionRef}
            onSceneReady={handleSceneReady}
          />
        </Physics>
      </Canvas>

      <div id="fps-crosshair" data-mode="idle" aria-hidden="true">
        <span className="crosshair-line crosshair-top" />
        <span className="crosshair-line crosshair-right" />
        <span className="crosshair-line crosshair-bottom" />
        <span className="crosshair-line crosshair-left" />
        <span className="crosshair-dot" />
      </div>

      <div id="fps-prompt" aria-live="polite" />

      <div className="cs-hud-bar" data-testid="cs-hud-bar">
        {!isShowcaseMode && (
          <>
            <button
              type="button"
              className="cs-hud-buy-btn"
              data-testid="hud-open-buy-menu"
              onClick={toggleMenu}
            >
              <span className="cs-hud-key">B</span>
              <span>PLANT BUY MENU</span>
            </button>
            <button
              type="button"
              className="cs-hud-buy-btn"
              data-testid="hud-open-start-menu"
              onClick={toggleStartMenu}
            >
              <span className="cs-hud-key">M</span>
              <span>START / SAVE</span>
            </button>
          </>
        )}
        {isShowcaseMode && (
          <button
            type="button"
            className={`cs-hud-buy-btn ${isPencilDraft ? 'is-active' : ''}`}
            data-testid="hud-toggle-pencil-draft"
            onClick={togglePencilDraft}
          >
            <span className="cs-hud-key">P</span>
            <span>{isPencilDraft ? 'PENCIL DRAFT: ON' : 'PENCIL DRAFT: OFF'}</span>
          </button>
        )}
        <button
          type="button"
          className="cs-hud-buy-btn"
          data-testid="hud-open-help-menu"
          onClick={toggleWelcome}
        >
          <span className="cs-hud-key">H</span>
          <span>HELP</span>
        </button>
        <div className="cs-hud-counter" data-testid="spawned-plants-count">
          PLANTS: {spawnedPlants.length}
        </div>
      </div>

      <WelcomeScreen
        isOpen={isWelcomeOpen}
        isSceneReady={isSceneReady}
        readOnly={isShowcaseMode}
        onEnter={handleEnterFromWelcome}
      />

      {!isShowcaseMode && (
        <>
          <PlantBuyMenu
            isOpen={isMenuOpen}
            onClose={handleCloseMenu}
            onSelectPlant={handleSelectPlant}
          />

          <StartMenu
            isOpen={isStartMenuOpen}
            onClose={handleCloseStartMenu}
            onLoadLayout={handleLoadLayout}
            onClearScene={handleClearScene}
            onResetDefault={handleResetDefault}
          />
        </>
      )}
    </>
  );
}

export default App;
