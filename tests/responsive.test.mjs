// Static checks on the stylesheet and components that catch the regressions
// real device testing usually finds first: layout that can't reflow, panels
// with no mobile rules, and motion that ignores the reduced-motion setting.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const viewer = await readFile(new URL("../app/components/OrganViewer.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../app/components/AnatomyApp.tsx", import.meta.url), "utf8");

test("every new overlay surface has a mobile rule", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 760px)"));
  for (const selector of [".side-panel", ".lesson-modal", ".hotspot-index", ".model-error"]) {
    assert.ok(mobile.includes(selector), `${selector} has no <=760px rule`);
  }
});

test("animated loading states respect prefers-reduced-motion", () => {
  const reduced = css.split("@media (prefers-reduced-motion: reduce)").slice(1).join("");
  for (const selector of [".skeleton-specimen", ".side-panel", ".lesson-modal"]) {
    assert.ok(reduced.includes(selector), `${selector} keeps animating under reduced motion`);
  }
});

test("layout uses logical properties so RTL locales mirror correctly", () => {
  // A single-sided physical offset is the usual cause of an Arabic layout
  // ending up back-to-front. Three shapes are legitimately physical and are
  // allowed: centring (`left: 50%` with a translate), a symmetric
  // `left` + `right` pair, and an origin the JS positions with a transform.
  const offenders = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const left = /(^|;)\s*left:\s*([^;]+)/.exec(body)?.[2]?.trim();
    const right = /(^|;)\s*right:\s*([^;]+)/.exec(body)?.[2]?.trim();
    if (!left && !right) continue;
    if (left && right) continue;                                  // symmetric
    const value = (left ?? right);
    if (value === "50%" && /transform:\s*translate/.test(body)) continue;  // centred
    if (/transform:\s*translate3d/.test(body) || selector.includes("hotspot-callout")) continue; // JS-positioned
    offenders.push(`${selector.trim()} { ${left ? "left" : "right"}: ${value} }`);
  }
  assert.deepEqual(offenders, [], "use inset-inline-start/end instead of a single-sided left/right");
});

test("the viewer renders an error state with a retry control", () => {
  assert.match(viewer, /model-error/);
  assert.match(viewer, /app\.viewer\.retry/);
  assert.match(viewer, /role="alert"/);
});

test("the viewer renders a skeleton before the first model resolves", () => {
  assert.match(viewer, /viewer-skeleton/);
  assert.match(viewer, /!ready && !loadError/);
});

test("structures are reachable as real buttons, not just list items", () => {
  const index = viewer.slice(viewer.indexOf('className="hotspot-index"'));
  assert.match(index, /<button/, "the structure index must contain focusable buttons");
  assert.match(index, /aria-pressed=/);
  assert.match(index, /cycleHotspot/);
});

test("mastery and review surfaces have mobile rules and respect reduced motion", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 760px)"));
  assert.ok(mobile.includes(".review-cta"), ".review-cta has no mobile rule");
  const reduced = css.split("@media (prefers-reduced-motion: reduce)").slice(1).join("");
  assert.ok(reduced.includes(".mastery-fill"), "the mastery bar animates under reduced motion");
});

test("the quiz records per-structure progress, not a per-round best score", () => {
  assert.match(viewer, /recordAnswer\(structureKey\(/, "answers must be recorded per structure");
  assert.doesNotMatch(viewer, /recordQuizResult/, "the per-round best-score API should be gone");
});

test("the round is built by the quiz engine rather than a blind shuffle", () => {
  assert.match(viewer, /buildRound\(organ/);
});

test("search results can select a structure, not just an organ", () => {
  assert.match(app, /pendingStructure/);
  assert.match(viewer, /selectHotspot\(pendingStructure\)/);
});

test("the search field has an empty state", () => {
  assert.match(app, /organ-empty/);
  assert.match(app, /app\.search\.empty/);
});

test("no primary nav button is left without a handler", () => {
  const nav = app.slice(app.indexOf('className="main-nav"'), app.indexOf("</nav>"));
  const buttons = nav.match(/<button[\s\S]*?>/g) ?? [];
  assert.ok(buttons.length >= 4, "expected the four primary nav buttons");
  for (const button of buttons) {
    assert.match(button, /onClick=/, `a nav button has no onClick: ${button.slice(0, 60)}…`);
  }
});

// ---------------------------------------------------------------- kid mode

test("the primary nav stays reachable on phones as a bottom bar", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 760px)"));
  const block = mobile.slice(0, mobile.indexOf("\n}\n"));
  assert.doesNotMatch(block, /\.main-nav \{ display: none; \}/, "phones must keep the primary nav");
  assert.match(block, /\.main-nav \{[^}]*position: fixed/);
});

test("condition lists are only rendered inside the grown-ups panel", () => {
  const uses = [...app.matchAll(/\.conditions\.map/g)].map((match) => match.index);
  assert.ok(uses.length > 0, "the grown-ups panel should still list conditions");
  const panel = app.indexOf('panel === "grownups" && (');
  const panelEnd = app.indexOf('panel === "notes" && (', panel);
  for (const index of uses) {
    assert.ok(index > panel && index < panelEnd, "conditions are rendered outside the grown-ups panel");
  }
});

test("there is no placeholder learner profile", () => {
  assert.doesNotMatch(app, /<span>MA<\/span>/, "the hard-coded profile initials should be gone");
  assert.match(app, /grownups-button/);
});

test("the review button opens an organ that actually has something due", () => {
  assert.match(app, /getReviewOrgan\(organId\)/);
});

test("tap targets meet 44px in kid mode", () => {
  const kid = css.slice(css.indexOf("Kid mode"));
  for (const selector of [".action-grid button", ".quiz-options button", ".grownups-button", ".grownups-notes"]) {
    const rule = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{[^}]*(min-height|height): (4[4-9]|[5-9]\\d)px");
    assert.match(kid, rule, `${selector} is under 44px`);
  }
});

test("the library shows the sticker book, not a mastery percentage", () => {
  assert.match(app, /sticker-button/);
  assert.doesNotMatch(app, /quiz\.mastery/, "kids shouldn't see 'Mastery N%'");
});
