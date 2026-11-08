import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import frag from '../shaders/present.frag.glsl?raw';
import type { FrameState, RenderPass } from './Pass.ts';

/** Copies the monster target to the default framebuffer. */
export class PresentPass implements RenderPass {
  readonly name = 'present';
  private program!: Program;
  private quad!: Quad;
  private ctx!: GlContext;

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.program = new Program(ctx.gl, vert, frag, 'present');
    this.quad = new Quad(ctx.gl);
  }

  enabled(frame: FrameState): boolean {
    return frame.mode === 'monster';
  }

  render(frame: FrameState): void {
    const gl = this.ctx.gl;
    GlState.begin(gl, null, 'off', frame.size);
    this.program.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frame.targets.monster.tex);
    this.program.setInt('uSource', 0);
    this.quad.draw();
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    this.program.dispose();
    this.quad.dispose();
  }
}
