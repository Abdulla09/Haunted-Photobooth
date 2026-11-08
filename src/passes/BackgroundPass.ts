import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import type { Target } from '../gl/Targets.ts';
import { PALETTE_VEC3 } from '../app/palette.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import halftoneFrag from '../shaders/halftone.frag.glsl?raw';
import type { FrameState, RenderPass } from './Pass.ts';

/**
 * Monster_Mode background: opaque halftone image of the camera in indigo and
 * violet dots on midnight paper.
 */
export class BackgroundPass implements RenderPass {
  readonly name = 'background';
  private ctx!: GlContext;
  private halftone!: Program;
  private quad!: Quad;
  private readonly pickTarget: (frame: FrameState) => Target | null;

  constructor(pickTarget: (frame: FrameState) => Target | null = () => null) {
    this.pickTarget = pickTarget;
  }

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.halftone = new Program(ctx.gl, vert, halftoneFrag, 'halftone');
    this.quad = new Quad(ctx.gl);
  }

  enabled(frame: FrameState): boolean {
    return frame.mode !== 'normal';
  }

  render(frame: FrameState): void {
    const gl = this.ctx.gl;
    const target = this.pickTarget(frame);
    const res: [number, number] = target ? [target.w, target.h] : [frame.size.w, frame.size.h];

    GlState.begin(gl, target, 'off', frame.size);
    this.halftone.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frame.textures.video);
    this.halftone.setInt('uVideo', 0);
    this.halftone.setFloat('uResolution', res);
    this.halftone.setFloat('uPaper', PALETTE_VEC3.midnight);
    this.halftone.setFloat('uIndigo', PALETTE_VEC3.indigo);
    this.halftone.setFloat('uViolet', PALETTE_VEC3.violet);
    this.quad.draw();

    gl.disable(gl.BLEND);
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    this.halftone.dispose();
    this.quad.dispose();
  }
}
