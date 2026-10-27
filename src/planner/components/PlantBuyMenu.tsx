import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { PLANT_CATALOG, type PlantItem } from '../data/plantCatalog.ts';
import { PlantMesh } from '../models/PlantMesh.tsx';

function SpinningPlantPortal({ plant }: { plant: PlantItem }) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.95;
    }
  });

  // Normalize preview scale slightly so giant and compact plants both frame well in the portal
  const previewScale = 1 / Math.pow(plant.scale, 0.45);

  return (
    <group ref={groupRef} scale={previewScale} position={[0, -0.05, 0]}>
      <PlantMesh plant={plant} />
      {/* Tactical Holo Pedestal */}
      <mesh position={[0, -0.64 * plant.scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.34, 32]} />
        <meshBasicMaterial color="#ffb700" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, -0.65 * plant.scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.28, 32]} />
        <meshBasicMaterial color="#2b3a29" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export interface PlantBuyMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlant: (plant: PlantItem) => void;
}

export function PlantBuyMenu({ isOpen, onClose, onSelectPlant }: PlantBuyMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePlant = PLANT_CATALOG[activeIndex] ?? PLANT_CATALOG[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Digit0' || event.code === 'Numpad0' || event.code === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.code === 'Enter') {
        event.preventDefault();
        onSelectPlant(PLANT_CATALOG[activeIndex] ?? PLANT_CATALOG[0]);
        return;
      }

      if (event.code === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % PLANT_CATALOG.length);
        return;
      }

      if (event.code === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + PLANT_CATALOG.length) % PLANT_CATALOG.length);
        return;
      }

      const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
      if (digitMatch) {
        const slot = Number(digitMatch[1]);
        const found = PLANT_CATALOG.find((item) => item.slot === slot);
        if (found) {
          event.preventDefault();
          onSelectPlant(found);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, isOpen, onClose, onSelectPlant]);

  if (!isOpen) return null;

  return (
    <div
      className="cs-buy-overlay"
      data-testid="plant-buy-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Tactical Botanical Requisition Menu"
    >
      <div className="cs-buy-window">
        <header className="cs-buy-header">
          <div className="cs-buy-title">
            <span className="cs-buy-icon">❖</span>
            <span>SELECT BOTANICAL UNIT // REQUISITION PORTAL</span>
          </div>
          <div className="cs-buy-subtitle">
            KEYS [1-{PLANT_CATALOG.length}] SELECT • [0 / B / ESC] EXIT
          </div>
        </header>

        <div className="cs-buy-body">
          {/* Left Column: CS 1.6 / Source Numbered Slot List */}
          <nav className="cs-buy-list" aria-label="Plant Categories">
            <div className="cs-section-label">AVAILABLE SPECIMENS</div>
            {PLANT_CATALOG.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`plant-slot-${item.slot}`}
                  className={`cs-slot-btn ${isSelected ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onFocus={() => setActiveIndex(idx)}
                  onClick={() => onSelectPlant(item)}
                >
                  <span className="cs-slot-num">{item.slot}</span>
                  <span className="cs-slot-name">{item.name}</span>
                  <span className="cs-slot-price">${item.price}</span>
                </button>
              );
            })}

            <div className="cs-list-spacer" />

            <button
              type="button"
              data-testid="plant-buy-cancel"
              className="cs-slot-btn cs-cancel-btn"
              onClick={onClose}
            >
              <span className="cs-slot-num">0</span>
              <span className="cs-slot-name">CANCEL / RETURN TO SCENE</span>
              <span className="cs-slot-price">ESC</span>
            </button>
          </nav>

          {/* Right Column: 3D Portal Preview & Counter-Strike Tactical Specs */}
          <section className="cs-buy-preview">
            <div className="cs-preview-top">
              <div className="cs-portal-frame" data-testid="plant-portal-viewport">
                <div className="cs-portal-badge">{activePlant.codeName}</div>
                <div className="cs-portal-category">{activePlant.category}</div>
                <Canvas
                  camera={{ position: [0, 0.25, 2.05], fov: 42 }}
                  gl={{ alpha: true, antialias: true }}
                >
                  <ambientLight intensity={1.1} />
                  <directionalLight position={[3, 5, 4]} intensity={1.6} />
                  <directionalLight position={[-3, 2, -2]} intensity={0.6} color="#a8dadc" />
                  <Suspense fallback={null}>
                    <SpinningPlantPortal plant={activePlant} />
                  </Suspense>
                </Canvas>
              </div>
            </div>

            <div className="cs-spec-panel">
              <div className="cs-spec-header">
                <div>
                  <h2 className="cs-spec-name" data-testid="preview-plant-name">
                    {activePlant.name}
                  </h2>
                  <div className="cs-spec-origin" data-testid="preview-plant-origin">
                    ORIGIN: {activePlant.origin} • MASS: {activePlant.weightKg.toFixed(1)} KG
                  </div>
                </div>
                <div className="cs-spec-price" data-testid="preview-plant-price">
                  ${activePlant.price}
                </div>
              </div>

              <p className="cs-spec-desc">{activePlant.description}</p>

              <div className="cs-stat-grid">
                <div className="cs-stat-row">
                  <span className="cs-stat-label">SUNLIGHT REQ</span>
                  <div className="cs-stat-bar">
                    <div
                      className="cs-stat-fill"
                      style={{ width: `${activePlant.stats.sunlight}%` }}
                    />
                  </div>
                  <span className="cs-stat-val">{activePlant.stats.sunlight}%</span>
                </div>
                <div className="cs-stat-row">
                  <span className="cs-stat-label">HYDRATION</span>
                  <div className="cs-stat-bar">
                    <div
                      className="cs-stat-fill"
                      style={{ width: `${activePlant.stats.hydration}%` }}
                    />
                  </div>
                  <span className="cs-stat-val">{activePlant.stats.hydration}%</span>
                </div>
                <div className="cs-stat-row">
                  <span className="cs-stat-label">FOLIAGE DENSITY</span>
                  <div className="cs-stat-bar">
                    <div
                      className="cs-stat-fill"
                      style={{ width: `${activePlant.stats.foliage}%` }}
                    />
                  </div>
                  <span className="cs-stat-val">{activePlant.stats.foliage}%</span>
                </div>
                <div className="cs-stat-row">
                  <span className="cs-stat-label">RESILIENCE</span>
                  <div className="cs-stat-bar">
                    <div
                      className="cs-stat-fill"
                      style={{ width: `${activePlant.stats.resilience}%` }}
                    />
                  </div>
                  <span className="cs-stat-val">{activePlant.stats.resilience}%</span>
                </div>
              </div>

              <button
                type="button"
                data-testid="plant-buy-confirm"
                className="cs-spawn-btn"
                onClick={() => onSelectPlant(activePlant)}
              >
                DEPLOY IN CROSSHAIR [{activePlant.slot} / ENTER]
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
