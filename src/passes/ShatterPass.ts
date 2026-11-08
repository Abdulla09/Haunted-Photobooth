import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import frag from '../shaders/shatter.frag.glsl?raw';
import { clampOrigin } from '../shatter/timeline.ts';
import { generateWedges, type Wedges } from '../shatter/wedges.ts';
import type { FrameState, RenderPass } from './Pass.ts';

/** Shatters the normal frame into wedges revealing the monster frame. Enabled only in Transitioning. */
export class ShatterPass implements RenderPass {
  readonly name = 'shatter';
  private program!: Program;
  private quad!: Quad;
  private ctx!: GlContext;
  private wedges: Wedges = generateWedges(1);
  private order = new Float32Array(13);

  constructor() {
    this.setWedges(this.wedges);
  }

  /** Sets the wedge layout (call per transition with a fresh seed). */
  setWedges(w: Wedges): void {
    this.wedges = w;
    // Topmost first: highest z rank wins.
    const idx = w.z.map((_, i) => i).sort((a, b) => w.z[b] - w.z[a]);
    this.order = Float32Array.from(idx);
  }

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.program = new Program(ctx.gl, vert, frag, 'shatter');
    this.quad = new Quad(ctx.gl);
  }

  enabled(frame: FrameState): boolean {
    return frame.mode === 'transitioning' && frame.transition !== null;
  }

  render(frame: FrameState): void {
    const t = frame.transition;
    if (!t) return;
    const gl = this.ctx.gl;
    const p = this.program;
    const w = this.wedges;
    GlState.begin(gl, null, 'off', frame.size);
    p.use();

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frame.targets.normal.tex);
    p.setInt('uNormal', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, frame.targets.monster.tex);
    p.setInt('uMonster', 1);

    const o = clampOrigin(t.origin);
    p.setFloat('uOrigin', [o.x, o.y]);
    p.setFloat('uAspect', frame.size.w / Math.max(1, frame.size.h));
    p.setFloat('uCrack', t.progress.crack);
    p.setFloat('uSeparate', t.progress.separate);
    this.setArray('uBoundaries', w.boundariesRad);
    this.setArray('uDir', w.dirRad);
    this.setArray('uSpeed', w.speed);
    this.setArray('uSpin', w.spin);
    this.setArray('uOrder', this.order);
    this.quad.draw();
  }

  private setArray(name: string, v: ArrayLike<number>): void {
    const l = this.program.loc(name);
    if (l) this.ctx.gl.uniform1fv(l, Float32Array.from(v as ArrayLike<number>));
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    this.program.dispose();
    this.quad.dispose();
  }
}
