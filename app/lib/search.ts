import type { Organ } from "../i18n/merge";
import type { OrganId } from "./anatomy-data";

/**
 * Search across structures, not just organs.
 *
 * Typing "mitral" previously matched nothing, because only organ names,
 * systems and poetic subtitles were searched — the 35 labelled structures
 * were invisible to it. A learner looking up a structure is the most likely
 * search there is, so structures are now first-class results, and matching a
 * structure also surfaces the organ that contains it.
 */

export type SearchResult =
  | { kind: "organ"; organId: OrganId; label: string; sub: string; score: number }
  | { kind: "structure"; organId: OrganId; hotspotId: string; label: string; sub: string; score: number };

const normalise = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Higher is better: prefix beats word-start beats substring. */
function scoreOf(haystack: string, needle: string): number {
  const text = normalise(haystack);
  if (text.startsWith(needle)) return 3;
  if (new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text)) return 2;
  return text.includes(needle) ? 1 : 0;
}

export function search(organs: Organ[], rawQuery: string, limit = 12): SearchResult[] {
  const query = normalise(rawQuery.trim());
  if (!query) return [];

  const results: SearchResult[] = [];

  for (const organ of organs) {
    const organScore = Math.max(
      scoreOf(organ.name, query),
      scoreOf(organ.system, query),
      scoreOf(organ.poetic, query),
      scoreOf(organ.scientificName, query),
    );
    if (organScore > 0) {
      results.push({ kind: "organ", organId: organ.id, label: organ.name, sub: organ.system, score: organScore + 0.5 });
    }

    for (const hotspot of organ.hotspots) {
      // The Latin term is searched too, so "valva mitralis" finds the mitral
      // valve in every locale.
      const score = Math.max(
        scoreOf(hotspot.label, query),
        scoreOf(hotspot.ta, query),
        scoreOf(hotspot.detail, query) * 0.5,
      );
      if (score > 0) {
        results.push({
          kind: "structure",
          organId: organ.id,
          hotspotId: hotspot.id,
          label: hotspot.label,
          sub: organ.name,
          score,
        });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}
