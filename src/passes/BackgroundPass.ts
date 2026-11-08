import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { Program } from '../gl/Program.ts';
import { Quad } from '../gl/Quad.ts';
import type { Target } from '../gl/Targets.ts';
import { PALETTE_VEC3 } from '../app/palette.ts';
import vert from '../shaders/fullscreen.vert.glsl?raw';
import halftoneFrag from '../shaders/halftone.frag.glsl?raw';
import raysFrag from '../shaders/rays.frag.glsl?raw';
import type { FrameState, RenderPass } from './Pass.ts';

/**
 * Monster_Mode background: opaque halftone image of the camera, then
 * additive light rays radiating from the smoothed Person_Center.
 */
export class BackgroundPass implements RenderPass {
  readonly name = 'background';
  private ctx!: GlContext;
  private halftone!: Program;
  private rays!: Program;
  private quad!: Quad;
  private readonly pickTarget: (frame: FrameState) => Target | null;
  /** Smoothed Person_Center (normalized, top-left origin, mirrored). */
  private center = { x: 0.5, y: 0.5 };

  constructor(pickTarget: (frame: FrameState) => Target | null = () => null) {
    this.pickTarget = pickTarget;
  }

  /** Sets the smoothed Person_Center used by the rays (defaults to the frame center). */
  setCenter(x: number, y: number): void {
    this.center = { x, y };
  }

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.halftone = new Program(ctx.gl, vert, halftoneFrag, 'halftone');
    this.rays = new Program(ctx.gl, vert, raysFrag, 'rays');
    this.quad = new Quad(ctx.gl);
  }

  enabled(frame: FrameState): boolean {
    return frame.mode !== 'normal';
  }

  render(frame: FrameState): void {
    const gl = this.ctx.gl;
    const target = this.pickTarget(frame);
    const res: [number, number] = target ? [target.w, target.h] : [frame.size.w, frame.size.h];

    // Halftone (opaque base).
    GlState.begin(gl, target, 'off', frame.size);
    this.halftone.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frame.textures.video);
    this.halftone.setInt('uVideo', 0);
    this.halftone.setFloat('uResolution', res);
    this.halftone.setFloat('uPaper', PALETTE_VEC3.black);
    this.halftone.setFloat('uPurple', PALETTE_VEC3.deepPurple);
    this.halftone.setFloat('uOrange', PALETTE_VEC3.pumpkinOrange);
    this.halftone.setFloat('uBone', PALETTE_VEC3.bone);
    this.quad.draw();

    // Light rays (additive).
    GlState.begin(gl, target, 'additive', frame.size);
    this.rays.use();
    this.rays.setFloat('uResolution', res);
    this.rays.setFloat('uPersonCenter', [this.center.x, this.center.y]);
    this.rays.setFloat('uStepTime', frame.stepTimeSec);
    this.rays.setFloat('uGreen', PALETTE_VEC3.toxicGreen);
    this.rays.setFloat('uOrange', PALETTE_VEC3.pumpkinOrange);
    this.quad.draw();

    gl.disable(gl.BLEND);
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {
    this.halftone.dispose();
    this.rays.dispose();
    this.quad.dispose();
  }
}
