import assert from "node:assert/strict";
import test from "node:test";
import { store } from "../app/lib/storage.ts";
import {
  allStructureKeys, getMasteredCount, getOrganMastery, getOverallMastery, getProgress, getRecentOrgans,
  getReviewOrgan, getReviewQueue, getWeakStructures, isMastered, masteryOf, parseStructureKey,
  recordAnswer, resetProgress, structureKey,
} from "../app/lib/progress.ts";

const DAY = 24 * 60 * 60 * 1000;

/** In-memory backend so the suite never touches a real localStorage. */
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

test("structure keys round-trip through parse", () => {
  const key = structureKey("heart", "left-ventricle");
  assert.equal(key, "heart:left-ventricle");
  assert.deepEqual(parseStructureKey(key), { organId: "heart", hotspotId: "left-ventricle" });
});

test("allStructureKeys covers every hotspot in the atlas exactly once", () => {
  const keys = allStructureKeys();
  assert.equal(new Set(keys).size, keys.length, "duplicate structure keys");
  assert.ok(keys.length >= 35, `expected at least 35 structures, got ${keys.length}`);
});

test("an unattempted structure has zero mastery and is not mastered", () => {
  assert.equal(masteryOf(null), 0);
  assert.equal(isMastered(null), false);
  assert.equal(getProgress("heart:aorta"), null);
});

test("one correct answer is not mastery", () => {
  const progress = recordAnswer("heart:aorta", true);
  assert.equal(progress.streak, 1);
  assert.ok(masteryOf(progress) < 0.8, "a single correct answer must not count as mastered");
});

test("a run of correct answers reaches mastery; a miss knocks it back", () => {
  const key = "heart:aorta";
  for (let i = 0; i < 5; i += 1) recordAnswer(key, true);
  assert.equal(isMastered(getProgress(key)), true, "five clean answers should reach mastery");

  const afterMiss = recordAnswer(key, false);
  assert.equal(afterMiss.streak, 0);
  assert.equal(isMastered(afterMiss), false, "a miss must drop the structure out of mastered");
});

test("intervals expand on success and collapse to same-session on a miss", () => {
  const key = "brain:frontal";
  assert.equal(recordAnswer(key, true).interval, 1, "first correct → tomorrow");
  assert.equal(recordAnswer(key, true).interval, 3, "second correct → 3 days");
  const third = recordAnswer(key, true);
  assert.ok(third.interval > 3, `third correct should extend past 3 days, got ${third.interval}`);
  assert.equal(recordAnswer(key, false).interval, 0, "a miss returns the structure to this session");
});

test("ease never falls below the SM-2 floor, however many misses", () => {
  const key = "lungs:trachea";
  for (let i = 0; i < 20; i += 1) recordAnswer(key, false);
  assert.ok(getProgress(key).ease >= 1.3, "ease must be floored at 1.3");
});

test("answering with the answer already revealed earns less than a first-try answer", () => {
  recordAnswer("liver:portal", true, true);
  recordAnswer("kidneys:cortex", true, false);
  assert.ok(
    getProgress("liver:portal").ease > getProgress("kidneys:cortex").ease,
    "a first-try answer should raise ease more than a prompted one",
  );
  assert.equal(getProgress("kidneys:cortex").firstTry, 0);
});

test("the review queue only contains structures that are actually due", () => {
  recordAnswer("heart:aorta", true);          // due tomorrow
  recordAnswer("heart:mitral", false);        // due now
  const now = Date.now();
  assert.deepEqual(getReviewQueue(now), ["heart:mitral"]);
  // A day later the first one comes due too.
  assert.equal(getReviewQueue(now + DAY + 1000).length, 2);
});

test("the review queue is ordered soonest-due first", () => {
  recordAnswer("heart:aorta", false);
  recordAnswer("brain:frontal", true);
  recordAnswer("lungs:base", true);
  const queue = getReviewQueue(Date.now() + 10 * DAY);
  const dueTimes = queue.map((key) => Date.parse(getProgress(key).dueAt));
  assert.deepEqual([...dueTimes].sort((a, b) => a - b), dueTimes, "queue must be sorted by due date");
});

test("weak structures are the attempted, unmastered ones, worst first", () => {
  for (let i = 0; i < 5; i += 1) recordAnswer("heart:aorta", true);   // mastered
  recordAnswer("heart:mitral", false);                                // weak
  recordAnswer("heart:left-atrium", true);                            // middling

  const weak = getWeakStructures(5);
  assert.ok(!weak.includes("heart:aorta"), "a mastered structure is not a weak area");
  assert.equal(weak[0], "heart:mitral", "the worst structure should come first");
});

test("unattempted structures never appear as weak areas", () => {
  recordAnswer("heart:mitral", false);
  const weak = getWeakStructures(20);
  assert.deepEqual(weak, ["heart:mitral"], "only attempted structures can be weak");
});

test("organ mastery aggregates its structures and counts totals correctly", () => {
  const before = getOrganMastery("heart");
  assert.equal(before.mastery, 0);
  assert.equal(before.attempted, 0);
  assert.equal(before.total, 6, "the heart has 6 structures");

  for (let i = 0; i < 5; i += 1) recordAnswer("heart:aorta", true);
  const after = getOrganMastery("heart");
  assert.equal(after.attempted, 1);
  assert.equal(after.mastered, 1);
  assert.ok(after.mastery > 0 && after.mastery < 1, "one of six structures is partial mastery");
  assert.ok(after.lastSeenAt);
});

test("overall mastery rises from zero as structures are learned", () => {
  assert.equal(getOverallMastery(), 0);
  for (let i = 0; i < 5; i += 1) recordAnswer("heart:aorta", true);
  assert.ok(getOverallMastery() > 0);
  assert.ok(getOverallMastery() < 0.2, "one structure of 35 is a small share of the whole");
});

test("recent organs are ordered by most recently studied", async () => {
  recordAnswer("heart:aorta", true);
  await new Promise((resolve) => setTimeout(resolve, 5));
  recordAnswer("brain:frontal", true);
  const recent = getRecentOrgans(3);
  assert.equal(recent[0], "brain", "the most recently studied organ comes first");
  assert.ok(recent.includes("heart"));
});

test("resetProgress clears everything", () => {
  recordAnswer("heart:aorta", true);
  resetProgress();
  assert.equal(getOverallMastery(), 0);
  assert.equal(getProgress("heart:aorta"), null);
});

test("mastered count only counts structures that reached mastery", () => {
  assert.equal(getMasteredCount(), 0);
  for (let i = 0; i < 5; i += 1) recordAnswer("heart:aorta", true);
  recordAnswer("brain:frontal", true); // one answer is not mastery
  assert.equal(getMasteredCount(), 1);
});

test("review opens the current organ when it has something due", () => {
  recordAnswer("heart:aorta", false);
  recordAnswer("lungs:trachea", false);
  recordAnswer("lungs:bronchus", false);
  assert.equal(getReviewOrgan("heart"), "heart", "should not switch away from an organ with due work");
});

test("review otherwise opens the organ with the most due", () => {
  recordAnswer("heart:aorta", false);
  recordAnswer("lungs:trachea", false);
  recordAnswer("lungs:bronchus", false);
  assert.equal(getReviewOrgan("skin"), "lungs");
});

test("review has no destination when nothing is due", () => {
  recordAnswer("heart:aorta", true); // due tomorrow, not now
  assert.equal(getReviewOrgan("heart"), null);
});
