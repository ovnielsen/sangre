import { useEffect, useMemo } from 'react';
import {
  Box3,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  EdgesGeometry,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RGBAFormat,
  Vector2,
  Vector3,
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { PLANT_CATALOG, type PlantItem } from '../data/plantCatalog.ts';
import { useProtectedGLTF } from '../hooks/useProtectedGLTF.ts';

const NOOP_RAYCAST = () => {};
const TARGET_BASE_DIMENSION = 1.25;

const SPECIES_PINK_PALETTE: Record<string, string[]> = {
  'monstera-classic': ['#e46fa3', '#f08db8', '#d4568d'],
  'calathea-orbifolia': ['#ec82ad', '#f5a1c2', '#d96594'],
  'elephant-ear': ['#d15288', '#e372a3', '#bc3f74'],
  'potted-strelitzia': ['#ea78a1', '#f399ba', '#d85c8a'],
  'golden-pothos': ['#f291b7', '#f7aecb', '#df719c'],
  'stellaria-dichotoma': ['#dc6498', '#ea84b0', '#c74c81'],
  'boston-lush-fern': ['#cb5083', '#de709e', '#b53c6e'],
};

const DEFAULT_PINK_SHADES = ['#e46fa3', '#f08db8', '#d4568d', '#ec82ad'];
const POT_PINK_HEX = '#f6bdd1';
const STEM_SOIL_PINK_HEX = '#b84a77';

let cachedPinkRamp: DataTexture | null = null;
const cachedPinkToonMaterials = new Map<string, MeshToonMaterial>();
let cachedDarkPinkCharcoalMaterial: LineMaterial | null = null;

function getPinkToonMaterial(hexColor: string): MeshToonMaterial {
  const existing = cachedPinkToonMaterials.get(hexColor);
  if (existing) return existing;

  if (!cachedPinkRamp) {
    const rampPixels = new Uint8Array([
      168, 128, 148, 255, // Shaded rose-pink tone
      218, 182, 200, 255, // Mid pink tone
      252, 232, 242, 255, // Bright pastel-pink highlight
    ]);
    cachedPinkRamp = new DataTexture(rampPixels, 3, 1, RGBAFormat);
    cachedPinkRamp.minFilter = NearestFilter;
    cachedPinkRamp.magFilter = NearestFilter;
    cachedPinkRamp.needsUpdate = true;
  }

  const mat = new MeshToonMaterial({
    color: new Color(hexColor),
    gradientMap: cachedPinkRamp,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });

  cachedPinkToonMaterials.set(hexColor, mat);
  return mat;
}

function getDarkPinkCharcoalEdgeMaterial(): LineMaterial {
  if (cachedDarkPinkCharcoalMaterial) {
    if (typeof window !== 'undefined') {
      cachedDarkPinkCharcoalMaterial.resolution.set(window.innerWidth, window.innerHeight);
    }
    return cachedDarkPinkCharcoalMaterial;
  }

  const mat = new LineMaterial({
    color: 0x5c0a2e, // Deep dark-pink / crimson-berry charcoal
    linewidth: 3.4,
    transparent: true,
    opacity: 0.92,
    dashed: false,
    resolution: new Vector2(
      typeof window !== 'undefined' ? window.innerWidth : 1280,
      typeof window !== 'undefined' ? window.innerHeight : 720
    ),
  });

  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `
      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }
      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      void main() {
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
      `
      float radialDist = abs(vUv.x);
      float grainCoarse = valueNoise(gl_FragCoord.xy * 0.45);
      float grainFine = hash21(floor(gl_FragCoord.xy * 0.9));
      float crayonTooth = mix(grainCoarse, grainFine, 0.45);

      float edgeRoughness = smoothstep(0.98, 0.15, radialDist + (crayonTooth - 0.5) * 0.65);
      float pressureGrain = 0.48 + 0.52 * smoothstep(0.12, 0.85, crayonTooth);
      float finalAlpha = alpha * edgeRoughness * pressureGrain;
      if (finalAlpha < 0.1) discard;

      // Deep dark-pink / berry-magenta charcoal in linear color space
      vec3 darkPinkCharcoal = mix(vec3(0.095, 0.003, 0.038), vec3(0.24, 0.014, 0.095), grainCoarse);
      gl_FragColor = vec4(darkPinkCharcoal, finalAlpha);
      `
    );
  };

  cachedDarkPinkCharcoalMaterial = mat;
  return mat;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildPlantCharcoalEdges(sourceGeometry: BufferGeometry): LineSegmentsGeometry {
  if (!sourceGeometry.boundingSphere) {
    sourceGeometry.computeBoundingSphere();
  }
  const radius = Math.max(0.001, sourceGeometry.boundingSphere?.radius || 1);

  const baseEdges = new EdgesGeometry(sourceGeometry, 42);
  const posAttr = baseEdges.attributes.position;
  const positions: number[] = [];

  const a = new Vector3();
  const b = new Vector3();
  const dir = new Vector3();
  const perp1 = new Vector3();
  const perp2 = new Vector3();
  const up = new Vector3(0, 1, 0);
  const altUp = new Vector3(1, 0, 0);
  const pPrev = new Vector3();
  const pCurr = new Vector3();

  if (posAttr) {
    const totalSegments = Math.floor(posAttr.count / 2);
    const maxSegments = 450;
    const stride = Math.max(1, Math.ceil(totalSegments / maxSegments));

    for (let i = 0; i < totalSegments; i += stride) {
      a.fromBufferAttribute(posAttr, i * 2);
      b.fromBufferAttribute(posAttr, i * 2 + 1);
      dir.subVectors(b, a);
      const len = dir.length();
      if (len < radius * 0.015) continue;
      dir.divideScalar(len);

      perp1.crossVectors(dir, Math.abs(dir.y) > 0.9 ? altUp : up).normalize();
      perp2.crossVectors(dir, perp1).normalize();

      const passes = 2;
      const steps = Math.max(2, Math.min(5, Math.ceil(len / (radius * 0.25))));

      for (let pass = 0; pass < passes; pass++) {
        const seedBase = i * 29.3 + pass * 97.1;
        const overshoot = radius * (0.012 + pseudoRandom(seedBase + 1) * 0.022);
        const wobbleAmp = Math.min(radius * 0.018, len * 0.04) * (0.85 + pass * 0.35);
        const passOffset1 = (pass - 0.5) * radius * 0.008;
        const passOffset2 = (pseudoRandom(seedBase + 5) - 0.5) * radius * 0.008;
        const waveFreq = 1.6 + pseudoRandom(seedBase + 3) * 2.2;
        const wavePhase = pseudoRandom(seedBase + 4) * Math.PI * 2;

        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const distAlong = -overshoot + t * (len + overshoot * 2);
          pCurr.copy(a).addScaledVector(dir, distAlong);

          const envelope = Math.sin(t * Math.PI);
          const wave1 =
            Math.sin(t * Math.PI * waveFreq + wavePhase) * wobbleAmp * envelope +
            (pseudoRandom(seedBase + s * 7.3) - 0.5) * wobbleAmp * 0.5;
          const wave2 =
            Math.cos(t * Math.PI * waveFreq + wavePhase) * wobbleAmp * 0.7 * envelope +
            (pseudoRandom(seedBase + s * 13.1) - 0.5) * wobbleAmp * 0.5;

          pCurr.addScaledVector(perp1, wave1 + passOffset1);
          pCurr.addScaledVector(perp2, wave2 + passOffset2);

          if (s > 0) {
            positions.push(pPrev.x, pPrev.y, pPrev.z, pCurr.x, pCurr.y, pCurr.z);
          }
          pPrev.copy(pCurr);
        }
      }
    }
  }

  baseEdges.dispose();
  const lineGeo = new LineSegmentsGeometry();
  if (positions.length > 0) {
    lineGeo.setPositions(positions);
  }
  return lineGeo;
}

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

export function PlantMesh({
  plant,
  pencilDraft = false,
}: {
  plant: PlantItem;
  pencilDraft?: boolean;
}) {
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

  useEffect(() => {
    const darkPinkEdgeMat = getDarkPinkCharcoalEdgeMaterial();
    const speciesPinks = SPECIES_PINK_PALETTE[plant.id] ?? DEFAULT_PINK_SHADES;
    let meshIndex = 0;

    instanceScene.traverse((child) => {
      if (child.userData?.isPlantSketchHelper) return;
      if (!(child instanceof Mesh) || !child.geometry) return;

      if (!child.userData.originalMaterialSaved) {
        child.userData.originalMaterial = child.material;
        child.userData.originalMaterialSaved = true;
      }

      if (pencilDraft) {
        const lowerName = child.name.toLowerCase();
        const isPot =
          lowerName.includes('vase') ||
          lowerName.includes('pot') ||
          lowerName.includes('cylinder') ||
          lowerName.includes('planter');
        const isSoilOrStem =
          lowerName.includes('soil') ||
          lowerName.includes('dirt') ||
          lowerName.includes('earth') ||
          lowerName.includes('stem') ||
          lowerName.includes('trunk') ||
          lowerName.includes('branch');

        const fillHex = isPot
          ? POT_PINK_HEX
          : isSoilOrStem
            ? STEM_SOIL_PINK_HEX
            : speciesPinks[meshIndex % speciesPinks.length];
        meshIndex += 1;

        child.material = getPinkToonMaterial(fillHex);

        if (!child.userData.pinkCharcoalEdges) {
          if (!child.geometry.userData.sharedPinkCharcoalGeo) {
            child.geometry.userData.sharedPinkCharcoalGeo = buildPlantCharcoalEdges(
              child.geometry
            );
          }
          const edgeLines = new LineSegments2(
            child.geometry.userData.sharedPinkCharcoalGeo,
            darkPinkEdgeMat
          );
          edgeLines.userData.isPlantSketchHelper = true;
          edgeLines.raycast = NOOP_RAYCAST;
          child.add(edgeLines);
          child.userData.pinkCharcoalEdges = edgeLines;
        }

        child.userData.pinkCharcoalEdges.visible = true;
      } else {
        if (child.userData.originalMaterialSaved) {
          child.material = child.userData.originalMaterial;
        }
        if (child.userData.pinkCharcoalEdges) {
          child.userData.pinkCharcoalEdges.visible = false;
        }
      }
    });
  }, [instanceScene, pencilDraft, plant.id]);

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
