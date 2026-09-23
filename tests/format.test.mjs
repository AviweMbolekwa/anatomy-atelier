import assert from "node:assert/strict";
import test from "node:test";
import { format } from "../app/i18n/types.ts";

test("format() substitutes every known placeholder", () => {
  assert.equal(format("{current} of {total}", { current: "2", total: "5" }), "2 of 5");
});

test("format() leaves an unknown placeholder untouched rather than dropping it", () => {
  assert.equal(format("Hello {name}", {}), "Hello {name}");
});

test("format() is a no-op on plain strings with no placeholders", () => {
  assert.equal(format("Reset", {}), "Reset");
});

test("format() substitutes repeated placeholders consistently", () => {
  assert.equal(format("{x} + {x} = 2{x}", { x: "1" }), "1 + 1 = 21");
});
