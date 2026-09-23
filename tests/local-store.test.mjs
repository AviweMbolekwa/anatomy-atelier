import assert from "node:assert/strict";
import test from "node:test";
import { store } from "../app/lib/storage.ts";
import * as local from "../app/lib/local-store.ts";
import { getOrganMastery, resetProgress } from "../app/lib/progress.ts";

function fakeBackend(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    async load() { return Object.fromEntries(data); },
    async save(key, value) { data.set(key, value); },
    async remove(key) { data.delete(key); },
  };
}

test.beforeEach(async () => {
  store.setBackend(fakeBackend());
  await store.hydrate();
  resetProgress();
});

test("an empty store yields safe defaults", () => {
  assert.deepEqual(local.getSavedOrgans(), []);
  assert.equal(local.isOrganSaved("heart"), false);
  assert.equal(local.getNote("heart"), "");
});

test("toggleSavedOrgan adds then removes an organ", () => {
  assert.deepEqual(local.toggleSavedOrgan("heart"), ["heart"]);
  assert.equal(local.isOrganSaved("heart"), true);
  assert.deepEqual(local.toggleSavedOrgan("heart"), []);
  assert.equal(local.isOrganSaved("heart"), false);
});

test("notes: set, read back, and clearing empties the entry", () => {
  local.setNote("brain", "Frontal lobe = planning");
  assert.equal(local.getNote("brain"), "Frontal lobe = planning");
  local.setNote("brain", "   ");
  assert.equal(local.getNote("brain"), "", "whitespace-only notes should clear the entry");
});

test("saved organs and notes survive a reload from the backend", async () => {
  const backend = fakeBackend();
  store.setBackend(backend);
  await store.hydrate();

  local.toggleSavedOrgan("liver");
  local.setNote("liver", "portal triad");
  await store.flush();

  // Simulate a reload: clear the in-memory cache and re-read from storage.
  store.setBackend(fakeBackend(Object.fromEntries(backend.data)));
  await store.hydrate();

  assert.deepEqual(local.getSavedOrgans(), ["liver"], "saved organs must persist across a reload");
  assert.equal(local.getNote("liver"), "portal triad", "notes must persist across a reload");
});

test("snapshots are stable references so useSyncExternalStore does not loop", () => {
  const first = local.getSavedSnapshot();
  const second = local.getSavedSnapshot();
  assert.deepEqual(first, second);
});

test("legacy per-organ best scores migrate into per-structure progress", async () => {
  // Seed a V1-shaped store.
  store.setBackend(fakeBackend({
    "anatomy-atelier:quiz-best": JSON.stringify({
      heart: { score: 6, total: 6, at: "2026-01-01T00:00:00.000Z" },
      brain: { score: 2, total: 4, at: "2026-01-01T00:00:00.000Z" },
    }),
  }));
  await store.hydrate();

  const seeded = [];
  const migrated = local.migrateLegacyBestScores((organId, correct) => seeded.push([organId, correct]));

  assert.equal(migrated, 2, "both legacy entries should be processed");
  assert.deepEqual(seeded.find((e) => e[0] === "heart"), ["heart", true], "a perfect round seeds a correct answer");
  assert.deepEqual(seeded.find((e) => e[0] === "brain"), ["brain", false], "a partial round does not seed mastery");
});

test("migration runs once and clears the legacy key", async () => {
  store.setBackend(fakeBackend({
    "anatomy-atelier:quiz-best": JSON.stringify({ heart: { score: 6, total: 6, at: "x" } }),
  }));
  await store.hydrate();

  assert.equal(local.migrateLegacyBestScores(() => {}), 1);
  assert.equal(local.migrateLegacyBestScores(() => {}), 0, "a second run must be a no-op");
});

test("migration on an empty store does nothing", () => {
  assert.equal(local.migrateLegacyBestScores(() => { throw new Error("should not seed"); }), 0);
});

test("an organ with no progress reports zero mastery", () => {
  assert.equal(getOrganMastery("heart").mastery, 0);
});
