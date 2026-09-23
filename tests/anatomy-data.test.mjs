import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import {
  organIds,
  organIdsBySystem,
  organStructures,
  structureById,
  systemIds,
} from "../app/lib/anatomy-data.ts";

const publicRoot = new URL("../public/", import.meta.url);

async function exists(relativePath) {
  try {
    await access(new URL(relativePath, publicRoot));
    return true;
  } catch {
    return false;
  }
}

test("every organ has a unique id and a corresponding GLB on disk", async () => {
  assert.equal(new Set(organIds).size, organIds.length, "duplicate organ ids");
  assert.equal(organStructures.length, 9, "expected 9 organs");

  for (const organ of organStructures) {
    assert.ok(organ.model.startsWith("/models/"), `${organ.id} model path looks wrong: ${organ.model}`);
    const onDisk = await exists(organ.model.replace(/^\//, ""));
    assert.ok(onDisk, `missing GLB for ${organ.id} at public${organ.model}`);
  }
});

test("every illustrated organ ships all five artwork variants", async () => {
  const variants = ["thumb", "organ", "microscopic", "compare", "location"];
  for (const organ of organStructures) {
    if (!organ.illustrated) continue;
    for (const variant of variants) {
      const onDisk = await exists(`anatomy/${organ.id}/${variant}.webp`);
      assert.ok(onDisk, `missing public/anatomy/${organ.id}/${variant}.webp`);
    }
  }
});

test("hotspot ids are unique within each organ and carry a valid position/color", () => {
  for (const organ of organStructures) {
    const ids = organ.hotspots.map((hotspot) => hotspot.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate hotspot ids on ${organ.id}`);
    assert.ok(organ.hotspots.length >= 3, `${organ.id} should have at least 3 hotspots`);
    for (const hotspot of organ.hotspots) {
      assert.equal(hotspot.position.length, 3, `${organ.id}/${hotspot.id} position must be [x, y, z]`);
      assert.ok(hotspot.position.every((n) => Number.isFinite(n)), `${organ.id}/${hotspot.id} has a non-finite coordinate`);
      assert.match(hotspot.color, /^#[0-9a-f]{6}$/i, `${organ.id}/${hotspot.id} has an invalid color`);
      assert.ok(hotspot.ta.length > 0, `${organ.id}/${hotspot.id} is missing its Terminologia Anatomica term`);
    }
  }
});

test("every organ belongs to a known system, and the system index agrees with it", () => {
  for (const organ of organStructures) {
    assert.ok(systemIds.includes(organ.systemId), `${organ.id} has an unknown systemId: ${organ.systemId}`);
    assert.ok(organIdsBySystem[organ.systemId].includes(organ.id), `${organ.id} missing from organIdsBySystem`);
  }
  const total = Object.values(organIdsBySystem).reduce((sum, list) => sum + list.length, 0);
  assert.equal(total, organIds.length, "organIdsBySystem should partition every organ exactly once");
});

test("related organs point at real, distinct organs (never the organ itself)", () => {
  for (const organ of organStructures) {
    assert.ok(organ.relatedOrganIds.length > 0, `${organ.id} has no related organs`);
    assert.ok(!organ.relatedOrganIds.includes(organ.id), `${organ.id} lists itself as related`);
    for (const relatedId of organ.relatedOrganIds) {
      assert.ok(organIds.includes(relatedId), `${organ.id} references unknown related organ ${relatedId}`);
    }
  }
});

test("every organ carries at least one citation with a well-formed URL", () => {
  for (const organ of organStructures) {
    assert.ok(organ.references.length > 0, `${organ.id} has no references`);
    for (const reference of organ.references) {
      assert.ok(reference.label.length > 0, `${organ.id} has a reference with an empty label`);
      assert.doesNotThrow(() => new URL(reference.url), `${organ.id} reference has an invalid URL: ${reference.url}`);
    }
  }
});

test("structureById is a complete, consistent index of organStructures", () => {
  for (const id of organIds) {
    assert.equal(structureById[id].id, id);
  }
  assert.equal(Object.keys(structureById).length, organStructures.length);
});
