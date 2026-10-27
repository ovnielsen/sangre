import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Camera, Object3D, Raycaster, Scene, Vector2, Vector3 } from 'three';
import {
  collectAutoGrabGroups,
  collectSceneTargets,
  computeWallSnapPosition,
  findDraggableGroup,
} from '../utils/plantInteractionMath.ts';
import {
  updateHudPinnedCount,
  updateHudState,
  type HudMode,
} from '../utils/playerHud.ts';
import { FLOOR_Y } from './usePlayerMovement.ts';

export const GRAB_RANGE = 10;
export const HOLD_DISTANCE = 2.2;

export interface UsePlantInteractionOptions {
  domElement: HTMLElement;
  initialCamera: Camera;
  menuOpenRef: MutableRefObject<boolean>;
  shiftHeldRef: MutableRefObject<boolean>;
  rightVectorRef: MutableRefObject<Vector3>;
  spawnPositionRef?: MutableRefObject<[number, number, number]>;
}

export interface StepInteractionParams {
  camera: Camera;
  raycaster: Raycaster;
  scene: Scene;
}

/**
 * Manages plant grabbing (`KeyE`), dropping with gravity (`KeyE` / `Click`),
 * wall-snapping (`Shift+E` / `Shift+Click`), free-pointer dragging (`KeyQ`),
 * and HUD state updates.
 */
