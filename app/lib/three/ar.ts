import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer";
import { disposeObject } from "./dispose";

/**
 * "See it in your room".
 *
 * Two platform paths, one model:
 *  - Android Chrome: a WebXR `immersive-ar` session with hit-testing, rendered
 *    by three.js — tap the table to place the organ.
 *  - iOS/iPadOS Safari: no WebXR, but AR Quick Look opens a USDZ. There are no
 *    USDZ files on disk, so one is generated from the same GLB at open time.
 *
 * The model is loaded fresh rather than borrowed from the viewer: the viewer's
 * copy may be clipped, wireframed or faded by its tools, and it lives in a
 * normalised cube rather than real-world metres.
 */

export type ArMode = "webxr" | "quicklook" | "none";

/** Which AR path this device can take. Never throws. */
export async function detectArMode(): Promise<ArMode> {
  if (typeof window === "undefined" || typeof document === "undefined") return "none";

  // Safari advertises AR Quick Look through <a rel="ar">, not through WebXR.
  const anchor = document.createElement("a");
  if (anchor.relList?.supports?.("ar")) return "quicklook";

  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  // WebXR only exists in secure contexts; a LAN http:// dev URL never qualifies.
  if (!xr || !window.isSecureContext) return "none";
  try {
    return (await xr.isSessionSupported("immersive-ar")) ? "webxr" : "none";
  } catch {
    return "none";
  }
}

/**
 * Scales `object` so its longest side is `sizeCm`, centred over the origin
 * with its lowest point at y = 0 — so "place at the hit point" means "sit on
 * the table", not "sink halfway into it".
 */
export function fitToRealSize(object: THREE.Object3D, sizeCm: number): THREE.Object3D {
  object.scale.setScalar(1);
  object.position.set(0, 0, 0);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = sizeCm / 100 / Math.max(size.x, size.y, size.z, 1e-6);
  const center = box.getCenter(new THREE.Vector3());
  object.scale.setScalar(scale);
  object.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  object.updateMatrixWorld(true);
  return object;
}

/** Loads a GLB at real-world size, wrapped in a group that can be placed and turned. */
export async function loadArModel(url: string, sizeCm: number): Promise<THREE.Group> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      // Same reasoning as the viewer: volume/transmission cost a lot per pixel
      // and neither Quick Look nor a phone camera feed gains anything from it.
      if (material instanceof THREE.MeshPhysicalMaterial) {
        material.transmission = 0;
        material.thickness = 0;
      }
      if (material instanceof THREE.MeshStandardMaterial && material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }
      material.side = THREE.FrontSide;
    }
  });

  fitToRealSize(model, sizeCm);
  const root = new THREE.Group();
  root.name = "ar-organ";
  root.add(model);
  return root;
}

// ------------------------------------------------------------ iOS Quick Look

/** Apple's guidance for Quick Look is well under 100k triangles. */
export const QUICK_LOOK_TRIANGLES = 50_000;

function triangleCount(geometry: THREE.BufferGeometry) {
  return (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
}

/**
 * Reduces every mesh under `root` so the whole model has at most
 * `maxTriangles`, dropping vertices the simplified mesh no longer uses.
 *
 * The organ GLBs carry ~300–390k triangles each. That's fine on screen, but
 * USDZ stores geometry as uncompressed text: a full-detail heart exports to a
 * 43 MB file, which is slow to open and heavy on an older iPhone. At tabletop
 * size a 50k-triangle organ is indistinguishable.
 */
export async function simplifyForExport(root: THREE.Object3D, maxTriangles = QUICK_LOOK_TRIANGLES) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => { if (child instanceof THREE.Mesh) meshes.push(child); });
  const total = meshes.reduce((sum, mesh) => sum + triangleCount(mesh.geometry), 0);
  if (total <= maxTriangles) return;

  await MeshoptSimplifier.ready;
  const ratio = maxTriangles / total;

  for (const mesh of meshes) {
    const original = mesh.geometry;
    // Non-indexed geometry shares no vertices, so every triangle is its own
    // island and nothing can collapse; weld identical vertices first.
    const source = original.index ? original : mergeVertices(original);
    const position = source.attributes.position;
    const vertexCount = position.count;
    const indices = Uint32Array.from(source.index!.array as ArrayLike<number>);
    // Read through the attribute rather than its array: the models use
    // quantized positions, and getX() is what undoes the quantization.
    const positions = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i += 1) {
      positions[i * 3] = position.getX(i);
      positions[i * 3 + 1] = position.getY(i);
      positions[i * 3 + 2] = position.getZ(i);
    }

    const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
    // Error is relative to the mesh's size. 5% reaches the target on most
    // organs; a denser mesh (the heart) stops early, so the bound is relaxed
    // step by step only until the target is met.
    let simplified: Uint32Array = indices;
    for (const error of [0.05, 0.1, 0.2]) {
      [simplified] = MeshoptSimplifier.simplify(indices, positions, 3, target, error);
      if (simplified.length <= target * 1.1) break;
    }
    // Renumbers `simplified` in place and says where each old vertex went.
    const [remap, unique] = MeshoptSimplifier.compactMesh(simplified);

    const next = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const size = attribute.itemSize;
      const out = new Float32Array(unique * size);
      for (let old = 0; old < vertexCount; old += 1) {
        const to = remap[old];
        if (to >= unique) continue; // dropped by the simplifier
        for (let k = 0; k < size; k += 1) out[to * size + k] = attribute.getComponent(old, k);
      }
      next.setAttribute(name, new THREE.BufferAttribute(out, size));
    }
    next.setIndex(new THREE.BufferAttribute(simplified, 1));
    if (source !== original) source.dispose();
    original.dispose();
    mesh.geometry = next;
  }
}

