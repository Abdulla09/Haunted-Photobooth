import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import frag from '../shaders/composite.frag.glsl?raw';
import type { FrameState, RenderPass } from './Pass.ts';
import type { ParticlePass } from './ParticlePass.ts';

/**
 * Blends the particle texture (premultiplied, resolved from the MSAA target)
 * over `targets.monster` with blendFunc(ONE, ONE_MINUS_SRC_ALPHA).
 */
export class ParticleCompositePass implements RenderPass {
  readonly name = 'particleComposite';
  private program!: Program;
  private quad!: Quad;
  private ctx!: GlContext;

  private readonly particles: ParticlePass;

  constructor(particles: ParticlePass) {
    this.particles = particles;
  }

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.program = new Program(ctx.gl, vert, frag, 'particleComposite');
    this.quad = new Quad(ctx.gl);
  }

  enabled(frame: FrameState): boolean {
    return this.particles.enabled(frame);
  }

  render(frame: FrameState): void {
    const tex = this.particles.texture;
    if (!tex) return;
    const gl = this.ctx.gl;
    GlState.begin(gl, frame.targets.monster, 'premultiplied');
    this.program.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this.program.setInt('uSource', 0);
    this.quad.draw();
    GlState.begin(gl, frame.targets.monster, 'off');
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    this.program.dispose();
    this.quad.dispose();
  }
}
