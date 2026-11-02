import { useEffect, useMemo } from 'react';
import { useTrimesh } from '@react-three/cannon';
import {
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  EdgesGeometry,
  Mesh,
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
import { useProtectedGLTF } from '../hooks/useProtectedGLTF.ts';

const COLLIDER_MESH_NAMES = new Set(['Column', 'Exterior_wall', 'Interior_wall', 'Roof']);
const PHYSICS_EXCLUDED_NODES = new Set(['ligths', 'Slab001']);
const MAX_TRIANGLES_PER_MESH = 5000;
const NOOP_RAYCAST = () => {};

let cachedWallToonMaterial: MeshToonMaterial | null = null;
let cachedFloorToonMaterial: MeshToonMaterial | null = null;
let cachedCeilingToonMaterial: MeshToonMaterial | null = null;
let cachedCharcoalEdgeMaterial: LineMaterial | null = null;

function createToonMaterial(hexColor: string): MeshToonMaterial {
  const rampPixels = new Uint8Array([
    150, 166, 184, 255, // Shaded slate gray-blue tone
    186, 200, 216, 255, // Mid gray-blue drafting tone
    218, 228, 238, 255, // Soft gray-blue highlight
  ]);
  const gradientMap = new DataTexture(rampPixels, 3, 1, RGBAFormat);
  gradientMap.minFilter = NearestFilter;
  gradientMap.magFilter = NearestFilter;
  gradientMap.needsUpdate = true;

  return new MeshToonMaterial({
    color: new Color(hexColor),
    gradientMap,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
}

function getPencilMaterials() {
  if (!cachedWallToonMaterial) {
    cachedWallToonMaterial = createToonMaterial('#9eb2c6');
  }
  if (!cachedFloorToonMaterial) {
    cachedFloorToonMaterial = createToonMaterial('#768b9f');
  }
  if (!cachedCeilingToonMaterial) {
    cachedCeilingToonMaterial = createToonMaterial('#899eb3');
  }
  return {
    wall: cachedWallToonMaterial,
    floor: cachedFloorToonMaterial,
    ceiling: cachedCeilingToonMaterial,
  };
}

function getCharcoalCrayonEdgeMaterial(): LineMaterial {
  if (cachedCharcoalEdgeMaterial) {
    if (typeof window !== 'undefined') {
      cachedCharcoalEdgeMaterial.resolution.set(window.innerWidth, window.innerHeight);
    }
    return cachedCharcoalEdgeMaterial;
  }

  const mat = new LineMaterial({
    color: 0x0d2340, // Deep dark-blue charcoal / crayon pigment
    linewidth: 4.2,
    transparent: true,
    opacity: 0.92,
    dashed: false,
    resolution: new Vector2(
      typeof window !== 'undefined' ? window.innerWidth : 1280,
      typeof window !== 'undefined' ? window.innerHeight : 720
    ),
  });

  // Inject rough crayon / charcoal paper-tooth grain & frayed edges into LineMaterial fragment shader
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
      // Crayon / charcoal paper grain across screen coordinates and across stroke width (vUv.x)
      float radialDist = abs(vUv.x);
      float grainCoarse = valueNoise(gl_FragCoord.xy * 0.42);
      float grainFine = hash21(floor(gl_FragCoord.xy * 0.85));
      float crayonTooth = mix(grainCoarse, grainFine, 0.45);

      // Frayed charcoal edges & dry-crayon gaps near the outer border of the stroke
      float edgeRoughness = smoothstep(0.98, 0.15, radialDist + (crayonTooth - 0.5) * 0.65);
      float pressureGrain = 0.45 + 0.55 * smoothstep(0.12, 0.85, crayonTooth);
      float finalAlpha = alpha * edgeRoughness * pressureGrain;
      if (finalAlpha < 0.1) discard;

      // Deep dark-blue charcoal / indigo crayon in linear color space (before sRGB encoding)
      vec3 darkBlueCharcoal = mix(vec3(0.003, 0.012, 0.045), vec3(0.016, 0.042, 0.115), grainCoarse);
      gl_FragColor = vec4(darkBlueCharcoal, finalAlpha);
      `
    );
  };

  cachedCharcoalEdgeMaterial = mat;
  return mat;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Converts clean CAD edges into multi-pass, hand-wobbled, corner-overshot
 * charcoal/crayon strokes for LineSegments2.
 */
function buildSketchyCharcoalGeometry(sourceGeometry: BufferGeometry): LineSegmentsGeometry {
  const baseEdges = new EdgesGeometry(sourceGeometry, 25);
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
    const segmentCount = Math.floor(posAttr.count / 2);

    for (let i = 0; i < segmentCount; i++) {
      a.fromBufferAttribute(posAttr, i * 2);
      b.fromBufferAttribute(posAttr, i * 2 + 1);
      dir.subVectors(b, a);
      const len = dir.length();
      if (len < 0.02) continue;
      dir. divideScalar(len);

      // Build two perpendicular basis vectors for 3D hand wobble
      perp1.crossVectors(dir, Math.abs(dir.y) > 0.9 ? altUp : up).normalize();
      perp2.crossVectors(dir, perp1).normalize();

      // 3 overlapping hand-drawn charcoal passes per architectural edge
      const passes = len > 0.35 ? 3 : 2;
      const steps = Math.max(3, Math.min(14, Math.ceil(len / 0.45)));

      for (let pass = 0; pass < passes; pass++) {
        const seedBase = i * 31.7 + pass * 113.3;
        // Hand-drawn sketch overshoot at corners (2.5cm to 8cm)
        const overshootStart =
          (0.025 + pseudoRandom(seedBase + 1) * 0.055) * (pass === 0 ? 1.15 : 0.75);
        const overshootEnd =
          (0.025 + pseudoRandom(seedBase + 2) * 0.055) * (pass === 0 ? 1.15 : 0.75);

        const waveFreq = 1.8 + pseudoRandom(seedBase + 3) * 2.8;
        const wavePhase = pseudoRandom(seedBase + 4) * Math.PI * 2;
        const wobbleAmp = Math.min(0.028, Math.max(0.008, len * 0.016)) * (0.8 + pass * 0.35);
        const passOffset1 = (pass - 1) * 0.011;
        const passOffset2 = (pseudoRandom(seedBase + 5) - 0.5) * 0.012;

        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const distAlong = -overshootStart + t * (len + overshootStart + overshootEnd);

          pCurr.copy(a).addScaledVector(dir, distAlong);

          // Organic hand wave + slight jitter along the stroke
          const envelope = Math.sin(t * Math.PI);
          const wave1 =
            Math.sin(t * Math.PI * waveFreq + wavePhase) * wobbleAmp * envelope +
            (pseudoRandom(seedBase + s * 7.1) - 0.5) * wobbleAmp * 0.55;
          const wave2 =
            Math.cos(t * Math.PI * (waveFreq * 0.8) + wavePhase) * wobbleAmp * 0.7 * envelope +
            (pseudoRandom(seedBase + s * 13.7) - 0.5) * wobbleAmp * 0.55;

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

function isExcludedFromPhysics(object: Object3D | null): boolean {
  let curr: Object3D | null = object;
  while (curr) {
    if (PHYSICS_EXCLUDED_NODES.has(curr.name)) {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

function isLightFixtureNode(object: Object3D | null): boolean {
  let curr: Object3D | null = object;
  while (curr) {
    if (curr.name === 'ligths' || curr.name.startsWith('Crystal')) {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

export function GltfModel(props: any) {
  const gltf = useProtectedGLTF(props.modelPath) as { scene: Object3D };
  const [px = 0, py = 0, pz = 0] = Array.isArray(props.position) ? props.position : [0, 0, 0];
  const [rx = 0, ry = 0, rz = 0] = Array.isArray(props.rotation) ? props.rotation : [0, 0, 0];
  const [sx = 1, sy = 1, sz = 1] = Array.isArray(props.scale)
    ? props.scale
    : typeof props.scale === 'number'
      ? [props.scale, props.scale, props.scale]
      : [1, 1, 1];

  const [vertices, indices] = useMemo(() => {
    const verts: number[] = [];
    const inds: number[] = [];
    const tempVec = new Vector3();

    gltf.scene.position.set(px, py, pz);
    gltf.scene.rotation.set(rx, ry, rz);
    gltf.scene.scale.set(sx, sy, sz);
    gltf.scene.updateMatrixWorld(true);

    gltf.scene.traverse((child) => {
      if (child.userData?.isSketchHelper) return;
      if (!(child instanceof Mesh) || !child.geometry) return;

      const geometry = child.geometry;
      const posAttr = geometry.attributes.position;
      if (!posAttr) return;

      const indexCount = geometry.index ? geometry.index.count : posAttr.count;
      const triangleCount = indexCount / 3;

      // Exclude specific collections/nodes (e.g. 'ligths') and high-poly decorative sub-meshes (>5k triangles) from physics
      if (
        isExcludedFromPhysics(child) ||
        (!COLLIDER_MESH_NAMES.has(child.name) &&
          (triangleCount > MAX_TRIANGLES_PER_MESH ||
            child.name.startsWith('Crystal') ||
            child.name.startsWith('OutsideShell')))
      ) {
        child.raycast = NOOP_RAYCAST;
        return;
      }

      child.userData.isWall = true;

      const vertexOffset = verts.length / 3;

      for (let i = 0; i < posAttr.count; i++) {
        tempVec.fromBufferAttribute(posAttr, i).applyMatrix4(child.matrixWorld);
        verts.push(tempVec.x, tempVec.y, tempVec.z);
      }

      if (geometry.index) {
        const indexArray = geometry.index.array;
        for (let i = 0; i < indexArray.length; i++) {
          inds.push(vertexOffset + indexArray[i]);
        }
      } else {
        for (let i = 0; i < posAttr.count; i++) {
          inds.push(vertexOffset + i);
        }
      }
    });

    return [new Float32Array(verts), new Uint32Array(inds)];
  }, [gltf.scene, px, py, pz, rx, ry, rz, sx, sy, sz]);

  const pencilDraft = Boolean(props.pencilDraft);

  useEffect(() => {
    const materials = getPencilMaterials();
    const charcoalEdgeMat = getCharcoalCrayonEdgeMaterial();

    const handleResize = () => {
      charcoalEdgeMat.resolution.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    gltf.scene.traverse((child) => {
      if (child.userData?.isSketchHelper) return;

      // Disable embedded point/spot lights in Pencil Draft mode so radial light falloff never creates concentric toon rings
      if ((child as any).isLight) {
        if (child.userData.originalLightVisible === undefined) {
          child.userData.originalLightVisible = child.visible;
        }
        child.visible = pencilDraft ? false : Boolean(child.userData.originalLightVisible);
        return;
      }

      if (!(child instanceof Mesh) || !child.geometry) return;

      if (!child.userData.originalMaterialSaved) {
        child.userData.originalMaterial = child.material;
        child.userData.originalMaterialSaved = true;
      }

      if (pencilDraft) {
        const isFloor = child.name.includes('Slab') || child.name.includes('Floor');
        const isRoof = child.name.includes('Roof') || child.name.includes('Ceiling');
        child.material = isFloor
          ? materials.floor
          : isRoof
            ? materials.ceiling
            : materials.wall;

        const skipEdges = isLightFixtureNode(child);

        if (!skipEdges && !child.userData.sketchPrimaryEdges) {
          const sketchyGeo = buildSketchyCharcoalGeometry(child.geometry);
          const primaryLines = new LineSegments2(sketchyGeo, charcoalEdgeMat);
          primaryLines.userData.isSketchHelper = true;
          primaryLines.raycast = NOOP_RAYCAST;
          child.add(primaryLines);
          child.userData.sketchPrimaryEdges = primaryLines;
        }

        if (child.userData.sketchPrimaryEdges) {
          child.userData.sketchPrimaryEdges.visible = !skipEdges;
        }
      } else {
        if (child.userData.originalMaterialSaved) {
          child.material = child.userData.originalMaterial;
        }
        if (child.userData.sketchPrimaryEdges) {
          child.userData.sketchPrimaryEdges.visible = false;
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [gltf.scene, pencilDraft]);

  useTrimesh(
    () => ({
      type: 'Static',
      args: [vertices, indices],
      material: { friction: 0, restitution: 0 },
    }),
    undefined,
    [vertices, indices]
  );

  return <primitive {...props} object={gltf.scene} />;
}
