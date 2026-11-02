import { useFrame, useThree } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import { usePlantInteraction } from '../hooks/usePlantInteraction.ts';
import { usePlayerMovement } from '../hooks/usePlayerMovement.ts';

export type { HudMode } from '../utils/playerHud.ts';

export interface PlayerProps {
  position?: [number, number, number];
  isMenuOpen?: boolean;
  readOnly?: boolean;
  spawnPositionRef?: MutableRefObject<[number, number, number]>;
}

/**
 * First-person Player entity composing physics movement/mouse-look (`usePlayerMovement`)
 * with plant grabbing, wall-snapping, and HUD state (`usePlantInteraction`).
 */
export function Player({
  position,
  isMenuOpen = false,
  readOnly = false,
  spawnPositionRef,
}: PlayerProps) {
  const { gl, camera: initialCamera } = useThree();

  const { colliderRef, menuOpenRef, shiftHeldRef, rightVectorRef, stepMovement } =
    usePlayerMovement({
      initialPosition: position,
      isMenuOpen,
      domElement: gl.domElement,
    });

  const { stepInteraction } = usePlantInteraction({
    domElement: gl.domElement,
    initialCamera,
    menuOpenRef,
    shiftHeldRef,
    rightVectorRef,
    spawnPositionRef,
    readOnly,
  });

  useFrame(({ camera, raycaster, scene }) => {
    stepMovement(camera);
    stepInteraction({ camera, raycaster, scene });
  });

  return <mesh ref={colliderRef} />;
}
