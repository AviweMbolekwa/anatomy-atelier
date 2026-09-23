// Static checks on the quiz mode wiring. There's no component-render harness
// in this stack (no jsdom), so — consistent with tests/responsive.test.mjs —
// these assert on the source directly. Thin, but they catch the two failure
// modes that matter here: the answer leaking through the wrong path, and a
// mode silently dropping out of rotation.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewer = await readFile(new URL("../app/components/OrganViewer.tsx", import.meta.url), "utf8");

test("a round exercises all three modes, not just identify", () => {
  assert.match(viewer, /\["identify", "reverse", "describe"\]/);
  assert.match(viewer, /buildRound\(organ, \[\.\.\.modes\]/);
});

test("reverse mode highlights via the viewer's select(), never via onPick", () => {
  // onPick is what sets the React `selected` state that renders the label
  // callout. Reverse mode must go through a path that never touches it.
  const reverseEffect = viewer.slice(viewer.indexOf("target.mode !== \"reverse\""), viewer.indexOf("commitChoice"));
  assert.match(reverseEffect, /select\(target\.hotspotId\)/);
  assert.doesNotMatch(reverseEffect, /onPick/, "reverse mode must not go through the onPick/selected path");
});

test("the label callout is gated off during the quiz regardless of mode", () => {
  assert.match(viewer, /\{selected && !quizActive &&/);
});

test("choice options render for reverse and describe, not identify", () => {
  assert.match(viewer, /target\.mode === "reverse" \|\| target\.mode === "describe"/);
});

test("options are disabled once an answer is committed, so a double-click can't double-score", () => {
  const optionsBlock = viewer.slice(viewer.indexOf('className="quiz-options"'), viewer.indexOf("</div>", viewer.indexOf('className="quiz-options"')));
  assert.match(optionsBlock, /disabled=\{Boolean\(answer\)\}/);
});

test("every answer — identify, reverse, or describe — is recorded as structure progress", () => {
  const matches = viewer.match(/recordAnswer\(structureKey\(/g) ?? [];
  assert.equal(matches.length, 2, "expected one recordAnswer call in the identify path and one in commitChoice");
});

test("the answer feedback is announced as text, not just conveyed by button color", () => {
  assert.match(viewer, /aria-live="assertive"/);
  assert.match(viewer, /t\.quiz\.correct/);
  assert.match(viewer, /t\.quiz\.wrong/);
});

test("the options group is labelled for assistive tech", () => {
  assert.match(viewer, /aria-label=\{t\.app\.quiz\.optionsLabel\}/);
});
