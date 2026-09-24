import assert from "node:assert/strict";
import test from "node:test";
import { pickVoice, speak, speechState, stopSpeaking, wordAt } from "../app/lib/speech.ts";

const v = (lang, name, extra = {}) => ({ lang, name, ...extra });

test("no voice for the language means no read-aloud — never a wrong-accent stand-in", () => {
  const voices = [v("en-US", "Samantha", { localService: true }), v("en-ZA", "Tessa")];
  assert.equal(pickVoice(voices, "xh"), null);
  assert.equal(pickVoice(voices, "zu"), null);
});

test("matches a voice by language, however the platform spells the tag", () => {
  assert.equal(pickVoice([v("af_ZA", "Afrikaans")], "af")?.name, "Afrikaans");
  assert.equal(pickVoice([v("AF-za", "Afrikaans")], "af")?.name, "Afrikaans");
  assert.equal(pickVoice([v("af", "Afrikaans")], "af")?.name, "Afrikaans");
  assert.equal(pickVoice([v("afr-XX", "Not Afrikaans")], "af"), null, "a prefix of another tag is not a match");
});

test("prefers on-device voices, then South African ones", () => {
  const voices = [v("en-US", "Cloud US"), v("en-ZA", "Cloud ZA"), v("en-GB", "Local GB", { localService: true })];
  assert.equal(pickVoice(voices, "en").name, "Local GB", "offline voices report word positions for highlighting");
  assert.equal(pickVoice(voices.slice(0, 2), "en").name, "Cloud ZA");
});

test("wordAt finds the spoken word, with or without the engine's charLength", () => {
  const text = "A strong muscle that pumps blood";
  assert.deepEqual(wordAt(text, 2, 6), [2, 6]);
  assert.deepEqual(wordAt(text, 9), [9, 6], "falls back to the run of non-spaces");
  assert.deepEqual(wordAt(text, -1), [-1, 0]);
  assert.deepEqual(wordAt(text, 99), [-1, 0]);
});

/** A fake browser speech engine that records utterances and lets the test fire events. */
function installFakeSpeech() {
  const spoken = [];
  globalThis.window = globalThis;
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; spoken.push(this); } };
  globalThis.speechSynthesis = { cancel() {}, speak() {} };
  return spoken;
}

test("one passage at a time; a late 'end' from the previous one can't clear the new one", () => {
  const spoken = installFakeSpeech();
  const voice = v("en-US", "Samantha");
  speak("heart:description", "A strong muscle", voice);
  const first = spoken.at(-1);
  speak("heart:funFact", "It beats roughly 2.5 billion times", voice);
  const second = spoken.at(-1);

  first.onend(); // cancel() of the first fires its end *after* the second starts
  assert.equal(speechState.get().id, "heart:funFact");

  second.onboundary({ name: "word", charIndex: 3, charLength: 5 });
  assert.deepEqual(speechState.get(), { id: "heart:funFact", charIndex: 3, charLength: 5 });

  second.onend();
  assert.equal(speechState.get().id, null);
});

test("stopping clears the state and ignores the stopped utterance's events", () => {
  const spoken = installFakeSpeech();
  speak("daily:2026-09-24", "Which organ is this?", v("en-US", "Samantha"));
  stopSpeaking();
  spoken.at(-1).onboundary({ name: "word", charIndex: 6, charLength: 5 });
  assert.equal(speechState.get().id, null);
});
