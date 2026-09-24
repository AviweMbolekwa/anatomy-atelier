"use client";

import { useEffect, useRef, useState } from "react";
import { HeartPulse, X } from "lucide-react";
import { format, type UiDictionary } from "../i18n/types";
import { useModalA11y } from "../lib/use-modal-a11y";
import { PulseMeter, pulseWave, type Sample } from "../lib/heartbeat";

type Phase = "intro" | "measuring" | "result" | "noCamera" | "noPulse";

export function HeartbeatSheet({
  t, onClose, onWatch,
}: {
  t: UiDictionary;
  onClose: () => void;
  onWatch: (bpm: number) => void;
}) {
  const copy = t.app.heartbeat;
  const dialogRef = useModalA11y<HTMLElement>(onClose);
  const videoRef = useRef<HTMLVideoElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>("intro");
  const [fingerOn, setFingerOn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<number | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);

  // The camera (and its light) must never outlive the sheet.
  useEffect(() => () => stopRef.current(), []);

  const start = async () => {
    stopRef.current();
    setBpm(null);
    setLive(null);
    setProgress(0);
    setFingerOn(false);

    if (!navigator.mediaDevices?.getUserMedia) return setPhase("noCamera");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } },
      });
    } catch {
      return setPhase("noCamera");
    }
    const track = stream.getVideoTracks()[0];
    // The flashlight lights the fingertip from behind — far stronger signal.
    // Android Chrome supports it; where it's refused, room light still works.
    // Not awaited: on some devices the request never settles, and nothing
    // below depends on it.
    track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] }).catch(() => {});

    const video = videoRef.current!;
    video.srcObject = stream;
    // Not awaited either: an off-screen video's play() promise can stay
    // pending indefinitely. The frame loop simply waits for readyState.
    video.play().catch(() => {});

    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 30;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;

    // All the measuring logic lives in PulseMeter, which is unit-tested; this
    // component only feeds it frame colours and shows its state.
    const meter = new PulseMeter();
    let lastTick = 0;
    let frame = 0;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((entry) => entry.stop());
      video.srcObject = null;
    };
    stopRef.current = stop;
    setPhase("measuring");

    const drawWave = (samples: Sample[], now: number) => {
      const target = waveRef.current;
      const ctx = target?.getContext("2d");
      if (!target || !ctx) return;
      ctx.clearRect(0, 0, target.width, target.height);
      const wave = pulseWave(samples.filter((sample) => now - sample.t < 5000));
      if (wave.length < 4) return;
      const peak = Math.max(...wave.map(Math.abs)) || 1;
      ctx.beginPath();
      wave.forEach((value, i) => {
        const x = (i / (wave.length - 1)) * target.width;
        // More blood absorbs more light, so each beat shows as a dip.
        const y = target.height / 2 + (value / peak) * (target.height * 0.4);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = "#eb7c6b";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.stroke();
    };

    // Sampled on every repaint, which outpaces the camera; the meter skips
    // repeated frames. (requestVideoFrameCallback would be tidier, but it was
    // seen to stall outright, which would freeze the measurement.)
    const tick = () => {
      if (stopped) return;
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      if (video.readyState < 2) return;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      // The centre of the frame — the edges catch light leaking past the finger.
      const { data } = context.getImageData(10, 7, 20, 16);
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
      const pixels = data.length / 4;
      r /= pixels; g /= pixels; b /= pixels;

      const state = meter.push(now, r, g, b);

      if (state.result !== null) {
        setBpm(state.result);
        setPhase("result");
        stop();
        return;
      }
      if (state.failed) {
        setPhase("noPulse");
        stop();
        return;
      }
      // The UI only needs a few updates a second.
      if (now - lastTick < 250) return;
      lastTick = now;
      drawWave(state.samples, now);
      setFingerOn(state.fingerOn);
      setProgress(state.progress);
      setLive(state.live);
    };
    frame = requestAnimationFrame(tick);
  };

  const stopMeasuring = () => {
    stopRef.current();
    setPhase("intro");
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="learning-modal hb-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hb-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label={t.modal.close}><X size={18} /></button>
        <span className="modal-icon" aria-hidden><HeartPulse size={22} /></span>
        <h2 id="hb-title">{copy.title}</h2>
        {/* Only its average colour is read; it's never shown. */}
        <video ref={videoRef} className="hb-video" muted playsInline aria-hidden />

        {phase === "intro" && (
          <>
            <p>{copy.intro}</p>
            <p className="hb-privacy">{copy.privacy}</p>
            <p className="hb-fun">{copy.fun}</p>
            <button type="button" className="lesson-button" onClick={() => void start()}>{copy.start}</button>
          </>
        )}

        {phase === "measuring" && (
          <>
            <p className="hb-status" role="status" aria-live="polite">
              {!fingerOn ? copy.cover : live ? format(copy.live, { bpm: String(live) }) : copy.hold}
            </p>
            <canvas ref={waveRef} className="hb-wave" width={600} height={120} aria-hidden />
            <div className="mastery-track hb-progress" aria-hidden>
              <div className="mastery-fill" style={{ "--progress": progress } as React.CSSProperties} />
            </div>
            <button type="button" className="hb-secondary" onClick={stopMeasuring}>{copy.stop}</button>
          </>
        )}

        {phase === "result" && bpm && (
          <>
            <p className="hb-result" role="status">
              <span className="hb-beat" style={{ animationDuration: `${60 / bpm}s` }} aria-hidden>♥</span>
              {format(copy.result, { bpm: String(bpm) })}
            </p>
            <p>{copy.challenge}</p>
            <p className="hb-fun">{copy.fun}</p>
            <button type="button" className="lesson-button" onClick={() => onWatch(bpm)}>{copy.watch}</button>
            <button type="button" className="hb-secondary" onClick={() => void start()}>{copy.again}</button>
          </>
        )}

        {(phase === "noCamera" || phase === "noPulse") && (
          <>
            <p role="alert">{phase === "noCamera" ? copy.noCamera : copy.noPulse}</p>
            {phase === "noPulse" && (
              <button type="button" className="lesson-button" onClick={() => void start()}>{copy.again}</button>
            )}
            <button type="button" className="hb-secondary" onClick={onClose}>{t.modal.continueExploring}</button>
          </>
        )}
      </section>
    </div>
  );
}
