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

/** Title card scale relative to the original full-frame layout. */
const TITLE_SCALE = 0.55;

/**
 * Three tilted rows stacked in the left third of the frame, vertically
 * centered, with rotated bounding boxes inside the left third and the canvas.
 */
export function layoutRows(w: number, h: number): TitleRow[] {
  const colW = w / 3;
  const cx = colW / 2;
  const targetW = w * 0.8 * TITLE_SCALE;
  const targetH = h * 0.2 * TITLE_SCALE;

  const sizes = ROW_TILTS_DEG.map((tiltDeg) => {
    const tilt = (tiltDeg * Math.PI) / 180;
    const c = Math.abs(Math.cos(tilt));
    const s = Math.abs(Math.sin(tilt));
    const bw = targetW * c + targetH * s;
    const k = Math.min(1, (colW * 0.92) / bw);
    return { tilt, tiltDeg, width: targetW * k, height: targetH * k };
  });
  const gap = h * 0.02;
  const rowH = Math.max(...sizes.map((r) => r.height));
  const totalH = rowH * 3 + gap * 2;
  const top = (h - totalH) / 2;

  return sizes.map((r, index) => ({
    index,
    cx,
    cy: top + rowH * (index + 0.5) + gap * index,
    width: r.width,
    height: r.height,
    tilt: r.tilt,
    tiltDeg: r.tiltDeg,
  }));
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
