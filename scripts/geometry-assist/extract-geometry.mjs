#!/usr/bin/env node
/**
 * Decodes a GLB's real vertex buffer using the exact loader the app itself
 * uses (three.js GLTFLoader + MeshoptDecoder, since these models are
 * EXT_meshopt_compression-compressed — a generic glTF parser will fail on
 * them, which is why this can't just be trimesh or a naive JSON read).
 *
 * Output is in *mesh-local* space — i.e. exactly what a raycast against the
 * live model would hit, before the app's own FIT_SIZE normalization. Use
 * to-hotspot-space.mjs to convert to the space `position` fields expect.
 *
 * Usage: node extract-geometry.mjs <model.glb> <out.json>
 */
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => { throw new Error("no image decoding in node — geometry only"); };

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const { GLTFLoader } = await import(path.join(root, "node_modules/three/examples/jsm/loaders/GLTFLoader.js"));
const { MeshoptDecoder } = await import(path.join(root, "node_modules/three/examples/jsm/libs/meshopt_decoder.module.js"));

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node extract-geometry.mjs <model.glb> <out.json>");
  process.exit(1);
}

const buf = readFileSync(inPath);
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

loader.parse(arrayBuffer, "", (gltf) => {
  const meshes = [];
  gltf.scene.traverse((obj) => { if (obj.isMesh) meshes.push(obj); });
  if (meshes.length !== 1) {
    console.error(`expected exactly 1 mesh, found ${meshes.length} — this script assumes the single-mesh-per-organ shape all 9 current GLBs use`);
  }
  const mesh = meshes[0];
  const pos = mesh.geometry.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    arr[i * 3] = pos.getX(i);
    arr[i * 3 + 1] = pos.getY(i);
    arr[i * 3 + 2] = pos.getZ(i);
  }
  writeFileSync(outPath, JSON.stringify({ name: mesh.name, count: pos.count, positions: Array.from(arr) }));
  console.log(`${inPath}: ${pos.count} vertices -> ${outPath}`);
}, (err) => {
  console.error("PARSE ERROR:", err.message ?? err);
  process.exit(1);
});
