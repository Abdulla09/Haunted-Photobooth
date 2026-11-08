import { describe, expect, it } from 'vitest';
import { buildGeometry, triangleCount } from './geometry.ts';
import { KIND_CAPACITY, MAX_TRIANGLES_PER_KIND, PARTICLE_KINDS } from './kinds.ts';
import { createGradientMap } from './toon.ts';

describe('particle geometry', () => {
  it('has eight kinds with capacity 19', () => {
    expect(PARTICLE_KINDS).toHaveLength(8);
    expect(KIND_CAPACITY).toBe(19);
  });

  for (const kind of PARTICLE_KINDS) {
    it(`${kind} is low-poly with palette vertex colors`, () => {
      const geo = buildGeometry(kind);
      const tris = triangleCount(geo);
      expect(tris).toBeGreaterThan(0);
      expect(tris).toBeLessThanOrEqual(MAX_TRIANGLES_PER_KIND);
      expect(geo.getAttribute('color').count).toBe(geo.getAttribute('position').count);
    });
  }

  it('gradient map has four texels', () => {
    const tex = createGradientMap();
    expect(tex.image.width).toBe(4);
    expect(tex.image.height).toBe(1);
  });
});
