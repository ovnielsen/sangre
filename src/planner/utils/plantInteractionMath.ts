import { Camera, Object3D, Raycaster, Vector2, Vector3 } from 'three';

export const WALL_SNAP_RANGE = 6.5;

export interface SceneTargets {
  pinnedCount: number;
  wallMeshes: Object3D[];
  draggableGroups: Object3D[];
}

/**
 * Walks up the parent chain from a raycast hit mesh to locate its draggable root group.
 */
export function findDraggableGroup(obj: Object3D | null): Object3D | null {
  let curr: Object3D | null = obj;
  while (curr) {
    if (curr.userData?.draggable) {
      return curr;
    }
    curr = curr.parent;
  }
  return null;
}

/**
 * Collects all newly spawned plant groups that requested immediate crosshair auto-grab.
 */
export function collectAutoGrabGroups(root: Object3D, out: Object3D[]): void {
  if (root.userData?.draggable && root.userData?.autoGrab) {
    out.push(root);
  }
  for (let i = 0; i < root.children.length; i++) {
    collectAutoGrabGroups(root.children[i], out);
  }
}

/**
 * Single-pass scene traversal collecting low-poly wall colliders, draggable plant roots,
 * and the current wall-pinned plant count.
 */
export function collectSceneTargets(root: Object3D, out: SceneTargets): void {
  if (root.userData?.isWall) {
    out.wallMeshes.push(root);
  }
  if (root.userData?.draggable) {
    out.draggableGroups.push(root);
    if (root.userData.pinned) {
      out.pinnedCount += 1;
    }
    return;
  }
  for (let i = 0; i < root.children.length; i++) {
    collectSceneTargets(root.children[i], out);
  }
}

export interface WallSnapQueryParams {
  camera: Camera;
  raycaster: Raycaster;
  centerScreen: Vector2;
  wallMeshes: Object3D[];
  wallOffset: number;
  minCenterY: number;
  tempNormal: Vector3;
  outSnapPosition: Vector3;
}

/**
 * Zero-allocation wall-snap solver.
 * Checks direct center-screen raycast against structural wall meshes so that
 * snapped plants stay aligned with the player's crosshair line of sight.
 */
export function computeWallSnapPosition({
  camera,
  raycaster,
  centerScreen,
  wallMeshes,
  wallOffset,
  minCenterY,
  tempNormal,
  outSnapPosition,
}: WallSnapQueryParams): boolean {
  if (wallMeshes.length === 0) return false;

  raycaster.setFromCamera(centerScreen, camera);
  const wallHits = raycaster.intersectObjects(wallMeshes, false);

  for (let i = 0; i < wallHits.length; i++) {
    const hit = wallHits[i];
    if (hit.distance > WALL_SNAP_RANGE) break;
    if (!hit.face) continue;

    tempNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    // Only snap to vertical/near-vertical surfaces (exclude floor & ceiling)
    if (Math.abs(tempNormal.y) < 0.65) {
      if (tempNormal.dot(raycaster.ray.direction) > 0) {
        tempNormal.negate();
      }
      outSnapPosition.copy(hit.point).addScaledVector(tempNormal, wallOffset);
      outSnapPosition.y = Math.max(minCenterY + 0.2, outSnapPosition.y);
      return true;
    }
  }

  return false;
}
