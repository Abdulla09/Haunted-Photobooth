import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { GestureDetector, type GestureMode } from './GestureDetector';
import { CONFIG } from '../app/config';
import type { Landmark } from '../inference/HandTracker';

type Kind = 'fist' | 'palm' | 'other' | 'none';

/** Builds 21 landmarks that classify as the requested kind. */
function hand(kind: Kind): Landmark[] | null {
  if (kind === 'none') return null;
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const pips = [6, 10, 14, 18];
  const tips = [8, 12, 16, 20];
  for (let i = 0; i < 4; i++) {
    lm[pips[i]] = { x: 0.5, y: 0.3, z: 0 };
    // fist: tip closer to wrist than PIP; palm: farther; other: mixed
    const tipY = kind === 'fist' ? 0.4 : kind === 'palm' ? 0.1 : i === 0 ? 0.1 : 0.4;
    lm[tips[i]] = { x: 0.5, y: tipY, z: 0 };
  }
  lm[17] = { x: 0.6, y: 0.5, z: 0 };
  lm[3] = { x: 0.7, y: 0.5, z: 0 };
  lm[4] = { x: 0.9, y: 0.5, z: 0 };
  return lm;
}

interface Sample {
  kind: Kind;
  mode: GestureMode;
  dt: number;
}

describe('GestureDetector', () => {
  // Feature: haunted-photobooth, Property 3: Hold timing raises events exactly when a hold completes
  // **Validates: Requirements 3.3, 3.4, 3.5**
  it('raises events exactly when a hold completes', () => {
    const sample = fc.record({
      kind: fc.constantFrom<Kind>('fist', 'palm', 'other', 'none'),
      mode: fc.constantFrom<GestureMode>('normal', 'transitioning', 'monster'),
      dt: fc.integer({ min: 1, max: 300 }),
    });
    fc.assert(
      fc.property(fc.array(sample, { minLength: 1, maxLength: 60 }), (samples: Sample[]) => {
        const det = new GestureDetector();
        let t = 1000;
        let key = '';
        let runStart = 0;
        let fired = false;
        for (const s of samples) {
          t += s.dt;
          const k = s.kind === 'palm' ? `palm:${s.mode === 'monster'}` : s.kind;
          if (k !== key) {
            key = k;
            runStart = t;
            fired = false;
          }
          let expected: 'trigger' | 'return' | null = null;
          if (!fired) {
            const held = t - runStart;
            if (s.kind === 'fist' && held >= CONFIG.FIST_HOLD_MS) expected = 'trigger';
            else if (k === 'palm:true' && held >= CONFIG.OPEN_PALM_HOLD_MS) expected = 'return';
            if (expected) fired = true;
          }
          const ev = det.update(hand(s.kind), t, s.mode);
          expect(ev?.type ?? null).toBe(expected);
        }
      }),
      { numRuns: 200 },
    );
  });
});
