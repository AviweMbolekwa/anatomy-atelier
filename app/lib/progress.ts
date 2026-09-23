import { organStructures, structureById, type OrganId } from "./anatomy-data";
import { store } from "./storage";

/**
 * Per-structure mastery and review scheduling.
 *
 * The previous model stored one best score per organ. A best score is a record
 * of a good day, not evidence of learning: 10/10 once says nothing about what
 * the learner still knows a week later, and it can't tell you what to study
 * next. Progress is therefore tracked per *structure*, which is the smallest
 * thing a learner actually knows or doesn't.
 *
 * Structure ids are stable and locale-independent (they're the same keys the
 * Terminologia Anatomica terms hang off), so they work as progress keys
 * without any translation-layer coupling.
 */

/** `organId:hotspotId` — globally unique, since hotspot ids repeat per organ. */
export type StructureKey = string;

export function structureKey(organId: OrganId, hotspotId: string): StructureKey {
  return `${organId}:${hotspotId}`;
}

export function parseStructureKey(key: StructureKey): { organId: OrganId; hotspotId: string } {
  const index = key.indexOf(":");
  return { organId: key.slice(0, index) as OrganId, hotspotId: key.slice(index + 1) };
}

export type StructureProgress = {
  attempts: number;
  correct: number;
  /** Correct without having already seen the answer this round. */
  firstTry: number;
  /** Consecutive correct answers; resets to 0 on a miss. */
  streak: number;
  /** SM-2 ease factor. Higher = easier for this learner. */
  ease: number;
  /** Days until the next review. */
  interval: number;
  /** ISO timestamp this structure is next due. */
  dueAt: string;
  lastSeenAt: string;
};

const PROGRESS_KEY = "progress:structures";

const DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

type ProgressMap = Record<StructureKey, StructureProgress>;

export function getAllProgress(): ProgressMap {
  return store.get<ProgressMap>(PROGRESS_KEY, {});
}

export function getProgress(key: StructureKey): StructureProgress | null {
  return getAllProgress()[key] ?? null;
}

/**
 * Mastery for one structure, 0–1.
 *
 * Deliberately not just accuracy. A structure answered right once is not
 * mastered; a structure answered right four times running, with a long
 * interval, is. Streak dominates early (it's the signal that moves fastest),
 * accuracy tempers it, and the scheduled interval contributes the "it stuck
 * over time" component that a single session can't fake.
 */
export function masteryOf(progress: StructureProgress | null): number {
  if (!progress || progress.attempts === 0) return 0;
  const accuracy = progress.correct / progress.attempts;
  const streak = Math.min(progress.streak, 4) / 4;
  const retention = Math.min(progress.interval, 21) / 21;
  return Math.round(Math.min(1, streak * 0.5 + accuracy * 0.3 + retention * 0.2) * 100) / 100;
}

export function isMastered(progress: StructureProgress | null): boolean {
  return masteryOf(progress) >= 0.8;
}

/**
 * Records one answer and reschedules the structure.
 *
 * SM-2-lite: full SM-2 grades answers 0–5, which needs a confidence prompt
 * after every question. That's too much friction for a labelling quiz, so
 * quality is derived from what the interaction already tells us — whether it
 * was right, and whether it was right first time.
 */
