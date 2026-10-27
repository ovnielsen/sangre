import { useMemo } from 'react';
import { useTrimesh } from '@react-three/cannon';
import { Mesh, Object3D, Vector3 } from 'three';
import { useProtectedGLTF } from '../hooks/useProtectedGLTF.ts';

const COLLIDER_MESH_NAMES = new Set(['Column', 'Exterior_wall', 'Interior_wall', 'Roof']);
const MAX_TRIANGLES_PER_MESH = 5000;
const NOOP_RAYCAST = () => {};

export function GltfModel(props: any) {
  const gltf = useProtectedGLTF(props.modelPath) as { scene: Object3D };

  const [vertices, indices] = useMemo(() => {
    const verts: number[] = [];
    const inds: number[] = [];
    const tempVec = new Vector3();

    gltf.scene.updateMatrixWorld(true);

    gltf.scene.traverse((child) => {
      if (!(child instanceof Mesh) || !child.geometry) return;

      const geometry = child.geometry;
      const posAttr = geometry.attributes.position;
      if (!posAttr) return;

      const indexCount = geometry.index ? geometry.index.count : posAttr.count;
      const triangleCount = indexCount / 3;

      // Automatically skip high-poly decorative sub-meshes (>5k triangles) so any new building.glb stays fast
      if (
        !COLLIDER_MESH_NAMES.has(child.name) &&
        (triangleCount > MAX_TRIANGLES_PER_MESH ||
          child.name.startsWith('Crystal') ||
          child.name.startsWith('OutsideShell') ||
          child.name === 'Slab001')
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
  }, [gltf.scene]);

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
