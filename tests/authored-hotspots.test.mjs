import assert from "node:assert/strict";
import test from "node:test";
import { getDictionary } from "../app/i18n/dictionaries.ts";
import { buildOrgans } from "../app/i18n/merge.ts";
import { hotspotCandidates, getHotspotCandidates } from "../app/lib/hotspot-authoring.ts";
import {
  clearAuthoredHotspots, getAuthoredHotspots, removeAuthoredHotspot, saveAuthoredHotspot,
} from "../app/lib/authored-hotspots.ts";
import { organIds, organStructures } from "../app/lib/anatomy-data.ts";

function fakeWindow() {
  const data = new Map();
  return {
    localStorage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => void data.set(key, String(value)),
      removeItem: (key) => void data.delete(key),
    },
  };
}

test.beforeEach(() => {
  globalThis.window = fakeWindow();
  for (const id of organIds) clearAuthoredHotspots(id);
});
test.after(() => { delete globalThis.window; });

test("every organ has candidates, and existing + candidates reach the 15-structure target", () => {
  for (const organ of organStructures) {
    const candidates = getHotspotCandidates(organ.id);
    assert.ok(candidates.length > 0, `${organ.id} has no authoring candidates`);
    assert.equal(
      organ.hotspots.length + candidates.length,
      15,
      `${organ.id}: ${organ.hotspots.length} existing + ${candidates.length} candidates should total 15`,
    );
  }
});

test("candidates carry no 3D position — only an authored point may supply one", () => {
  for (const list of Object.values(hotspotCandidates)) {
    for (const candidate of list) {
      assert.ok(!("position" in candidate), `${candidate.id} must not ship a pre-filled position`);
    }
  }
});

test("candidate ids don't collide with the organ's existing structural hotspots", () => {
  for (const organ of organStructures) {
    const existing = new Set(organ.hotspots.map((h) => h.id));
    for (const candidate of getHotspotCandidates(organ.id)) {
      assert.ok(!existing.has(candidate.id), `${organ.id}: candidate "${candidate.id}" collides with an existing hotspot id`);
    }
  }
});

test("saving an authored hotspot round-trips through storage", () => {
  const candidate = getHotspotCandidates("heart")[0];
  assert.deepEqual(getAuthoredHotspots("heart"), []);
  saveAuthoredHotspot("heart", { ...candidate, position: [0.1, 0.2, 0.3] });
  const saved = getAuthoredHotspots("heart");
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].position, [0.1, 0.2, 0.3]);
});

test("saving the same candidate id twice replaces the point rather than duplicating it", () => {
  const candidate = getHotspotCandidates("heart")[0];
  saveAuthoredHotspot("heart", { ...candidate, position: [0, 0, 0] });
  saveAuthoredHotspot("heart", { ...candidate, position: [1, 1, 1] });
  const saved = getAuthoredHotspots("heart");
  assert.equal(saved.length, 1, "re-placing a candidate must replace, not duplicate");
  assert.deepEqual(saved[0].position, [1, 1, 1]);
});

test("removeAuthoredHotspot removes only the targeted structure", () => {
  const [a, b] = getHotspotCandidates("heart");
  saveAuthoredHotspot("heart", { ...a, position: [0, 0, 0] });
  saveAuthoredHotspot("heart", { ...b, position: [1, 1, 1] });
  removeAuthoredHotspot("heart", a.id);
  const saved = getAuthoredHotspots("heart");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, b.id);
});

test("authored hotspots for one organ never leak into another", () => {
  const candidate = getHotspotCandidates("heart")[0];
  saveAuthoredHotspot("heart", { ...candidate, position: [0, 0, 0] });
  assert.deepEqual(getAuthoredHotspots("brain"), []);
});

// --- the i18n gap: authored hotspots do not go through the locale dictionary ---

test("KNOWN GAP: an authored hotspot's label is identical in every locale", async () => {
  // Unlike the original 35 hotspots — which resolve through
  // organs/<locale>.ts and fall back to the Latin term — an authored
  // candidate's English label/detail is baked in at save time and is never
  // looked up per-locale. This test documents that gap rather than silently
  // shipping English-only content as if it were fully translated; if this
  // starts failing, the gap has been fixed and the test should be inverted.
  const candidate = getHotspotCandidates("heart")[0];
  saveAuthoredHotspot("heart", { ...candidate, position: [0, 0, 0] });
  const authored = { heart: getAuthoredHotspots("heart") };

  const [en, af, zu] = await Promise.all(
    ["en", "af", "zu"].map(async (code) =>
      buildOrgans((await getDictionary(code)).organs, authored)
        .find((o) => o.id === "heart").hotspots.find((h) => h.id === candidate.id),
    ),
  );

  assert.equal(af.label, en.label, "documents that Afrikaans currently shows the English label");
  assert.equal(zu.label, en.label, "documents that isiZulu currently shows the English label");
});

test("an organ with no authored hotspots yet still builds normally", async () => {
  const organs = buildOrgans((await getDictionary("en")).organs, {});
  assert.equal(organs.find((o) => o.id === "heart").hotspots.length, 6);
});
