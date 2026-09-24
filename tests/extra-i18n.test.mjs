import assert from "node:assert/strict";
import test from "node:test";
import { extra } from "../app/i18n/extra.ts";
import { locales } from "../app/i18n/config.ts";
import { systemIds } from "../app/lib/anatomy-data.ts";
import { getDictionary } from "../app/i18n/dictionaries.ts";

const placeholders = (value) => (String(value).match(/\{(\w+)\}/g) ?? []).sort().join(",");

function* strings(node, path = []) {
  for (const [key, value] of Object.entries(node)) {
    const next = [...path, key];
    if (typeof value === "string") yield [next.join("."), value];
    else if (value && typeof value === "object") yield* strings(value, next);
  }
}

test("every configured locale has an entry in the extra dictionary", () => {
  for (const { code } of locales) {
    assert.ok(extra[code], `extra dictionary is missing locale "${code}"`);
  }
});

test("every locale names all 8 body systems", () => {
  for (const { code } of locales) {
    for (const systemId of systemIds) {
      const name = extra[code].systems.names[systemId];
      assert.ok(name && name.length > 0, `${code} is missing a name for system "${systemId}"`);
    }
  }
});

test("extra dictionaries have identical key sets across all locales", () => {
  const base = [...strings(extra.en)].map(([path]) => path).sort();
  for (const { code } of locales) {
    const got = [...strings(extra[code])].map(([path]) => path).sort();
    assert.deepEqual(got, base, `extra."${code}" has different keys than English`);
  }
});

test("extra dictionaries keep English's {placeholders} in every locale", () => {
  for (const [path, english] of strings(extra.en)) {
    for (const { code } of locales) {
      const translated = path.split(".").reduce((node, key) => node[key], extra[code]);
      assert.equal(
        placeholders(translated),
        placeholders(english),
        `extra."${code}".${path} has different {placeholders} than English`,
      );
    }
  }
});

test("getDictionary merges the extra block onto the UI dictionary", async () => {
  const dictionary = await getDictionary("xh");
  assert.equal(dictionary.ui.app.systems.title, extra.xh.systems.title);
  // Existing keys must survive the merge untouched.
  assert.ok(dictionary.ui.nav.explore.length > 0);
});

test("an unknown locale falls back to English rather than throwing", async () => {
  const dictionary = await getDictionary("xx");
  assert.equal(dictionary.ui.app.systems.title, extra.en.systems.title);
});
