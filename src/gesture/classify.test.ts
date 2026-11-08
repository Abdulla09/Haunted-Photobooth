import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { classify } from './classify';

const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];

interface Pt {
  x: number;
  y: number;
  z: number;
}

/** Builds 21 landmarks with a chosen extended/curled state per finger and thumb. */
function buildHand(
  thumbExtended: boolean,
  angles: number[],
  pipDists: number[],
  ratios: number[],
  thumbAngle: number,
): Pt[] {
  const wrist = { x: 0.5, y: 0.5, z: 0 };
  const lm: Pt[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[0] = wrist;
  for (let i = 0; i < 4; i++) {
    const a = angles[i];
    const pipD = pipDists[i];
    const tipD = pipD * ratios[i];
    lm[PIPS[i]] = { x: 0.5 + Math.cos(a) * pipD, y: 0.5 + Math.sin(a) * pipD, z: 0 };
    lm[TIPS[i]] = { x: 0.5 + Math.cos(a) * tipD, y: 0.5 + Math.sin(a) * tipD, z: 0 };
  }
  const pinky = { x: 0.6, y: 0.5, z: 0 };
  lm[17] = pinky;
  // Thumb IP at 0.1 from the pinky MCP; tip closer (curled) or farther (extended).
  const ipD = 0.1;
  const tipD = thumbExtended ? 0.2 : 0.05;
  lm[3] = { x: pinky.x + Math.cos(thumbAngle) * ipD, y: pinky.y + Math.sin(thumbAngle) * ipD, z: 0 };
  lm[4] = { x: pinky.x + Math.cos(thumbAngle) * tipD, y: pinky.y + Math.sin(thumbAngle) * tipD, z: 0 };
  return lm;
}

describe('classify', () => {
  // Feature: haunted-photobooth, Property 2: Gesture classification is exclusive and matches the definitions
  // **Validates: Requirements 3.2**
  it('is exclusive and matches the fist / open palm definitions', () => {
    const curledRatio = fc.double({ min: 0.2, max: 0.8, noNaN: true });
    const extendedRatio = fc.double({ min: 1.2, max: 2, noNaN: true });
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        fc.boolean(),
        fc.array(fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), { minLength: 4, maxLength: 4 }),
        fc.array(fc.double({ min: 0.1, max: 0.3, noNaN: true }), { minLength: 4, maxLength: 4 }),
        fc.array(curledRatio, { minLength: 4, maxLength: 4 }),
        fc.array(extendedRatio, { minLength: 4, maxLength: 4 }),
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        (fingers, thumb, angles, pipDists, curled, extended, thumbAngle) => {
          const ratios = fingers.map((ext, i) => (ext ? extended[i] : curled[i]));
          const lm = buildHand(thumb, angles, pipDists, ratios, thumbAngle);
          const result = classify(lm);
          const allCurled = fingers.every((f) => !f);
          const allExtended = fingers.every((f) => f);
          const expected = allCurled ? 'fist' : allExtended && thumb ? 'open_palm' : 'other';
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
