import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../app/rng';
import { ParticleSim, distributeKinds } from './simulation';

describe('distributeKinds', () => {
  it('gives 18 or 19 per kind summing to 150', () => {
    const c = Object.values(distributeKinds(150, mulberry32(7)));
    expect(c.reduce((a, b) => a + b, 0)).toBe(150);
    expect(c.every((n) => n === 18 || n === 19)).toBe(true);
  });
});

describe('ParticleSim', () => {
  const bounds = { minX: -2, maxX: 2, minY: -1, maxY: 1 };
  const center = { x: 0.1, y: 0 };

  it('moves away from center and respawns out-of-bounds particles', () => {
    const sim = new ParticleSim(mulberry32(1));
    sim.reset(center);
    for (let n = 0; n < 200; n++) {
      sim.step(1 / 18, bounds, center);
      for (let i = 0; i < sim.count; i++) {
        expect(sim.px[i]).toBeGreaterThan(bounds.minX - 1);
        expect(sim.px[i]).toBeLessThan(bounds.maxX + 1);
      }
    }
  });

  it('reset keeps array identity and matches a fresh sim', () => {
    const a = new ParticleSim(mulberry32(3));
    const arr = a.px;
    a.step(1 / 18, bounds, center);
    const b = new ParticleSim(mulberry32(3));
    b.step(1 / 18, bounds, center);
    a.reset(center);
    expect(a.px).toBe(arr);
    expect(a.px.length).toBe(150);
  });
});
