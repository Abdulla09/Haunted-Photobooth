import type { GlContext } from '../gl/GlContext.ts';
import type { Target } from '../gl/Targets.ts';

export type Mode = 'normal' | 'transitioning' | 'monster';

/** Placeholder for the shatter timeline snapshot (defined in Phase 5). */
export type TransitionSnapshot = Record<string, unknown>;

export interface FrameState {
  gl: WebGL2RenderingContext;
  nowMs: number;
  step: number;
  stepTimeSec: number;
  mode: Mode;
  burstStartMs: number | null;
  size: { w: number; h: number };
  textures: { video: WebGLTexture; mask: WebGLTexture; maskBlur: WebGLTexture };
  maskVersion: number;
  personCenter: { x: number; y: number };
  hasSegmenter: boolean;
  transition: { progress: TransitionSnapshot; origin: { x: number; y: number } } | null;
  targets: { monster: Target; normal: Target };
}

export interface RenderPass {
  readonly name: string;
  init(ctx: GlContext): void;
  enabled(frame: FrameState): boolean;
  /** Writes only to the target it was told to. */
  render(frame: FrameState): void;
  resize(w: number, h: number): void;
  dispose(): void;
}
