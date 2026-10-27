import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, flatten, join, prune, simplify, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';

const ASSETS_DIR = path.resolve(process.cwd(), 'src/planner/assets');
const PUBLIC_BUILDING_PATH = path.resolve(process.cwd(), 'public/building.glb');
const OPTIMIZER_VERSION = 2;

const args = process.argv.slice(2);
const force = args.includes('--force');
const maxVertsArg = args.find((a) => a.startsWith('--max-verts='));
const MAX_PLANT_VERTICES = maxVertsArg ? Number(maxVertsArg.split('=')[1]) : 15000;

function getStats(doc) {
  let vertices = 0;
  let primitives = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      primitives += 1;
      const pos = prim.getAttribute('POSITION');
      if (pos) vertices += pos.getCount();
    }
  }
  return { vertices, primitives };
}

async function main() {
  await MeshoptSimplifier.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  const files = fs.readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.glb'));
  const summaryRows = [];

  for (const file of files) {
    const filePath = path.join(ASSETS_DIR, file);
    const beforeSize = fs.statSync(filePath).size;
    const doc = await io.read(filePath);
    const beforeStats = getStats(doc);
    const extras = doc.getRoot().getExtras() || {};

    if (!force && extras.r3fOptimizedVersion === OPTIMIZER_VERSION) {
      console.log(
        `[skip] ${file} already at r3fOptimizedVersion=${OPTIMIZER_VERSION} (${beforeStats.vertices} verts, ${beforeStats.primitives} prims, ${(beforeSize / 1024).toFixed(1)} KB)`
      );
      summaryRows.push({
        file,
        beforeVerts: beforeStats.vertices,
        afterVerts: beforeStats.vertices,
        beforePrims: beforeStats.primitives,
        afterPrims: beforeStats.primitives,
        beforeKB: (beforeSize / 1024).toFixed(1),
        afterKB: (beforeSize / 1024).toFixed(1),
      });
      continue;
    }

    const isBuilding = file.toLowerCase().includes('building');

    if (isBuilding) {
      await doc.transform(
        dedup(),
        weld(),
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: 0.25,
          error: 0.02,
        }),
        prune(),
        draco({
          quantizePosition: 11,
          quantizeNormal: 8,
          quantizeTexcoord: 10,
        })
      );
    } else {
      const targetRatio =
        beforeStats.vertices > MAX_PLANT_VERTICES
          ? Math.max(0.01, MAX_PLANT_VERTICES / beforeStats.vertices)
          : 1.0;

      const transforms = [dedup(), flatten(), join(), weld()];

      if (targetRatio < 1.0) {
        transforms.push(
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: targetRatio,
            error: 0.05,
            lockBorder: false,
          })
        );
      }

      transforms.push(
        prune(),
        draco({
          quantizePosition: 11,
          quantizeNormal: 8,
          quantizeTexcoord: 10,
        })
      );

      await doc.transform(...transforms);
    }

    doc.getRoot().setExtras({
      ...extras,
      r3fOptimizedVersion: OPTIMIZER_VERSION,
    });

    await io.write(filePath, doc);

    if (isBuilding && fs.existsSync(PUBLIC_BUILDING_PATH)) {
      fs.copyFileSync(filePath, PUBLIC_BUILDING_PATH);
    }

    const afterSize = fs.statSync(filePath).size;
    const afterStats = getStats(doc);

    console.log(
      `[optimized] ${file}: verts ${beforeStats.vertices} -> ${afterStats.vertices} | prims ${beforeStats.primitives} -> ${afterStats.primitives} | ${(beforeSize / 1024).toFixed(1)} KB -> ${(afterSize / 1024).toFixed(1)} KB`
    );

    summaryRows.push({
      file,
      beforeVerts: beforeStats.vertices,
      afterVerts: afterStats.vertices,
      beforePrims: beforeStats.primitives,
      afterPrims: afterStats.primitives,
      beforeKB: (beforeSize / 1024).toFixed(1),
      afterKB: (afterSize / 1024).toFixed(1),
    });
  }

  console.table(summaryRows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
