"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { Box, X } from "lucide-react";
import type { Organ } from "../i18n/merge";
import { format, type UiDictionary } from "../i18n/types";
import { arSizes } from "../lib/anatomy-data";
import { useModalA11y } from "../lib/use-modal-a11y";
import { disposeObject } from "../lib/three/dispose";
import {
  detectArMode, loadArModel, openQuickLook, prepareQuickLook, startWebXr,
  type ArMode, type ArSession,
} from "../lib/three/ar";

type Phase = "preparing" | "ready" | "session" | "unsupported" | "failed";

/**
 * "See it in your room". Everything slow — detecting support, loading the
 * model at real size, generating the iOS USDZ — happens as soon as the sheet
 * opens, so the one button that starts AR can do so inside the tap itself.
 * Both WebXR and Quick Look refuse to start outside a user gesture.
 */
export function ArSheet({
  organ, t, localeCode, onClose,
}: {
  organ: Organ;
  t: UiDictionary;
  localeCode: string;
  onClose: () => void;
}) {
  const copy = t.app.ar;
  const dialogRef = useModalA11y<HTMLElement>(onClose);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const usdzRef = useRef<string | null>(null);
  const sessionRef = useRef<ArSession | null>(null);
  const [mode, setMode] = useState<ArMode>("none");
  const [phase, setPhase] = useState<Phase>("preparing");
  const [placed, setPlaced] = useState(false);

  const size = arSizes[organ.id];
  const vars = { organ: organ.name };
  const sizeLabel = size.enlarged
    ? copy.enlarged
    : format(copy.lifeSize, { size: new Intl.NumberFormat(localeCode).format(size.sizeCm) });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const detected = await detectArMode();
      if (cancelled) return;
      setMode(detected);
      if (detected === "none") return setPhase("unsupported");
      try {
        const model = await loadArModel(organ.model, size.sizeCm);
        if (cancelled) return disposeObject(model);
        modelRef.current = model;
        if (detected === "quicklook") {
          const url = await prepareQuickLook(model, size.enlarged);
          if (cancelled) return URL.revokeObjectURL(url.split("#")[0]);
          usdzRef.current = url;
        }
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("failed");
      }
    })();

    return () => {
      cancelled = true;
      sessionRef.current?.end();
      sessionRef.current = null;
      if (usdzRef.current) URL.revokeObjectURL(usdzRef.current.split("#")[0]);
      usdzRef.current = null;
      if (modelRef.current) disposeObject(modelRef.current);
      modelRef.current = null;
    };
  }, [organ.model, size.sizeCm, size.enlarged]);

  const start = () => {
    if (mode === "quicklook" && usdzRef.current) {
      openQuickLook(usdzRef.current);
      return;
    }
    const model = modelRef.current;
    const overlay = overlayRef.current;
    if (mode !== "webxr" || !model || !overlay) return;
    // The overlay becomes the in-camera UI; it has to be displayable before
    // the session asks for it, which is sooner than a React re-render.
    overlay.hidden = false;
    setPlaced(false);
    startWebXr(model, overlay, {
      onPlaced: () => setPlaced(true),
      onEnd: () => {
        sessionRef.current = null;
        overlay.hidden = true;
        setPhase("ready");
      },
    })
      .then((session) => {
        sessionRef.current = session;
        setPhase("session");
      })
      .catch(() => {
        overlay.hidden = true;
        setPhase("failed");
      });
  };

  const intro = mode === "quicklook" ? copy.introQuickLook : copy.introWebxr;

  return (
    <>
      <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
        <section
          ref={dialogRef}
          tabIndex={-1}
          className="learning-modal ar-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ar-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose} aria-label={t.modal.close}><X size={18} /></button>
          <span className="modal-icon" aria-hidden><Box size={22} /></span>
          <h2 id="ar-title">{format(copy.title, vars)}</h2>

          {phase === "unsupported" && <p>{format(copy.unsupported, vars)}</p>}
          {phase === "failed" && <p role="alert">{format(copy.failed, vars)}</p>}
          {(phase === "preparing" || phase === "ready" || phase === "session") && (
            <>
              <p>{format(intro, vars)}</p>
              <p className="ar-size">{sizeLabel}</p>
              <p className="ar-safety">{copy.safety}</p>
            </>
          )}

          {phase === "preparing" && (
            <p className="ar-status" role="status">{format(copy.preparing, vars)}</p>
          )}
          {phase === "ready" && (
            <button type="button" className="lesson-button" onClick={start}>
              {copy.start} <Box size={16} aria-hidden />
            </button>
          )}
          {(phase === "unsupported" || phase === "failed") && (
            <button type="button" className="lesson-button" onClick={onClose}>
              {t.modal.continueExploring}
            </button>
          )}
        </section>
      </div>

      {/* In-camera UI for WebXR. Kept outside the dialog so the modal's
          backdrop and focus trap don't sit between the child and the camera. */}
      <div ref={overlayRef} className="ar-overlay" hidden>
        <div className="ar-overlay-bar">
          <p role="status" aria-live="polite">{placed ? copy.placed : copy.placeHint}</p>
          <button type="button" onClick={() => sessionRef.current?.end()}>{copy.done}</button>
        </div>
        <small className="ar-overlay-size">{sizeLabel}</small>
      </div>
    </>
  );
}
