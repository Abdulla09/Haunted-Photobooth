import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { expect } from 'vitest';
import { generateWedges, WEDGE_COUNT } from './wedges.ts';

describe('wedges', () => {
  // Feature: haunted-photobooth, Property 17: Wedge geometry is valid
  // **Validates: Requirements 14.1, 14.2**
  it('Property 17: Wedge geometry is valid', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const { widthsDeg: w, boundariesRad: b } = generateWedges(seed);
        expect(w).toHaveLength(13);
        expect(WEDGE_COUNT).toBe(13);
        expect(Math.abs(w.reduce((a, c) => a + c, 0) - 360)).toBeLessThan(1e-9);
        for (let i = 0; i < 13; i++) {
          expect(w[i]).toBeGreaterThanOrEqual(8);
          expect(Math.abs(w[i] - w[(i + 1) % 13])).toBeGreaterThanOrEqual(1.0);
        }
        expect(b).toHaveLength(14);
        for (let i = 0; i < 13; i++) {
          expect(b[i + 1]).toBeGreaterThan(b[i]);
          expect((b[i + 1] - b[i]) * (180 / Math.PI)).toBeCloseTo(w[i], 6);
        }
        expect(b[13] - b[0]).toBeCloseTo(2 * Math.PI, 9);
      }),
      { numRuns: 200 },
    );
  });
});
