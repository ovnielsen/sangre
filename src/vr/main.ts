import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import buildingPath from '../planner/assets/building.glb';
import { DRACO_DECODER_URL, fetchAndDecryptGlbBuffer } from '../utils/protectedGlb.ts';

declare global {
  interface Window {
    AFRAME?: any;
    THREE?: any;
    __CLERK_AUTHENTICATED__?: boolean;
  }
}

let fallbackThreeGltfLoader: GLTFLoader | null = null;

function getFallbackThreeGltfLoader(): GLTFLoader {
  if (!fallbackThreeGltfLoader) {
    fallbackThreeGltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_URL);
    fallbackThreeGltfLoader.setDRACOLoader(dracoLoader);
  }
  return fallbackThreeGltfLoader;
}

function waitForSceneLoaded(sceneEl: any): Promise<void> {
  if (!sceneEl || sceneEl.hasLoaded) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    sceneEl.addEventListener('loaded', () => resolve(), { once: true });
  });
}

function getAframeGltfLoader(sceneEl: any, buildingEl: any): any {
  const gltfSystem = sceneEl?.systems?.['gltf-model'];
  if (gltfSystem && !gltfSystem.getDRACOLoader?.()) {
    if (gltfSystem.data && !gltfSystem.data.dracoDecoderPath) {
      gltfSystem.data.dracoDecoderPath = DRACO_DECODER_URL;
    }
    gltfSystem.update?.();
  }

  // Initialize A-Frame's gltf-model component with an empty src so A-Frame
  // constructs its internal THREE.GLTFLoader (with Draco/Meshopt/KTX2) without fetching.
  if (!buildingEl.components?.['gltf-model']) {
    buildingEl.setAttribute('gltf-model', '');
  }

  const gltfComp = buildingEl.components?.['gltf-model'];
  let loader = gltfComp?.loader;

  const THREE = window.AFRAME?.THREE || window.THREE;
  if (!loader && THREE?.GLTFLoader) {
    loader = new THREE.GLTFLoader();
  }

  if (loader) {
    const dracoLoader = gltfSystem?.getDRACOLoader?.();
    if (dracoLoader && typeof loader.setDRACOLoader === 'function') {
      loader.setDRACOLoader(dracoLoader);
    } else if (THREE?.DRACOLoader && typeof loader.setDRACOLoader === 'function') {
      const fallbackDraco = new THREE.DRACOLoader();
      fallbackDraco.setDecoderPath(DRACO_DECODER_URL);
      loader.setDRACOLoader(fallbackDraco);
    }
    return loader;
  }

  return getFallbackThreeGltfLoader();
}

let isLoaded = false;
let isLoading = false;

async function loadVrBuilding() {
  if (isLoaded || isLoading) return;
  const sceneEl = document.getElementById('scene') as any;
  const buildingEl = document.getElementById('building') as any;
  if (!sceneEl || !buildingEl) return;

  isLoading = true;
  try {
    const [glbBuffer] = await Promise.all([
      fetchAndDecryptGlbBuffer(buildingPath),
      waitForSceneLoaded(sceneEl),
    ]);

    const loader = getAframeGltfLoader(sceneEl, buildingEl);

    await new Promise<void>((resolve, reject) => {
      loader.parse(
        glbBuffer,
        '',
        (gltfModel: any) => {
          new Uint8Array(glbBuffer).fill(0);
          const model = gltfModel.scene || gltfModel.scenes?.[0];
          if (!model) {
            reject(new Error('Decoded GLB contains no scene.'));
            return;
          }
          model.animations = gltfModel.animations;
          const gltfComp = buildingEl.components?.['gltf-model'];
          if (gltfComp) {
            gltfComp.model = model;
          }
          buildingEl.setObject3D('mesh', model);
          buildingEl.emit('model-loaded', { format: 'gltf', model });
          isLoaded = true;
          resolve();
        },
        (err: any) => {
          new Uint8Array(glbBuffer).fill(0);
          reject(err);
        }
      );
    });
  } catch (err) {
    console.error('[VR] Failed to load protected building GLB:', err);
  } finally {
    isLoading = false;
  }
}

loadVrBuilding();

if (!window.__CLERK_AUTHENTICATED__) {
  window.addEventListener(
    'clerk:authenticated',
    () => {
      if (!isLoaded) {
        loadVrBuilding();
      }
    },
    { once: true }
  );
}
