import assert from "node:assert/strict";
import test from "node:test";
import { store } from "../app/lib/storage.ts";
import {
  STICKER_EVENT_KEY, backfillStickers, getFoundStickerCount, getGoldStickerCount, getStickers,
  recordAnswer, resetProgress,
} from "../app/lib/progress.ts";
import { structureById } from "../app/lib/anatomy-data.ts";

function fakeBackend() {
  const data = new Map();
  return {
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

const latest = () => store.get(STICKER_EVENT_KEY, null);

test("a first correct answer earns a sticker; a wrong one doesn't", () => {
  recordAnswer("heart:aorta", false);
  assert.equal(getStickers()["heart:aorta"], undefined);
  recordAnswer("heart:aorta", true);
  assert.ok(getStickers()["heart:aorta"]?.found);
  assert.equal(latest().kind, "found");
  assert.equal(getFoundStickerCount(), 1);
});

test("the sticker turns gold at mastery — and stays, even after a later miss", () => {
  for (let i = 0; i < 5; i += 1) recordAnswer("brain:frontal", true);
  assert.ok(getStickers()["brain:frontal"].gold, "mastery should make it gold");
  assert.equal(latest().kind, "gold");
  recordAnswer("brain:frontal", false);
  assert.ok(getStickers()["brain:frontal"].gold, "a miss must never take a sticker back");
  assert.equal(getGoldStickerCount(), 1);
});

test("repeat correct answers below mastery don't re-announce the same sticker", () => {
  recordAnswer("lungs:trachea", true);
  const first = latest();
  recordAnswer("lungs:trachea", true);
  assert.deepEqual(latest(), first);
});

test("finding the last part of an organ is celebrated as the whole organ", () => {
  const parts = structureById.kidneys.hotspots.map((h) => `kidneys:${h.id}`);
  parts.slice(0, -1).forEach((key) => recordAnswer(key, true));
  assert.equal(latest().kind, "found");
  recordAnswer(parts.at(-1), true);
  assert.equal(latest().kind, "organ");
  assert.equal(latest().organId, "kidneys");
});

test("backfill gives existing learners their stickers, silently", () => {
  // Simulate answers recorded before stickers existed.
  recordAnswer("liver:portal", true);
  for (let i = 0; i < 5; i += 1) recordAnswer("skin:dermis", true);
  store.remove("stickers");
  store.remove(STICKER_EVENT_KEY);

  assert.equal(backfillStickers(), 2);
  assert.ok(getStickers()["liver:portal"].found);
  assert.ok(getStickers()["skin:dermis"].gold);
  assert.equal(latest(), null, "history must not trigger a celebration");
  assert.equal(backfillStickers(), 0, "running it again adds nothing");
});

test("resetting progress also clears stickers", () => {
  recordAnswer("heart:mitral", true);
  resetProgress();
  assert.equal(getFoundStickerCount(), 0);
  assert.equal(latest(), null);
});
