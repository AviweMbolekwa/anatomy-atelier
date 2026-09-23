import assert from "node:assert/strict";
import test from "node:test";
import { estimateBpm, heartbeatScale, isFingerOnCamera, pulseWave } from "../app/lib/heartbeat.ts";

/** Deterministic noise so the tests never flake. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * A realistic camera trace: uneven frame timing, a PPG-shaped pulse (with a
 * harmonic), slow drift from finger pressure, and sensor noise.
 */
function trace(bpm, { seconds = 15, amplitude = 2.5, noise = 0.6, seed = 1 } = {}) {
  const rand = rng(seed);
  const samples = [];
  const f = bpm / 60;
  for (let t = 0; t < seconds * 1000; t += 33 + (rand() - 0.5) * 12) {
    const s = t / 1000;
    const pulse = -amplitude * (Math.sin(2 * Math.PI * f * s) + 0.4 * Math.sin(4 * Math.PI * f * s + 0.8));
    const drift = 6 * Math.sin(2 * Math.PI * 0.08 * s) + 0.4 * s;
    samples.push({ t, v: 180 + pulse + drift + (rand() - 0.5) * 2 * noise });
  }
  return samples;
}

for (const bpm of [55, 72, 95, 130, 165]) {
  test(`reads a ${bpm} bpm pulse within ±3`, () => {
    const result = estimateBpm(trace(bpm, { seed: bpm }));
    assert.ok(result, "should find the rhythm");
    assert.ok(Math.abs(result.bpm - bpm) <= 3, `got ${result.bpm}`);
    assert.ok(result.confidence >= 0.5, `confidence ${result.confidence}`);
  });
}

test("prefers the true beat over its half-speed echo", () => {
  // At 150 bpm the 75 bpm lag correlates strongly too.
  assert.ok(Math.abs(estimateBpm(trace(150, { seed: 9 })).bpm - 150) <= 3);
});

test("noise alone is not reported as a heartbeat", () => {
  const rand = rng(42);
  const samples = [];
  for (let t = 0; t < 15000; t += 33) samples.push({ t, v: 180 + (rand() - 0.5) * 6 });
  const result = estimateBpm(samples);
  assert.ok(!result || result.confidence < 0.5, `noise read as ${JSON.stringify(result)}`);
});

test("too little signal gives no answer rather than a guess", () => {
  assert.equal(estimateBpm(trace(72, { seconds: 3 })), null);
  assert.equal(estimateBpm([]), null);
});

test("pulseWave removes drift so the wave is centred on zero", () => {
  const wave = pulseWave(trace(72));
  const middle = wave.slice(60, -60);
  const mean = middle.reduce((s, v) => s + v, 0) / middle.length;
  assert.ok(Math.abs(mean) < 0.5, `mean ${mean}`);
});

test("finger detection: a red, lit fingertip yes; a room, darkness, or a white wall no", () => {
  assert.equal(isFingerOnCamera(210, 40, 35), true);   // torch through a fingertip
  assert.equal(isFingerOnCamera(90, 20, 18), true);    // fingertip in room light
  assert.equal(isFingerOnCamera(120, 110, 100), false); // an ordinary scene
  assert.equal(isFingerOnCamera(10, 3, 2), false);      // lens covered in the dark
  assert.equal(isFingerOnCamera(250, 250, 250), false); // a white wall
});

test("the 3D heart beats lub-dub at the given rate and rests at 1", () => {
  const bpm = 60;
  const samples = Array.from({ length: 1000 }, (_, i) => heartbeatScale(i, bpm));
  const peak = Math.max(...samples);
  assert.ok(peak > 1.04 && peak <= 1.06, `peak ${peak}`);
  assert.ok(Math.abs(heartbeatScale(700, bpm) - 1) < 0.001, "rests between beats");
  assert.ok(Math.abs(heartbeatScale(123, bpm) - heartbeatScale(123 + 60000 / bpm, bpm)) < 1e-9, "periodic");
});

import { PulseMeter } from "../app/lib/heartbeat.ts";

/**
 * Drives the meter the way the app does: a 60 Hz render loop reading a 30 fps
 * camera (so every frame is seen twice), integer colour channels, a PPG
 * pulse riding on drift and noise.
 */
function runMeter(bpm, { seconds = 40, amplitude = 5, noise = 0.8, seed = 3, fingerAt = 1000 } = {}) {
  const rand = rng(seed);
  const meter = new PulseMeter();
  let state;
  let frameValue = null;
  for (let now = 0; now < seconds * 1000; now += 1000 / 60) {
    const frameIndex = Math.floor(now / (1000 / 30));
    if (!frameValue || frameValue.index !== frameIndex) {
      const s = frameIndex / 30;
      const pulse = -amplitude * (Math.sin(2 * Math.PI * bpm / 60 * s) + 0.4 * Math.sin(4 * Math.PI * bpm / 60 * s + 0.8));
      const r = Math.round(200 + pulse + 4 * Math.sin(2 * Math.PI * 0.07 * s) + (rand() - 0.5) * 2 * noise);
      frameValue = { index: frameIndex, rgb: now < fingerAt ? [120, 110, 100] : [r, 25, 18] };
    }
    state = meter.push(now, ...frameValue.rgb);
    if (state.result !== null || state.failed) return { state, at: now };
  }
  return { state, at: seconds * 1000 };
}

for (const bpm of [62, 78, 104, 140]) {
  test(`the meter reads ${bpm} bpm from a camera-like stream in about 15 s`, () => {
    const { state, at } = runMeter(bpm, { seed: bpm });
    assert.equal(state.failed, false, "should not give up on a clean pulse");
    assert.ok(state.result !== null, "should produce a reading");
    assert.ok(Math.abs(state.result - bpm) <= 3, `read ${state.result}`);
    assert.ok(at >= 15000 && at < 25000, `took ${at} ms`);
  });
}

test("the meter gives up on a finger with no pulse, after the full time", () => {
  const { state, at } = runMeter(72, { amplitude: 0, noise: 2 });
  assert.equal(state.failed, true);
  assert.ok(at >= 35000, `gave up too early, at ${at} ms`);
});

test("lifting the finger resets the progress", () => {
  const meter = new PulseMeter();
  for (let now = 0; now < 8000; now += 33) meter.push(now, 200 + Math.round(Math.sin(now / 150) * 4), 25, 18);
  const lifted = meter.push(8033, 120, 110, 100);
  assert.equal(lifted.fingerOn, false);
  assert.equal(lifted.progress, 0);
});
