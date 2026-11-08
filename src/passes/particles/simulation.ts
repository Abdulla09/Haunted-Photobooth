import { CONFIG } from '../../app/config';

/** Pure, Three-free ghost simulation (struct-of-arrays). */

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

/** Burst phase duration range (s) and outward speed range (world units/s). */
export const BURST_MIN_S = 0.6;
export const BURST_MAX_S = 0.8;
export const MIN_SPEED = 5;
export const MAX_SPEED = 8;
const BURST_DRAG = 2.2;
/** World-space radius used for the soft viewport bounds. */
export const PARTICLE_RADIUS = 0.2;
/** Float-phase spring toward the orbit anchor, and velocity damping. */
const SPRING = 3;
const DAMPING = 3.4;
/** Ring (orbit) radii as fractions of viewport world height, scaled per ghost by `ring`. */
const RING_RX_FRAC = 0.42;
const RING_RY_FRAC = 0.42;
const BOB_AMPLITUDE = 0.07;
const MAX_TILT = 0.35;

export const BURST = 0;
export const FLOAT = 1;

export class ParticleSim {
  readonly count: number;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  /** Vertical bob offset added to py when rendering. */
  readonly bob: Float32Array;
  /** Rotation about z (radians), leaning toward the drift direction. */
  readonly tilt: Float32Array;
  /** Per-ghost size multiplier (slight variation). */
  readonly size: Float32Array;
  readonly phase: Uint8Array;
  readonly radius: Float32Array;

  private readonly age: Float32Array;
  private readonly burstLen: Float32Array;
  private readonly bobPhase: Float32Array;
  private readonly orbitAngle: Float32Array;
  private readonly orbitSpeed: Float32Array;
  private readonly ring: Float32Array;
  private time = 0;
  private readonly rng: Rng;

  constructor(rng: Rng, count: number = CONFIG.PARTICLE_COUNT) {
    this.rng = rng;
    this.count = count;
    const f = () => new Float32Array(count);
    this.px = f();
    this.py = f();
    this.vx = f();
    this.vy = f();
    this.bob = f();
    this.tilt = f();
    this.size = f();
    this.radius = f();
    this.age = f();
    this.burstLen = f();
    this.bobPhase = f();
    this.orbitAngle = f();
    this.orbitSpeed = f();
    this.ring = f();
    this.phase = new Uint8Array(count);
    this.reset({ x: 0, y: 0 });
  }

  /** Respawn particle `i` at the center with a fresh outward velocity (fixed RNG draws per call). */
  spawn(i: number, center: Point): void {
    const rng = this.rng;
    const theta = rng() * Math.PI * 2;
    const speed = MIN_SPEED + rng() * (MAX_SPEED - MIN_SPEED);
    this.px[i] = center.x;
    this.py[i] = center.y;
    this.vx[i] = Math.cos(theta) * speed;
    this.vy[i] = Math.sin(theta) * speed;
    this.phase[i] = BURST;
    this.age[i] = 0;
    this.burstLen[i] = BURST_MIN_S + rng() * (BURST_MAX_S - BURST_MIN_S);
    this.bobPhase[i] = rng() * Math.PI * 2;
    // Ghosts spread around the ring, starting near their burst direction.
    this.orbitAngle[i] = theta;
    this.orbitSpeed[i] = (rng() < 0.5 ? -1 : 1) * (0.12 + rng() * 0.2);
    this.ring[i] = 0.85 + rng() * 0.3;
    this.size[i] = 0.85 + rng() * 0.35;
    this.radius[i] = PARTICLE_RADIUS * this.size[i];
    this.bob[i] = 0;
    this.tilt[i] = 0;
  }

  /** Respawn all particles at `center` in place (no reallocation). */
  reset(center: Point): void {
    this.time = 0;
    for (let i = 0; i < this.count; i++) this.spawn(i, center);
  }

