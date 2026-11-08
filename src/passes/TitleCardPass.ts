import { CONFIG } from '../app/config';
import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import vert from '../shaders/titlecard.vert.glsl?raw';
import frag from '../shaders/titlecard.frag.glsl?raw';
import { bakeTitleAtlas, uploadAtlas } from '../titleCard/atlas';
import { layoutRows, ROW_STAGGER_MS, slamProgress } from '../titleCard/layout';
import type { FrameState, RenderPass } from './Pass.ts';

const SHAKE_STEPS = 2;
const SHAKE_PX = 7;
const SHAKE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [SHAKE_PX, -SHAKE_PX * 0.5],
  [-SHAKE_PX, SHAKE_PX * 0.5],
];

/** Scale 1.8 -> 1.0 with overshoot (ease-out-back). */
export function slamScale(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const q = p - 1;
  const eased = 1 + c3 * q * q * q + c1 * q * q;
  return 1 + 0.8 * (1 - eased);
}

/** Draws the baked title card over `targets.monster` (premultiplied). */
export class TitleCardPass implements RenderPass {
  readonly name = 'titleCard';
  private program!: Program;
  private vao: WebGLVertexArrayObject | null = null;
  private atlas: WebGLTexture | null = null;
  private ctx!: GlContext;

  init(ctx: GlContext): void {
    const gl = ctx.gl;
    this.ctx = ctx;
    this.program = new Program(gl, vert, frag, 'titleCard');
    this.vao = gl.createVertexArray();
    // Bake once; premultiply is on only inside uploadAtlas.
    this.atlas = uploadAtlas(gl, bakeTitleAtlas());
  }

  enabled(frame: FrameState): boolean {
    return frame.burstStartMs !== null;
  }

  render(frame: FrameState): void {
    if (frame.burstStartMs === null || !this.atlas) return;
    const gl = this.ctx.gl;
    const since = frame.nowMs - frame.burstStartMs;
    const { w, h } = frame.size;
    const rows = layoutRows(w, h);
    const stepMs = 1000 / CONFIG.STEP_RATE;

    GlState.begin(gl, frame.targets.monster, 'premultiplied');
    this.program.use();
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    this.program.setInt('uAtlas', 0);
    this.program.setFloat('uCanvas', [w, h]);

    for (const row of rows) {
      const p = slamProgress(since, row.index);
      if (p <= 0) continue;
      // Two stepped shake frames right after landing.
      const landed = since - row.index * ROW_STAGGER_MS - CONFIG.SLAM_MS;
      const shakeStep = landed >= 0 ? Math.floor(landed / stepMs) : SHAKE_STEPS;
      const shake = shakeStep < SHAKE_STEPS ? SHAKE_OFFSETS[shakeStep] : [0, 0];

      this.program.setFloat('uCenter', [row.cx, row.cy]);
      this.program.setFloat('uHalfSize', [row.width / 2, row.height / 2]);
      this.program.setFloat('uTilt', row.tilt);
      this.program.setFloat('uScale', slamScale(p));
      this.program.setFloat('uShake', [shake[0], shake[1]]);
      this.program.setFloat('uRow', row.index);
      this.program.setFloat('uAlpha', Math.min(1, p * 3));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindVertexArray(null);
    GlState.begin(gl, frame.targets.monster, 'off');
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    const gl = this.ctx.gl;
    this.program.dispose();
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.atlas) gl.deleteTexture(this.atlas);
    this.vao = null;
    this.atlas = null;
  }
}
