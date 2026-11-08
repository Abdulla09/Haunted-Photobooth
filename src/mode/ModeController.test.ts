import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CONFIG } from '../app/config';
import { ModeController, type ModeEvent } from './ModeController';
import type { DriverCallbacks, Point, TransitionDriver } from './TransitionDriver';

class CountingDriver implements TransitionDriver {
  starts = 0;
  start(_origin: Point, cb: DriverCallbacks): void {
    this.starts++;
    cb.onBurstStart();
    cb.onComplete();
  }
}

const eventArb: fc.Arbitrary<ModeEvent> = fc.oneof(
  fc.record({
    type: fc.constant('trigger' as const),
    fistPosition: fc.record({ x: fc.double({ min: 0, max: 1, noNaN: true }), y: fc.double({ min: 0, max: 1, noNaN: true }) }),
  }),
  fc.constant<ModeEvent>({ type: 'trigger' }),
  fc.constant<ModeEvent>({ type: 'return' }),
);

describe('ModeController cooldown', () => {
  // Feature: haunted-photobooth, Property 7: Cooldown ignores every event
  // **Validates: Requirements 5.4, 15.3**
  it('ignores every event dispatched before the cooldown ends', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // false: cooldown after Trigger (monster); true: after Return (normal)
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), eventArb), { minLength: 1, maxLength: 30 }),
        (viaReturn, t0, events) => {
          const driver = new CountingDriver();
          const mc = new ModeController(driver);
          let cooldownEnd: number;
          let now = t0;
          expect(mc.dispatch({ type: 'trigger' }, now)).toBe(true);
          cooldownEnd = now + CONFIG.TRIGGER_COOLDOWN_MS;
          if (viaReturn) {
            now = cooldownEnd;
            expect(mc.dispatch({ type: 'return' }, now)).toBe(true);
            cooldownEnd = now + CONFIG.RETURN_COOLDOWN_MS;
          }
          const span = cooldownEnd - now;
          const state = mc.state;
          const burst = mc.burstStartMs;
          const starts = driver.starts;
          let changes = 0;
          mc.onChange(() => changes++);

          for (const [frac, ev] of events) {
            // strictly earlier than cooldownEnd
            const t = now + Math.min(Math.floor(frac * span), span - 1);
            expect(mc.dispatch(ev, t)).toBe(false);
            expect(mc.state).toBe(state);
            expect(mc.burstStartMs).toBe(burst);
            expect(driver.starts).toBe(starts);
          }
          expect(changes).toBe(0);

          // cooldown end unchanged: an event exactly at the end is still accepted
          const expected: ModeEvent = viaReturn ? { type: 'trigger' } : { type: 'return' };
          expect(mc.dispatch(expected, cooldownEnd)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
