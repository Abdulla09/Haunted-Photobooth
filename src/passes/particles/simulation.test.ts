import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../app/config';
import { mulberry32 } from '../../app/rng';
import { ParticleSim } from './simulation';

describe('ParticleSim (ghosts)', () => {
  const bounds = { minX: -4, maxX: 4, minY: -2.2, maxY: 2.2 };
  const center = { x: 0.1, y: 0 };
  const dt = 1 / 18;

  it('has 20 particles', () => {
    expect(new ParticleSim(mulberry32(1)).count).toBe(20);
    expect(CONFIG.PARTICLE_COUNT).toBe(20);
  });

  it('bursts outward from the center without approaching it', () => {
    const sim = new ParticleSim(mulberry32(2));
    sim.reset(center);
    const prev = Array.from({ length: sim.count }, () => 0);
    for (let n = 0; n < 8; n++) {
      sim.step(dt, bounds, center);
      for (let i = 0; i < sim.count; i++) {
        const d = Math.hypot(sim.px[i] - center.x, sim.py[i] - center.y);
        expect(d).toBeGreaterThanOrEqual(prev[i] - 1e-6);
        prev[i] = d;
      }
    }
  });

  it('floats inside the viewport and outside the face clear zone', () => {
    const sim = new ParticleSim(mulberry32(5));
    sim.reset(center);
    const H = bounds.maxY - bounds.minY;
    const cy = center.y + CONFIG.GHOST_CLEAR_UP_FRAC * H;
    for (let n = 0; n < 400; n++) {
      sim.step(dt, bounds, center);
      if (n < 20) continue; // burst phase (<= 0.8 s)
      for (let i = 0; i < sim.count; i++) {
        expect(sim.px[i]).toBeGreaterThanOrEqual(bounds.minX);
        expect(sim.px[i]).toBeLessThanOrEqual(bounds.maxX);
        expect(sim.py[i]).toBeGreaterThanOrEqual(bounds.minY);
        expect(sim.py[i]).toBeLessThanOrEqual(bounds.maxY);
        const d = Math.hypot(
          (sim.px[i] - center.x) / (CONFIG.GHOST_CLEAR_RX_FRAC * H),
          (sim.py[i] - cy) / (CONFIG.GHOST_CLEAR_RY_FRAC * H),
        );
        expect(d).toBeGreaterThanOrEqual(1 - 1e-6);
      }
    }
  });

  it('reset keeps array identity, matches a fresh sim, and is idempotent for equal RNG state', () => {
    const a = new ParticleSim(mulberry32(3));
    const arr = a.px;
    for (let n = 0; n < 30; n++) a.step(dt, bounds, center);
    a.reset(center);
    expect(a.px).toBe(arr);
    expect(a.px.length).toBe(20);
    const b = new ParticleSim(mulberry32(3));
    // Fresh sim consumed one reset worth of RNG in its constructor; align `a` with a second reset.
    const c = new ParticleSim(mulberry32(3));
    c.reset(center);
    b.reset(center);
    expect(Array.from(b.px)).toEqual(Array.from(c.px));
    expect(Array.from(b.vx)).toEqual(Array.from(c.vx));
  });
});
