import { CONFIG } from '../app/config';

export type ShatterPhase = 'crack' | 'separate' | 'done';

export interface ShatterTimeline {
  phase: ShatterPhase;
  /** Crack progress 0..1 */
  crack: number;
  /** Separation progress 0..1 */
  separate: number;
  done: boolean;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Pure shatter timeline: crack [0,400), separate [400,1600], then done. */
export function timeline(tMs: number): ShatterTimeline {
  const t = Number.isFinite(tMs) ? Math.max(0, tMs) : 0;
  const crackMs = CONFIG.SHATTER_CRACK_MS;
  const sepMs = CONFIG.SHATTER_SEPARATE_MS;
  if (t < crackMs) {
    return { phase: 'crack', crack: clamp01(t / crackMs), separate: 0, done: false };
  }
  const s = clamp01((t - crackMs) / sepMs);
  if (t <= crackMs + sepMs) {
    return { phase: 'separate', crack: 1, separate: s, done: false };
  }
  return { phase: 'done', crack: 1, separate: 1, done: true };
}

/** Clamp a normalized point to [0,1]². */
export function clampOrigin(p: { x: number; y: number }): { x: number; y: number } {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}
