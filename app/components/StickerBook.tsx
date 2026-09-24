"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Star, X } from "lucide-react";
import type { Organ } from "../i18n/merge";
import type { OrganId } from "../lib/anatomy-data";
import { format, type UiDictionary } from "../i18n/types";
import { useModalA11y } from "../lib/use-modal-a11y";
import { withBase } from "../lib/base-path";
import { store } from "../lib/storage";
import {
  STICKER_EVENT_KEY, allStructureKeys, getStickers, structureKey,
  type StickerEvent, type StickerRecord,
} from "../lib/progress";

/** Sticker state keyed by structure, re-read whenever the store changes.
 *  Subscribes to the raw string so the snapshot is stable for React. */
function useStickers(): Record<string, StickerRecord> {
  const raw = useSyncExternalStore(store.subscribe, () => store.getRaw("stickers"), () => null);
  // `raw` is the change signal; getStickers() does the parsing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getStickers(), [raw]);
}

function Sticker({
  organ, hotspotId, label, color, record, t, onSee,
}: {
  organ: Organ;
  hotspotId: string;
  label: string;
  color: string;
  record: StickerRecord | undefined;
  t: UiDictionary;
  onSee: (organId: OrganId, hotspotId: string) => void;
}) {
  const state = record?.gold ? "gold" : record ? "found" : "locked";
  const status = state === "gold" ? t.app.stickers.newGold : state === "found" ? "" : t.app.stickers.locked;
  return (
    <li>
      <button
        type="button"
        className={`sticker is-${state}`}
        style={{ "--sticker-color": color } as React.CSSProperties}
        onClick={() => onSee(organ.id, hotspotId)}
        aria-label={status ? `${label} — ${status}` : label}
      >
        <span className="sticker-face" aria-hidden>
          <img src={withBase(`/anatomy/${organ.id}/thumb.webp`)} alt="" width={64} height={64} loading="lazy" />
          {state === "gold" && <span className="sticker-star"><Star size={12} fill="currentColor" /></span>}
        </span>
        <span className="sticker-label">{label}</span>
      </button>
    </li>
  );
}

export function StickerBook({
  organs, t, onClose, onSee,
}: {
  organs: Organ[];
  t: UiDictionary;
  onClose: () => void;
  onSee: (organId: OrganId, hotspotId: string) => void;
}) {
  const copy = t.app.stickers;
  const dialogRef = useModalA11y<HTMLElement>(onClose);
  const stickers = useStickers();
  const total = allStructureKeys().length;
  const found = allStructureKeys().filter((key) => stickers[key]).length;
  const gold = allStructureKeys().filter((key) => stickers[key]?.gold).length;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        ref={dialogRef}
        tabIndex={-1}
        className="side-panel sticker-book"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sticker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="sticker-title">{copy.title}</h2>
          <button onClick={onClose} aria-label={t.modal.close}><X size={18} /></button>
        </header>

        <div className="sticker-summary">
          <strong>{format(copy.count, { count: String(found), total: String(total) })}</strong>
          {gold > 0 && <span className="sticker-gold-count"><Star size={13} fill="currentColor" aria-hidden /> {format(copy.gold, { count: String(gold) })}</span>}
          <div className="mastery-track" aria-hidden>
            <div className="mastery-fill" style={{ "--progress": total ? found / total : 0 } as React.CSSProperties} />
          </div>
          <p>{copy.howTo}</p>
          <p className="sticker-hint">{copy.tapHint}</p>
        </div>

        {organs.map((organ) => {
          const parts = organ.hotspots.filter((hotspot) => allStructureKeys().includes(structureKey(organ.id, hotspot.id)));
          const have = parts.filter((hotspot) => stickers[structureKey(organ.id, hotspot.id)]).length;
          const complete = have === parts.length && parts.length > 0;
          return (
            <section key={organ.id} className={`sticker-organ ${complete ? "is-complete" : ""}`}>
              <h3>
                <span>{organ.name}</span>
                <small>{have}/{parts.length}</small>
                {complete && <Star size={14} fill="currentColor" aria-hidden className="sticker-organ-star" />}
              </h3>
              <ul>
                {parts.map((hotspot) => (
                  <Sticker
                    key={hotspot.id}
                    organ={organ}
                    hotspotId={hotspot.id}
                    label={hotspot.label}
                    color={hotspot.color}
                    record={stickers[structureKey(organ.id, hotspot.id)]}
                    t={t}
                    onSee={onSee}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </aside>
    </div>
  );
}

/**
 * Celebrates each new sticker wherever it was earned — the 3D quiz or the
 * question of the day. Watches the "latest award" key rather than being wired
 * into each quiz, so no answer path can forget to celebrate.
 */
export function StickerToast({ organById, t }: { organById: Record<OrganId, Organ>; t: UiDictionary }) {
  const raw = useSyncExternalStore(store.subscribe, () => store.getRaw(STICKER_EVENT_KEY), () => null);
  const seen = useRef<string | null | undefined>(undefined);
  const [event, setEvent] = useState<StickerEvent | null>(null);

  useEffect(() => {
    // The first value is history (already celebrated, or from before this
    // visit); only a change during the visit is news.
    if (seen.current === undefined) {
      seen.current = raw;
      return;
    }
    if (raw === seen.current || !raw) return;
    seen.current = raw;
    try {
      // Reacting to a store change is exactly what this effect is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvent(JSON.parse(raw) as StickerEvent);
    } catch {
      return;
    }
    const timer = window.setTimeout(() => setEvent(null), 3800);
    return () => window.clearTimeout(timer);
  }, [raw]);

  if (!event) return null;
  const organ = organById[event.organId];
  if (!organ) return null;
  const hotspotId = event.key.slice(event.key.indexOf(":") + 1);
  const hotspot = organ.hotspots.find((entry) => entry.id === hotspotId);
  const copy = t.app.stickers;
  const heading = event.kind === "organ" ? format(copy.organDone, { organ: organ.name })
    : event.kind === "gold" ? copy.newGold
    : copy.newSticker;

  return (
    <div className={`sticker-toast is-${event.kind}`} role="status" aria-live="polite">
      <span
        className={`sticker-face ${event.kind === "gold" ? "is-gold" : ""}`}
        style={{ "--sticker-color": hotspot?.color ?? organ.accent } as React.CSSProperties}
        aria-hidden
      >
        <img src={withBase(`/anatomy/${organ.id}/thumb.webp`)} alt="" width={44} height={44} />
      </span>
      <span>
        <b>{heading}</b>
        {event.kind !== "organ" && hotspot && <small>{hotspot.label}</small>}
      </span>
    </div>
  );
}
