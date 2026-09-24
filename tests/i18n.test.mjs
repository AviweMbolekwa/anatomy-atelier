import assert from "node:assert/strict";
import test from "node:test";
import { organStructures } from "../app/lib/anatomy-data.ts";
import { locales, localeCodes } from "../app/i18n/config.ts";
import { getDictionary } from "../app/i18n/dictionaries.ts";
import { buildOrgans, indexOrgans } from "../app/i18n/merge.ts";

const placeholders = (value) => (String(value).match(/\{(\w+)\}/g) ?? []).sort().join(",");

/** Depth-first walk yielding [dottedPath, string] for every leaf string. */
function* strings(node, path = []) {
  for (const [key, value] of Object.entries(node)) {
    const next = [...path, key];
    if (typeof value === "string") yield [next.join("."), value];
    else if (value && typeof value === "object" && !Array.isArray(value)) yield* strings(value, next);
  }
}

test("all 4 configured locales are loadable and distinct", () => {
  assert.equal(locales.length, 4);
  assert.equal(new Set(localeCodes).size, 4);
});

for (const { code } of locales) {
  test(`locale "${code}": ui + organ dictionaries load and cover every organ`, async () => {
    const dictionary = await getDictionary(code);
    assert.ok(dictionary.ui, `no UI dictionary for ${code}`);
    for (const organ of organStructures) {
      assert.ok(dictionary.organs[organ.id], `${code} is missing organ content for ${organ.id}`);
    }
  });

  test(`locale "${code}": every hotspot has a translated label (or a documented fallback)`, async () => {
    const dictionary = await getDictionary(code);
    for (const organ of organStructures) {
      const got = new Set(Object.keys(dictionary.organs[organ.id].hotspots));
      for (const hotspot of organ.hotspots) {
        // A missing key is not a hard failure — merge.ts falls back to the
        // Latin term — but it must never be an *empty* label once merged.
        assert.ok(got.has(hotspot.id) || hotspot.ta, `${code}/${organ.id}/${hotspot.id} has no label and no TA fallback`);
      }
    }
  });

  test(`locale "${code}": UI placeholders match the English template`, async () => {
    const [base, dictionary] = await Promise.all([getDictionary("en"), getDictionary(code)]);
    for (const [path, english] of strings(base.ui)) {
      const translated = path.split(".").reduce((node, key) => node?.[key], dictionary.ui);
      if (typeof translated !== "string") continue; // optional/new key not yet localized — allowed
      assert.equal(
        placeholders(translated),
        placeholders(english),
        `ui.${path} in "${code}" has different {placeholders} than English`,
      );
    }
  });

  test(`locale "${code}": buildOrgans/indexOrgans resolve every organ with a real model + hotspots`, async () => {
    const dictionary = await getDictionary(code);
    const organs = buildOrgans(dictionary.organs);
    const byId = indexOrgans(organs);
    assert.equal(organs.length, organStructures.length);
    for (const structure of organStructures) {
      const organ = byId[structure.id];
      assert.ok(organ, `${code} could not resolve organ ${structure.id}`);
      assert.equal(organ.model, structure.model);
      assert.equal(organ.hotspots.length, structure.hotspots.length);
      for (const hotspot of organ.hotspots) {
        assert.ok(hotspot.label.length > 0, `${code}/${structure.id}/${hotspot.id} resolved to an empty label`);
      }
    }
  });
}
