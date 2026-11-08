import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import { createTarget, disposeTarget, resizeTarget } from '../gl/Targets.ts';
import type { Target } from '../gl/Targets.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import kuwaharaFrag from '../shaders/kuwahara_gradient.frag.glsl?raw';
import personFrag from '../shaders/person.frag.glsl?raw';
import type { FrameState, RenderPass } from './Pass.ts';

const KUWAHARA_RADIUS = 3;

/**
 * Cel-shaded person: Kuwahara + gradient map at half resolution, then masked
 * with a hard orange rim light, premultiplied over the target.
 * Without a segmenter it draws the full stylized frame with no rim.
 */
export class PersonPass implements RenderPass {
  readonly name = 'person';
  private ctx!: GlContext;
  private kuwahara!: Program;
  private person!: Program;
  private quad!: Quad;
  private half: Target | null = null;
  private readonly pickTarget: (frame: FrameState) => Target | null;

  constructor(pickTarget: (frame: FrameState) => Target | null = () => null) {
    this.pickTarget = pickTarget;
  }

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.kuwahara = new Program(ctx.gl, vert, kuwaharaFrag, 'kuwahara_gradient');
    this.person = new Program(ctx.gl, vert, personFrag, 'person');
    this.quad = new Quad(ctx.gl);
  }

  enabled(frame: FrameState): boolean {
    return frame.mode !== 'normal';
  }

  render(frame: FrameState): void {
    const gl = this.ctx.gl;
    const hw = Math.max(1, Math.floor(frame.size.w / 2));
    const hh = Math.max(1, Math.floor(frame.size.h / 2));
    if (!this.half) this.half = createTarget(gl, hw, hh);
    else if (this.half.w !== hw || this.half.h !== hh) this.half = resizeTarget(gl, this.half, hw, hh);
    const half = this.half;

    // Stage 1: Kuwahara then gradient map at half resolution.
    GlState.begin(gl, half, 'off');
    this.kuwahara.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frame.textures.video);
    this.kuwahara.setInt('uVideo', 0);
    this.kuwahara.setFloat('uTexel', [1 / half.w, 1 / half.h]);
    this.kuwahara.setInt('uRadius', KUWAHARA_RADIUS);
    this.quad.draw();

    // Stage 2: mask, rim light, premultiplied output.
    GlState.begin(gl, this.pickTarget(frame), 'premultiplied', frame.size);
    this.person.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, half.tex);
    this.person.setInt('uStyled', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, frame.textures.mask);
    this.person.setInt('uMask', 1);
    this.person.setFloat('uTexel', [1 / frame.size.w, 1 / frame.size.h]);
    this.person.setInt('uHasSegmenter', frame.hasSegmenter ? 1 : 0);
    this.quad.draw();
    gl.activeTexture(gl.TEXTURE0);
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    if (this.half) disposeTarget(this.ctx.gl, this.half);
    this.half = null;
    this.kuwahara.dispose();
    this.person.dispose();
    this.quad.dispose();
  }
}
