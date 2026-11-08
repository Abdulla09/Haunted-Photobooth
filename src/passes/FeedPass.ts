import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import type { Target } from '../gl/Targets.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import frag from '../shaders/feed.frag.glsl?raw';
import type { FrameState, RenderPass } from './Pass.ts';

/** Draws the mirrored camera feed to a target (null = default framebuffer). */
export class FeedPass implements RenderPass {
  readonly name = 'feed';
  private program!: Program;
  private quad!: Quad;
  private ctx!: GlContext;

  private readonly pickTarget: (frame: FrameState) => Target | null;

  constructor(pickTarget: (frame: FrameState) => Target | null = () => null) {
    this.pickTarget = pickTarget;
  }

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.program = new Program(ctx.gl, vert, frag, 'feed');
    this.quad = new Quad(ctx.gl);
  }

  enabled(_frame: FrameState): boolean {
    return true;
  }

  render(frame: FrameState): void {
    const gl = this.ctx.gl;
    GlState.begin(gl, this.pickTarget(frame), 'off', frame.size);
    this.program.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frame.textures.video);
    this.program.setInt('uVideo', 0);
    this.quad.draw();
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    this.program.dispose();
    this.quad.dispose();
  }
}
