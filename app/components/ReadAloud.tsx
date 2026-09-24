"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import { isSpeechSupported, pickVoice, speak, speechState, stopSpeaking, wordAt } from "../lib/speech";

/** The installed voice list changes asynchronously (and `getVoices()` returns a
 *  fresh array each call), so subscribe to a stable string key of it. */
function voiceKey() {
  return isSpeechSupported()
    ? window.speechSynthesis.getVoices().map((voice) => `${voice.lang}|${voice.name}`).join(",")
    : "";
}
function subscribeVoices(listener: () => void) {
  if (!isSpeechSupported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", listener);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", listener);
}

/** The device's voice for this locale, or null if it has none. */
export function useVoice(code: string): SpeechSynthesisVoice | null {
  const key = useSyncExternalStore(subscribeVoices, voiceKey, () => "");
  return useMemo(
    () => (key && isSpeechSupported() ? pickVoice(window.speechSynthesis.getVoices(), code) : null),
    [key, code],
  );
}

export function useSpeechState() {
  return useSyncExternalStore(speechState.subscribe, speechState.get, speechState.getServer);
}

/**
 * Text that highlights the word being spoken. `offset` places this piece
 * inside a longer utterance (e.g. a question read together with its options).
 */
export function Speakable({ id, text, offset = 0 }: { id: string; text: string; offset?: number }) {
  const state = useSpeechState();
  if (state.id !== id) return <>{text}</>;
  const [start, length] = wordAt(text, state.charIndex - offset, state.charLength);
  if (start < 0 || !length) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark className="speak-word">{text.slice(start, start + length)}</mark>
      {text.slice(start + length)}
    </>
  );
}

/**
 * The 🔊 button. Renders nothing when the device has no voice for `lang`, so a
 * child is never read their language in the wrong accent.
 */
export function SpeakButton({
  id, text, lang, labels,
}: {
  id: string;
  text: string;
  lang: string;
  labels: { read: string; stop: string };
}) {
  const voice = useVoice(lang);
  const state = useSpeechState();
  const active = state.id === id;

  // A passage that leaves the screen (organ switched, sheet closed) stops.
  useEffect(() => () => {
    if (speechState.get().id === id) stopSpeaking();
  }, [id]);

  if (!voice) return null;
  return (
    <button
      type="button"
      className={`speak-button ${active ? "is-active" : ""}`}
      onClick={() => (active ? stopSpeaking() : speak(id, text, voice))}
      aria-label={active ? labels.stop : labels.read}
      aria-pressed={active}
      title={active ? labels.stop : labels.read}
    >
      {active ? <Square size={14} fill="currentColor" aria-hidden /> : <Volume2 size={17} aria-hidden />}
    </button>
  );
}
