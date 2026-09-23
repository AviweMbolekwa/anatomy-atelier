import assert from "node:assert/strict";
import test from "node:test";
import { getDictionary } from "../app/i18n/dictionaries.ts";
import { buildOrgans, indexOrgans } from "../app/i18n/merge.ts";
import { store } from "../app/lib/storage.ts";
import { recordAnswer, resetProgress } from "../app/lib/progress.ts";
import { buildQuestion, buildRound, buildReviewRound } from "../app/lib/quiz-engine.ts";

const dictionary = await getDictionary("en");
const organs = buildOrgans(dictionary.organs);
const byId = indexOrgans(organs);
const heart = byId.heart;

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

test("identify mode prompts with the label and needs no options", () => {
  const question = buildQuestion(heart, "aorta", "identify");
  assert.equal(question.mode, "identify");
  assert.equal(question.prompt, heart.hotspots.find((h) => h.id === "aorta").label);
  assert.deepEqual(question.options, []);
});

test("reverse mode offers four options including the right answer", () => {
  const question = buildQuestion(heart, "aorta", "reverse");
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options.map((o) => o.id)).size, 4, "options must be distinct");
  assert.ok(question.options.some((o) => o.id === "aorta"), "the correct answer must be present");
});

test("describe mode prompts with the structure's own detail text", () => {
  const question = buildQuestion(heart, "mitral", "describe");
  assert.equal(question.prompt, heart.hotspots.find((h) => h.id === "mitral").detail);
  assert.ok(question.prompt.length > 0, "describe mode needs detail prose to work");
});

test("distractors are drawn from the same organ where possible", () => {
  const question = buildQuestion(heart, "aorta", "reverse");
  const ownIds = new Set(heart.hotspots.map((h) => h.id));
  for (const option of question.options) {
    assert.ok(ownIds.has(option.id), `${option.id} is not a heart structure`);
  }
});

test("an organ with few structures still yields four options", () => {
  // The liver has only 3 hotspots, so distractors must come from its system.
  const question = buildQuestion(byId.liver, "portal", "reverse");
  assert.equal(question.options.length, 4);
  assert.ok(question.options.some((o) => o.id === "portal"));
});

test("an unknown hotspot is rejected rather than silently producing a bad question", () => {
  assert.throws(() => buildQuestion(heart, "not-a-structure", "identify"), /unknown hotspot/);
});

test("a round covers distinct structures and respects the requested length", () => {
  const round = buildRound(heart, ["identify"], 4);
  assert.equal(round.length, 4);
  assert.equal(new Set(round.map((q) => q.hotspotId)).size, 4, "a round must not repeat a structure");
});

test("a round never asks for more structures than the organ has", () => {
  const round = buildRound(byId.liver, ["identify"], 99);
  assert.equal(round.length, byId.liver.hotspots.length);
});

test("due structures are asked first", () => {
  recordAnswer("heart:mitral", false); // due immediately
  const round = buildRound(heart, ["identify"], 3);
  assert.equal(round[0].hotspotId, "mitral", "a structure due for review should lead the round");
});

test("modes cycle across a round when several are requested", () => {
  const round = buildRound(heart, ["identify", "reverse"], 4);
  assert.deepEqual(round.map((q) => q.mode), ["identify", "reverse", "identify", "reverse"]);
});

test("the cross-organ review round draws only from due structures", () => {
  recordAnswer("heart:mitral", false);
  recordAnswer("brain:frontal", false);
  const round = buildReviewRound(byId, ["reverse"], 10);
  assert.equal(round.length, 2);
  assert.deepEqual(
    round.map((entry) => `${entry.organId}:${entry.question.hotspotId}`).sort(),
    ["brain:frontal", "heart:mitral"],
  );
});

test("the review round is empty when nothing is due", () => {
  assert.deepEqual(buildReviewRound(byId, ["reverse"], 10), []);
});

test("a stale progress key for a structure that no longer exists is skipped", () => {
  recordAnswer("heart:removed-structure", false);
  const round = buildReviewRound(byId, ["reverse"], 10);
  assert.deepEqual(round, [], "a key with no matching hotspot must not crash or appear");
});
