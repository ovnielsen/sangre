import { useSphere } from '@react-three/cannon';
import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Camera, Euler, Object3D, Vector3 } from 'three';

export const PLAYER_SPEED = 6;
export const JUMP_FORCE = 7;
export const MOUSE_SENSITIVITY = 0.0022;
export const MAX_PITCH = Math.PI / 2 - 0.05;
export const FLOOR_Y = 0.85;
export const PLAYER_RADIUS = 0.35;
export const EYE_HEIGHT_OFFSET = 1.0;

export interface UsePlayerMovementOptions {
  initialPosition?: [number, number, number];
  isMenuOpen: boolean;
  domElement: HTMLElement;
}

export interface PlayerMovementController {
  colliderRef: MutableRefObject<Object3D | null>;
  menuOpenRef: MutableRefObject<boolean>;
  shiftHeldRef: MutableRefObject<boolean>;
  rightVectorRef: MutableRefObject<Vector3>;
  stepMovement: (camera: Camera) => void;
}

/**
 * Manages the player's dynamic sphere collider, WASD/Arrow movement, jumping,
 * and 360-degree Pointer Lock mouse look without allocating inside `useFrame`.
 */
export function usePlayerMovement({
  initialPosition,
  isMenuOpen,
  domElement,
}: UsePlayerMovementOptions): PlayerMovementController {
  const defaultSpawn: [number, number, number] = initialPosition ?? [
    1,
    FLOOR_Y + PLAYER_RADIUS,
    0,
  ];

  const [colliderRef, api] = useSphere(() => ({
    mass: 1,
    type: 'Dynamic',
    args: [PLAYER_RADIUS],
    position: defaultSpawn,
    fixedRotation: true,
    linearDamping: 0,
    collisionFilterGroup: 2,
    collisionFilterMask: -1,
    material: { friction: 0, restitution: 0 },
  }));

  const menuOpenRef = useRef(isMenuOpen);
  const velocity = useRef<[number, number, number]>([0, 0, 0]);
  const pos = useRef<[number, number, number]>(defaultSpawn);

  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const jumpQueued = useRef(false);
  const shiftHeldRef = useRef(false);
  const grounded = useRef(true);

  const yaw = useRef(0);
  const pitch = useRef(0);

  // Reusable math vectors for the hot loop
  const direction = useRef(new Vector3());
  const forward = useRef(new Vector3());
  const rightVectorRef = useRef(new Vector3());
  const euler = useRef(new Euler(0, 0, 0, 'YXZ'));

  useEffect(() => {
    menuOpenRef.current = isMenuOpen;
    if (isMenuOpen) {
      moveForward.current = false;
      moveBackward.current = false;
      moveLeft.current = false;
      moveRight.current = false;
      jumpQueued.current = false;
      shiftHeldRef.current = false;
    }
  }, [isMenuOpen]);

  useEffect(() => {
    const unsubVel = api.velocity.subscribe((v) => {
      velocity.current = v;
    });
    const unsubPos = api.position.subscribe((p) => {
      pos.current = p;
      grounded.current =
        p[1] <= FLOOR_Y + PLAYER_RADIUS + 0.15 && Math.abs(velocity.current[1]) < 0.5;
    });
    return () => {
      unsubVel();
      unsubPos();
    };
  }, [api]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent | MouseEvent) => {
      if (!menuOpenRef.current && document.pointerLockElement === domElement) {
        yaw.current -= event.movementX * MOUSE_SENSITIVITY;
        pitch.current = Math.max(
          -MAX_PITCH,
          Math.min(MAX_PITCH, pitch.current - event.movementY * MOUSE_SENSITIVITY)
        );
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (menuOpenRef.current) return;

      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        shiftHeldRef.current = true;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        jumpQueued.current = true;
      }

      switch (event.code) {
        case 'KeyW':
        case 'KeyZ':
        case 'ArrowUp':
          moveForward.current = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveBackward.current = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveLeft.current = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveRight.current = true;
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        shiftHeldRef.current = false;
      }

      switch (event.code) {
        case 'KeyW':
        case 'KeyZ':
        case 'ArrowUp':
          moveForward.current = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveBackward.current = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveLeft.current = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveRight.current = false;
          break;
        default:
          break;
      }
    };

    const handleBlur = () => {
      moveForward.current = false;
      moveBackward.current = false;
      moveLeft.current = false;
      moveRight.current = false;
      jumpQueued.current = false;
      shiftHeldRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [domElement]);

  const stepMovement = (camera: Camera) => {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    euler.current.set(0, yaw.current, 0, 'YXZ');
    forward.current.set(0, 0, -1).applyEuler(euler.current);
    rightVectorRef.current.set(1, 0, 0).applyEuler(euler.current);

    direction.current
      .set(0, 0, 0)
      .addScaledVector(
        forward.current,
        Number(moveForward.current) - Number(moveBackward.current)
      )
      .addScaledVector(
        rightVectorRef.current,
        Number(moveRight.current) - Number(moveLeft.current)
      )
      .multiplyScalar(PLAYER_SPEED);

    const shouldJump = jumpQueued.current && grounded.current;
    const jumpVelocity = shouldJump ? JUMP_FORCE : velocity.current[1];

    if (shouldJump) {
      jumpQueued.current = false;
      grounded.current = false;
    }

    camera.position.set(
      pos.current[0],
      pos.current[1] + EYE_HEIGHT_OFFSET,
      pos.current[2]
    );
    camera.updateMatrixWorld();
    api.velocity.set(direction.current.x, jumpVelocity, direction.current.z);
  };

  return {
    colliderRef,
    menuOpenRef,
    shiftHeldRef,
    rightVectorRef,
    stepMovement,
  };
}