export function recordAnswer(key: StructureKey, correct: boolean, firstTry = correct): StructureProgress {
  const all = getAllProgress();
  const previous: StructureProgress = all[key] ?? {
    attempts: 0, correct: 0, firstTry: 0, streak: 0,
    ease: DEFAULT_EASE, interval: 0, dueAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
  };

  const quality = correct ? (firstTry ? 5 : 3) : 2;
  const streak = correct ? previous.streak + 1 : 0;

  // Ease drifts down on a miss and slightly up on a clean recall, floored so a
  // bad run can't push a structure into permanent daily repetition.
  const ease = Math.max(
    MIN_EASE,
    previous.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  let interval: number;
  if (!correct) interval = 0;            // same session
  else if (streak === 1) interval = 1;   // tomorrow
  else if (streak === 2) interval = 3;
  else interval = Math.round(previous.interval * ease) || 6;

  const now = Date.now();
  const next: StructureProgress = {
    attempts: previous.attempts + 1,
    correct: previous.correct + (correct ? 1 : 0),
    firstTry: previous.firstTry + (correct && firstTry ? 1 : 0),
    streak,
    ease: Math.round(ease * 100) / 100,
    interval,
    dueAt: new Date(now + interval * DAY).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
  };

  store.set(PROGRESS_KEY, { ...all, [key]: next });
  if (correct) awardSticker(key, next, next.lastSeenAt);
  return next;
}

// ---------------------------------------------------------------- stickers

/**
 * The child-facing face of progress. Two tiers per structure:
 *  - found: the first correct answer — an immediate, early win;
 *  - gold:  the structure reached mastery — the long-term goal.
 *
 * Unlike mastery, stickers are permanent. Mastery rightly drops after a miss
 * (that's what schedules the review), but taking a sticker back from an
 * eight-year-old reads as punishment, not feedback.
 */
export type StickerRecord = { found: string; gold?: string };
export type StickerEvent = {
  kind: "found" | "gold" | "organ";
  key: StructureKey;
  organId: OrganId;
  at: string;
};

const STICKERS_KEY = "stickers";
/** The most recent award, which the UI watches to celebrate it. */
export const STICKER_EVENT_KEY = "stickers:latest";

export function getStickers(): Record<StructureKey, StickerRecord> {
  return store.get<Record<StructureKey, StickerRecord>>(STICKERS_KEY, {});
}

function awardSticker(key: StructureKey, progress: StructureProgress, at: string) {
  const all = getStickers();
  const previous = all[key];
  const next: StickerRecord = previous ? { ...previous } : { found: at };
  let kind: StickerEvent["kind"] | null = previous ? null : "found";
  if (isMastered(progress) && !previous?.gold) {
    next.gold = at;
    kind = "gold";
  }
  if (!kind) return;

  const updated = { ...all, [key]: next };
  store.set(STICKERS_KEY, updated);

  const { organId } = parseStructureKey(key);
  const organ = structureById[organId];
  // Finding the last missing part of an organ is its own celebration.
  if (kind === "found" && organ?.hotspots.every((hotspot) => updated[structureKey(organId, hotspot.id)])) {
    kind = "organ";
  }
  store.set(STICKER_EVENT_KEY, { kind, key, organId, at } satisfies StickerEvent);
}

/** Counts across the whole atlas — numbers, so they're stable React snapshots. */
export function getFoundStickerCount(): number {
  const stickers = getStickers();
  return allStructureKeys().filter((key) => stickers[key]).length;
}

export function getGoldStickerCount(): number {
  const stickers = getStickers();
  return allStructureKeys().filter((key) => stickers[key]?.gold).length;
}

/**
 * Gives existing learners the stickers their past answers already earned, so
 * the sticker book doesn't open empty for someone with weeks of quizzes behind
 * them. Silent: no celebration for history.
 */
export function backfillStickers(): number {
  const stickers = getStickers();
  let added = 0;
  const next = { ...stickers };
  for (const [key, progress] of Object.entries(getAllProgress())) {
    if (progress.correct === 0) continue;
    const current = next[key];
    const gold = isMastered(progress) ? progress.lastSeenAt : undefined;
    if (!current) {
      next[key] = gold ? { found: progress.lastSeenAt, gold } : { found: progress.lastSeenAt };
      added += 1;
    } else if (gold && !current.gold) {
      next[key] = { ...current, gold };
      added += 1;
    }
  }
  if (added) store.set(STICKERS_KEY, next);
  return added;
}

/** Every structure in the atlas, whether or not it's been attempted. */
export function allStructureKeys(): StructureKey[] {
  return organStructures.flatMap((organ) =>
    organ.hotspots.map((hotspot) => structureKey(organ.id, hotspot.id)),
  );
}

/** Structures due for review now, soonest-due first. Unseen ones are not due. */
export function getReviewQueue(now = Date.now()): StructureKey[] {
  const all = getAllProgress();
  return Object.entries(all)
    .filter(([, progress]) => Date.parse(progress.dueAt) <= now)
    .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt))
    .map(([key]) => key);
}

