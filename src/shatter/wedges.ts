import { mulberry32 } from '../app/rng';

export const WEDGE_COUNT = 13;
const MIN_WIDTH_DEG = 8;
const MIN_ADJ_DIFF_DEG = 1.0;
const NUDGE_DEG = 1.5;
const MAX_ITERS = 200;

export interface Wedges {
  widthsDeg: number[];
  boundariesRad: number[];
  dirRad: number[];
  speed: number[];
  spin: number[];
  z: number[];
}

function normalize(w: number[]): number[] {
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (360 * x) / sum);
}

function valid(w: number[]): boolean {
  const n = w.length;
  for (let i = 0; i < n; i++) {
    if (w[i] < MIN_WIDTH_DEG) return false;
    if (Math.abs(w[i] - w[(i + 1) % n]) < MIN_ADJ_DIFF_DEG) return false;
  }
  return true;
}

/** Deterministic widths that always satisfy the constraints (fallback). */
function fallbackWidths(): number[] {
  const base = 360 / WEDGE_COUNT;
  const mid = (WEDGE_COUNT - 1) / 2;
  return Array.from({ length: WEDGE_COUNT }, (_, i) => base + (i - mid) * NUDGE_DEG);
}

export function generateWedges(seed: number): Wedges {
  const rng = mulberry32(seed);
  let w = normalize(Array.from({ length: WEDGE_COUNT }, () => 0.55 + rng() * 0.9));

  let ok = valid(w);
  for (let iter = 0; !ok && iter < MAX_ITERS; iter++) {
    const n = w.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (Math.abs(w[i] - w[j]) < MIN_ADJ_DIFF_DEG) {
        w[j] += rng() < 0.5 ? NUDGE_DEG : -NUDGE_DEG;
        break;
      }
    }
    for (let i = 0; i < n; i++) if (w[i] < MIN_WIDTH_DEG) w[i] = MIN_WIDTH_DEG;
    w = normalize(w);
    ok = valid(w);
  }
  if (!ok) w = normalize(fallbackWidths());

  const phase = rng() * Math.PI * 2;
  const boundariesRad: number[] = [phase];
  for (let i = 0; i < WEDGE_COUNT; i++) {
    boundariesRad.push(boundariesRad[i] + (w[i] * Math.PI) / 180);
  }

  const dirRad: number[] = [];
  const speed: number[] = [];
  const spin: number[] = [];
  for (let i = 0; i < WEDGE_COUNT; i++) {
    dirRad.push((boundariesRad[i] + boundariesRad[i + 1]) / 2);
    speed.push(0.6 + rng() * 0.8);
    spin.push((rng() * 2 - 1) * 1.2);
  }

  // z order: a seeded shuffle of 0..12 (Fisher-Yates)
  const z = Array.from({ length: WEDGE_COUNT }, (_, i) => i);
  for (let i = z.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    [z[i], z[k]] = [z[k], z[i]];
  }

  return { widthsDeg: w, boundariesRad, dirRad, speed, spin, z };
}
