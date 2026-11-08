import { CONFIG } from '../app/config';
import type { Landmark } from '../inference/HandTracker';
import { classify, type GestureClass } from './classify';

export type GestureMode = 'normal' | 'transitioning' | 'monster';

export type GestureEvent =
  | { type: 'trigger'; fistPosition: { x: number; y: number } }
  | { type: 'return' };

const PALM_CENTER = 9;

/**
 * Pure hold-timer state machine. Time is injected through `nowMs`.
 * A class change or a lost hand restarts the hold; each event is latched
 * so one continuous hold fires at most once.
 */
export class GestureDetector {
  private current: GestureClass | null = null;
  private holdStart = 0;
  private latched = false;

  /** Returns zero or one event for this sample. `null` means no hand. */
  update(
    landmarks: readonly Landmark[] | null,
    nowMs: number,
    mode: GestureMode,
  ): GestureEvent | null {
    if (!landmarks || landmarks.length < 21) {
      this.reset(null, nowMs);
      return null;
    }
    const cls = classify(landmarks);
    if (cls !== this.current) this.reset(cls, nowMs);
    if (this.latched) return null;

    const held = nowMs - this.holdStart;
    if (cls === 'fist' && held >= CONFIG.FIST_HOLD_MS) {
      this.latched = true;
      const palm = landmarks[PALM_CENTER];
      return { type: 'trigger', fistPosition: { x: 1 - palm.x, y: palm.y } };
    }
    if (cls === 'open_palm' && mode === 'monster' && held >= CONFIG.OPEN_PALM_HOLD_MS) {
      this.latched = true;
      return { type: 'return' };
    }
    return null;
  }

  private reset(cls: GestureClass | null, nowMs: number): void {
    this.current = cls;
    this.holdStart = nowMs;
    this.latched = false;
  }
}
