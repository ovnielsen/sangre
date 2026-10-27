import { useMemo } from 'react';
import { Box3, Color, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { PLANT_CATALOG, type PlantItem } from '../data/plantCatalog.ts';
import { useProtectedGLTF } from '../hooks/useProtectedGLTF.ts';

const NOOP_RAYCAST = () => {};
const TARGET_BASE_DIMENSION = 1.25;

interface PreparedPlantPrototype {
  templateRoot: Object3D;
  offset: [number, number, number];
  normalizedScale: number;
}

const prototypeCache = new Map<string, PreparedPlantPrototype>();

function getOrCreatePrototype(plant: PlantItem, rawScene: Object3D): PreparedPlantPrototype {
  const existing = prototypeCache.get(plant.id);
  if (existing) return existing;

  rawScene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(rawScene);
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const normalizedScale =
    maxDim > 0.001 ? (TARGET_BASE_DIMENSION * plant.scale) / maxDim : plant.scale;

  const templateRoot = rawScene.clone(true);
  templateRoot.traverse((child) => {
    if (child instanceof Mesh) {
      child.raycast = NOOP_RAYCAST;
      child.frustumCulled = true;
      if (child.geometry && !child.geometry.boundingSphere) {
        child.geometry.computeBoundingSphere();
      }
      if ((plant.leafTint || plant.potTint) && child.material) {
        const mat = (child.material as MeshStandardMaterial).clone();
        if (plant.leafTint && child.name.toLowerCase().includes('leav')) {
          mat.color.lerp(new Color(plant.leafTint), 0.55);
        }
        if (plant.potTint && child.name.toLowerCase().includes('vase')) {
          mat.color.set(plant.potTint);
        }
        child.material = mat;
      }
    }
  });

  const proto: PreparedPlantPrototype = {
    templateRoot,
    offset: [-center.x, -center.y, -center.z],
    normalizedScale,
  };
  prototypeCache.set(plant.id, proto);
  return proto;
}

export function PlantMesh({ plant }: { plant: PlantItem }) {
  const gltf = useProtectedGLTF(plant.modelPath) as { scene: Object3D };

  const { instanceScene, offset, normalizedScale } = useMemo(() => {
    const proto = getOrCreatePrototype(plant, gltf.scene);
    // Shallow clone reuses the exact same GPU BufferGeometry and pre-tinted Material references
    const clone = proto.templateRoot.clone(true);
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.raycast = NOOP_RAYCAST;
        child.frustumCulled = true;
      }
    });
    return {
      instanceScene: clone,
      offset: proto.offset,
      normalizedScale: proto.normalizedScale,
    };
  }, [gltf.scene, plant]);

  return (
    <group scale={normalizedScale}>
      <primitive object={instanceScene} position={offset} />
    </group>
  );
}

// Preload the initial spawned plant model; additional catalog species load on-demand when previewed/spawned
if (PLANT_CATALOG[0]) {
  useProtectedGLTF.preload(PLANT_CATALOG[0].modelPath);
}
