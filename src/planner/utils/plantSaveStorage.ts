export interface ClerkUserInfo {
  id: string;
  displayName: string;
}

export interface SavedPlantEntry {
  plantId: string;
  position: [number, number, number];
  pinned: boolean;
}

export interface SaveSlotData {
  slotId: number;
  label: string;
  updatedAt: string;
  plants: SavedPlantEntry[];
}

declare global {
  interface Window {
    __CLERK_USER__?: ClerkUserInfo;
  }
}

const STORAGE_PREFIX = 'limonera_saves_v1_';
const livePlantGetters = new Map<string, () => SavedPlantEntry>();

export function getActiveClerkUser(): ClerkUserInfo {
  if (typeof window !== 'undefined' && window.__CLERK_USER__?.id) {
    return window.__CLERK_USER__;
  }
  return {
    id: 'local-operator',
    displayName: 'Local Operator',
  };
}

export function getStorageKeyForUser(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function registerLivePlant(
  instanceId: string,
  getter: () => SavedPlantEntry
): () => void {
  livePlantGetters.set(instanceId, getter);
  return () => {
    livePlantGetters.delete(instanceId);
  };
}

export function captureCurrentPlantLayout(): SavedPlantEntry[] {
  const result: SavedPlantEntry[] = [];
  for (const getter of livePlantGetters.values()) {
    const entry = getter();
    result.push({
      plantId: entry.plantId,
      position: [
        Math.round(entry.position[0] * 1000) / 1000,
        Math.round(entry.position[1] * 1000) / 1000,
        Math.round(entry.position[2] * 1000) / 1000,
      ],
      pinned: entry.pinned,
    });
  }
  return result;
}

export function loadUserSaveSlots(userId: string): Record<number, SaveSlotData> {
  try {
    const raw = window.localStorage.getItem(getStorageKeyForUser(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SaveSlotData>;
    const slots: Record<number, SaveSlotData> = {};
    for (const [k, val] of Object.entries(parsed)) {
      const slotNum = Number(k);
      if (slotNum >= 1 && slotNum <= 3 && val && Array.isArray(val.plants)) {
        slots[slotNum] = val;
      }
    }
    return slots;
  } catch {
    return {};
  }
}

export function saveSlotForUser(
  userId: string,
  slotId: number,
  label: string,
  plants: SavedPlantEntry[]
): Record<number, SaveSlotData> {
  const existing = loadUserSaveSlots(userId);
  const trimmedLabel = label.trim() || `Building Layout #${slotId}`;
  existing[slotId] = {
    slotId,
    label: trimmedLabel,
    updatedAt: new Date().toISOString(),
    plants,
  };
  try {
    window.localStorage.setItem(getStorageKeyForUser(userId), JSON.stringify(existing));
  } catch {
    // Ignore storage quota errors
  }
  return existing;
}

export function deleteSlotForUser(
  userId: string,
  slotId: number
): Record<number, SaveSlotData> {
  const existing = loadUserSaveSlots(userId);
  delete existing[slotId];
  try {
    window.localStorage.setItem(getStorageKeyForUser(userId), JSON.stringify(existing));
  } catch {
    // Ignore storage errors
  }
  return existing;
}

function isValidSavedPlantEntry(item: unknown): item is SavedPlantEntry {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.plantId === 'string' &&
    Array.isArray(candidate.position) &&
    candidate.position.length === 3 &&
    candidate.position.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

export function parseSavedPlantEntries(rawJson: unknown): SavedPlantEntry[] {
  if (!rawJson) return [];

  if (Array.isArray(rawJson)) {
    return rawJson.filter(isValidSavedPlantEntry).map((entry) => ({
      plantId: entry.plantId,
      position: [entry.position[0], entry.position[1], entry.position[2]],
      pinned: Boolean(entry.pinned),
    }));
  }

  if (typeof rawJson === 'object') {
    const obj = rawJson as Record<string, unknown>;
    if (Array.isArray(obj.plants)) {
      return parseSavedPlantEntries(obj.plants);
    }

    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object' && Array.isArray((val as Record<string, unknown>).plants)) {
        return parseSavedPlantEntries((val as Record<string, unknown>).plants);
      }
    }
  }

  return [];
}

export function exportLayoutToJsonFile(
  label: string,
  plants: SavedPlantEntry[],
  fileName = 'horoscopo-layout.json'
): void {
  const payload: SaveSlotData = {
    slotId: 1,
    label: label.trim() || 'Horoscopo Showcase Layout',
    updatedAt: new Date().toISOString(),
    plants,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
