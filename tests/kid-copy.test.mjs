// The audience is 8–12. These checks keep the English kid-facing organ copy
// free of the clinical vocabulary it was rewritten away from, and short enough
// for the places it renders (the function line sits in a one-line card title).
import assert from "node:assert/strict";
import test from "node:test";
import { organs } from "../app/i18n/organs/en.ts";
import { locales } from "../app/i18n/config.ts";
import { getDictionary } from "../app/i18n/dictionaries.ts";

const JARGON = /\b(alveol|nephron|hepatic|islets? of langerhans|metabolic|detoxif|electrolyte|microvill|neural|venous|oxygenated|endocrine|exocrine|renal|ophthalmic|mesenteric|lobule)/i;

test("kid-facing English organ copy avoids clinical jargon", () => {
  for (const [id, organ] of Object.entries(organs)) {
    for (const field of ["description", "location", "function", "medical"]) {
      assert.doesNotMatch(organ[field], JARGON, `${id}.${field}: "${organ[field]}"`);
    }
    for (const [hotspot, { detail }] of Object.entries(organ.hotspots)) {
      assert.doesNotMatch(detail, JARGON, `${id}.hotspots.${hotspot}: "${detail}"`);
    }
  }
});

test("function lines stay short enough for a one-line card title", async () => {
  for (const { code } of locales) {
    const { organs: localized } = await getDictionary(code);
    for (const [id, organ] of Object.entries(localized)) {
      // Latin-script lines are measured in characters; CJK glyphs are ~2x wide.
      const width = [...organ.function].reduce((w, ch) => w + (/[　-鿿가-힯]/.test(ch) ? 2 : 1), 0);
      assert.ok(width <= 42, `${code}.${id}.function is ${width} wide: "${organ.function}"`);
    }
  }
});

test("structure details within an organ are distinct, so describe-quiz prompts have one answer", async () => {
  for (const { code } of locales) {
    const { organs: localized } = await getDictionary(code);
    for (const [id, organ] of Object.entries(localized)) {
      const details = Object.values(organ.hotspots).map((h) => h.detail);
      assert.equal(new Set(details).size, details.length, `${code}.${id} has duplicate structure details`);
    }
  }
});
