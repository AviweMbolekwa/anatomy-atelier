"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ArrowRight, Check, Flame, X } from "lucide-react";
import type { Organ } from "../i18n/merge";
import type { OrganId } from "../lib/anatomy-data";
import { format, type UiDictionary } from "../i18n/types";
import { useModalA11y } from "../lib/use-modal-a11y";
import { SpeakButton, Speakable } from "./ReadAloud";
import { store } from "../lib/storage";
import {
  DAILY_KEY, answerDaily, currentStreak, ensureTodaysQuestion, isAnsweredToday, localDateKey, parseDailyState,
} from "../lib/daily";

/** Reads the daily state as a raw string — a stable snapshot for React — and
 *  parses it once per change. */
export function useDailyState() {
  const raw = useSyncExternalStore(store.subscribe, () => store.getRaw(DAILY_KEY), () => null);
  return useMemo(() => parseDailyState(raw), [raw]);
}

export function DailySheet({
  lang, organs, organById, t, onClose, onSee,
}: {
  lang: string;
  organs: Organ[];
  organById: Record<OrganId, Organ>;
  t: UiDictionary;
  onClose: () => void;
  onSee: (organId: OrganId, hotspotId?: string) => void;
}) {
  const copy = t.app.daily;
  const dialogRef = useModalA11y<HTMLElement>(onClose);
  const state = useDailyState();

  // Generated on first open each day, then read back unchanged all day.
  useEffect(() => { ensureTodaysQuestion(organs); }, [organs]);

  const today = localDateKey();
  const question = state.question?.date === today ? state.question : null;
  const answered = isAnsweredToday(state);
  const streak = currentStreak(state);
  const organ = question ? organById[question.organId] : null;

  const labelFor = (id: string) =>
    question?.kind === "organ"
      ? organById[id as OrganId]?.name ?? id
      : organ?.hotspots.find((hotspot) => hotspot.id === id)?.label ?? id;
  const answerId = question ? (question.kind === "organ" ? question.organId : question.hotspotId) : null;

  // Read the clue, the question and the choices as one passage, so a child
  // who can't read yet can still play. Offsets let each piece highlight its
  // own words as they're spoken.
  const clue = question && organ
    ? (question.kind === "organ" ? organ[question.fact] : organ.hotspots.find((hotspot) => hotspot.id === question.hotspotId)?.detail ?? "")
    : "";
  const prompt = question && organ
    ? (question.kind === "organ" ? copy.whichOrgan : format(copy.whichPart, { organ: organ.name }))
    : "";
  const optionOffsets: number[] = [];
  let spoken = `${clue}. ${prompt}`;
  for (const id of question?.options ?? []) {
    spoken += " ";
    optionOffsets.push(spoken.length);
    spoken += `${labelFor(id)}.`;
  }
  const passageId = question ? `daily:${question.date}` : "daily";

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="learning-modal daily-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label={t.modal.close}><X size={18} /></button>
        <em>{copy.title}</em>

        <div className="daily-streak-row">
          <span className={`daily-flame ${streak > 0 ? "lit" : ""}`} aria-hidden><Flame size={22} /></span>
          <strong>{streak}</strong>
          <span>{copy.streakLabel}</span>
          {state.best > 0 && <small>{format(copy.best, { count: String(state.best) })}</small>}
        </div>
        {!answered && streak === 0 && <p className="daily-nudge">{copy.streakStart}</p>}

        {question && organ && (
          <>
            <blockquote className="daily-clue">
              <SpeakButton id={passageId} text={spoken} lang={lang} labels={t.app.speech} />
              <Speakable id={passageId} text={clue} />
            </blockquote>
            <h2 id="daily-title">
              <Speakable id={passageId} text={prompt} offset={clue.length + 2} />
            </h2>

            <div className="daily-options" role="group" aria-label={t.app.quiz.optionsLabel}>
              {question.options.map((id) => {
                const isAnswer = id === answerId;
                const isPicked = id === state.picked;
                const status = answered ? (isAnswer ? "is-correct" : isPicked ? "is-wrong" : "") : "";
                return (
                  <button
                    key={id}
                    type="button"
                    className={status}
                    disabled={answered}
                    onClick={() => answerDaily(id)}
                  >
                    <span><Speakable id={passageId} text={labelFor(id)} offset={optionOffsets[(question.options as string[]).indexOf(id)]} /></span>
                    {answered && isAnswer && <Check size={16} aria-hidden />}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className="daily-result" role="status" aria-live="polite">
                <p><b>{state.correct ? copy.correct : format(copy.wrong, { answer: labelFor(answerId!) })}</b></p>
                <p>{copy.comeBack}</p>
                <button
                  type="button"
                  className="lesson-button"
                  onClick={() => onSee(question.organId, question.kind === "structure" ? question.hotspotId : undefined)}
                >
                  {copy.see3d} <ArrowRight size={16} aria-hidden />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
