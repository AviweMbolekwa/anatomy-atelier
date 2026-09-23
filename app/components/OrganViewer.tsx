"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Box,
  CircleDashed,
  Layers3,
  Maximize2,
  RotateCcw,
  ScanLine,
  Search,
  Check,
  Crosshair,
  Sparkles,
  TriangleAlert,
  Trophy,
  X,
} from "lucide-react";
import type { Hotspot, Organ } from "../i18n/merge";
import { format, type UiDictionary } from "../i18n/types";
import type { AnatomyViewer } from "../lib/three/viewer";
import { getOrganMastery, recordAnswer, structureKey } from "../lib/progress";
import { buildRound } from "../lib/quiz-engine";
import { getHotspotCandidates } from "../lib/hotspot-authoring";
import { clearAuthoredHotspots, exportAuthoredHotspots, getAuthoredHotspots, getAuthoredSnapshot, getAuthoredSnapshotServer, removeAuthoredHotspot, saveAuthoredHotspot, subscribeAuthored } from "../lib/authored-hotspots";

type Props = {
  organ: Organ;
  t: UiDictionary;
  autoRotate: boolean;
  onAutoRotate: (enabled: boolean) => void;
  compare: boolean;
  onCompare: () => void;
  quizActive: boolean;
  onQuizExit: () => void;
  /** Structure to select once the model is ready — set by a search hit. */
  pendingStructure?: string | null;
  onStructureShown?: () => void;
};

type PickRef = { current: (hotspot: Hotspot) => void };

/**
 * The labelling quiz. Owns its own round state and is mounted with a `key` per
 * organ, so switching specimens restarts it without a resetting effect.
 */
