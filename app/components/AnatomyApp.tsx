"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import {
  ArrowRight,
  BookOpen,
  Box,
  Bookmark,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  Flame,
  Compass,
  Globe,
  Heart,
  HeartPulse,
  Lightbulb,
  LibraryBig,
  Microscope,
  NotebookPen,
  Play,
  Search,
  Share2,
  Sparkles,
  Crosshair,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { OrganViewer } from "./OrganViewer";
import { ArSheet } from "./ArSheet";
import { DailySheet, useDailyState } from "./DailySheet";
import { StickerBook, StickerToast } from "./StickerBook";
import { HeartbeatSheet } from "./HeartbeatSheet";
import { SpeakButton, Speakable } from "./ReadAloud";
import { currentStreak, isAnsweredToday } from "../lib/daily";
import { organIds, organIdsBySystem, systemIds, type OrganId, type SystemId } from "../lib/anatomy-data";
import {
  EMPTY_NOTES, EMPTY_SAVED, getNotesSnapshot, getSavedSnapshot,
  setNote as persistNote, subscribe, toggleSavedOrgan,
} from "../lib/local-store";
import { useModalA11y } from "../lib/use-modal-a11y";
import { search as searchAnatomy } from "../lib/search";
import { allStructureKeys, backfillStickers, getFoundStickerCount, getReviewOrgan, getReviewQueue, recordAnswer, structureKey } from "../lib/progress";
import { migrateLegacyBestScores } from "../lib/local-store";
import { store } from "../lib/storage";
import type { LocaleConfig } from "../i18n/config";
import { locales } from "../i18n/config";
import { buildOrgans, indexOrgans, type Organ } from "../i18n/merge";
import { getAuthoredHotspots, getAuthoredSnapshot, getAuthoredSnapshotServer, subscribeAuthored } from "../lib/authored-hotspots";
import { format, type Dictionary, type UiDictionary } from "../i18n/types";
import { withBase } from "../lib/base-path";

/**
 * The old "quiz" modal was three buttons that all closed the dialog without
 * checking anything, sitting alongside the real 3D labelling quiz in the
 * viewer. There is now exactly one quiz — the labelling one — so this modal
 * type no longer carries a quiz variant.
 */
type Modal = "lesson" | "animation" | "system" | null;

/** Slide-over panels driven by the primary nav. */
type Panel = "systems" | "saved" | "notes" | "grownups" | null;

/**
 * Renders an organ illustration, or its accent glyph for organs that ship as a
 * 3D model without the painted asset set. Keeps every image slot filled instead
 * of leaving a broken `<img>` behind.
 */
function OrganArt({
  organ,
  asset,
  alt,
  size,
}: {
  organ: Organ;
  asset: "thumb" | "organ" | "microscopic" | "compare" | "location";
  alt: string;
  size?: number;
}) {
  if (!organ.illustrated) {
    // An empty alt means a surrounding control already names this, so the
    // glyph should be skipped rather than announced with no label.
    const labelling = alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true };
    return (
      <span className="art-fallback" style={{ "--art-accent": organ.accent } as React.CSSProperties} {...labelling}>
        {organ.icon}
      </span>
    );
  }
  return (
    <img
      key={`${organ.id}-${asset}`}
      src={withBase(`/anatomy/${organ.id}/${asset}.webp`)}
      alt={alt}
      width={size}
      height={size}
      loading={asset === "thumb" ? "eager" : "lazy"}
      decoding="async"
    />
  );
}


/**
 * Measurements like "250–350 g" begin with a digit, which Unicode treats as
 * neutral — inside an RTL paragraph the range gets visually reversed. Digits
 * are not "strong" characters, so `unicode-bidi: plaintext` cannot rescue it;
 * the run has to be isolated as LTR explicitly.
 */
