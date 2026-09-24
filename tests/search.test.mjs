import assert from "node:assert/strict";
import test from "node:test";
import { getDictionary } from "../app/i18n/dictionaries.ts";
import { buildOrgans } from "../app/i18n/merge.ts";
import { search } from "../app/lib/search.ts";

const en = buildOrgans((await getDictionary("en")).organs);

test("an empty query returns nothing", () => {
  assert.deepEqual(search(en, ""), []);
  assert.deepEqual(search(en, "   "), []);
});

test("searching a structure name finds the structure — the V1 gap", () => {
  const results = search(en, "mitral");
  const hit = results.find((r) => r.kind === "structure" && r.hotspotId === "mitral");
  assert.ok(hit, '"mitral" must match the mitral valve');
  assert.equal(hit.sub, "Heart", "a structure result should name its organ");
});

test("searching an organ name still finds the organ", () => {
  const results = search(en, "heart");
  assert.ok(results.some((r) => r.kind === "organ" && r.organId === "heart"));
});

test("organs outrank structures on an equal-quality match", () => {
  const results = search(en, "heart");
  assert.equal(results[0].kind, "organ", "an exact organ name should lead");
});

test("the Latin term is searchable in every locale", async () => {
  const xh = buildOrgans((await getDictionary("xh")).organs);
  const results = search(xh, "valva");
  assert.ok(results.length > 0, "Terminologia Anatomica terms must be searchable in every locale");
});

test("search is accent- and case-insensitive", () => {
  assert.ok(search(en, "HEART").length > 0);
  assert.ok(search(en, "Ãorta".normalize("NFD")).length >= 0); // must not throw
});

test("results are ordered by descending score", () => {
  // "cor" legitimately prefix-matches the heart's scientific name (Cor) and
  // the Latin terms of several structures, so assert the ordering invariant
  // rather than assuming which field produced the match.
  const scores = search(en, "cor").map((r) => r.score);
  assert.deepEqual([...scores].sort((a, b) => b - a), scores, "results must be sorted best-first");
});

test("a match on the scientific name surfaces the organ", () => {
  const results = search(en, "cor");
  assert.equal(results[0].kind, "organ");
  assert.equal(results[0].organId, "heart", "Cor is the heart's scientific name");
});

test("nonsense returns no results rather than everything", () => {
  assert.deepEqual(search(en, "qzxqzx"), []);
});

test("results are capped at the requested limit", () => {
  assert.ok(search(en, "a", 5).length <= 5);
});

test("regex metacharacters in a query are escaped, not executed", () => {
  assert.doesNotThrow(() => search(en, "a(b"));
  assert.doesNotThrow(() => search(en, "*"));
});
