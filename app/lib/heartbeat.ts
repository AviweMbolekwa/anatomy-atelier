/**
 * "Feel your heartbeat" — reading a pulse from the camera.
 *
 * Photoplethysmography: with a fingertip over the lens, each heartbeat pushes
 * a little more blood into the skin, which absorbs a little more light, so the
 * frame's average red level dips once per beat. The dip is tiny next to the
 * drift from pressure and lighting, so the estimate relies on periodicity
 * (autocorrelation) rather than counting individual peaks.
 *
 * Only the average colour of each frame is ever read. No image is kept.
 * This is a toy, not a medical device: the UI never labels a rate as normal
 * or abnormal, and implausible readings are rejected rather than shown.
 */

export type Sample = { t: number; v: number };
export type BpmEstimate = { bpm: number; confidence: number };

export const MIN_BPM = 45;
export const MAX_BPM = 180;
const RATE = 30; // resampling rate, Hz

/** A fingertip lit through from behind reads as bright, strongly red. */
export function isFingerOnCamera(r: number, g: number, b: number): boolean {
  const sum = r + g + b;
  return r > 40 && sum > 0 && r / sum > 0.5;
}

/** Linear resampling onto a uniform grid — camera frames arrive unevenly. */
function resample(samples: Sample[]): number[] {
  const start = samples[0].t;
  const end = samples[samples.length - 1].t;
  const step = 1000 / RATE;
  const out: number[] = [];
  let j = 0;
  for (let t = start; t <= end; t += step) {
    while (j < samples.length - 2 && samples[j + 1].t < t) j += 1;
    const a = samples[j];
    const b = samples[j + 1];
    const span = b.t - a.t || 1;
    out.push(a.v + ((b.v - a.v) * (t - a.t)) / span);
  }
  return out;
}

function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  const out = new Array<number>(values.length);
  let sum = 0;
  let count = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < values.length; i += 1) {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length - 1, i + half);
    while (hi < to) { hi += 1; sum += values[hi]; count += 1; }
    while (lo < from) { sum -= values[lo]; lo += 1; count -= 1; }
    out[i] = sum / count;
  }
  return out;
}

/** Removes slow drift (pressure, lighting) and fast jitter, leaving the pulse. */
export function pulseWave(samples: Sample[]): number[] {
  if (samples.length < 2) return [];
  const raw = resample(samples);
  const baseline = movingAverage(raw, Math.round(RATE * 1.5));
  return movingAverage(raw.map((v, i) => v - baseline[i]), 3);
}

/**
 * Beats per minute from `samples`, or null when there isn't a trustworthy
 * rhythm in them. Needs at least ~5 s of signal.
 */
export function estimateBpm(samples: Sample[]): BpmEstimate | null {
  if (samples.length < 20 || samples[samples.length - 1].t - samples[0].t < 5000) return null;
  const wave = pulseWave(samples);
  // The edges carry the smoothing windows' ramp-up; skip them.
  const x = wave.slice(RATE, wave.length - RATE);
  const n = x.length;
  if (n < RATE * 3) return null;
  const mean = x.reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i += 1) x[i] -= mean;
  if (x.reduce((s, v) => s + v * v, 0) / n < 1e-6) return null;

  const minLag = Math.floor((60 * RATE) / MAX_BPM);
  const maxLag = Math.ceil((60 * RATE) / MIN_BPM);
  const corr = new Array<number>(maxLag + 2).fill(0);
  for (let lag = minLag - 1; lag <= maxLag + 1 && lag < n; lag += 1) {
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i + lag < n; i += 1) {
      num += x[i] * x[i + lag];
      da += x[i] * x[i];
      db += x[i + lag] * x[i + lag];
    }
    corr[lag] = da && db ? num / Math.sqrt(da * db) : 0;
  }

  // Local maxima in the plausible range.
  const peaks: number[] = [];
  for (let lag = minLag; lag <= maxLag && lag + 1 < corr.length; lag += 1) {
    if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1]) peaks.push(lag);
  }
  if (!peaks.length) return null;
  const best = Math.max(...peaks.map((lag) => corr[lag]));
  // A rhythm also correlates with itself at 2x and 3x its period. Take the
  // shortest lag that is nearly as strong as the best, i.e. the true beat
  // rather than a half-speed echo of it.
  const lag = peaks.find((candidate) => corr[candidate] >= best * 0.9)!;

  // Parabolic interpolation for sub-sample precision.
  const a = corr[lag - 1];
  const b = corr[lag];
  const c = corr[lag + 1];
  const denom = a - 2 * b + c;
  const refined = denom ? lag + (0.5 * (a - c)) / denom : lag;

  const bpm = (60 * RATE) / refined;
  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;
  return { bpm: Math.round(bpm), confidence: Math.max(0, Math.min(1, b)) };
}

