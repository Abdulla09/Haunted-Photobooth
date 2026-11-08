import { CONFIG } from '../app/config';
import type { DriverCallbacks, Point, TransitionDriver } from '../mode/TransitionDriver';
import { clampOrigin } from './timeline';

/** Total shatter length (crack + separation) in ms. */
export const SHATTER_TOTAL_MS = CONFIG.SHATTER_CRACK_MS + CONFIG.SHATTER_SEPARATE_MS;

/**
 * Drives the shatter transition on the stepped clock. `update` is called once
 * per rendered frame with the stepped time in ms (and the real frame time, used
 * to stamp Burst_Start). Burst start fires once when elapsed >= crack length;
 * completion fires once when elapsed >= crack + separation.
 */
export class ShatterDriver implements TransitionDriver {
  private callbacks: DriverCallbacks | null = null;
  private startSteppedMs: number | null = null;
  private burstFired = false;
  private _origin: Point = { x: 0.5, y: 0.5 };
  private _elapsedMs = 0;

  /** Clamped origin of the active transition (UV convention, no y flip). */
  get origin(): Point {
    return this._origin;
  }

  /** Stepped elapsed time of the active transition in ms. */
  get elapsedMs(): number {
    return this._elapsedMs;
  }

  get active(): boolean {
    return this.callbacks !== null;
  }

  start(origin: Point, callbacks: DriverCallbacks): void {
    this._origin = clampOrigin(origin);
    this.callbacks = callbacks;
    this.startSteppedMs = null; // captured on the first update
    this.burstFired = false;
    this._elapsedMs = 0;
  }

  update(steppedMs: number, nowMs: number): void {
    const cb = this.callbacks;
    if (!cb) return;
    if (this.startSteppedMs === null) this.startSteppedMs = steppedMs;
    const t = Math.max(0, steppedMs - this.startSteppedMs);
    this._elapsedMs = t;
    if (!this.burstFired && t >= CONFIG.SHATTER_CRACK_MS) {
      this.burstFired = true;
      cb.onBurstStart(nowMs);
    }
    if (t >= SHATTER_TOTAL_MS) {
      if (!this.burstFired) {
        this.burstFired = true;
        cb.onBurstStart(nowMs);
      }
      this.callbacks = null;
      cb.onComplete();
    }
  }
}
