import { useEffect, useState } from 'react';
import {
  captureCurrentPlantLayout,
  deleteSlotForUser,
  getActiveClerkUser,
  loadUserSaveSlots,
  saveSlotForUser,
  type ClerkUserInfo,
  type SavedPlantEntry,
  type SaveSlotData,
} from '../utils/plantSaveStorage.ts';

export interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadLayout: (entries: SavedPlantEntry[]) => void;
  onClearScene: () => void;
  onResetDefault: () => void;
}

const SLOT_IDS = [1, 2, 3] as const;

export function StartMenu({
  isOpen,
  onClose,
  onLoadLayout,
  onClearScene,
  onResetDefault,
}: StartMenuProps) {
  const [clerkUser, setClerkUser] = useState<ClerkUserInfo>(() => getActiveClerkUser());
  const [slots, setSlots] = useState<Record<number, SaveSlotData>>({});
  const [labels, setLabels] = useState<Record<number, string>>({
    1: 'Atrium Main Layout',
    2: 'Wall Garden Setup',
    3: 'Experimental Layout',
  });
  const [statusBanner, setStatusBanner] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const activeUser = getActiveClerkUser();
    setClerkUser(activeUser);
    const loaded = loadUserSaveSlots(activeUser.id);
    setSlots(loaded);
    setLabels((prev) => ({
      1: loaded[1]?.label ?? prev[1],
      2: loaded[2]?.label ?? prev[2],
      3: loaded[3]?.label ?? prev[3],
    }));
    setStatusBanner('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveSlot = (slotId: number) => {
    const activeUser = getActiveClerkUser();
    const currentPlants = captureCurrentPlantLayout();
    const nextSlots = saveSlotForUser(
      activeUser.id,
      slotId,
      labels[slotId] || `Building Layout #${slotId}`,
      currentPlants
    );
    setSlots({ ...nextSlots });
    setStatusBanner(
      `SAVED ${currentPlants.length} PLANT(S) TO SLOT #${slotId} FOR ${activeUser.id.toUpperCase()}`
    );
  };

  const handleLoadSlot = (slotId: number) => {
    const slotData = slots[slotId];
    if (!slotData) return;
    onLoadLayout(slotData.plants);
  };

  const handleDeleteSlot = (slotId: number) => {
    const activeUser = getActiveClerkUser();
    const nextSlots = deleteSlotForUser(activeUser.id, slotId);
    setSlots({ ...nextSlots });
    setStatusBanner(`CLEARED SLOT #${slotId}`);
  };

  return (
    <div
      className="cs-buy-overlay"
      data-testid="start-save-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Building Layout Start & Save Menu"
    >
      <div className="cs-buy-window cs-start-window">
        <header className="cs-buy-header">
          <div className="cs-buy-title">
            <span className="cs-buy-icon">◈</span>
            <span>LIMONERA COMMAND // SAVE & LOAD PLANT POSITIONS</span>
          </div>
          <div className="cs-buy-subtitle" data-testid="clerk-operator-badge">
            OPERATOR: {clerkUser.displayName} [{clerkUser.id}]
          </div>
        </header>

        <div className="cs-start-body">
          <div className="cs-section-label">
            CLERK USER SAVE SLOTS (STORED PER ACCOUNT IN LOCAL ARCHIVE)
          </div>

          {statusBanner && (
            <div className="cs-start-status" data-testid="start-menu-status">
              {statusBanner}
            </div>
          )}

          <div className="cs-save-slots-grid">
            {SLOT_IDS.map((slotId) => {
              const slotData = slots[slotId];
              const plantCount = slotData?.plants.length ?? 0;
              const pinnedCount =
                slotData?.plants.filter((p) => p.pinned).length ?? 0;
              const formattedDate = slotData
                ? new Date(slotData.updatedAt).toLocaleString()
                : null;

              return (
                <div
                  key={slotId}
                  className={`cs-save-slot-card ${slotData ? 'has-data' : ''}`}
                  data-testid={`save-slot-card-${slotId}`}
                >
                  <div className="cs-save-slot-top">
                    <span className="cs-slot-num">{slotId}</span>
                    <input
                      type="text"
                      className="cs-save-slot-input"
                      aria-label={`Slot ${slotId} Label`}
                      value={labels[slotId] ?? ''}
                      onChange={(e) =>
                        setLabels((prev) => ({
                          ...prev,
                          [slotId]: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div
                    className="cs-save-slot-meta"
                    data-testid={`slot-meta-${slotId}`}
                  >
                    {slotData ? (
                      <>
                        <span className="cs-meta-highlight">
                          {plantCount} PLANTS ({pinnedCount} WALL-PINNED)
                        </span>
                        <span> • SAVED: {formattedDate}</span>
                      </>
                    ) : (
                      <span>EMPTY SLOT — NO SAVED LAYOUT</span>
                    )}
                  </div>

                  <div className="cs-save-slot-actions">
                    <button
                      type="button"
                      className="cs-slot-action-btn is-save"
                      data-testid={`save-slot-${slotId}`}
                      onClick={() => handleSaveSlot(slotId)}
                    >
                      SAVE POSITION
                    </button>
                    <button
                      type="button"
                      className="cs-slot-action-btn is-load"
                      data-testid={`load-slot-${slotId}`}
                      disabled={!slotData}
                      onClick={() => handleLoadSlot(slotId)}
                    >
                      LOAD LAYOUT
                    </button>
                    <button
                      type="button"
                      className="cs-slot-action-btn is-delete"
                      data-testid={`delete-slot-${slotId}`}
                      disabled={!slotData}
                      onClick={() => handleDeleteSlot(slotId)}
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cs-start-footer">
            <div className="cs-start-scene-btns">
              <button
                type="button"
                className="cs-slot-action-btn is-delete"
                data-testid="scene-clear-plants"
                onClick={onClearScene}
              >
                CLEAR ALL PLANTS (0)
              </button>
              <button
                type="button"
                className="cs-slot-action-btn"
                data-testid="scene-reset-default"
                onClick={onResetDefault}
              >
                RESET DEFAULT SCENE
              </button>
            </div>

            <button
              type="button"
              className="cs-spawn-btn cs-resume-btn"
              data-testid="start-menu-resume"
              onClick={onClose}
            >
              RESUME BUILDING [M / ESC]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
