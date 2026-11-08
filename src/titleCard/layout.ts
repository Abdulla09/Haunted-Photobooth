import { CONFIG } from '../app/config';

export interface TitleRow {
  /** Row text index (0 = HAUNTED, 1 = PHOTO, 2 = BOOTH) */
  index: number;
  /** Center in pixels */
  cx: number;
  cy: number;
  /** Unrotated size in pixels */
  width: number;
  height: number;
  /** Tilt in radians */
  tilt: number;
  /** Tilt in degrees */
  tiltDeg: number;
}

export const ROW_TILTS_DEG = [-8, 5, -3] as const;
export const ROW_STAGGER_MS = 80;

/** Three tilted rows whose rotated bounding boxes lie inside the canvas. */
export function layoutRows(w: number, h: number): TitleRow[] {
  const rowH = h * 0.2;
  const gap = h * 0.04;
  const totalH = rowH * 3 + gap * 2;
  const top = (h - totalH) / 2;
  const maxW = w * 0.8;

  return ROW_TILTS_DEG.map((tiltDeg, index) => {
    const tilt = (tiltDeg * Math.PI) / 180;
    const c = Math.abs(Math.cos(tilt));
    const s = Math.abs(Math.sin(tilt));
    // Scale so the rotated bounding box fits within 90% of the canvas.
    let width = maxW;
    let height = rowH;
    const bw = width * c + height * s;
    const bh = width * s + height * c;
    const k = Math.min(1, (w * 0.9) / bw, (h * 0.3) / bh);
    width *= k;
    height *= k;
    return {
      index,
      cx: w / 2,
      cy: top + rowH * (index + 0.5) + gap * index,
      width,
      height,
      tilt,
      tiltDeg,
    };
  });
}

/**
 * Slam progress in [0,1] for a row, stepped at 1/18 s, with per-row stagger.
 * Monotonic non-decreasing in time; 0 before start, 1 at/after SLAM_MS.
 */
export function slamProgress(sinceBurstStartMs: number, rowIndex = 0): number {
  const t = sinceBurstStartMs - rowIndex * ROW_STAGGER_MS;
  if (!(t > 0)) return 0;
  if (t >= CONFIG.SLAM_MS) return 1;
  const stepMs = 1000 / CONFIG.STEP_RATE;
  const stepped = Math.floor(t / stepMs) * stepMs;
  return Math.min(1, Math.max(0, stepped / CONFIG.SLAM_MS));
}
