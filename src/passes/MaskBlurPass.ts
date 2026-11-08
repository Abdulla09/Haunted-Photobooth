import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import { createTarget, disposeTarget, type Target } from '../gl/Targets.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import frag from '../shaders/maskblur.frag.glsl?raw';
import type { FrameState, RenderPass } from './Pass.ts';

const DIVISOR = 4;

/**
 * Blurs the person mask with two separable 9-tap Gaussian passes at 1/4
 * resolution. Re-runs only when `maskVersion` changes (or targets are recreated).
 * The result is available as `outputTexture` (R channel, mask UV orientation).
 */
export class MaskBlurPass implements RenderPass {
  readonly name = 'maskBlur';
  private ctx!: GlContext;
  private program!: Program;
  private quad!: Quad;
  private temp: Target | null = null;
  private out: Target | null = null;
  private lastVersion = -1;
  private dirty = true;
  private w = 0;
  private h = 0;

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.program = new Program(ctx.gl, vert, frag, 'maskblur');
    this.quad = new Quad(ctx.gl);
  }

  /** Blurred mask texture, or null before the first resize/render. */
  get outputTexture(): WebGLTexture | null {
    return this.out ? this.out.tex : null;
  }

  enabled(frame: FrameState): boolean {
    return frame.hasSegmenter;
  }

  render(frame: FrameState): void {
    if (!this.out || !this.temp) this.allocate(frame.size.w, frame.size.h);
    if (!this.dirty && frame.maskVersion === this.lastVersion) return;
    const temp = this.temp!;
    const out = this.out!;
    const gl = this.ctx.gl;
    this.program.use();
    this.program.setInt('uSrc', 0);

    GlState.begin(gl, temp, 'off');
    gl.bindTexture(gl.TEXTURE_2D, frame.textures.mask);
    this.program.setFloat('uStep', [1 / temp.w, 0]);
    this.quad.draw();

    GlState.begin(gl, out, 'off');
    gl.bindTexture(gl.TEXTURE_2D, temp.tex);
    this.program.setFloat('uStep', [0, 1 / out.h]);
    this.quad.draw();

    this.lastVersion = frame.maskVersion;
    this.dirty = false;
  }

  resize(w: number, h: number): void {
    if (!this.ctx) return;
    this.allocate(w, h);
  }

  private allocate(w: number, h: number): void {
    const tw = Math.max(1, Math.round(w / DIVISOR));
    const th = Math.max(1, Math.round(h / DIVISOR));
    if (this.out && this.temp && tw === this.w && th === this.h) return;
    this.releaseTargets();
    const gl = this.ctx.gl;
    this.temp = createTarget(gl, tw, th);
    this.out = createTarget(gl, tw, th);
    this.w = tw;
    this.h = th;
    this.dirty = true;
  }

  private releaseTargets(): void {
    const gl = this.ctx.gl;
    if (this.temp) disposeTarget(gl, this.temp);
    if (this.out) disposeTarget(gl, this.out);
    this.temp = null;
    this.out = null;
  }

  dispose(): void {
    if (!this.ctx) return;
    this.releaseTargets();
    this.program.dispose();
    this.quad.dispose();
  }
}
