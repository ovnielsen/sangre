import calatheaPath from '../assets/calathea.glb';
import elephantPath from '../assets/elephantplant.glb';
import lushfernPath from '../assets/lushfern.glb';
import monsteraPath from '../assets/monstera.glb';
import pothoPath from '../assets/potho.glb';
import strelitziaPath from '../assets/pottedstrelizia.glb';
import stellariaPath from '../assets/stellariadichotoma.glb';

export interface PlantItem {
  id: string;
  slot: number;
  name: string;
  codeName: string;
  category: string;
  modelPath: string;
  price: number;
  scale: number;
  leafTint?: string;
  potTint?: string;
  origin: string;
  weightKg: number;
  stats: {
    sunlight: number;
    hydration: number;
    foliage: number;
    resilience: number;
  };
  description: string;
}

export interface SpawnedPlant {
  instanceId: string;
  plant: PlantItem;
  initialPosition: [number, number, number];
  autoGrab?: boolean;
  initialPinned?: boolean;
}

export const PLANT_CATALOG: PlantItem[] = [
  {
    id: 'monstera-classic',
    slot: 1,
    name: 'Monstera Deliciosa',
    codeName: 'MNST-47 // CLASSIC',
    category: 'TROPICAL HEAVY',
    modelPath: monsteraPath,
    price: 1200,
    scale: 1.0,
    origin: 'Southern Mexico / Panama',
    weightKg: 4.5,
    stats: {
      sunlight: 65,
      hydration: 70,
      foliage: 90,
      resilience: 85,
    },
    description:
      'Standard-issue fenestrated broadleaf specimen. Reliable indoor coverage with iconic split leaves.',
  },
  {
    id: 'calathea-orbifolia',
    slot: 2,
    name: 'Calathea Orbifolia',
    codeName: 'CLTH-09 // PRAYER',
    category: 'TROPICAL LIGHT',
    modelPath: calatheaPath,
    price: 850,
    scale: 0.75,
    origin: 'Bolivia Rainforest',
    weightKg: 2.2,
    stats: {
      sunlight: 45,
      hydration: 80,
      foliage: 78,
      resilience: 70,
    },
    description:
      'Compact striped prayer-plant cultivar prized for silver-banded round leaves and low-light adaptability.',
  },
  {
    id: 'elephant-ear',
    slot: 3,
    name: 'Alocasia Elephant Ear',
    codeName: 'ALCS-50 // SHIELD',
    category: 'SPECIMEN GIANT',
    modelPath: elephantPath,
    price: 1850,
    scale: 1.15,
    origin: 'Southeast Asia',
    weightKg: 6.4,
    stats: {
      sunlight: 75,
      hydration: 85,
      foliage: 95,
      resilience: 78,
    },
    description:
      'Broad sagittal-leaf architectural specimen that provides high-volume vertical presence.',
  },
  {
    id: 'potted-strelitzia',
    slot: 4,
    name: 'Strelitzia Nicolai',
    codeName: 'STRL-77 // PARADISE',
    category: 'ARCHITECTURAL PALM',
    modelPath: strelitziaPath,
    price: 2400,
    scale: 1.2,
    origin: 'South Africa',
    weightKg: 7.5,
    stats: {
      sunlight: 90,
      hydration: 65,
      foliage: 88,
      resilience: 84,
    },
    description:
      'Tall upright Bird of Paradise cultivar with banana-like fan paddles suited for sunlit atriums.',
  },
  {
    id: 'golden-pothos',
    slot: 5,
    name: 'Epipremnum Golden Pothos',
    codeName: 'PTHS-12 // TRAILER',
    category: 'WALL / VINE UNIT',
    modelPath: pothoPath,
    price: 650,
    scale: 0.7,
    origin: 'Moorea / French Polynesia',
    weightKg: 1.8,
    stats: {
      sunlight: 50,
      hydration: 55,
      foliage: 82,
      resilience: 98,
    },
    description:
      'Ultra-resilient cascading vine ideal for Shift+E wall-snapping and elevated ledge installations.',
  },
  {
    id: 'stellaria-dichotoma',
    slot: 6,
    name: 'Stellaria Dichotoma',
    codeName: 'STLR-33 // STARWORT',
    category: 'BOTANICAL BUSH',
    modelPath: stellariaPath,
    price: 1100,
    scale: 0.9,
    origin: 'East Asian Steppe',
    weightKg: 3.1,
    stats: {
      sunlight: 70,
      hydration: 50,
      foliage: 86,
      resilience: 92,
    },
    description:
      'Dense dichotomous branching specimen with fine textured foliage and high drought tolerance.',
  },
  {
    id: 'boston-lush-fern',
    slot: 7,
    name: 'Nephrolepis Lush Fern',
    codeName: 'FERN-99 // CANOPY',
    category: 'DENSE FROND HEAVY',
    modelPath: lushfernPath,
    price: 1600,
    scale: 0.95,
    origin: 'Neotropical Cloud Forest',
    weightKg: 4.0,
    stats: {
      sunlight: 55,
      hydration: 90,
      foliage: 100,
      resilience: 75,
    },
    description:
      'Ultra-dense cascading frond specimen providing maximum radial foliage volume.',
  },
];
