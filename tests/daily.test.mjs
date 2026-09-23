import assert from "node:assert/strict";
import test from "node:test";
import { store } from "../app/lib/storage.ts";
import { getProgress, recordAnswer, resetProgress } from "../app/lib/progress.ts";
import { buildOrgans } from "../app/i18n/merge.ts";
import { locales } from "../app/i18n/config.ts";
import { getDictionary } from "../app/i18n/dictionaries.ts";
import {
  answerDaily, buildDailyQuestion, currentStreak, ensureTodaysQuestion, factRevealsOrgan,
  getDailyState, isAnsweredToday, localDateKey, resetDaily,
} from "../app/lib/daily.ts";

const organs = buildOrgans((await getDictionary("en")).organs);
const day = (n) => new Date(2026, 8, n, 15, 0, 0); // local afternoon, September 2026

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
  resetDaily();
  resetProgress();
});

const answerOf = (q) => (q.kind === "organ" ? q.organId : q.hotspotId);
const wrongOf = (q) => q.options.find((o) => o !== answerOf(q));

test("dates are the child's local calendar day", () => {
  assert.equal(localDateKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("the same day always yields the same question", () => {
  assert.deepEqual(buildDailyQuestion(organs, "2026-09-10"), buildDailyQuestion(organs, "2026-09-10"));
});

test("today's question is fixed for the day and changes the next day", () => {
  const first = ensureTodaysQuestion(organs, day(10));
  assert.deepEqual(ensureTodaysQuestion(organs, day(10)), first);
  assert.notEqual(ensureTodaysQuestion(organs, day(11)).date, first.date);
});

test("every question has distinct options that include the answer", () => {
  for (let n = 1; n <= 60; n += 1) {
    const q = buildDailyQuestion(organs, `2026-${String(1 + (n % 12)).padStart(2, "0")}-${String(1 + (n % 28)).padStart(2, "0")}`);
    assert.ok(q.options.length >= 3, "at least three choices");
    assert.equal(new Set(q.options).size, q.options.length, "no duplicate choices");
    assert.ok(q.options.includes(answerOf(q)), "the answer must be offered");
  }
});

test("an organ question never names the organ it's asking about, in any language", async () => {
  for (const { code } of locales) {
    const localized = buildOrgans((await getDictionary(code)).organs);
    for (let n = 1; n <= 40; n += 1) {
      const q = buildDailyQuestion(localized, `2027-01-${String(n % 28 + 1).padStart(2, "0")}-${n}`);
      if (q.kind !== "organ") continue;
      const organ = localized.find((o) => o.id === q.organId);
      assert.equal(factRevealsOrgan(organ[q.fact], organ.name), false, `${code}: "${organ[q.fact]}" gives away ${organ.name}`);
    }
  }
});

test("a fact that names its organ is caught, including the singular of a plural name", () => {
  assert.equal(factRevealsOrgan("The right lung carries three lobes", "Lungs"), true);
  assert.equal(factRevealsOrgan("It beats about 100,000 times", "Heart"), false);
});

test("the streak grows on consecutive days — right or wrong — and resets after a gap", () => {
  let q = ensureTodaysQuestion(organs, day(1));
  answerDaily(answerOf(q), day(1));
  q = ensureTodaysQuestion(organs, day(2));
  answerDaily(wrongOf(q), day(2)); // a wrong answer still keeps the habit going
  assert.equal(getDailyState().streak, 2);
  assert.equal(currentStreak(getDailyState(), day(3)), 2, "yesterday's streak still counts today");

  assert.equal(currentStreak(getDailyState(), day(4)), 0, "a missed day shows zero");
  q = ensureTodaysQuestion(organs, day(4));
  answerDaily(answerOf(q), day(4));
  assert.equal(getDailyState().streak, 1);
  assert.equal(getDailyState().best, 2, "the best streak is remembered");
});

test("answering twice on the same day changes nothing", () => {
  const q = ensureTodaysQuestion(organs, day(5));
  const first = answerDaily(wrongOf(q), day(5));
  const second = answerDaily(answerOf(q), day(5));
  assert.deepEqual(second, first);
  assert.equal(isAnsweredToday(getDailyState(), day(5)), true);
});

test("a structure question feeds the spaced-repetition progress", () => {
  let q;
  for (let n = 1; n <= 28 && q?.kind !== "structure"; n += 1) { resetDaily(); q = ensureTodaysQuestion(organs, day(n)); }
  assert.equal(q.kind, "structure");
  answerDaily(answerOf(q), new Date(`${q.date}T15:00:00`));
  assert.ok(getProgress(`${q.organId}:${q.hotspotId}`), "the answer should be recorded per structure");
});

test("a structure that's due for review tends to become the question", () => {
  recordAnswer("heart:aorta", false); // due now
  let hits = 0;
  for (let n = 1; n <= 30; n += 1) {
    const q = buildDailyQuestion(organs, `2026-10-${String(n).padStart(2, "0")}`);
    if (q.kind === "structure" && q.organId === "heart" && q.hotspotId === "aorta") hits += 1;
  }
  assert.ok(hits >= 10, `expected the due structure most days, got ${hits}/30`);
});
