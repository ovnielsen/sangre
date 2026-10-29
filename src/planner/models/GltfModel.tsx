import { useMemo } from 'react';
import { useTrimesh } from '@react-three/cannon';
import { Mesh, Object3D, Vector3 } from 'three';
import { useProtectedGLTF } from '../hooks/useProtectedGLTF.ts';

const COLLIDER_MESH_NAMES = new Set(['Column', 'Exterior_wall', 'Interior_wall', 'Roof']);
const PHYSICS_EXCLUDED_NODES = new Set(['ligths', 'Slab001']);
const MAX_TRIANGLES_PER_MESH = 5000;
const NOOP_RAYCAST = () => {};

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
