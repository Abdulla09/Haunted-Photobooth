import { describe, expect, it } from 'vitest';
import { buildGhostGeometry, triangleCount } from './geometry.ts';
import { KIND_CAPACITY, MAX_TRIANGLES_PER_KIND, PARTICLE_KINDS } from './kinds.ts';
import { CONFIG } from '../../app/config.ts';

describe('ghost geometry', () => {
  it('has a single ghost kind with capacity for all particles', () => {
    expect(PARTICLE_KINDS).toEqual(['ghost']);
    expect(CONFIG.PARTICLE_COUNT).toBe(20);
    expect(KIND_CAPACITY).toBeGreaterThanOrEqual(CONFIG.PARTICLE_COUNT);
  });

  it('is low-poly with a vertex color per vertex, mint body and dark eyes', () => {
    const geo = buildGhostGeometry();
    const tris = triangleCount(geo);
    expect(tris).toBeGreaterThan(0);
    expect(tris).toBeLessThanOrEqual(MAX_TRIANGLES_PER_KIND);
    const color = geo.getAttribute('color');
    expect(color.count).toBe(geo.getAttribute('position').count);
    // First vertex belongs to the body: ghost mint #8CFFC1.
    expect(color.getX(0)).toBeCloseTo(0x8c / 255, 4);
    expect(color.getY(0)).toBeCloseTo(0xff / 255, 4);
    // Last vertex belongs to an eye: midnight #0D0820.
    const last = color.count - 1;
    expect(color.getX(last)).toBeCloseTo(0x0d / 255, 4);
    expect(color.getZ(last)).toBeCloseTo(0x20 / 255, 4);
  });
});