export function usePlantInteraction({
  domElement,
  initialCamera,
  menuOpenRef,
  shiftHeldRef,
  rightVectorRef,
  spawnPositionRef,
}: UsePlantInteractionOptions) {
  const cameraRef = useRef(initialCamera);
  const freeCursorMode = useRef(false);
  const hoveredGroup = useRef<Object3D | null>(null);
  const grabbedGroup = useRef<Object3D | null>(null);

  // Reusable math objects for the hot loop
  const targetWorldPos = useRef(new Vector3());
  const wallSnapPos = useRef(new Vector3());
  const wallHitValid = useRef(false);
  const tempNormal = useRef(new Vector3());
  const centerScreen = useRef(new Vector2(0, 0));

  const prevHudMode = useRef<HudMode>('idle');
  const prevPinnedCount = useRef(-1);

  useEffect(() => {
    cameraRef.current = initialCamera;
  }, [initialCamera]);

  useEffect(() => {
    let downX = 0;
    let downY = 0;

    const triggerInteractAction = (withShift: boolean, source: 'key' | 'mouse'): boolean => {
      // 1. Place (wall-snap with Shift) or drop (gravity without Shift) the currently held plant
      if (grabbedGroup.current) {
        const group = grabbedGroup.current;
        const plantScale = Number(group.userData.plantScale) || 1;
        const minCenterY = FLOOR_Y + 0.64 * plantScale;

        group.userData.grabbed = false;
        group.userData.wallSnapPreview = false;

        if (withShift) {
          group.userData.pinned = true;
          const snapTarget = wallHitValid.current ? wallSnapPos.current : targetWorldPos.current;
          if (group.userData.targetWorldCenter instanceof Vector3) {
            group.userData.targetWorldCenter.copy(snapTarget);
            group.userData.targetWorldCenter.y = Math.max(
              minCenterY + 0.25,
              group.userData.targetWorldCenter.y
            );
          }
        } else {
          group.userData.pinned = false;
        }

        grabbedGroup.current = null;
        return true;
      }

      // 2. Unpin a wall-pinned plant ONLY when directly hovering it with the crosshair
      if (hoveredGroup.current && hoveredGroup.current.userData.pinned && !withShift) {
        const pinnedTarget = hoveredGroup.current;
        pinnedTarget.userData.pinned = false;
        pinnedTarget.userData.grabbed = false;
        pinnedTarget.userData.wallSnapPreview = false;
        return true;
      }

      // 3. Grab a hovered plant into the center-crosshair with KeyE
      if (source === 'key' && hoveredGroup.current) {
        const group = hoveredGroup.current;
        grabbedGroup.current = group;
        group.userData.pinned = false;
        group.userData.grabbed = true;
        group.userData.wallSnapPreview = false;

        cameraRef.current.updateMatrixWorld();
        targetWorldPos.current
          .set(0, -0.1, -HOLD_DISTANCE)
          .applyMatrix4(cameraRef.current.matrixWorld);

        if (group.userData.targetWorldCenter instanceof Vector3) {
          group.userData.targetWorldCenter.copy(targetWorldPos.current);
        }

        if (document.pointerLockElement !== domElement) {
          freeCursorMode.current = false;
          domElement.requestPointerLock?.();
        }
        return true;
      }

      return false;
    };

    const handlePointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (menuOpenRef.current) return;
      const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
      if (event.button === 0 && moved < 5 && !freeCursorMode.current) {
        // If pointer is not locked yet and we aren't holding a plant, this click only locks the pointer
        if (document.pointerLockElement !== domElement && !grabbedGroup.current) {
          try {
            const res = domElement.requestPointerLock?.();
            if (res && typeof (res as Promise<unknown>).catch === 'function') {
              (res as Promise<unknown>).catch(() => {});
            }
          } catch {
            // Ignore pointer lock rejection
          }
          return;
        }

        const withShift = event.shiftKey || shiftHeldRef.current;
        triggerInteractAction(withShift, 'mouse');
        if (document.pointerLockElement !== domElement) {
          try {
            const res = domElement.requestPointerLock?.();
            if (res && typeof (res as Promise<unknown>).catch === 'function') {
              (res as Promise<unknown>).catch(() => {});
            }
          } catch {
            // Ignore pointer lock rejection
          }
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (menuOpenRef.current || event.repeat) return;

      if (event.code === 'KeyE') {
        const withShift = event.shiftKey || shiftHeldRef.current;
        triggerInteractAction(withShift, 'key');
        return;
      }

      if (event.code === 'KeyQ') {
        if (grabbedGroup.current) {
          grabbedGroup.current.userData.grabbed = false;
          grabbedGroup.current.userData.wallSnapPreview = false;
          grabbedGroup.current = null;
        }
        if (document.pointerLockElement === domElement || !freeCursorMode.current) {
          freeCursorMode.current = true;
          if (document.pointerLockElement === domElement) {
            document.exitPointerLock?.();
          }
        } else {
          freeCursorMode.current = false;
          domElement.requestPointerLock?.();
        }
      }
    };

    domElement.addEventListener('pointerdown', handlePointerDown);
    domElement.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [domElement, menuOpenRef, shiftHeldRef]);

  const stepInteraction = ({ camera, raycaster, scene }: StepInteractionParams) => {
    // 1. Update center-crosshair hold position in world space
    targetWorldPos.current
      .set(0, shiftHeldRef.current ? 0.15 : -0.1, -HOLD_DISTANCE)
      .applyMatrix4(camera.matrixWorld);

    if (spawnPositionRef) {
      spawnPositionRef.current = [
        targetWorldPos.current.x,
        Math.max(FLOOR_Y + 0.75, targetWorldPos.current.y),
        targetWorldPos.current.z,
      ];
    }

    // 2. Claim any newly spawned plant(s) requesting immediate crosshair auto-grab
    const autoGrabCandidates: Object3D[] = [];
    collectAutoGrabGroups(scene, autoGrabCandidates);
    if (autoGrabCandidates.length > 0) {
      for (let i = 0; i < autoGrabCandidates.length; i++) {
        autoGrabCandidates[i].userData.autoGrab = false;
        autoGrabCandidates[i].userData.grabbed = false;
      }

      const newestCandidate = autoGrabCandidates[autoGrabCandidates.length - 1];

      if (grabbedGroup.current && grabbedGroup.current !== newestCandidate) {
        const prevGroup = grabbedGroup.current;
        prevGroup.userData.grabbed = false;
        prevGroup.userData.autoGrab = false;
        prevGroup.userData.wallSnapPreview = false;
        if (prevGroup.userData.targetWorldCenter instanceof Vector3) {
          prevGroup.userData.targetWorldCenter.addScaledVector(rightVectorRef.current, -0.55);
        }
      }

      newestCandidate.userData.pinned = false;
      newestCandidate.userData.grabbed = true;
      grabbedGroup.current = newestCandidate;
      freeCursorMode.current = false;
    }

    // 3. Collect scene wall colliders, draggable plants, and wall-pinned count
    const sceneTargets = {
      pinnedCount: 0,
      wallMeshes: [] as Object3D[],
      draggableGroups: [] as Object3D[],
    };
    collectSceneTargets(scene, sceneTargets);

    // 4. Update held plant position (or wall-snap preview) vs. hover detection
    if (grabbedGroup.current) {
      const group = grabbedGroup.current;
      const plantScale = Number(group.userData.plantScale) || 1;
      const wallOffset = 0.36 * plantScale;
      const minCenterY = FLOOR_Y + 0.64 * plantScale;

      const foundWallHit = shiftHeldRef.current
        ? computeWallSnapPosition({
            camera,
            raycaster,
            centerScreen: centerScreen.current,
            wallMeshes: sceneTargets.wallMeshes,
             wallOffset,
            minCenterY,
            tempNormal: tempNormal.current,
            outSnapPosition: wallSnapPos.current,
          })
        : false;

      wallHitValid.current = foundWallHit;
      group.userData.wallSnapPreview = shiftHeldRef.current;

      const activeTarget =
        shiftHeldRef.current && foundWallHit ? wallSnapPos.current : targetWorldPos.current;

      if (group.userData.targetWorldCenter instanceof Vector3) {
        group.userData.targetWorldCenter.copy(activeTarget);
        if (shiftHeldRef.current) {
          group.userData.targetWorldCenter.y = Math.max(
            minCenterY + 0.25,
            group.userData.targetWorldCenter.y
          );
        }
      } else {
        group.matrix.setPosition(activeTarget);
        group.matrixWorldNeedsUpdate = true;
      }
    } else if (!freeCursorMode.current) {
      wallHitValid.current = false;
      hoveredGroup.current = null;
      if (sceneTargets.draggableGroups.length > 0) {
        raycaster.setFromCamera(centerScreen.current, camera);
        const intersects = raycaster.intersectObjects(sceneTargets.draggableGroups, true);
        for (let i = 0; i < intersects.length; i++) {
          const hit = intersects[i];
          if (hit.distance > GRAB_RANGE) break;
          const draggable = findDraggableGroup(hit.object);
          if (draggable) {
            hoveredGroup.current = draggable;
            break;
          }
        }
      }
    } else {
      wallHitValid.current = false;
      hoveredGroup.current = null;
    }

    // 5. Sync HUD DOM state only when values change
    if (sceneTargets.pinnedCount !== prevPinnedCount.current) {
      prevPinnedCount.current = sceneTargets.pinnedCount;
      updateHudPinnedCount(sceneTargets.pinnedCount);
    }

    const nextHudMode: HudMode = freeCursorMode.current
      ? 'free'
      : grabbedGroup.current
        ? shiftHeldRef.current
          ? 'wall-snap'
          : 'grabbed'
        : hoveredGroup.current
          ? hoveredGroup.current.userData.pinned
            ? 'hover-pinned'
            : 'hover'
          : 'idle';

    if (nextHudMode !== prevHudMode.current) {
      prevHudMode.current = nextHudMode;
      updateHudState(nextHudMode);
    }
  };

  return {
    stepInteraction,
  };
}