  /**
   * Advance one stepped tick. Burst phase: outward motion with drag. Float phase:
   * damped spring toward an orbiting anchor on a ring around `center`, pushed out
   * of the face clear zone and kept inside the viewport bounds.
   */
  step(dt: number, bounds: Bounds, center: Point): void {
    this.time += dt;
    const H = bounds.maxY - bounds.minY;
    const cx = center.x;
    const cy = center.y + CONFIG.GHOST_CLEAR_UP_FRAC * H;
    const rx = CONFIG.GHOST_CLEAR_RX_FRAC * H;
    const ry = CONFIG.GHOST_CLEAR_RY_FRAC * H;
    const drag = Math.exp(-BURST_DRAG * dt);
    const damp = Math.exp(-DAMPING * dt);
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt;
      if (this.phase[i] === BURST) {
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.vx[i] *= drag;
        this.vy[i] *= drag;
        if (this.age[i] >= this.burstLen[i]) this.phase[i] = FLOAT;
      } else {
        this.orbitAngle[i] += this.orbitSpeed[i] * dt;
        const a = this.orbitAngle[i];
        const k = this.ring[i];
        const tx = center.x + Math.cos(a) * RING_RX_FRAC * H * k;
        const ty = center.y + Math.sin(a) * RING_RY_FRAC * H * k;
        this.vx[i] += (tx - this.px[i]) * SPRING * dt;
        this.vy[i] += (ty - this.py[i]) * SPRING * dt;
        this.vx[i] *= damp;
        this.vy[i] *= damp;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.pushOutOfClearZone(i, cx, cy, rx, ry);
        this.keepInBounds(i, bounds);
      }
      this.bob[i] = Math.sin(this.bobPhase[i] + this.time * 2.4) * BOB_AMPLITUDE;
      this.tilt[i] = Math.max(-MAX_TILT, Math.min(MAX_TILT, -this.vx[i] * 0.12));
    }
  }

  /** Hard constraint: project the particle onto the clear-zone ellipse boundary if inside. */
  private pushOutOfClearZone(i: number, cx: number, cy: number, rx: number, ry: number): void {
    // Margin so the ghost body (not only its center) stays clear.
    const ex = rx + this.radius[i];
    const ey = ry + this.radius[i];
    let dx = this.px[i] - cx;
    let dy = this.py[i] - cy;
    let d = Math.hypot(dx / ex, dy / ey);
    if (d >= 1) return;
    if (d < 1e-6) {
      dx = ex * Math.cos(this.orbitAngle[i]);
      dy = ey * Math.sin(this.orbitAngle[i]);
      d = 1;
    }
    this.px[i] = cx + dx / d;
    this.py[i] = cy + dy / d;
    // Remove the inward velocity component.
    const nx = dx / (ex * ex);
    const ny = dy / (ey * ey);
    const nl = Math.hypot(nx, ny) || 1;
    const vn = (this.vx[i] * nx + this.vy[i] * ny) / nl;
    if (vn < 0) {
      this.vx[i] -= (vn * nx) / nl;
      this.vy[i] -= (vn * ny) / nl;
    }
  }

  /** Soft viewport bounds: clamp and reflect the velocity component that points outward. */
  private keepInBounds(i: number, b: Bounds): void {
    const r = this.radius[i];
    if (this.px[i] < b.minX + r) {
      this.px[i] = b.minX + r;
      if (this.vx[i] < 0) this.vx[i] *= -0.3;
    } else if (this.px[i] > b.maxX - r) {
      this.px[i] = b.maxX - r;
      if (this.vx[i] > 0) this.vx[i] *= -0.3;
    }
    if (this.py[i] < b.minY + r) {
      this.py[i] = b.minY + r;
      if (this.vy[i] < 0) this.vy[i] *= -0.3;
    } else if (this.py[i] > b.maxY - r) {
      this.py[i] = b.maxY - r;
      if (this.vy[i] > 0) this.vy[i] *= -0.3;
    }
  }
}
