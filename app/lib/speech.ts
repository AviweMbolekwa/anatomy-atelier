/**
 * "Read aloud" — the browser's built-in speech synthesis.
 *
 * Free, offline where the voice is on-device, and nothing leaves the device —
 * but it can only use voices the device has. English is everywhere; Afrikaans
 * on some devices; isiXhosa and isiZulu almost nowhere. So the button only
 * appears when there is a real voice for the page's language: reading isiXhosa
 * with an English voice would teach the wrong pronunciation. (Recorded audio
 * by native speakers is the planned way to cover xh/zu.)
 *
 * One utterance plays at a time, app-wide. State lives in this module so any
 * number of read-aloud buttons and highlighted passages stay in step.
 */

export type VoiceLike = { lang: string; name: string; localService?: boolean; default?: boolean };

const normalise = (lang: string) => lang.toLowerCase().replace("_", "-");

/**
 * The best voice for a locale code ("af", "en", …), or null when the device has
 * none. Prefers on-device voices (they work offline and report word positions
 * for highlighting), then South African variants, then the platform default.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], code: string): V | null {
  const target = code.toLowerCase();
  const matches = voices.filter((voice) => {
    const lang = normalise(voice.lang);
    return lang === target || lang.startsWith(`${target}-`);
  });
  if (!matches.length) return null;
  const score = (voice: V) =>
    (voice.localService ? 4 : 0) + (normalise(voice.lang).endsWith("-za") ? 2 : 0) + (voice.default ? 1 : 0);
  return [...matches].sort((a, b) => score(b) - score(a))[0];
}

/** The word to highlight in `text` starting at `charIndex`. Some engines omit
 *  charLength on boundary events, so fall back to the run of non-spaces. */
export function wordAt(text: string, charIndex: number, charLength = 0): [number, number] {
  if (charIndex < 0 || charIndex >= text.length) return [-1, 0];
  const length = charLength > 0 ? charLength : (/^\S+/.exec(text.slice(charIndex))?.[0].length ?? 0);
  return [charIndex, length];
}

// ------------------------------------------------------------- the player

export type SpeechState = {
  /** Which passage is being read, or null. */
  id: string | null;
  /** Offset of the current word in the spoken text; -1 before the first word. */
  charIndex: number;
  charLength: number;
};

const IDLE: SpeechState = { id: null, charIndex: -1, charLength: 0 };
let state: SpeechState = IDLE;
let token = 0;
const listeners = new Set<() => void>();

function set(next: SpeechState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export const speechState = {
  get: () => state,
  getServer: () => IDLE,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Reads `text` aloud as passage `id`, stopping anything already playing. */
export function speak(id: string, text: string, voice: SpeechSynthesisVoice) {
  if (!isSpeechSupported()) return;
  const synth = window.speechSynthesis;
  // Cancelling fires the previous utterance's `end` asynchronously; the token
  // stops that late event from clearing the new passage's state.
  const mine = ++token;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.9; // a touch slower for young listeners
  set({ id, charIndex: -1, charLength: 0 });

  utterance.onboundary = (event) => {
    if (mine !== token || (event.name && event.name !== "word")) return;
    set({ id, charIndex: event.charIndex, charLength: event.charLength ?? 0 });
  };
  const finish = () => {
    if (mine === token) set(IDLE);
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  synth.speak(utterance);
}

export function stopSpeaking() {
  token += 1;
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  if (state.id !== null) set(IDLE);
}
