import { Suspense, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { DragControls } from '@react-three/drei';
import { useCompoundBody } from '@react-three/cannon';
import { Group, Matrix4, Vector3 } from 'three';
import type { PlantItem } from '../data/plantCatalog.ts';
import { registerLivePlant } from '../utils/plantSaveStorage.ts';
import { PlantMesh } from './PlantMesh.tsx';

const FLOOR_Y = 0.85;
const BASE_HALF_HEIGHT = 0.64;
const SETTLE_FRAME_THRESHOLD = 18;
const SETTLE_SPEED_SQ_LIMIT = 0.0025;
const POSITION_EPSILON_SQ = 1e-6;
const WORKER_SYNC_COOLDOWN_FRAMES = 4;

export interface DragModelProps {
  instanceId?: string;
  plant: PlantItem;
  initialPosition: [number, number, number];
  autoGrab?: boolean;
  initialPinned?: boolean;
}

export function DragModel({
  instanceId = 'plant-default',
  plant,
  initialPosition,
  autoGrab = false,
  initialPinned = false,
}: DragModelProps) {
  const groupRef = useRef<Group>(null);
  const [matrix] = useState(() =>
    new Matrix4().setPosition(initialPosition[0], initialPosition[1], initialPosition[2])
  );
  const isDragging = useRef(false);
  const startStatic = autoGrab || initialPinned;
  const prevPhysicsActive = useRef(!startStatic);
  const isSettled = useRef(false);
  const settleFrames = useRef(0);
  const workerSyncCooldown = useRef(0);
  const s = plant.scale;
  const minOffsetY = BASE_HALF_HEIGHT * s;
  const dynamicMass = Math.max(1, 2 * s);

  const targetWorldCenter = useRef(
    new Vector3(initialPosition[0], initialPosition[1], initialPosition[2])
  );
  const lastAppliedPos = useRef(new Vector3(NaN, NaN, NaN));
  const physicsPos = useRef<[number, number, number]>([
    initialPosition[0],
    initialPosition[1],
    initialPosition[2],
  ]);
  const physicsVel = useRef<[number, number, number]>([0, 0, 0]);

  // Physics starts inactive (mass: 0) when spawned in crosshair (autoGrab) or loaded wall-pinned (initialPinned)
  const [, api] = useCompoundBody(() => ({
    mass: startStatic ? 0 : dynamicMass,
    type: 'Dynamic',
    position: [initialPosition[0], initialPosition[1], initialPosition[2]],
    fixedRotation: true,
    linearDamping: 0.85,
    allowSleep: true,
    sleepSpeedLimit: 0.25,
    sleepTimeLimit: 0.4,
    collisionFilterGroup: 4,
    collisionFilterMask: startStatic ? 0 : -1,
    material: { friction: 0.3, restitution: 0.05 },
    shapes: [
      { type: 'Sphere', args: [0.22 * s], position: [0, -0.42 * s, 0] },
      { type: 'Sphere', args: [0.28 * s], position: [0, 0, 0] },
      { type: 'Sphere', args: [0.35 * s], position: [0, 0.35 * s, 0] },
    ],
  }));

  useEffect(() => {
    const unsubPos = api.position.subscribe((p) => {
      // Ignore stale Web Worker position ticks while held, wall-pinned, settled, or during drop handoff cooldown
      if (
        !prevPhysicsActive.current ||
        isSettled.current ||
        workerSyncCooldown.current > 0
      ) {
        return;
      }
      physicsPos.current = p;
    });
    const unsubVel = api.velocity.subscribe((v) => {
      if (
        !prevPhysicsActive.current ||
        isSettled.current ||
        workerSyncCooldown.current > 0
      ) {
        return;
      }
      physicsVel.current = v;
    });
    return () => {
      unsubPos();
      unsubVel();
    };
  }, [api]);

  const initialPosRef = useRef(initialPosition);
  const initialAutoGrabRef = useRef(autoGrab);
  const initialPinnedRef = useRef(initialPinned);
  const initialScaleRef = useRef(s);
  const initialNameRef = useRef(plant.name);

  useEffect(() => {
    if (groupRef.current) {
      const [ix, iy, iz] = initialPosRef.current;
      groupRef.current.matrix.setPosition(ix, iy, iz);
      groupRef.current.matrixWorldNeedsUpdate = true;
      lastAppliedPos.current.set(ix, iy, iz);
      groupRef.current.userData.draggable = true;
      groupRef.current.userData.grabbed = initialAutoGrabRef.current;
      groupRef.current.userData.pinned = initialPinnedRef.current;
      groupRef.current.userData.wallSnapPreview = false;
      groupRef.current.userData.autoGrab = initialAutoGrabRef.current;
      groupRef.current.userData.plantScale = initialScaleRef.current;
      groupRef.current.userData.plantName = initialNameRef.current;
      groupRef.current.userData.targetWorldCenter = targetWorldCenter.current;
      groupRef.current.userData.physicsPos = physicsPos;
    }
  }, []);

  useEffect(() => {
    return registerLivePlant(instanceId, () => ({
      plantId: plant.id,
      position: [
        targetWorldCenter.current.x,
        targetWorldCenter.current.y,
        targetWorldCenter.current.z,
      ],
      pinned: Boolean(groupRef.current?.userData.pinned),
    }));
  }, [instanceId, plant.id]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const isGrabbed = Boolean(group.userData.grabbed) || Boolean(group.userData.autoGrab);
    const isHeld = isDragging.current || isGrabbed;
    const isPinned = Boolean(group.userData.pinned) && !isHeld;
    const shouldActivatePhysics = !isHeld && !isPinned;

    // Only activate gravity & collisions when the plant is released in space (not held and not wall-pinned)
    if (shouldActivatePhysics !== prevPhysicsActive.current) {
      prevPhysicsActive.current = shouldActivatePhysics;
      isSettled.current = false;
      settleFrames.current = 0;

      const curX = targetWorldCenter.current.x;
      const curY = Math.max(FLOOR_Y + minOffsetY, targetWorldCenter.current.y);
      const curZ = targetWorldCenter.current.z;
      targetWorldCenter.current.set(curX, curY, curZ);
      physicsPos.current = [curX, curY, curZ];
      physicsVel.current = [0, 0, 0];

      if (shouldActivatePhysics) {
        workerSyncCooldown.current = WORKER_SYNC_COOLDOWN_FRAMES;
        api.position.set(curX, curY, curZ);
        api.velocity.set(0, 0, 0);
        api.collisionFilterMask.set(-1);
        api.mass.set(dynamicMass);
        api.wakeUp();
      } else {
        workerSyncCooldown.current = 0;
        // Disable physics & gravity while held or wall-snapped so there is zero spring bounce or CPU load
        api.mass.set(0);
        api.velocity.set(0, 0, 0);
        api.position.set(curX, curY, curZ);
        api.collisionFilterMask.set(0);
      }
    }

    let nextX: number;
    let nextY: number;
    let nextZ: number;

    if (!shouldActivatePhysics) {
      nextX = targetWorldCenter.current.x;
      nextY = Math.max(FLOOR_Y + minOffsetY, targetWorldCenter.current.y);
      nextZ = targetWorldCenter.current.z;
      physicsPos.current = [nextX, nextY, nextZ];
    } else if (isSettled.current) {
      // Plant has already settled on the floor; skip physics & matrix recalculations
      return;
    } else if (workerSyncCooldown.current > 0) {
      // Hold at drop coordinates while the physics Web Worker processes api.position.set(curX, curY, curZ)
      workerSyncCooldown.current -= 1;
      nextX = targetWorldCenter.current.x;
      nextY = targetWorldCenter.current.y;
      nextZ = targetWorldCenter.current.z;
      physicsPos.current = [nextX, nextY, nextZ];
    } else {
      nextX = physicsPos.current[0];
      nextY = physicsPos.current[1];
      nextZ = physicsPos.current[2];
      targetWorldCenter.current.set(nextX, nextY, nextZ);

      // Check if the dropped plant has come to rest so we can freeze its cannon-es body
      const [vx, vy, vz] = physicsVel.current;
      const speedSq = vx * vx + vy * vy + vz * vz;
      if (speedSq < SETTLE_SPEED_SQ_LIMIT && nextY <= FLOOR_Y + minOffsetY + 0.15) {
        settleFrames.current += 1;
        if (settleFrames.current >= SETTLE_FRAME_THRESHOLD) {
          isSettled.current = true;
          api.mass.set(0);
          api.velocity.set(0, 0, 0);
          api.collisionFilterMask.set(0);
        }
      } else {
        settleFrames.current = 0;
      }
    }

    // Dirty check: only update matrix & matrixWorldNeedsUpdate when the position actually changes
    const dx = nextX - lastAppliedPos.current.x;
    const dy = nextY - lastAppliedPos.current.y;
    const dz = nextZ - lastAppliedPos.current.z;
    if (dx * dx + dy * dy + dz * dz > POSITION_EPSILON_SQ) {
      lastAppliedPos.current.set(nextX, nextY, nextZ);
      group.matrix.setPosition(nextX, nextY, nextZ);
      group.matrixWorldNeedsUpdate = true;
      if (!shouldActivatePhysics) {
        // Keep the physics worker body synced with the held/pinned position so releasing it never jumps back
        api.position.set(nextX, nextY, nextZ);
      }
    }
  });

  return (
    <DragControls
      ref={groupRef}
      matrix={matrix}
      autoTransform={false}
      onDragStart={() => {
        // Only allow DragControls gizmo dragging when explicitly in [Q] Free Pointer Mode
        const isFreeMode =
          document.getElementById('fps-crosshair')?.dataset.mode === 'free';
        if (
          !isFreeMode ||
          document.pointerLockElement ||
          groupRef.current?.userData.grabbed
        ) {
          return;
        }
        isDragging.current = true;
        isSettled.current = false;
        settleFrames.current = 0;
        if (groupRef.current) {
          groupRef.current.userData.pinned = false;
        }
        targetWorldCenter.current.set(
          physicsPos.current[0],
          physicsPos.current[1],
          physicsPos.current[2]
        );
      }}
      onDrag={(localMatrix) => {
        if (!isDragging.current || document.pointerLockElement) return;
        targetWorldCenter.current.setFromMatrixPosition(localMatrix);
      }}
      onDragEnd={() => {
        isDragging.current = false;
      }}
    >
      {/* Low-poly proxy hitbox (8 sides) so pointer & crosshair raycasts never test leaf triangles */}
      <mesh>
        <cylinderGeometry args={[0.32 * s, 0.24 * s, 1.24 * s, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Suspense fallback={null}>
        <PlantMesh plant={plant} />
      </Suspense>
    </DragControls>
  );
}