/**
 * Scale for the 3D heart at `elapsedMs` into a heartbeat at `bpm`:
 * a strong "lub" and a softer "dub", then rest. Returns 1 at rest.
 */
export function heartbeatScale(elapsedMs: number, bpm: number, amplitude = 0.05): number {
  const phase = ((elapsedMs / 60000) * bpm) % 1;
  const bump = (centre: number, width: number) => Math.exp(-(((phase - centre) / width) ** 2));
  return 1 + amplitude * (bump(0.1, 0.05) + 0.55 * bump(0.3, 0.05));
}

// ------------------------------------------------------------- the meter

/** Finger-on-lens time needed for a reading, and the point to give up. */
export const MEASURE_MS = 15_000;
export const GIVE_UP_MS = 35_000;
const WINDOW_MS = 12_000;

export type MeterState = {
  fingerOn: boolean;
  /** 0–1 towards a reading, reset whenever the finger lifts. */
  progress: number;
  /** A confident running estimate, once there is one. */
  live: number | null;
  /** The final reading. */
  result: number | null;
  failed: boolean;
  /** Recent samples, for drawing the wave. */
  samples: Sample[];
};

/**
 * Turns a stream of frame colours into a reading. Pure and clock-free (the
 * caller passes `now`), so the whole measuring flow is testable without a
 * camera. Frames may repeat (the render loop outpaces the camera); a repeated
 * frame carries no new information and is skipped.
 */
export class PulseMeter {
  private samples: Sample[] = [];
  private fingerSince: number | null = null;
  private fingerTotal = 0;
  private lastSeen: number | null = null;
  private lastFrameValue: string | null = null;
  private lastEstimateAt = 0;
  private confident: { at: number; bpm: number }[] = [];
  private live: number | null = null;
  private result: number | null = null;
  private failed = false;

  push(now: number, r: number, g: number, b: number): MeterState {
    if (this.result !== null || this.failed) return this.state(now, true);
    const on = isFingerOnCamera(r, g, b);
    const elapsed = this.lastSeen === null ? 0 : Math.min(now - this.lastSeen, 250);
    this.lastSeen = now;

    if (!on) {
      if (this.fingerSince !== null) {
        // Lifting the finger breaks the trace; start the count again.
        this.fingerSince = null;
        this.samples = [];
        this.confident = [];
        this.live = null;
      }
      this.lastFrameValue = null;
      return this.state(now, false);
    }

    if (this.fingerSince === null) this.fingerSince = now;
    this.fingerTotal += elapsed;
    const key = `${r.toFixed(3)}|${g.toFixed(3)}|${b.toFixed(3)}`;
    if (key !== this.lastFrameValue) {
      this.lastFrameValue = key;
      this.samples.push({ t: now, v: r });
      while (this.samples.length && now - this.samples[0].t > WINDOW_MS) this.samples.shift();
    }

    const held = now - this.fingerSince;
    if (held > 6000 && now - this.lastEstimateAt >= 250) {
      this.lastEstimateAt = now;
      const estimate = estimateBpm(this.samples);
      if (estimate && estimate.confidence >= 0.5) {
        this.confident.push({ at: now, bpm: estimate.bpm });
        this.live = estimate.bpm;
      }
      this.confident = this.confident.filter((entry) => now - entry.at < 5000);
      if (held >= MEASURE_MS && this.confident.length >= 3) {
        const sorted = this.confident.map((entry) => entry.bpm).sort((x, y) => x - y);
        this.result = sorted[Math.floor(sorted.length / 2)];
      }
    }
    if (this.result === null && this.fingerTotal > GIVE_UP_MS) this.failed = true;
    return this.state(now, true);
  }

  private state(now: number, fingerOn: boolean): MeterState {
    const held = this.fingerSince === null ? 0 : now - this.fingerSince;
    return {
      fingerOn,
      progress: Math.min(1, held / MEASURE_MS),
      live: this.live,
      result: this.result,
      failed: this.failed,
      samples: this.samples,
    };
  }
}
