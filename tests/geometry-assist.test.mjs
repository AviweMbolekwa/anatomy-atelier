import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FIT_SIZE } from "../app/lib/three/loaders.ts";

test("FIT_SIZE stays in sync with the Python geometry-assist normalization", () => {
  // scripts/geometry-assist/to_hotspot_space.py hardcodes this constant
  // (it can't import TS). If loaders.ts's FIT_SIZE ever changes, every
  // geometry-assist coordinate silently goes stale unless this is caught.
  const py = readFileSync(
    new URL("../scripts/geometry-assist/to_hotspot_space.py", import.meta.url),
    "utf8",
  );
  const match = py.match(/^FIT_SIZE = ([\d.]+)/m);
  assert.ok(match, "to_hotspot_space.py must declare FIT_SIZE at module level");
  assert.equal(
    Number(match[1]),
    FIT_SIZE,
    "scripts/geometry-assist/to_hotspot_space.py's FIT_SIZE has drifted from app/lib/three/loaders.ts — geometry-assist output will be wrong until it's updated to match",
  );
});
