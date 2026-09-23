import type { Organ } from "../i18n/merge";
import type { OrganId } from "./anatomy-data";
import { getReviewQueue, parseStructureKey, recordAnswer, structureKey } from "./progress";
import { store } from "./storage";

/**
 * Question of the day — the reason to open the app tomorrow.
 *
 * Every question is built from content that already exists in all 12 locales
 * (organ facts, structure descriptions), so the feature costs no new prose.
 * The question is stored as ids, not text: it stays the same all day, and
 * still reads correctly if the child switches language.
 *
 * The streak counts days a question was *answered*, right or wrong. For an
 * 8-year-old the habit is the win; punishing a wrong answer by breaking the
 * streak would teach them to stop trying, not to learn.
 */

export type FactField = "funFact" | "medical" | "dailyFact";

export type DailyQuestion =
  /** A fact about an organ, name withheld: which organ is it? */
  | { kind: "organ"; date: string; organId: OrganId; fact: FactField; options: OrganId[] }
  /** A structure's description: which part of this organ is it? */
  | { kind: "structure"; date: string; organId: OrganId; hotspotId: string; options: string[] };

export type DailyState = {
  question: DailyQuestion | null;
  /** The option picked for `question`, once answered. */
  picked: string | null;
  correct: boolean | null;
  streak: number;
  best: number;
  lastAnsweredOn: string | null;
};

export const DAILY_KEY = "daily";
const KEY = DAILY_KEY;
const EMPTY: DailyState = { question: null, picked: null, correct: null, streak: 0, best: 0, lastAnsweredOn: null };

/** The child's local calendar day. A UTC date would roll over mid-afternoon
 *  in some time zones and break a streak the child never missed. */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function getDailyState(): DailyState {
  return store.get<DailyState>(KEY, EMPTY);
}

/** Parses a raw stored value (what React subscribes to) into state. */
export function parseDailyState(raw: string | null): DailyState {
  if (!raw) return EMPTY;
  try {
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<DailyState>) };
  } catch {
    return EMPTY;
  }
}

/** The streak as it stands today: a missed day shows 0, not yesterday's count. */
export function currentStreak(state: DailyState = getDailyState(), now: Date = new Date()): number {
  if (!state.lastAnsweredOn) return 0;
  const gap = dayNumber(localDateKey(now)) - dayNumber(state.lastAnsweredOn);
  return gap <= 1 ? state.streak : 0;
}

export function isAnsweredToday(state: DailyState = getDailyState(), now: Date = new Date()): boolean {
  return state.lastAnsweredOn === localDateKey(now);
}

// ------------------------------------------------------------- generation

/** Deterministic per-day randomness, so a regenerated question is the same one. */
function seeded(seedText: string) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i += 1) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A fact is only usable if it doesn't give the answer away by naming the organ. */
export function factRevealsOrgan(fact: string, organName: string): boolean {
  const name = organName.toLowerCase();
  // "Lungs" must also catch "lung"; CJK names are short and matched whole.
  const stem = name.length > 4 ? name.slice(0, name.length - 1) : name;
  return fact.toLowerCase().includes(stem);
}

const FACT_FIELDS: FactField[] = ["funFact", "medical", "dailyFact"];

export function buildDailyQuestion(organs: Organ[], date: string, now = Date.now()): DailyQuestion {
  const rand = seeded(date);

  // Practice first: a structure that's due for review makes the daily
  // question pull double duty as spaced repetition.
  const due = getReviewQueue(now)
    .map(parseStructureKey)
    .find(({ organId, hotspotId }) => organs.some((o) => o.id === organId && o.hotspots.some((h) => h.id === hotspotId)));

  const structureQuestion = (organ: Organ, hotspotId: string): DailyQuestion => {
    const others = shuffle(organ.hotspots.filter((h) => h.id !== hotspotId).map((h) => h.id), rand).slice(0, 3);
    return { kind: "structure", date, organId: organ.id, hotspotId, options: shuffle([hotspotId, ...others], rand) };
  };

  if (due && rand() < 0.6) {
    return structureQuestion(organs.find((o) => o.id === due.organId)!, due.hotspotId);
  }

  if (rand() < 0.5) {
    const candidates = organs.flatMap((organ) =>
      FACT_FIELDS.filter((field) => organ[field] && !factRevealsOrgan(organ[field], organ.name))
        .map((fact) => ({ organ, fact })),
    );
    if (candidates.length) {
      const { organ, fact } = candidates[Math.floor(rand() * candidates.length)];
      const others = shuffle(organs.filter((o) => o.id !== organ.id).map((o) => o.id), rand).slice(0, 3);
      return { kind: "organ", date, organId: organ.id, fact, options: shuffle([organ.id, ...others], rand) };
    }
  }

  const withParts = organs.filter((o) => o.hotspots.length >= 3);
  const organ = withParts[Math.floor(rand() * withParts.length)];
  return structureQuestion(organ, organ.hotspots[Math.floor(rand() * organ.hotspots.length)].id);
}

/** Today's question, generated once per day and then read back unchanged. */
export function ensureTodaysQuestion(organs: Organ[], now: Date = new Date()): DailyQuestion {
  const state = getDailyState();
  const today = localDateKey(now);
  if (state.question?.date === today) return state.question;
  const question = buildDailyQuestion(organs, today, now.getTime());
  store.set(KEY, { ...state, question, picked: null, correct: null } satisfies DailyState);
  return question;
}

/** Records today's answer. Answering twice in one day changes nothing. */
export function answerDaily(choice: string, now: Date = new Date()): DailyState {
  const state = getDailyState();
  const today = localDateKey(now);
  const question = state.question;
  if (!question || question.date !== today || state.lastAnsweredOn === today) return state;

  const correct = question.kind === "organ" ? choice === question.organId : choice === question.hotspotId;
  if (question.kind === "structure") {
    recordAnswer(structureKey(question.organId, question.hotspotId), correct, true);
  }

  const continues = state.lastAnsweredOn !== null && dayNumber(today) - dayNumber(state.lastAnsweredOn) === 1;
  const streak = continues ? state.streak + 1 : 1;
  const next: DailyState = {
    ...state,
    picked: choice,
    correct,
    streak,
    best: Math.max(state.best, streak),
    lastAnsweredOn: today,
  };
  store.set(KEY, next);
  return next;
}

export function resetDaily() {
  store.remove(KEY);
}
