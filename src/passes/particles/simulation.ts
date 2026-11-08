import { CONFIG } from '../../app/config';
import { KIND_COUNT, PARTICLE_KINDS, type ParticleKind } from './kinds';

/** Pure, Three-free particle simulation (struct-of-arrays). */

export type Rng = () => number;
export interface Point {
  x: number;
  y: number;
}
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const MIN_SPEED = 0.8;
export const MAX_SPEED = 2.4;
/** Small positive z velocity (world units/s) so particles drift toward the camera. */
export const MAX_Z_SPEED = 0.3;
/** World-space radius used for out-of-bounds tests. */
export const PARTICLE_RADIUS = 0.15;
/** Number of palette colors a particle may pick from. */
export const COLOR_COUNT = 4;

/** 18 or 19 per kind, summing to `total`; the remainder goes to a seeded random subset. */
export function distributeKinds(total: number, rng: Rng): Record<ParticleKind, number> {
  const base = Math.floor(total / KIND_COUNT);
  const remainder = total - base * KIND_COUNT;
  const order = PARTICLE_KINDS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const counts = {} as Record<ParticleKind, number>;
  for (const k of PARTICLE_KINDS) counts[k] = base;
  for (let i = 0; i < remainder; i++) counts[PARTICLE_KINDS[order[i]]] += 1;
  return counts;
}

export class ParticleSim {
  readonly count: number;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  /** Rotation axis (unit) per particle. */
  readonly ax: Float32Array;
  readonly ay: Float32Array;
  readonly az: Float32Array;
  readonly angle: Float32Array;
  readonly spin: Float32Array;
  /** Index into PARTICLE_KINDS. */
  readonly kind: Uint8Array;
  readonly colorIndex: Uint8Array;
  readonly radius: Float32Array;

  private readonly rng: Rng;

  constructor(rng: Rng, count: number = CONFIG.PARTICLE_COUNT) {
    this.rng = rng;
    this.count = count;
    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.pz = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.vz = new Float32Array(count);
    this.ax = new Float32Array(count);
    this.ay = new Float32Array(count);
    this.az = new Float32Array(count);
    this.angle = new Float32Array(count);
    this.spin = new Float32Array(count);
    this.kind = new Uint8Array(count);
    this.colorIndex = new Uint8Array(count);
    this.radius = new Float32Array(count).fill(PARTICLE_RADIUS);

    const counts = distributeKinds(count, rng);
    let i = 0;
    PARTICLE_KINDS.forEach((k, ki) => {
      for (let n = 0; n < counts[k]; n++) this.kind[i++] = ki;
    });
    this.reset({ x: 0, y: 0 });
  }

  /** Respawn particle `i` at the center with a fresh outward velocity. */
  spawn(i: number, center: Point): void {
    const rng = this.rng;
    const theta = rng() * Math.PI * 2;
    const speed = MIN_SPEED + rng() * (MAX_SPEED - MIN_SPEED);
    this.px[i] = center.x;
    this.py[i] = center.y;
    this.pz[i] = 0;
    this.vx[i] = Math.cos(theta) * speed;
    this.vy[i] = Math.sin(theta) * speed;
    this.vz[i] = rng() * MAX_Z_SPEED;
    // Random unit rotation axis.
    const az = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - az * az);
    this.ax[i] = r * Math.cos(phi);
    this.ay[i] = r * Math.sin(phi);
    this.az[i] = az;
    this.angle[i] = rng() * Math.PI * 2;
    this.spin[i] = (rng() * 2 - 1) * 4;
    this.colorIndex[i] = Math.floor(rng() * COLOR_COUNT);
  }

  /** Respawn all particles at `center` in place (no reallocation). */
  reset(center: Point): void {
    for (let i = 0; i < this.count; i++) this.spawn(i, center);
  }

  /** Advance one stepped tick; out-of-bounds particles respawn at `center`. */
  step(dt: number, bounds: Bounds, center: Point): void {
    for (let i = 0; i < this.count; i++) {
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      this.angle[i] += this.spin[i] * dt;
      const r = this.radius[i];
      if (
        this.px[i] + r < bounds.minX ||
        this.px[i] - r > bounds.maxX ||
        this.py[i] + r < bounds.minY ||
        this.py[i] - r > bounds.maxY
      ) {
        this.spawn(i, center);
      }
    }
  }
}
