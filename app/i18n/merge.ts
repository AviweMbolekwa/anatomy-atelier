import { organStructures, type HotspotStructure, type OrganId, type OrganStructure } from "../lib/anatomy-data";
import type { AuthoredHotspot } from "../lib/authored-hotspots";
import type { OrganContent, OrganContentDictionary } from "./types";
import { withBase } from "../lib/base-path";

/** Structure joined with the active locale's prose. Components consume this
 *  shape, so they never need to know a translation layer exists. */
export type Hotspot = HotspotStructure & { label: string; detail: string };
export type Organ = Omit<OrganStructure, "hotspots"> & Omit<OrganContent, "hotspots"> & { hotspots: Hotspot[] };

export function buildOrgans(
  content: OrganContentDictionary,
  authored: Partial<Record<OrganId, AuthoredHotspot[]>> = {},
): Organ[] {
  return organStructures.map((structure) => {
    const prose = content[structure.id];
    const baseHotspots = structure.hotspots.map((hotspot) => ({
      ...hotspot,
      // Fall back to the Latin term if a locale has not translated this
      // structure yet — never render an empty label.
      label: prose.hotspots[hotspot.id]?.label ?? hotspot.ta,
      detail: prose.hotspots[hotspot.id]?.detail ?? "",
    }));
    const authoredHotspots = (authored[structure.id] ?? []).map((hotspot) => ({
      ...hotspot,
      label: hotspot.label ?? hotspot.ta,
      detail: hotspot.detail ?? "",
    }));
    return {
      ...structure,
      ...prose,
      // Public paths gain the deploy prefix here, once, so every consumer
      // (viewer, prefetch, AR) gets a URL that resolves on a sub-path host.
      model: withBase(structure.model),
      hotspots: [...baseHotspots, ...authoredHotspots],
    };
  });
}

export function indexOrgans(organs: Organ[]): Record<OrganId, Organ> {
  return Object.fromEntries(organs.map((organ) => [organ.id, organ])) as Record<OrganId, Organ>;
}
