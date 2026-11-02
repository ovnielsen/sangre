import { useEffect, useState } from 'react';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACO_DECODER_URL, fetchAndDecryptGlbBuffer } from '../../utils/protectedGlb.ts';

interface AssetProgressEntry {
  loadedBytes: number;
  totalBytes: number;
  stageProgress: number; // 0..1
  done: boolean;
}

const resolvedGltfs = new Map<string, GLTF>();
const pendingLoads = new Map<string, Promise<GLTF>>();
const assetProgressMap = new Map<string, AssetProgressEntry>();
const progressListeners = new Set<() => void>();
let highestReportedPercent = 0;
let sharedGltfLoader: GLTFLoader | null = null;

function notifyProgressListeners() {
  for (const listener of progressListeners) {
    listener();
  }
}

function updateAssetProgress(modelPath: string, patch: Partial<AssetProgressEntry>) {
  const current = assetProgressMap.get(modelPath) ?? {
    loadedBytes: 0,
    totalBytes: 0,
    stageProgress: 0,
    done: false,
  };
  assetProgressMap.set(modelPath, { ...current, ...patch });
  notifyProgressListeners();
}

export function getGlbLoadingProgress(isSceneReady = false): number {
  if (isSceneReady) {
    highestReportedPercent = 100;
    return 100;
  }

  if (assetProgressMap.size === 0) {
    return highestReportedPercent;
  }

  const entries = Array.from(assetProgressMap.values());
  const allHeadersKnown = entries.every((e) => e.totalBytes > 0 || e.done);

  let ratio = 0;
  if (allHeadersKnown) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const entry of entries) {
      const weight = entry.totalBytes > 0 ? entry.totalBytes : 1_000_000;
      weightedSum += entry.stageProgress * weight;
      totalWeight += weight;
    }
    ratio = totalWeight > 0 ? weightedSum / totalWeight : 0;
  } else {
    // Before all response headers arrive, weight pending header assets conservatively
    let sum = 0;
    for (const entry of entries) {
      sum += entry.totalBytes > 0 ? Math.min(entry.stageProgress, 0.15) : entry.stageProgress;
    }
    ratio = sum / entries.length;
  }

  const computedPercent = Math.min(98, Math.max(0, Math.round(ratio * 98)));
  if (computedPercent > highestReportedPercent) {
    highestReportedPercent = computedPercent;
  }
  return highestReportedPercent;
}

export function useGlbLoadingProgress(isSceneReady: boolean): number {
  const [progress, setProgress] = useState<number>(() => getGlbLoadingProgress(isSceneReady));

  useEffect(() => {
    const sync = () => {
      setProgress(getGlbLoadingProgress(isSceneReady));
    };
    sync();
    if (isSceneReady) return;

    progressListeners.add(sync);
    return () => {
      progressListeners.delete(sync);
    };
  }, [isSceneReady]);

  return isSceneReady ? 100 : progress;
}

function getGltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_URL);
    sharedGltfLoader.setDRACOLoader(dracoLoader);
  }
  return sharedGltfLoader;
}

async function fetchDecryptAndParseGlb(modelPath: string): Promise<GLTF> {
  const existing = resolvedGltfs.get(modelPath);
  if (existing) {
    updateAssetProgress(modelPath, { stageProgress: 1, done: true });
    return existing;
  }

  updateAssetProgress(modelPath, {
    loadedBytes: 0,
    totalBytes: 0,
    stageProgress: 0.02,
    done: false,
  });

  const glbBuffer = await fetchAndDecryptGlbBuffer(modelPath, (patch) => {
    updateAssetProgress(modelPath, patch);
  });

  updateAssetProgress(modelPath, { stageProgress: 0.92 });

  // 4. Parse directly in memory without creating a Blob or blob: URL in the Network tab
  const loader = getGltfLoader();
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    loader.parse(glbBuffer, '', resolve, reject);
  });

  // 5. Immediately wipe decrypted GLB bytes from RAM
  new Uint8Array(glbBuffer).fill(0);

  resolvedGltfs.set(modelPath, gltf);
  updateAssetProgress(modelPath, { stageProgress: 1, done: true });
  return gltf;
}

export function useProtectedGLTF(modelPath: string): GLTF {
  const resolved = resolvedGltfs.get(modelPath);
  if (resolved) return resolved;

  let pending = pendingLoads.get(modelPath);
  if (!pending) {
    pending = fetchDecryptAndParseGlb(modelPath);
    pendingLoads.set(modelPath, pending);
  }
  throw pending;
}

useProtectedGLTF.preload = (modelPath: string) => {
  if (!resolvedGltfs.has(modelPath) && !pendingLoads.has(modelPath)) {
    const p = fetchDecryptAndParseGlb(modelPath);
    pendingLoads.set(modelPath, p);
  }
};
