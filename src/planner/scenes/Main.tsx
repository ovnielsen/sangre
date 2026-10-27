import { Suspense } from 'react';
import type { MutableRefObject } from 'react';
import { Debug, usePlane } from '@react-three/cannon';
import buildingPath from '../assets/building.glb';
import type { SpawnedPlant } from '../data/plantCatalog.ts';

import { DragModel } from '../models/DragModel.tsx';
import { GltfModel } from '../models/GltfModel.tsx';
import { Ground } from '../components/Ground.tsx';
import { Player } from '../components/Player.tsx';
import { Stats } from '@react-three/drei';

export interface MainProps {
  spawnedPlants: SpawnedPlant[];
  isMenuOpen: boolean;
  spawnPositionRef: MutableRefObject<[number, number, number]>;
}

function Main({ spawnedPlants, isMenuOpen, spawnPositionRef }: MainProps) {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0.85, 0],
    material: { friction: 0, restitution: 0 },
  }));

  return (
    <>
    <Stats/>
    <Debug>
      <Player
        position={[1, 1.25, 0]}
        isMenuOpen={isMenuOpen}
        spawnPositionRef={spawnPositionRef}
      />
      <Suspense fallback={null}>
        <GltfModel modelPath={buildingPath} />
        {spawnedPlants.map((entry) => (
          <DragModel
            key={entry.instanceId}
            instanceId={entry.instanceId}
            plant={entry.plant}
            initialPosition={entry.initialPosition}
            autoGrab={entry.autoGrab}
            initialPinned={entry.initialPinned}
          />
        ))}
      </Suspense>
      <Ground ref={ref} position={[0, 0.85, 0]} />
      </Debug>
    </>
  );
}

export default Main;
