export interface Point {
  x: number;
  y: number;
}

/** Converts a float in [0, 1] to a byte, clamping out-of-range and non-finite input. */
export function toU8(v: number): number {
  if (!(v > 0)) return 0; // also handles NaN
  if (v >= 1) return 255;
  return Math.round(v * 255);
}

/** Converts a float mask into a byte mask. Allocates `dst` if not given. */
export function floatMaskToU8(src: ArrayLike<number>, dst?: Uint8Array): Uint8Array {
  const out = dst ?? new Uint8Array(src.length);
  const n = Math.min(src.length, out.length);
  for (let i = 0; i < n; i++) out[i] = toU8(src[i]);
  return out;
}

const MIN_PIXELS = 16;
const THRESHOLD = 128;

/**
 * Centroid of mask pixels >= 128, normalized, y down, x mirrored to match the
 * mirrored feed. Returns (0.5, 0.5) when fewer than 16 pixels qualify.
 */
export function personCenter(mask: Uint8Array, w: number, h: number): Point {
  let count = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (mask[row + x] >= THRESHOLD) {
        count++;
        sx += x + 0.5;
        sy += y + 0.5;
      }
    }
  }
  if (count < MIN_PIXELS) return { x: 0.5, y: 0.5 };
  return { x: 1 - sx / count / w, y: sy / count / h };
}
