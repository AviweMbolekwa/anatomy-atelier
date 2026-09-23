import type { Organ } from "../i18n/merge";
import { structureById, type OrganId } from "./anatomy-data";
import { getReviewQueue, parseStructureKey, structureKey } from "./progress";

/**
 * Question generation.
 *
 * Every mode here is built from data the atlas already has — hotspot labels,
 * their `detail` prose, and which organ they belong to. Nothing needs new
 * per-structure content, which matters: any field added for a quiz mode has to
 * be written twelve times, once per locale. Modes that would need new prose
 * (function, spatial relationships) are deliberately not here yet.
 */

export type QuizMode =
  /** Click the named structure on the 3D model. */
  | "identify"
  /** A structure is highlighted; name it from four options. */
  | "reverse"
  /** A description is given; pick the structure it describes. */
  | "describe";

export type QuizQuestion = {
  mode: QuizMode;
  /** The structure being tested. */
  hotspotId: string;
  key: string;
  /** Shown as the prompt. Empty for `identify`, where the model is the prompt. */
  prompt: string;
  /** Option labels for the choice-based modes; empty for `identify`. */
  options: { id: string; label: string }[];
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Distractors for a choice question: structures from the same organ first,
 * since a plausible wrong answer is one the learner could actually confuse
 * with the right one. Falls back to structures from organs in the same body
 * system when an organ has too few of its own.
 */
function distractorsFor(organ: Organ, hotspotId: string, count: number) {
  const sameOrgan = organ.hotspots.filter((hotspot) => hotspot.id !== hotspotId);
  if (sameOrgan.length >= count) return shuffle(sameOrgan).slice(0, count);

  const systemId = structureById[organ.id].systemId;
  const neighbours = Object.values(structureById)
    .filter((entry) => entry.systemId === systemId && entry.id !== organ.id)
    .flatMap((entry) => entry.hotspots.map((hotspot) => ({ ...hotspot, label: hotspot.ta, detail: "" })));

  return shuffle([...sameOrgan, ...neighbours]).slice(0, count);
}

export function buildQuestion(organ: Organ, hotspotId: string, mode: QuizMode): QuizQuestion {
  const hotspot = organ.hotspots.find((entry) => entry.id === hotspotId);
  if (!hotspot) throw new Error(`unknown hotspot ${hotspotId} on ${organ.id}`);
  const key = structureKey(organ.id, hotspotId);

  if (mode === "identify") {
    return { mode, hotspotId, key, prompt: hotspot.label, options: [] };
  }

  const distractors = distractorsFor(organ, hotspotId, 3);
  const options = shuffle([
    { id: hotspot.id, label: hotspot.label },
    ...distractors.map((entry) => ({ id: entry.id, label: entry.label })),
  ]);

  return {
    mode,
    hotspotId,
    key,
    prompt: mode === "describe" ? hotspot.detail : "",
    options,
  };
}

/**
 * Builds a round.
 *
 * Structures already due for review come first and are always included, so a
 * session spends its questions on what the learner is closest to forgetting
 * rather than on what they already know. The rest of the round is filled from
 * the organ's remaining structures.
 */
export function buildRound(
  organ: Organ,
  modes: QuizMode[] = ["identify"],
  length = Math.min(10, organ.hotspots.length),
  now = Date.now(),
): QuizQuestion[] {
  const dueHere = new Set(
    getReviewQueue(now)
      .map(parseStructureKey)
      .filter((entry) => entry.organId === organ.id)
      .map((entry) => entry.hotspotId),
  );

  const due = organ.hotspots.filter((hotspot) => dueHere.has(hotspot.id));
  const rest = shuffle(organ.hotspots.filter((hotspot) => !dueHere.has(hotspot.id)));
  const chosen = [...due, ...rest].slice(0, length);

  return chosen.map((hotspot, index) =>
    buildQuestion(organ, hotspot.id, modes[index % modes.length]),
  );
}

/**
 * A cross-organ review round drawn from the global queue — the "review today"
 * session, as opposed to studying one organ.
 */
export function buildReviewRound(
  organsById: Record<OrganId, Organ>,
  modes: QuizMode[] = ["reverse", "describe"],
  length = 10,
  now = Date.now(),
): { organId: OrganId; question: QuizQuestion }[] {
  return getReviewQueue(now)
    .slice(0, length)
    .map((key, index) => {
      const { organId, hotspotId } = parseStructureKey(key);
      const organ = organsById[organId];
      if (!organ?.hotspots.some((hotspot) => hotspot.id === hotspotId)) return null;
      return { organId, question: buildQuestion(organ, hotspotId, modes[index % modes.length]) };
    })
    .filter((entry): entry is { organId: OrganId; question: QuizQuestion } => entry !== null);
}