/**
 * Builds the USDZ ahead of the tap. Quick Look has to be opened from a user
 * gesture, and exporting takes long enough to lose it — so the sheet prepares
 * this when it opens, and the button only has to click a ready link.
 */
export async function prepareQuickLook(model: THREE.Object3D, allowScaling: boolean): Promise<string> {
  await simplifyForExport(model);
  const exporter = new USDZExporter();
  const buffer = await exporter.parseAsync(model, {
    quickLookCompatible: true,
    ar: { anchoring: { type: "plane" }, planeAnchoring: { alignment: "horizontal" } },
  });
  const url = URL.createObjectURL(new Blob([buffer], { type: "model/vnd.usdz+zip" }));
  // Life-size models are locked so a pinch can't quietly make them "wrong";
  // enlarged ones may be resized freely.
  return allowScaling ? url : `${url}#allowsContentScaling=0`;
}

/** Must be called synchronously inside a click handler. */
export function openQuickLook(usdzUrl: string) {
  const anchor = document.createElement("a");
  anchor.rel = "ar";
  anchor.href = usdzUrl;
  // Safari only treats rel="ar" as Quick Look when the link wraps an image.
  anchor.appendChild(document.createElement("img"));
  anchor.click();
}

// --------------------------------------------------------- Android WebXR

export type ArSession = { end: () => void };

/**
 * Starts an immersive-ar session. `overlay` is shown over the camera feed
 * (DOM overlay), so its buttons stay usable; taps on it don't place the organ.
 */
export async function startWebXr(
  model: THREE.Object3D,
  overlay: HTMLElement,
  callbacks: { onPlaced: () => void; onEnd: () => void },
): Promise<ArSession> {
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr) throw new Error("WebXR unavailable");

  const session = await xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: overlay },
  });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  scene.add(new THREE.HemisphereLight(0xfff6ee, 0x6b5a50, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0.5, 1.5, 0.8);
  scene.add(key);

  // A soft ring shows where the organ will land before the tap.
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.075, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xeb7c6b, transparent: true, opacity: 0.9 }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Taps on the overlay's own controls must not also place the organ.
  const keepOverlayTaps = (event: Event) => event.preventDefault();
  overlay.addEventListener("beforexrselect", keepOverlayTaps);

  await renderer.xr.setSession(session);
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitSource = await session.requestHitTestSource?.({ space: viewerSpace });

  const placeAt = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const controller = renderer.xr.getController(0);
  controller.addEventListener("select", () => {
    if (!reticle.visible) return;
    placeAt.setFromMatrixPosition(reticle.matrix);
    model.position.copy(placeAt);
    // Turn the organ's front toward the child rather than whatever way the
    // model file happens to face.
    renderer.xr.getCamera().getWorldPosition(cameraPosition);
    model.rotation.set(0, Math.atan2(cameraPosition.x - placeAt.x, cameraPosition.z - placeAt.z), 0);
    if (!model.parent) scene.add(model);
    callbacks.onPlaced();
  });
  scene.add(controller);

  renderer.setAnimationLoop((_time, frame) => {
    const space = renderer.xr.getReferenceSpace();
    if (frame && hitSource && space) {
      const pose = frame.getHitTestResults(hitSource)[0]?.getPose(space);
      reticle.visible = Boolean(pose);
      if (pose) reticle.matrix.fromArray(pose.transform.matrix);
    }
    renderer.render(scene, camera);
  });

  session.addEventListener("end", () => {
    renderer.setAnimationLoop(null);
    hitSource?.cancel();
    overlay.removeEventListener("beforexrselect", keepOverlayTaps);
    scene.remove(model);
    disposeObject(reticle);
    renderer.dispose();
    callbacks.onEnd();
  });

  return { end: () => void session.end().catch(() => {}) };
}
