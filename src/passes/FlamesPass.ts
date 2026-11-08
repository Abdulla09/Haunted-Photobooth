import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import type { Target } from '../gl/Targets.ts';
import { PALETTE_VEC3 } from '../app/palette.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import frag from '../shaders/flames.frag.glsl?raw';
import type { FrameState, RenderPass } from './Pass.ts';

/**
 * A single soft mint ghost-fire rising behind the person, drawn premultiplied
 * over the target. Disabled without a segmenter.
 */
export class FlamesPass implements RenderPass {
  readonly name = 'flames';
  private ctx!: GlContext;
  private program!: Program;
  private quad!: Quad;
  private readonly pickTarget: (frame: FrameState) => Target | null;
  private readonly maskBlurTexture: (frame: FrameState) => WebGLTexture | null;

  /**
   * @param pickTarget target to draw into (null = default framebuffer)
   * @param maskBlurTexture blurred mask source (typically `MaskBlurPass.outputTexture`)
   */
  constructor(
    pickTarget: (frame: FrameState) => Target | null,
    maskBlurTexture: (frame: FrameState) => WebGLTexture | null,
  ) {
    this.pickTarget = pickTarget;
    this.maskBlurTexture = maskBlurTexture;
  }

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.program = new Program(ctx.gl, vert, frag, 'flames');
    this.quad = new Quad(ctx.gl);
  }

  enabled(frame: FrameState): boolean {
    return frame.mode !== 'normal' && frame.hasSegmenter;
  }

  render(frame: FrameState): void {
    const tex = this.maskBlurTexture(frame);
    if (!tex) return;
    const gl = this.ctx.gl;
    const target = this.pickTarget(frame);
    GlState.begin(gl, target, 'premultiplied', frame.size);
    this.program.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this.program.setInt('uMaskBlur', 0);
    this.program.setFloat('uResolution', target ? [target.w, target.h] : [frame.size.w, frame.size.h]);
    this.program.setFloat('uStepTime', frame.stepTimeSec);
    this.program.setFloat('uMint', PALETTE_VEC3.ghostMint);
    this.program.setFloat('uMintShadow', PALETTE_VEC3.mintShadow);
    this.quad.draw();
    gl.disable(gl.BLEND);
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    if (!this.ctx) return;
    this.program.dispose();
    this.quad.dispose();
  }
}
