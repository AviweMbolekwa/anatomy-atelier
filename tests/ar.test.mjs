import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { arSizes, organIds } from "../app/lib/anatomy-data.ts";
import { detectArMode, fitToRealSize, simplifyForExport } from "../app/lib/three/ar.ts";

test("every organ has a plausible real-world AR size", () => {
  for (const id of organIds) {
    const size = arSizes[id];
    assert.ok(size, `${id} has no AR size`);
    assert.ok(size.sizeCm >= 1 && size.sizeCm <= 40, `${id}: ${size.sizeCm} cm is not a tabletop size`);
  }
  // The two models that can't honestly be shown at life size say so.
  assert.equal(arSizes.eyeball.enlarged, true);
  assert.equal(arSizes.skin.enlarged, true);
  assert.equal(arSizes.heart.enlarged, false);
});

test("fitToRealSize scales the longest side to the target and sits the model on y = 0", () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1));
  mesh.position.set(5, 7, -3); // arbitrary authoring offset
  const root = new THREE.Group();
  root.add(mesh);
  fitToRealSize(root, 12);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 0.12) < 1e-6, "longest side should be 12 cm");
  assert.ok(Math.abs(box.min.y) < 1e-6, "the model should rest on the surface, not sink into it");
  assert.ok(Math.abs(center.x) < 1e-6 && Math.abs(center.z) < 1e-6, "the model should be centred over the tap point");
});

test("fitToRealSize is repeatable — calling it twice doesn't compound the scale", () => {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1)));
  fitToRealSize(root, 20);
  fitToRealSize(root, 20);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 0.2) < 1e-6);
});

/** Temporarily installs browser globals, restoring whatever was there. */
async function withGlobals(globals, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(globals)) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  try { return await fn(); } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

const doc = (arLinks) => ({ createElement: () => ({ relList: { supports: (v) => arLinks && v === "ar" } }) });

test("detectArMode: no browser means no AR", async () => {
  assert.equal(await detectArMode(), "none");
});

test("detectArMode: Safari's rel=ar support selects Quick Look", async () => {
  const mode = await withGlobals({ window: { isSecureContext: true }, document: doc(true), navigator: {} }, detectArMode);
  assert.equal(mode, "quicklook");
});

test("detectArMode: WebXR immersive-ar in a secure context selects WebXR", async () => {
  const xr = { isSessionSupported: async (m) => m === "immersive-ar" };
  const mode = await withGlobals({ window: { isSecureContext: true }, document: doc(false), navigator: { xr } }, detectArMode);
  assert.equal(mode, "webxr");
});

test("detectArMode: WebXR on plain http (e.g. a LAN dev URL) is not offered", async () => {
  const xr = { isSessionSupported: async () => true };
  const mode = await withGlobals({ window: { isSecureContext: false }, document: doc(false), navigator: { xr } }, detectArMode);
  assert.equal(mode, "none");
});

test("detectArMode: a throwing support check degrades to none", async () => {
  const xr = { isSessionSupported: async () => { throw new Error("blocked"); } };
  const mode = await withGlobals({ window: { isSecureContext: true }, document: doc(false), navigator: { xr } }, detectArMode);
  assert.equal(mode, "none");
});

test("simplifyForExport cuts triangles to the budget and leaves a valid, compact mesh", async () => {
  const geometry = new THREE.IcosahedronGeometry(1, 40); // ~33k triangles, non-indexed
  const mesh = new THREE.Mesh(geometry);
  const before = new THREE.Box3().setFromObject(mesh);
  await simplifyForExport(mesh, 2000);

  const next = mesh.geometry;
  const triangles = next.index.count / 3;
  assert.ok(triangles <= 2200, `expected ~2000 triangles, got ${triangles}`);

  const vertexCount = next.attributes.position.count;
  let maxIndex = 0;
  for (const i of next.index.array) maxIndex = Math.max(maxIndex, i);
  assert.equal(maxIndex, vertexCount - 1, "unused vertices should be dropped, and every index in range");
  for (const name of ["normal", "uv"]) {
    assert.equal(next.attributes[name].count, vertexCount, `${name} must stay aligned with positions`);
  }

  // The silhouette survives: the bounds barely move.
  const after = new THREE.Box3().setFromObject(mesh);
  assert.ok(after.min.distanceTo(before.min) < 0.1 && after.max.distanceTo(before.max) < 0.1);
});

test("simplifyForExport leaves models already under budget untouched", async () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.Mesh(geometry);
  await simplifyForExport(mesh, 50_000);
  assert.equal(mesh.geometry, geometry);
});
