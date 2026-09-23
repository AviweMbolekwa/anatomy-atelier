import type { OrganId } from "./anatomy-data";
import { store } from "./storage";

/**
 * Saved organs and study notes.
 *
 * These now sit on the shared `Store` rather than talking to `localStorage`
 * directly, so they move to a server-backed store alongside progress when
 * accounts land — without any call-site changes.
 *
 * Quiz best-scores used to live here too. They've been replaced by
 * per-structure mastery in `progress.ts`: a best score records one good round
 * and can't say what to study next, which is the question the app now needs
 * to answer. `migrateLegacyBestScores` carries the old data forward so an
 * existing learner doesn't open V2 to an empty profile.
 */

const SAVED = "saved-organs";
const NOTES = "notes";

export function subscribe(listener: () => void) {
  return store.subscribe(listener);
}

// ------------------------------------------------------------- saved organs

export const EMPTY_SAVED: OrganId[] = [];

export function getSavedOrgans(): OrganId[] {
  return store.get<OrganId[]>(SAVED, EMPTY_SAVED);
}

export function getSavedSnapshot(): OrganId[] {
  return getSavedOrgans();
}

export function isOrganSaved(id: OrganId): boolean {
  return getSavedOrgans().includes(id);
}

export function toggleSavedOrgan(id: OrganId): OrganId[] {
  const current = getSavedOrgans();
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  store.set(SAVED, next);
  return next;
}

// ------------------------------------------------------------------- notes

export type NotesMap = Partial<Record<OrganId, string>>;

export const EMPTY_NOTES: NotesMap = {};

export function getAllNotes(): NotesMap {
  return store.get<NotesMap>(NOTES, EMPTY_NOTES);
}

export function getNotesSnapshot(): NotesMap {
  return getAllNotes();
}

export function getNote(id: OrganId): string {
  return getAllNotes()[id] ?? "";
}

export function setNote(id: OrganId, text: string): void {
  const all = getAllNotes();
  const next: NotesMap = { ...all };
  if (text.trim()) next[id] = text;
  else delete next[id];
  store.set(NOTES, next);
}

// --------------------------------------------------------------- migration

type LegacyBest = { score: number; total: number; at: string };

/**
 * V1 stored one best score per organ. There's no way to recover which
 * individual structures were right, so the score is converted into evidence
 * about the organ as a whole: a perfect round seeds each of its structures
 * with a modest streak, a partial round seeds nothing but is not discarded
 * silently — it still counts as "attempted" so the organ doesn't read as
 * untouched. Runs once; the legacy key is removed afterwards.
 */
export function migrateLegacyBestScores(
  seed: (organId: OrganId, correct: boolean) => void,
): number {
  const legacy = store.get<Record<string, LegacyBest>>("quiz-best", {});
  const entries = Object.entries(legacy);
  if (!entries.length) return 0;

  for (const [organId, best] of entries) {
    if (!best || typeof best.score !== "number" || !best.total) continue;
    const perfect = best.score === best.total;
    seed(organId as OrganId, perfect);
  }

  store.remove("quiz-best");
  return entries.length;
}
