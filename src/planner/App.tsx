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
  saveSlotForUser,
  type SavedPlantEntry,
} from './utils/plantSaveStorage.ts';

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
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [spawnedPlants, setSpawnedPlants] = useState<SpawnedPlant[]>(() => getDefaultPlants());

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

  const toggleMenu = useCallback(() => {
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
  }, []);

  const toggleStartMenu = useCallback(() => {
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
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
    safeRequestPointerLock();
  }, []);

  const handleCloseStartMenu = useCallback(() => {
    setIsStartMenuOpen(false);
    safeRequestPointerLock();
  }, []);

  const handleSelectPlant = useCallback((plant: PlantItem) => {
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
  }, []);

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
  }, [handleLoadLayout, isSceneReady, isWelcomeOpen, toggleMenu, toggleStartMenu, toggleWelcome]);

  return (
    <>
      <Canvas>
        <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimuth={0.25} />
        <ambientLight />
        <Physics>
          <Main
            spawnedPlants={spawnedPlants}
            isMenuOpen={isWelcomeOpen || isMenuOpen || isStartMenuOpen}
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
        onEnter={handleEnterFromWelcome}
      />

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
  );
}

export default App;