function Measure({ children }: { children: string }) {
  return <bdi dir={/^[\d(]/.test(children.trim()) ? "ltr" : "auto"}>{children}</bdi>;
}

/**
 * Switches language by swapping the leading path segment, so the current
 * document is preserved rather than bouncing through the root redirect.
 *
 * The native <select> is stretched transparently over the whole pill rather
 * than sitting inline. A <label> only *focuses* a select when clicked — it does
 * not open it — so anything outside the select's own box (the globe, the
 * chevron, the padding) would otherwise be a dead zone. Overlaying it means a
 * click anywhere on the control opens the picker, while the visible row
 * underneath stays fully styleable.
 */
function LanguageSwitcher({ locale, t }: { locale: LocaleConfig; t: UiDictionary }) {
  return (
    <div className="language-switcher" title={t.language.label}>
      <Globe size={16} aria-hidden />
      <span className="language-current">{locale.nativeName}</span>
      <ChevronDown size={14} aria-hidden />
      <select
        aria-label={t.language.choose}
        value={locale.code}
        onChange={(event) => {
          window.location.pathname = withBase(`/${event.target.value}/`);
        }}
      >
        {locales.map((entry) => (
          <option key={entry.code} value={entry.code} lang={entry.code}>
            {entry.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AnatomyApp({ locale, dictionary }: { locale: LocaleConfig; dictionary: Dictionary }) {
  const t = dictionary.ui;
  const authoredVersion = useSyncExternalStore(subscribeAuthored, getAuthoredSnapshot, getAuthoredSnapshotServer);
  const authored = useMemo(() => {
    if (!authoredVersion) return {};
    const result: Record<string, ReturnType<typeof getAuthoredHotspots>> = {};
    for (const id of organIds) result[id] = getAuthoredHotspots(id);
    return result;
  }, [authoredVersion]);
  const organs = useMemo(() => buildOrgans(dictionary.organs, authored), [dictionary.organs, authored]);
  const organById = useMemo(() => indexOrgans(organs), [organs]);

  const [organId, setOrganId] = useState<OrganId>("heart");
  const [autoRotate, setAutoRotate] = useState(true);
  const [compare, setCompare] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [arOpen, setArOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [heartbeatOpen, setHeartbeatOpen] = useState(false);
  /** The child's measured pulse, while the 3D heart beats along with it. */
  const [heartbeatBpm, setHeartbeatBpm] = useState<number | null>(null);
  const daily = useDailyState();
  const dailyStreak = currentStreak(daily);
  const dailyWaiting = !isAnsweredToday(daily);
  /** Structure to select once the organ's model is ready (set by search). */
  const [pendingStructure, setPendingStructure] = useState<string | null>(null);
  // Read through the store rather than copied into state by an effect: the
  // server snapshot is empty, and the client re-reads on subscribe.
  const saved = useSyncExternalStore(subscribe, getSavedSnapshot, () => EMPTY_SAVED);
  const notes = useSyncExternalStore(subscribe, getNotesSnapshot, () => EMPTY_NOTES) as Record<string, string>;
  const contentRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(new Set<OrganId>());
  const organ = organById[organId];
  const reference = organById[organId === "heart" ? "brain" : "heart"];
  // With no query the library lists every organ; with one it switches to
  // ranked results that include individual structures, not just organs.
  const results = useMemo(() => (query.trim() ? searchAnatomy(organs, query) : null), [organs, query]);
  const filteredOrgans = useMemo(
    () => (results === null ? organs : []),
    [organs, results],
  );

  // Review state is read through the store so it stays in step with answers
  // recorded inside the viewer.
  const reviewDue = useSyncExternalStore(store.subscribe, () => getReviewQueue().length, () => 0);
  // Stickers, not a mastery percentage: "12 of 35 stickers" means something to
  // an eight-year-old; "Mastery 20%" doesn't.
  const stickersFound = useSyncExternalStore(store.subscribe, getFoundStickerCount, () => 0);
  const stickersTotal = useMemo(() => allStructureKeys().length, []);

  // V1 stored one best score per organ. Carry that forward once, on first
  // load, so an existing learner doesn't open V2 to an empty profile.
  useEffect(() => {
    void store.hydrate().then(() => {
      migrateLegacyBestScores((migratedOrganId, correct) => {
        for (const hotspot of organById[migratedOrganId].hotspots) {
          recordAnswer(structureKey(migratedOrganId, hotspot.id), correct, correct);
        }
      });
      // Learners with answers from before stickers existed get what they earned.
      backfillStickers();
    });
    // Runs once; organById is stable for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current.querySelectorAll("[data-reveal]"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.48, stagger: 0.035, ease: "power2.out", overwrite: true },
    );
  }, [organId]);

  const selectOrgan = (id: OrganId) => {
    if (organById[id].illustrated) {
      ["organ", "microscopic", "compare", "location"].forEach((asset) => {
        const image = new Image();
        image.src = withBase(`/anatomy/${id}/${asset}.webp`);
      });
    }
    setOrganId(id);
    setMobileLibrary(false);
    setCompare(false);
    setQuizActive(false);
    setPanel(null);
    setArOpen(false);
    setDailyOpen(false);
    setStickersOpen(false);
    setHeartbeatOpen(false);
    setHeartbeatBpm(null);
    setPendingStructure(null);
  };

  // The due count covers every organ but the quiz runs on one, so jump to an
  // organ that actually has something due rather than quizzing the current
  // one on parts that may not need practice at all.
  const startReview = () => {
    const target = getReviewOrgan(organId);
    if (target && target !== organId) selectOrgan(target);
    setQuizActive(true);
  };

  const onToggleSaved = (id: OrganId) => toggleSavedOrgan(id);

  const onNoteChange = (id: OrganId, text: string) => persistNote(id, text);

  // Warms the model in the HTTP cache while the pointer is still travelling,
  // so the switch usually renders without a visible loading pass.
  const prefetchOrgan = (id: OrganId) => {
    if (id === organId || prefetched.current.has(id)) return;
    prefetched.current.add(id);
    void fetch(organById[id].model, { priority: "low" } as RequestInit).catch(() => {});
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => selectOrgan("heart")} aria-label={t.brand.home}>
          <strong>Anatomy Atelier<sup>✦</sup></strong>
          <em>{t.brand.tagline}</em>
        </button>
        <nav className="main-nav" aria-label="Primary navigation">
          <button
            className={panel === null ? "active" : ""}
            onClick={() => { setPanel(null); setModal(null); }}
            aria-pressed={panel === null}
          >
            <Compass size={17} /> {t.nav.explore}
          </button>
          <button
            className={panel === "systems" ? "active" : ""}
            onClick={() => setPanel(panel === "systems" ? null : "systems")}
            aria-pressed={panel === "systems"}
          >
            <BrainCircuit size={17} /> {t.nav.systems}
          </button>
          <button onClick={() => setModal("lesson")}><BookOpen size={17} /> {t.nav.lessons}</button>
          <button
            className={panel === "saved" ? "active" : ""}
            onClick={() => setPanel(panel === "saved" ? null : "saved")}
            aria-pressed={panel === "saved"}
          >
            <LibraryBig size={17} /> {t.nav.library}
          </button>
          {/* The daily habit lives in the primary nav, so on phones it's a tab
              in the bottom bar — one thumb away, not buried in a panel. */}
          <button
            className={`daily-tab ${dailyOpen ? "active" : ""}`}
            onClick={() => setDailyOpen(true)}
            aria-pressed={dailyOpen}
          >
            <Flame size={17} /> {t.app.daily.tab}
            {dailyStreak > 0 && <span className="daily-badge">{dailyStreak}</span>}
            {dailyWaiting && <span className="daily-dot"><span className="sr-only">{t.app.daily.newQuestion}</span></span>}
          </button>
        </nav>
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search.placeholder} />
        </label>
        <LanguageSwitcher locale={locale} t={t} />
        {/* Where a learner profile would sit. There are no accounts, so this
            slot belongs to the parent: safety note, privacy, clinical content. */}
        <button
          type="button"
          className={`grownups-button ${panel === "grownups" ? "active" : ""}`}
          onClick={() => setPanel(panel === "grownups" ? null : "grownups")}
          aria-pressed={panel === "grownups"}
          aria-label={t.app.kids.grownupsTitle}
        >
          <Users size={16} aria-hidden /> <span>{t.app.kids.grownups}</span>
        </button>
        <button className="mobile-library-trigger" onClick={() => setMobileLibrary(true)} aria-label={t.library.open}><LibraryBig size={20} /></button>
      </header>

      <div className="workspace">
        <aside className={`organ-library ${mobileLibrary ? "open" : ""}`}>
          <div className="panel-heading">
            <span>{t.library.title}</span>
            <button aria-label={t.library.close} className="mobile-close" onClick={() => setMobileLibrary(false)}><X size={17} /></button>
            <button
              aria-label={saved.includes(organId) ? t.app.saved.remove : t.app.saved.add}
              aria-pressed={saved.includes(organId)}
              className={saved.includes(organId) ? "saved-on" : ""}
              onClick={() => onToggleSaved(organId)}
            >
              <Bookmark size={17} fill={saved.includes(organId) ? "currentColor" : "none"} />
            </button>
          </div>
          {reviewDue > 0 && results === null && (
            <button
              type="button"
              className="review-cta"
              onClick={startReview}
            >
              <span className="review-count">{reviewDue}</span>
              <span>
                <b>{t.app.kids.practice}</b>
                <small>{format(t.app.kids.practiceCount, { count: String(reviewDue) })}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          )}
          <button type="button" className="library-mastery sticker-button" onClick={() => setStickersOpen(true)}>
            <span className="sticker-button-row">
              <Star size={15} fill="currentColor" aria-hidden />
              <b>{t.app.stickers.button}</b>
              <small>{format(t.app.stickers.count, { count: String(stickersFound), total: String(stickersTotal) })}</small>
            </span>
            <span className="mastery-track" aria-hidden>
              <span className="mastery-fill" style={{ width: `${stickersTotal ? Math.round((stickersFound / stickersTotal) * 100) : 0}%` }} />
            </span>
          </button>
          <div className="organ-list">
            {results !== null && results.length === 0 && (
              <p className="organ-empty">
                {format(t.app.search.empty, { query })}
                <button type="button" onClick={() => setQuery("")}>{t.app.search.clear}</button>
              </p>
            )}
            {results?.map((result) => (
              <button
                type="button"
                key={result.kind === "organ" ? result.organId : `${result.organId}:${result.hotspotId}`}
                className={`organ-item ${result.kind === "structure" ? "is-structure" : ""} ${organId === result.organId && result.kind === "organ" ? "active" : ""}`}
                onClick={() => {
                  selectOrgan(result.organId);
                  // A structure hit selects that structure once the organ is up,
                  // so searching "mitral" lands on the valve, not just the heart.
                  if (result.kind === "structure") setPendingStructure(result.hotspotId);
                }}
                onPointerEnter={() => prefetchOrgan(result.organId)}
                onFocus={() => prefetchOrgan(result.organId)}
                style={{ "--item-accent": organById[result.organId].accent } as React.CSSProperties}
              >
                <span className="organ-glyph">
                  <OrganArt organ={organById[result.organId]} asset="thumb" alt="" size={47} />
                </span>
                <span><b>{result.label}</b><small>{result.sub}</small></span>
                {result.kind === "structure" && <Crosshair className="result-kind" size={13} />}
              </button>
            ))}
            {filteredOrgans.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`organ-item ${organId === item.id ? "active" : ""}`}
                onClick={() => selectOrgan(item.id)}
                onPointerEnter={() => prefetchOrgan(item.id)}
                onFocus={() => prefetchOrgan(item.id)}
                style={{ "--item-accent": item.accent } as React.CSSProperties}
              >
                <span className="organ-glyph">
                  <OrganArt organ={item} asset="thumb" alt="" size={47} />
                </span>
                <span><b>{item.name}</b><small>{item.system}</small></span>
                {saved.includes(item.id) && <Bookmark className="saved-flag" size={13} fill="currentColor" />}
                {organId === item.id && <Heart className="favorite" size={14} fill="currentColor" />}
              </button>
            ))}
          </div>
          <button className="view-all" onClick={() => setQuery("")}>{t.library.viewAll} <ArrowRight size={14} /></button>
          <blockquote>
            <Sparkles size={18} />
            <p>{t.library.quoteLine1}<br />{t.library.quoteLine2}</p>
            <em>{t.library.quoteSign}</em>
          </blockquote>
        </aside>

        <OrganViewer
          organ={organ}
          t={t}
          autoRotate={autoRotate}
          onAutoRotate={setAutoRotate}
          compare={compare}
          onCompare={() => setCompare(!compare)}
          quizActive={quizActive}
          onQuizExit={() => setQuizActive(false)}
          pendingStructure={pendingStructure}
          onStructureShown={() => setPendingStructure(null)}
          heartbeatBpm={heartbeatBpm}
        />

        <aside className="info-panel" ref={contentRef}>
          <div className="info-kicker" data-reveal><Heart size={13} fill="currentColor" /> {format(t.info.kicker, { organ: organ.name })}</div>
          <div className="info-title-row" data-reveal>
            <div><h1>{organ.name}</h1><em>{organ.poetic}</em></div>
            <span className="specimen-stamp">
              <OrganArt organ={organ} asset="organ" alt="" size={92} />
            </span>
          </div>
          <p className="description" data-reveal>
            <SpeakButton id={`${organ.id}:description`} text={organ.description} lang={locale.code} labels={t.app.speech} />
            <Speakable id={`${organ.id}:description`} text={organ.description} />
          </p>
          <div className="rule" />
          <h2 data-reveal>{t.info.keyFacts}</h2>
          <dl className="key-facts">
            <div data-reveal><dt><span>◇</span> {t.info.size}</dt><dd><Measure>{organ.size}</Measure></dd></div>
            <div data-reveal><dt><span>♙</span> {t.info.weight}</dt><dd><Measure>{organ.weight}</Measure></dd></div>
            <div data-reveal><dt><span>⌁</span> {t.info.daily}</dt><dd><Measure>{organ.dailyFact}</Measure></dd></div>
            <div data-reveal><dt><span>⌖</span> {t.info.location}</dt><dd><Measure>{organ.location}</Measure></dd></div>
            <div data-reveal><dt><span>◈</span> {t.info.function}</dt><dd><Measure>{organ.function}</Measure></dd></div>
          </dl>
          <div className="medical-note" data-reveal>
            <Lightbulb size={16} />
            <p><b>{t.app.kids.howItWorks}</b><Speakable id={`${organ.id}:medical`} text={organ.medical} /></p>
            <SpeakButton id={`${organ.id}:medical`} text={organ.medical} lang={locale.code} labels={t.app.speech} />
          </div>
          <div className="fun-note" data-reveal>
            <Sparkles size={15} />
            <p><b>{t.info.didYouKnow}</b><Speakable id={`${organ.id}:funFact`} text={organ.funFact} /></p>
            <SpeakButton id={`${organ.id}:funFact`} text={organ.funFact} lang={locale.code} labels={t.app.speech} />
          </div>
          <button className="lesson-button" data-reveal onClick={() => setModal("lesson")}>{t.info.viewLesson} <ArrowRight size={16} /></button>
          <button className="ar-button" data-reveal onClick={() => setArOpen(true)}>
            <Box size={17} aria-hidden /> {t.app.ar.button}
          </button>
          {organ.id === "heart" && (
            heartbeatBpm ? (
              <div className="hb-pill" data-reveal role="status">
                <span className="hb-beat" style={{ animationDuration: `${60 / heartbeatBpm}s` }} aria-hidden>♥</span>
                <span>{format(t.app.heartbeat.beating, { bpm: String(heartbeatBpm) })}</span>
                <button type="button" onClick={() => setHeartbeatBpm(null)}>{t.app.heartbeat.stop}</button>
              </div>
            ) : (
              <button className="hb-button" data-reveal onClick={() => setHeartbeatOpen(true)}>
                <HeartPulse size={17} aria-hidden /> {t.app.heartbeat.button}
              </button>
            )
          )}
          <div className="action-grid" data-reveal>
            <button onClick={() => setModal("animation")}><Play size={15} /> {t.info.animate}</button>
            <button onClick={() => { setQuizActive(true); setModal(null); }}><CircleHelp size={15} /> {t.info.quiz}</button>
            <button onClick={() => setCompare(!compare)} className={compare ? "active" : ""}><Share2 size={15} /> {t.info.compare}</button>
            <button
              onClick={() => onToggleSaved(organId)}
              className={saved.includes(organId) ? "active" : ""}
              aria-pressed={saved.includes(organId)}
            >
              <Bookmark size={15} fill={saved.includes(organId) ? "currentColor" : "none"} />
              {saved.includes(organId) ? t.app.saved.remove : t.app.saved.add}
            </button>
          </div>
        </aside>
      </div>

      {compare && (
        <section className="compare-strip" aria-label={t.compare.title}>
          <div className="compare-organ"><OrganArt organ={organ} asset="thumb" alt="" /><span>{t.compare.comparing}</span><strong>{organ.name}</strong><small>{organ.system}</small></div>
          <b>{t.compare.vs}</b>
          <div className="compare-organ"><OrganArt organ={reference} asset="thumb" alt="" /><span>{t.compare.reference}</span><strong>{reference.name}</strong><small>{reference.system}</small></div>
          <dl><div><dt>{t.compare.primaryRole}</dt><dd><Measure>{organ.function}</Measure></dd></div><div><dt>{t.compare.scale}</dt><dd><Measure>{organ.size}</Measure></dd></div></dl>
          <button onClick={() => setCompare(false)} aria-label={t.compare.close}><X size={16} /></button>
        </section>
      )}

      <section className="learning-cards" aria-label={format(t.cards.resources, { organ: organ.name })}>
        <article className="curiosity-card">
          <span>✿</span><p>{t.library.quoteLine1}<br />{t.library.quoteLine2}</p><em>{t.library.quoteSign}</em>
        </article>
        <article className="tissue-card">
          <header><div><em>{t.cards.microscopic}</em><h3>{organ.tissue}</h3></div><Microscope size={17} /></header>
          <div className="microscope-visual organ-card-image"><OrganArt organ={organ} asset="microscopic" alt="" /></div>
          <button onClick={() => setModal("lesson")}>{t.cards.exploreTissue} <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>{t.cards.compareOrgans}</em><h3>{organ.comparison}</h3></div><Share2 size={17} /></header>
          <div className="comparison-visual organ-card-image"><OrganArt organ={organ} asset="compare" alt="" /></div>
          <button onClick={() => setCompare(true)}>{t.cards.openComparison} <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>{t.cards.functionAnimation}</em><h3>{organ.function}</h3></div><Play size={17} /></header>
          {/* The artwork itself is the control, so the play badge inside it is
              decorative rather than a nested button. */}
          <button
            type="button"
            className="function-visual organ-card-image"
            onClick={() => setModal("animation")}
            aria-label={format(t.cards.playAria, { organ: organ.name })}
          >
            <OrganArt organ={organ} asset="organ" alt="" />
            <i className="function-pulse" />
            <span className="play-badge"><Play size={18} fill="currentColor" /></span>
          </button>
          <button onClick={() => setModal("animation")}>{t.cards.playAnimation} <ArrowRight size={14} /></button>
        </article>
        {/* Condition lists ("brain aneurysm", "heart failure") frighten
            children, so they live in the grown-ups panel. This slot carries
            the facts kids actually repeat at the dinner table. */}
        <article className="facts-card">
          <header><div><em>{t.info.didYouKnow}</em><h3>{t.app.kids.amazingFacts}</h3></div><Star size={17} /></header>
          <ul>
            <li><Measure>{organ.funFact}</Measure></li>
            <li><Measure>{organ.dailyFact}</Measure></li>
            <li><Measure>{organ.size}</Measure></li>
          </ul>
          <button onClick={() => setModal("lesson")}>{t.info.viewLesson} <ArrowRight size={14} /></button>
        </article>
        <article className="system-card">
          <header><div><em>{t.cards.whereItWorks}</em><h3>{organ.system}</h3></div><BrainCircuit size={17} /></header>
          <button
            type="button"
            className="system-visual organ-card-image"
            onClick={() => setModal("system")}
            aria-label={format(t.cards.systemAria, { organ: organ.name })}
          >
            <OrganArt organ={organ} asset="location" alt="" />
          </button>
          <button onClick={() => setModal("system")}>{t.cards.seeSystem} <ArrowRight size={14} /></button>
        </article>
        <article className="related-card">
          <header><div><em>{t.app.related.title}</em><h3>{t.app.systems.names[organ.systemId]}</h3></div><Compass size={17} /></header>
          <ul className="related-list">
            {organ.relatedOrganIds.map((id) => (
              <li key={id}>
                <button type="button" onClick={() => selectOrgan(id)}>
                  <span className="organ-glyph"><OrganArt organ={organById[id]} asset="thumb" alt="" size={34} /></span>
                  <span><b>{organById[id].name}</b><small>{organById[id].system}</small></span>
                  <ArrowRight size={14} />
                </button>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {panel && (
        <SidePanel
          panel={panel}
          organs={organs}
          organById={organById}
          organId={organId}
          t={t}
          saved={saved}
          notes={notes}
          onSelect={selectOrgan}
          onToggleSaved={onToggleSaved}
          onNoteChange={onNoteChange}
          onOpenNotes={() => setPanel("notes")}
          onClose={() => setPanel(null)}
        />
      )}
      {dailyOpen && (
        <DailySheet
          lang={locale.code}
          organs={organs}
          organById={organById}
          t={t}
          onClose={() => setDailyOpen(false)}
          onSee={(id, hotspotId) => {
            selectOrgan(id);
            if (hotspotId) setPendingStructure(hotspotId);
          }}
        />
      )}
      {stickersOpen && (
        <StickerBook
          organs={organs}
          t={t}
          onClose={() => setStickersOpen(false)}
          onSee={(id, hotspotId) => {
            selectOrgan(id);
            setPendingStructure(hotspotId);
          }}
        />
      )}
      <StickerToast organById={organById} t={t} />
      {heartbeatOpen && (
        <HeartbeatSheet
          t={t}
          onClose={() => setHeartbeatOpen(false)}
          onWatch={(bpm) => {
            setHeartbeatBpm(bpm);
            setHeartbeatOpen(false);
          }}
        />
      )}
      {arOpen && <ArSheet key={organ.id} organ={organ} t={t} localeCode={locale.code} onClose={() => setArOpen(false)} />}
      {modal && <LearningModal type={modal} organ={organ} t={t} lang={locale.code} onClose={() => setModal(null)} />}
      {mobileLibrary && <button className="drawer-backdrop" aria-label={t.library.close} onClick={() => setMobileLibrary(false)} />}
    </main>
  );
}

const MODAL_ICON: Record<Exclude<Modal, null>, string> = {
  animation: "▶",
  system: "⌖",
  lesson: "✦",
};

function LearningModal({
  type,
  organ,
  t,
  lang,
  onClose,
}: {
  type: Exclude<Modal, null>;
  organ: Organ;
  t: UiDictionary;
  lang: string;
  onClose: () => void;
}) {
  const vars = { organ: organ.name, location: organ.location };
  const title =
    type === "animation" ? format(t.modal.motionTitle, vars)
    // Avoids gluing onto `system`, whose wording varies per organ, and stays
    // grammatical for the plural organs too.
    : type === "system" ? format(t.modal.bodyTitle, vars)
    : format(t.modal.insideTitle, vars);

  const dialogRef = useModalA11y<HTMLElement>(onClose);

  // The lesson is a real multi-step flow rather than a single panel, so it
  // gets its own component.
  if (type === "lesson") return <LessonFlow organ={organ} t={t} lang={lang} onClose={onClose} />;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className={`learning-modal ${type === "system" ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label={t.modal.close}><X size={18} /></button>
        <span className="modal-icon">{MODAL_ICON[type]}</span>
        <em>{t.modal.guided}</em>
        <h2 id="modal-title">{title}</h2>
        {type === "system" ? (
          <>
            <p>{format(t.modal.systemIntro, vars)}</p>
            {/* Shown whole rather than cropped into the circular demo — the
                point of this view is the figure and its vessels. */}
            <figure className="modal-figure">
              <OrganArt organ={organ} asset="location" alt="" />
            </figure>
            <dl className="modal-facts">
              <div><dt>{t.modal.system}</dt><dd>{organ.system}</dd></div>
              <div><dt>{t.modal.primaryRole}</dt><dd><Measure>{organ.function}</Measure></dd></div>
              <div><dt>{t.modal.bloodSupply}</dt><dd><Measure>{organ.bloodSupply}</Measure></dd></div>
            </dl>
            <button className="lesson-button" onClick={onClose}>{t.modal.continueExploring} <ArrowRight size={16} /></button>
          </>
        ) : (
          <>
            <p>{t.modal.lessonBody}</p>
            <div className={`modal-demo ${type === "animation" ? "moving" : ""}`}><OrganArt organ={organ} asset="organ" alt="" /></div>
            <button className="lesson-button" onClick={onClose}>{t.modal.continueExploring} <ArrowRight size={16} /></button>
          </>
        )}
      </section>
    </div>
  );
}


/**
 * The guided lesson: a real, ordered walkthrough of one organ rather than a
 * single paragraph behind a "Continue exploring" button. Each step is its own
 * screen with its own content, and the last one credits the sources the
 * medical copy is based on.
 */
function LessonFlow({ organ, t, lang, onClose }: { organ: Organ; t: UiDictionary; lang: string; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const dialogRef = useModalA11y<HTMLElement>(onClose);

  const steps = [
    {
      title: t.app.lesson.overview,
      body: (
        <>
          <p>
            <SpeakButton id={`lesson:${organ.id}:description`} text={organ.description} lang={lang} labels={t.app.speech} />
            <Speakable id={`lesson:${organ.id}:description`} text={organ.description} />
          </p>
          <div className="modal-demo"><OrganArt organ={organ} asset="organ" alt="" /></div>
          <dl className="modal-facts">
            <div><dt>{t.modal.system}</dt><dd>{organ.system}</dd></div>
            <div><dt>{t.info.size}</dt><dd><Measure>{organ.size}</Measure></dd></div>
            <div><dt>{t.info.weight}</dt><dd><Measure>{organ.weight}</Measure></dd></div>
          </dl>
        </>
      ),
    },
    {
      title: t.app.lesson.structures,
      body: (
        <>
          <p>{t.modal.lessonBody}</p>
          <ul className="lesson-structures">
            {organ.hotspots.map((hotspot) => (
              <li key={hotspot.id}>
                <span className="lesson-dot" style={{ background: hotspot.color }} aria-hidden />
                <b>{hotspot.label}</b>
                <small>{hotspot.detail}</small>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    // Kid mode ends on wonder rather than on disease and citations; the
    // conditions and sources are still one tap away in the grown-ups panel.
    {
      title: t.app.kids.amazingFacts,
      body: (
        <>
          <p>
            <SpeakButton id={`lesson:${organ.id}:medical`} text={organ.medical} lang={lang} labels={t.app.speech} />
            <b className="lesson-lead">{t.app.kids.howItWorks}</b>
            <Speakable id={`lesson:${organ.id}:medical`} text={organ.medical} />
          </p>
          <ul className="lesson-conditions lesson-facts">
            <li><Measure>{organ.funFact}</Measure></li>
            <li><Measure>{organ.dailyFact}</Measure></li>
          </ul>
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="learning-modal lesson-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label={t.modal.close}><X size={18} /></button>
        <em>{t.modal.guided}</em>
        <h2 id="lesson-title">{format(t.modal.insideTitle, { organ: organ.name })}</h2>

        <div className="lesson-progress" role="status" aria-live="polite">
          <span>{format(t.app.lesson.step, { current: String(step + 1), total: String(steps.length) })}</span>
          <ol aria-hidden>
            {steps.map((entry, index) => <li key={entry.title} className={index <= step ? "on" : ""} />)}
          </ol>
        </div>

        <h3 className="lesson-step-title">{current.title}</h3>
        <div className="lesson-body">{current.body}</div>

        <div className="lesson-actions">
          <button type="button" onClick={() => setStep((value) => value - 1)} disabled={step === 0}>
            {t.app.lesson.back}
          </button>
          {isLast ? (
            <button type="button" className="lesson-button" onClick={onClose}>{t.app.lesson.finish}</button>
          ) : (
            <button type="button" className="lesson-button" onClick={() => setStep((value) => value + 1)}>
              {t.app.lesson.next} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/** Slide-over for Systems / Saved / Notes / Grown-ups. */
function SidePanel({
  panel, organs, organById, organId, t, saved, notes,
  onSelect, onToggleSaved, onNoteChange, onOpenNotes, onClose,
}: {
  panel: Exclude<Panel, null>;
  organs: Organ[];
  organById: Record<OrganId, Organ>;
  organId: OrganId;
  t: UiDictionary;
  saved: OrganId[];
  notes: Record<string, string>;
  onSelect: (id: OrganId) => void;
  onToggleSaved: (id: OrganId) => void;
  onNoteChange: (id: OrganId, text: string) => void;
  onOpenNotes: () => void;
  onClose: () => void;
}) {
  const dialogRef = useModalA11y<HTMLElement>(onClose);
  const title =
    panel === "systems" ? t.app.systems.title
    : panel === "saved" ? t.app.saved.title
    : panel === "grownups" ? t.app.kids.grownupsTitle
    : t.app.notes.title;
  const current = organById[organId];
  const noted = organs.filter((organ) => (notes[organ.id] ?? "").trim().length > 0);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        ref={dialogRef}
        tabIndex={-1}
        className="side-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="panel-title">{title}</h2>
          <button onClick={onClose} aria-label={t.modal.close}><X size={18} /></button>
        </header>

        {panel === "systems" && (
          <div className="system-groups">
            {systemIds.map((systemId: SystemId) => {
              const ids = organIdsBySystem[systemId];
              if (!ids.length) return null;
              return (
                <section key={systemId}>
                  <h3>{t.app.systems.names[systemId]}</h3>
                  <ul>
                    {ids.map((id) => (
                      <li key={id}>
                        <button type="button" onClick={() => onSelect(id)} className={id === organId ? "active" : ""}>
                          <span className="organ-glyph"><OrganArt organ={organById[id]} asset="thumb" alt="" size={34} /></span>
                          <span><b>{organById[id].name}</b><small>{organById[id].poetic}</small></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {panel === "saved" && (
          saved.length === 0 ? (
            <p className="panel-empty">{t.app.saved.empty}</p>
          ) : (
            <ul className="panel-list">
              {saved.map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => onSelect(id)}>
                    <span className="organ-glyph"><OrganArt organ={organById[id]} asset="thumb" alt="" size={34} /></span>
                    <span><b>{organById[id].name}</b><small>{organById[id].system}</small></span>
                  </button>
                  <button type="button" className="panel-remove" onClick={() => onToggleSaved(id)} aria-label={t.app.saved.remove}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {panel === "grownups" && (
          <div className="grownups-panel">
            <p>{t.app.kids.grownupsIntro}</p>
            <p className="grownups-privacy">{t.app.kids.privacy}</p>

            <section>
              <h3>{format(t.app.kids.conditionsTitle, { organ: current.name })}</h3>
              <p>{t.app.kids.conditionsIntro}</p>
              <ul className="lesson-conditions">
                {current.conditions.map((condition) => <li key={condition}>{condition}</li>)}
              </ul>
            </section>

            <section>
              <h3>{t.app.lesson.sources}</h3>
              <p>{t.app.lesson.sourcesIntro}</p>
              <ul className="lesson-sources">
                {current.references.map((reference) => (
                  <li key={reference.url}>
                    <a href={reference.url} target="_blank" rel="noreferrer noopener">{reference.label}</a>
                  </li>
                ))}
              </ul>
            </section>

            <button type="button" className="grownups-notes" onClick={onOpenNotes}>
              <NotebookPen size={15} aria-hidden /> {t.app.notes.title} <ArrowRight size={14} aria-hidden />
            </button>
          </div>
        )}

        {panel === "notes" && (
          <div className="notes-panel">
            <label className="notes-current">
              <b>{organById[organId].name}</b>
              <textarea
                value={notes[organId] ?? ""}
                onChange={(event) => onNoteChange(organId, event.target.value)}
                placeholder={format(t.app.notes.placeholder, { organ: organById[organId].name })}
                rows={6}
              />
              <small>{t.app.notes.status}</small>
            </label>
            {noted.filter((organ) => organ.id !== organId).length > 0 && (
              <ul className="panel-list">
                {noted.filter((organ) => organ.id !== organId).map((organ) => (
                  <li key={organ.id}>
                    <button type="button" onClick={() => onSelect(organ.id)}>
                      <span><b>{organ.name}</b><small>{(notes[organ.id] ?? "").slice(0, 60)}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
