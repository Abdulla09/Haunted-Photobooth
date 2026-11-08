import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import type { Target } from '../gl/Targets.ts';
import type { Vec3 } from '../app/palette.ts';
import type { FrameState, RenderPass } from './Pass.ts';

/** Clears a target to an opaque solid color (the Monster_Mode base layer). */
export class SolidBasePass implements RenderPass {
  readonly name = 'solid-base';
  private ctx!: GlContext;
  private readonly pickTarget: (frame: FrameState) => Target | null;
  private readonly color: Vec3;

  constructor(pickTarget: (frame: FrameState) => Target | null, color: Vec3) {
    this.pickTarget = pickTarget;
    this.color = color;
  }

  init(ctx: GlContext): void {
    this.ctx = ctx;
  }

  enabled(_frame: FrameState): boolean {
    return true;
  }

  render(frame: FrameState): void {
    const gl = this.ctx.gl;
    GlState.begin(gl, this.pickTarget(frame), 'off', frame.size);
    gl.clearColor(this.color[0], this.color[1], this.color[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(0, 0, 0, 0); // restore baseline
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {}
}