function LabelQuiz({
  organ, t, pickRef, flash, screenY, select, onExit,
}: {
  organ: Organ;
  t: UiDictionary;
  pickRef: PickRef;
  flash: (id: string, correct: boolean) => void;
  screenY: (id: string) => number | null;
  select: (id: string | null) => void;
  onExit: () => void;
}) {
  const [seed, setSeed] = useState(0);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<{ correct: boolean; picked: string; target: string; atTop: boolean } | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const organId = organ.id;
  const hotspots = organ.hotspots;
  const [masteryBefore] = useState(() => getOrganMastery(organId));
  const [masteryAfter, setMasteryAfter] = useState<number | null>(null);

  // Rotate through the three V2 modes so a round tests recall in more than one
  // direction without requiring new per-structure content.
  const modes = useMemo(() => ["identify", "reverse", "describe"] as const, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const round = useMemo(() => buildRound(organ, [...modes]), [organ, seed, modes]);
  const target = round[step];
  const targetHotspot = target ? hotspots.find((h) => h.id === target.hotspotId) : undefined;
  const finished = step >= round.length;

  // Reverse identification uses the same 3D hotspot system as the normal quiz:
  // the answer is highlighted on the model, while the learner names it from
  // the four choices.
  useEffect(() => {
    if (!target || target.mode !== "reverse" || answer) return;
    window.requestAnimationFrame(() => {
      // Selection is intentionally visual only; the callout remains hidden in
      // quiz mode so the label itself is not revealed.
      select(target.hotspotId);
    });
  }, [answer, select, target]);

  const commitChoice = useCallback((pickedId: string) => {
    if (!target || !targetHotspot || answer) return;
    const picked = target.options.find((option) => option.id === pickedId);
    if (!picked) return;
    const correct = pickedId === target.hotspotId;
    flash(pickedId, correct);
    if (!correct) flash(target.hotspotId, true);
    const revealed = screenY(target.hotspotId);
    setAnswer({
      correct,
      picked: picked.label,
      target: targetHotspot.label,
      atTop: (revealed ?? 0) > 0.55,
    });
    setResults((list) => [...list, correct]);
    recordAnswer(structureKey(organId, target.hotspotId), correct, true);
    if (correct) setScore((value) => value + 1);
    window.setTimeout(() => {
      setAnswer(null);
      setStep((value) => value + 1);
    }, correct ? 1200 : 2400);
  }, [answer, flash, organId, screenY, target, targetHotspot]);

  // Keep the viewer's long-lived pointer callback in sync with the current
  // question. Identify mode is answered by clicking the 3D hotspot.
  useEffect(() => {
    pickRef.current = (hotspot) => {
      if (!target || target.mode !== "identify" || !targetHotspot || answer) return;
      const correct = hotspot.id === target.hotspotId;
      flash(hotspot.id, correct);
      if (!correct) flash(target.hotspotId, true);
      const revealed = screenY(correct ? hotspot.id : target.hotspotId);
      setAnswer({ correct, picked: hotspot.label, target: targetHotspot.label, atTop: (revealed ?? 0) > 0.55 });
      setResults((list) => [...list, correct]);
      recordAnswer(structureKey(organId, target.hotspotId), correct, true);
      if (correct) setScore((value) => value + 1);
      window.setTimeout(() => {
        setAnswer(null);
        setStep((value) => value + 1);
      }, correct ? 1200 : 2400);
    };
  }, [answer, flash, organId, pickRef, screenY, target, targetHotspot]);

  const recorded = useRef(false);
  useEffect(() => {
    if (!finished || recorded.current || !round.length) return;
    recorded.current = true;
    setMasteryAfter(getOrganMastery(organId).mastery);
  }, [finished, round.length, organId]);

  const retry = () => {
    recorded.current = false;
    setMasteryAfter(null);
    setStep(0);
    setScore(0);
    setAnswer(null);
    setResults([]);
    setSeed((value) => value + 1);
  };

  const modeLabel =
    target?.mode === "reverse" ? t.app.quiz.modeReverse
    : target?.mode === "describe" ? t.app.quiz.modeDescribe
    : t.app.quiz.modeIdentify;

  return (
    <>
      {target && (
        <div className={`quiz-bar quiz-mode-${target.mode}`} role="status" aria-live="polite">
          <div className="quiz-prompt">
            <em>{modeLabel}</em>
            {target.mode === "identify" && <strong>{targetHotspot?.label}</strong>}
            {target.mode === "reverse" && <strong>{t.app.quiz.reversePrompt}</strong>}
            {target.mode === "describe" && <strong>{target.prompt}</strong>}
          </div>

          {(target.mode === "reverse" || target.mode === "describe") && (
            <div className="quiz-options" role="group" aria-label={t.app.quiz.optionsLabel}>
              {target.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={Boolean(answer)}
                  className={answer
                    ? option.id === target.hotspotId ? "correct"
                      : option.label === answer.picked ? "incorrect" : ""
                    : ""}
                  onClick={() => commitChoice(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <div className="quiz-meta">
            <span className="quiz-progress">{format(t.quiz.progress, { current: String(step + 1), total: String(round.length) })}</span>
            <ol className="quiz-pips" aria-hidden>
              {round.map((question, index) => (
                <li
                  key={`${question.key}-${index}`}
                  className={index < results.length ? (results[index] ? "ok" : "no") : index === step ? "now" : ""}
                />
              ))}
            </ol>
            {target.mode === "identify" && <small>{t.quiz.hint}</small>}
            <small className="quiz-best">
              <Trophy size={11} /> {format(t.app.quiz.mastery, { percent: String(Math.round(masteryBefore.mastery * 100)) })}
            </small>
          </div>
          <button type="button" onClick={onExit} aria-label={t.quiz.exit}><X size={16} /></button>
        </div>
      )}

      {answer && (
        <div className={`quiz-answer ${answer.correct ? "ok" : "no"} ${answer.atTop ? "at-top" : ""}`} role="status" aria-live="assertive">
          <span className="quiz-answer-icon">{answer.correct ? <Check size={22} /> : <X size={22} />}</span>
          <div>
            <strong>{answer.correct ? t.quiz.correct : t.quiz.wrong}</strong>
            {answer.correct ? (
              <span>{answer.target}</span>
            ) : (
              <>
                <span>{format(t.quiz.reveal, { label: answer.picked })}</span>
                <span className="quiz-answer-hint">{format(t.quiz.answer, { label: answer.target })}</span>
              </>
            )}
          </div>
        </div>
      )}

      {finished && (
        <div className="quiz-summary" role="dialog" aria-modal="true">
          <span className="modal-icon">{score === round.length ? "★" : "✓"}</span>
          <h2>{t.quiz.done}</h2>
          <p>{format(t.quiz.score, { score: String(score), total: String(round.length) })}</p>
          {masteryAfter !== null && (
            <p className={masteryAfter > masteryBefore.mastery ? "quiz-new-best" : "quiz-best-line"}>
              <Trophy size={14} />{" "}
              {format(t.app.quiz.mastery, { percent: String(Math.round(masteryAfter * 100)) })}
              {masteryAfter > masteryBefore.mastery && (
                <span className="mastery-delta">
                  +{Math.round((masteryAfter - masteryBefore.mastery) * 100)}
                </span>
              )}
            </p>
          )}
          <div className="quiz-summary-actions">
            <button type="button" className="lesson-button" onClick={retry}>{t.quiz.retry}</button>
            <button type="button" onClick={onExit}>{t.quiz.exit}</button>
          </div>
        </div>
      )}
    </>
  );
}

/** `?authoring=1` is read from the URL without a hydration mismatch. */
function useAuthoringFlag() {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("authoring") === "1",
    () => false,
  );
}

export function OrganViewer({
  organ, t, autoRotate, onAutoRotate, compare, onCompare, quizActive, onQuizExit,
  pendingStructure, onStructureShown,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const organRef = useRef(organ);
  const autoRotateRef = useRef(autoRotate);
  const canvasLabelRef = useRef(t.viewer.canvas);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Bumped to force a re-attempt after a failed load.
  const [retryToken, setRetryToken] = useState(0);
  const [ready, setReady] = useState(false);

  // Opt-in coordinate probe for placing hotspots — not a user-facing feature.
  const authoring = useAuthoringFlag();
  const authoringRef = useRef(authoring);
  const [authorPoint, setAuthorPoint] = useState<{ x: number; y: number; z: number } | null>(null);
  const [copied, setCopied] = useState(false);
  // The candidate being placed is mostly a *derived* value (the first
  // not-yet-placed candidate) with one explicit override: "skip" picks a
  // specific later candidate. Deriving it with useMemo rather than syncing it
  // via setState-in-an-effect means it's correct on the very first render —
  // no extra render is needed for it to catch up — and there's no risk of the
  // classic effect/state ping-pong.
  const [candidateOverride, setCandidateOverride] = useState<string | null>(null);
  const authoredVersion = useSyncExternalStore(subscribeAuthored, getAuthoredSnapshot, getAuthoredSnapshotServer);
  // authoredVersion is a change signal from the external localStorage-backed
  // store, not read inside the callback — but recomputation must follow it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const authoredForOrgan = useMemo(() => getAuthoredHotspots(organ.id), [organ.id, authoredVersion]);
  const authorCandidates = useMemo(() => getHotspotCandidates(organ.id), [organ.id]);
  const placedCandidateIds = useMemo(
    () => new Set(authoredForOrgan.map((item) => item.id)),
    [authoredForOrgan],
  );
  const selectedCandidateId = useMemo(() => {
    if (candidateOverride && !placedCandidateIds.has(candidateOverride)) return candidateOverride;
    return authorCandidates.find((candidate) => !placedCandidateIds.has(candidate.id))?.id ?? null;
  }, [candidateOverride, authorCandidates, placedCandidateIds]);

  // The viewer captures its callbacks once, so live handlers go through refs.
  const pickRef = useRef<(hotspot: Hotspot) => void>(() => {});
  const authorRef = useRef<(point: { x: number; y: number; z: number }) => void>(() => {});
  useEffect(() => {
    authorRef.current = (point) => {
      setAuthorPoint(point);
      if (!selectedCandidateId) return;
      const candidate = authorCandidates.find((item) => item.id === selectedCandidateId);
      if (!candidate) return;
      saveAuthoredHotspot(organ.id, { ...candidate, position: [point.x, point.y, point.z] });
      setCopied(false);
    };
  }, [authorCandidates, organ.id, selectedCandidateId]);
  useEffect(() => {
    authoringRef.current = authoring;
  }, [authoring]);
  // A typical organ is ready well inside a second — flashing a loading panel for
  // that reads as jank. It only appears if the fetch is genuinely slow; the flag
  // is cleared by onLoading when the next load starts.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setSlowLoad(true), 900);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    organRef.current = organ;
  }, [organ]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    canvasLabelRef.current = t.viewer.canvas;
    viewerRef.current?.setCanvasLabel(t.viewer.canvas);
  }, [t.viewer.canvas]);

  useEffect(() => {
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("../lib/three/viewer").then(({ AnatomyViewer: Viewer }) => {
      if (cancelled || !mountRef.current) return;
      viewer = new Viewer(mountRef.current, {
        onSelect: setSelected,
        onLoading: (isLoading, value) => {
          setLoading(isLoading);
          setProgress(value);
          if (isLoading) setSlowLoad(false);
        },
        onPick: (hotspot) => pickRef.current(hotspot),
        onAuthorPoint: (point) => {
          authorRef.current(point);
        },
        onLoadError: () => setLoadError(true),
        onLoadTiming: ({ url, ms, cached }) => {
          // Surfaced in the console and as a performance mark rather than in
          // the UI: useful when profiling a switch, invisible to learners.
          if (typeof performance !== "undefined" && "measure" in performance) {
            try {
              performance.measure(`organ-load${cached ? "-cached" : ""}`, { start: performance.now() - ms, duration: ms });
            } catch {
              // measure() with a detail object is unsupported on some engines.
            }
          }
          if (process.env.NODE_ENV !== "production") {
            console.debug(`[anatomy] ${url} loaded in ${ms}ms${cached ? " (cached)" : ""}`);
          }
        },
      });
      viewerRef.current = viewer;
      viewer.setCanvasLabel(canvasLabelRef.current);
      viewer.setAutoRotate(autoRotateRef.current);
      viewer.setAuthoring(authoringRef.current);
      const current = organRef.current;
      viewer.setOrgan(current.model, current.hotspots, current.accent)
        .then(() => setReady(true))
        .catch(() => {
          setLoading(false);
          setProgress(0);
          setLoadError(true);
        });
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.dispose();
    };
  }, []);

  // A structure requested by search is applied once the model has resolved;
  // selecting before the GLB is in place would silently no-op.
  useEffect(() => {
    if (!pendingStructure || !ready || loadError) return;
    viewerRef.current?.selectHotspot(pendingStructure);
    onStructureShown?.();
  }, [pendingStructure, ready, loadError, onStructureShown]);

  useEffect(() => {
    if (!viewerRef.current) return;
    setLoadError(false);
    viewerRef.current.setOrgan(organ.model, organ.hotspots, organ.accent)
      .then(() => setReady(true))
      .catch(() => {
        setLoading(false);
        setProgress(0);
        setLoadError(true);
      });
  }, [organ, retryToken]);

  // A spinning specimen makes "click the mitral valve" a game of chance, so the
  // quiz holds the model still and restores the user's setting on exit.
  useEffect(() => viewerRef.current?.setAutoRotate(autoRotate && !quizActive), [autoRotate, quizActive]);
  useEffect(() => viewerRef.current?.setQuizMode(quizActive), [quizActive]);
  useEffect(() => viewerRef.current?.setAuthoring(authoring), [authoring]);


  // The viewer drives the callout's position directly, so a spinning model
  // never costs a React render.
  const calloutRef = useCallback((node: HTMLDivElement | null) => {
    viewerRef.current?.attachCallout(node);
  }, []);
  const selectQuizHotspot = useCallback((id: string | null) => {
    viewerRef.current?.selectHotspot(id);
  }, []);


  const handleTool = (tool: string) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (tool === "rotate") onAutoRotate(!autoRotate);
    if (tool === "zoom") viewer.zoom(-1);
    if (tool === "isolate") setActiveTool(viewer.toggleIsolate() ? tool : null);
    if (tool === "section") setActiveTool(viewer.toggleCrossSection() ? tool : null);
    if (tool === "layers") setActiveTool(viewer.toggleLayers() ? tool : null);
    if (tool === "compare") onCompare();
    if (tool === "reset") {
      const state = viewer.reset();
      setActiveTool(null);
      // Reset turns auto-rotation back on, so the parent's toggle has to follow
      // or the switch would disagree with the scene.
      if (state.autoRotate !== autoRotate) onAutoRotate(state.autoRotate);
      if (compare) onCompare();
    }
  };

  const tools = [
    { id: "rotate", label: t.tools.rotate, icon: RotateCcw },
    { id: "zoom", label: t.tools.zoom, icon: Search },
    { id: "isolate", label: t.tools.isolate, icon: CircleDashed },
    { id: "section", label: t.tools.section, icon: ScanLine },
    { id: "layers", label: t.tools.layers, icon: Layers3 },
    { id: "compare", label: t.tools.compare, icon: Box },
    { id: "reset", label: t.tools.reset, icon: RotateCcw },
  ];

  return (
    <section className="viewer-shell" aria-label={format(t.viewer.title, { organ: organ.name })}>
      <div className="viewer-glow" style={{ "--organ-accent": organ.accent } as React.CSSProperties} />
      <div ref={mountRef} className="three-mount" />

      <div className="viewer-tools" aria-label={t.tools.label}>
        {tools.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`tool-button ${(activeTool === id || (id === "compare" && compare)) ? "active" : ""}`}
            onClick={() => handleTool(id)}
            aria-pressed={activeTool === id || (id === "compare" && compare)}
            title={label}
          >
            <Icon size={19} strokeWidth={1.65} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {!quizActive && (
      <aside className="tip-note" aria-label={t.viewer.tip}>
        <span><Sparkles size={15} /> {t.viewer.tip}</span>
        <p>{t.viewer.tipDrag}<br />{t.viewer.tipScroll}<br />{t.viewer.tipClick}</p>
      </aside>
      )}

      {selected && !quizActive && (
        <div className="hotspot-callout" ref={calloutRef} data-side="right">
          <div className="callout-body" style={{ "--hotspot-color": selected.color } as React.CSSProperties}>
            <button className="callout-close" type="button" onClick={() => viewerRef.current?.clearSelection()} aria-label={t.modal.close}>
              <X size={13} />
            </button>
            <b>{selected.label}</b>
            <small>{selected.detail}</small>
          </div>
        </div>
      )}

      {/*
        Keyboard- and screen-reader-accessible equivalent of the dots, which
        otherwise live only inside the canvas. These are real buttons: they
        select the same structure a click on the dot would, so the viewer is
        fully operable without a pointer. Visually hidden until focused.
      */}
      {!quizActive && (
        <div className="hotspot-index" role="group" aria-label={t.viewer.structures}>
          <p className="hotspot-index-hint">{t.app.viewer.hint}</p>
          <ul>
            {organ.hotspots.map((hotspot) => (
              <li key={hotspot.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === hotspot.id}
                  onClick={() => viewerRef.current?.selectHotspot(selected?.id === hotspot.id ? null : hotspot.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      viewerRef.current?.cycleHotspot(event.key === "ArrowDown" ? 1 : -1);
                    }
                  }}
                >
                  <b>{hotspot.label}</b>: {hotspot.detail}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quizActive && (
        <LabelQuiz
          key={organ.id}
          organ={organ}
          t={t}
          pickRef={pickRef}
          flash={(id, correct) => viewerRef.current?.flash(id, correct)}
          screenY={(id) => viewerRef.current?.hotspotScreenY(id) ?? null}
          select={selectQuizHotspot}
          onExit={onQuizExit}
        />
      )}

      {authoring && (
        <div className="authoring-panel">
          <div className="authoring-head">
            <span><Crosshair size={13} /> authoring</span>
            <b>{organ.name}</b>
            <em>{organ.hotspots.length} active</em>
          </div>
          <div className="authoring-progress" aria-label="Hotspot authoring progress">
            <span style={{ width: `${Math.min(100, (authoredForOrgan.length / Math.max(authorCandidates.length, 1)) * 100)}%` }} />
          </div>
          <div className="authoring-copy">
            {selectedCandidateId ? (
              (() => {
                const candidate = authorCandidates.find((item) => item.id === selectedCandidateId);
                if (!candidate) return <strong>All expansion hotspots placed.</strong>;
                return <>
                  <strong>Click the model to place: {candidate.label}</strong>
                  <small>{candidate.detail}</small>
                </>;
              })()
            ) : (
              <strong>All expansion hotspots placed.</strong>
            )}
          </div>
          <div className="authoring-actions">
            <button
              type="button"
              disabled={!selectedCandidateId}
              onClick={() => {
                const index = authorCandidates.findIndex((item) => item.id === selectedCandidateId);
                const next = authorCandidates.slice(index + 1).find((item) => !placedCandidateIds.has(item.id));
                setCandidateOverride(next?.id ?? null);
                setAuthorPoint(null);
              }}
            >
              skip
            </button>
            <button
              type="button"
              disabled={!authoredForOrgan.length}
              onClick={() => {
                removeAuthoredHotspot(organ.id, authoredForOrgan[authoredForOrgan.length - 1].id);
                setCandidateOverride(null);
              }}
            >
              undo last
            </button>
            <button
              type="button"
              disabled={!authoredForOrgan.length}
              onClick={() => {
                const text = exportAuthoredHotspots();
                void navigator.clipboard.writeText(text).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                });
              }}
            >
              {copied ? "copied" : "export"}
            </button>
            <button type="button" onClick={() => { clearAuthoredHotspots(organ.id); setCandidateOverride(null); }}>clear</button>
          </div>
          {authorPoint && (
            <code>{`last: [${authorPoint.x}, ${authorPoint.y}, ${authorPoint.z}]`}</code>
          )}
          <p className="authoring-note">Place the next structure on the actual mesh. The position is saved locally and becomes part of search, quizzes and mastery after the model refreshes.</p>
        </div>
      )}

      {/* Before the very first model resolves there is nothing on the canvas
          at all, so a skeleton stands in for the specimen rather than leaving
          an empty panel. */}
      {!ready && !loadError && (
        <div className="viewer-skeleton" aria-hidden>
          <div className="skeleton-specimen" />
          <div className="skeleton-plinth" />
        </div>
      )}

      {loadError ? (
        <div className="model-error" role="alert">
          <span className="model-error-icon"><TriangleAlert size={20} /></span>
          <strong>{format(t.app.viewer.error, { organ: organ.name })}</strong>
          <button
            type="button"
            className="lesson-button"
            onClick={() => {
              setLoadError(false);
              setLoading(true);
              setRetryToken((value) => value + 1);
            }}
          >
            {t.app.viewer.retry}
          </button>
        </div>
      ) : loading && slowLoad ? (
        <div className="model-loader" role="status" aria-live="polite">
          <div className="loader-orbit"><Maximize2 size={20} /></div>
          <strong>{format(t.viewer.loading, { organ: organ.name })}</strong>
          <span>{Math.max(8, Math.round(progress * 100))}%</span>
        </div>
      ) : null}

      {!quizActive && (
      <button className="auto-rotate" type="button" onClick={() => onAutoRotate(!autoRotate)} aria-pressed={autoRotate}>
        <RotateCcw size={14} /> {t.viewer.autoRotate}
        <span className={`switch ${autoRotate ? "on" : ""}`}><i /></span>
      </button>
      )}

      <div className="view-caption">
        <span>{t.viewer.caption}</span>
        <strong>{organ.scientificName}</strong>
      </div>
    </section>
  );
}