/** Attempted, repeatedly missed, and not yet mastered — what to study next.
 *  Unlike the review queue this is not time-based: a weak structure is weak
 *  whether or not it happens to be due right now. */
export function getWeakStructures(limit = 5): StructureKey[] {
  const all = getAllProgress();
  return Object.entries(all)
    .filter(([, progress]) => progress.attempts > 0 && !isMastered(progress))
    .sort((a, b) => {
      const byMastery = masteryOf(a[1]) - masteryOf(b[1]);
      if (byMastery !== 0) return byMastery;
      return Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt);
    })
    .slice(0, limit)
    .map(([key]) => key);
}

export type OrganMastery = {
  organId: OrganId;
  mastery: number;
  /** Structures at >= 0.8 mastery. */
  mastered: number;
  total: number;
  attempted: number;
  lastSeenAt: string | null;
};

export function getOrganMastery(organId: OrganId): OrganMastery {
  const all = getAllProgress();
  const hotspots = structureById[organId].hotspots;
  let sum = 0;
  let mastered = 0;
  let attempted = 0;
  let lastSeenAt: string | null = null;

  for (const hotspot of hotspots) {
    const progress = all[structureKey(organId, hotspot.id)] ?? null;
    const mastery = masteryOf(progress);
    sum += mastery;
    if (mastery >= 0.8) mastered += 1;
    if (progress) {
      attempted += 1;
      if (!lastSeenAt || progress.lastSeenAt > lastSeenAt) lastSeenAt = progress.lastSeenAt;
    }
  }

  return {
    organId,
    mastery: hotspots.length ? Math.round((sum / hotspots.length) * 100) / 100 : 0,
    mastered,
    total: hotspots.length,
    attempted,
    lastSeenAt,
  };
}

export function getOverallMastery(): number {
  const keys = allStructureKeys();
  if (!keys.length) return 0;
  const all = getAllProgress();
  const sum = keys.reduce((total, key) => total + masteryOf(all[key] ?? null), 0);
  return Math.round((sum / keys.length) * 100) / 100;
}

/** How many structures across the whole atlas are mastered. A count reads
 *  better than a percentage for a child ("you know 7 of 35 body parts"). */
export function getMasteredCount(): number {
  const all = getAllProgress();
  return allStructureKeys().filter((key) => isMastered(all[key] ?? null)).length;
}

/**
 * The organ a "review" button should open. The quiz runs one organ at a time,
 * so a global due count needs a concrete destination: the current organ if it
 * has anything due (no jarring switch), otherwise whichever has the most.
 */
export function getReviewOrgan(preferred: OrganId, now = Date.now()): OrganId | null {
  const counts = new Map<OrganId, number>();
  for (const key of getReviewQueue(now)) {
    const { organId } = parseStructureKey(key);
    if (!(organId in structureById)) continue;
    counts.set(organId, (counts.get(organId) ?? 0) + 1);
  }
  if (counts.has(preferred)) return preferred;
  let best: OrganId | null = null;
  for (const [organId, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = organId;
  }
  return best;
}

/** Organs touched most recently, for "continue studying". */
export function getRecentOrgans(limit = 3): OrganId[] {
  return organStructures
    .map((organ) => getOrganMastery(organ.id))
    .filter((entry) => entry.lastSeenAt !== null)
    .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""))
    .slice(0, limit)
    .map((entry) => entry.organId);
}

/** Clears all progress. Only ever called from an explicit user action. */
export function resetProgress() {
  store.remove(PROGRESS_KEY);
  store.remove(STICKERS_KEY);
  store.remove(STICKER_EVENT_KEY);
}
