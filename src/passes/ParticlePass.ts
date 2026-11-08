import * as THREE from 'three';
import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import type { FrameState, RenderPass } from './Pass.ts';

/**
 * Particle layer rendered by Three.js into its own 4x MSAA RGBA8 render target
 * on the shared WebGL2 context. The raw pipeline samples `texture` afterwards
 * (premultiplied alpha). This file family is the only place `three` is imported.
 *
 * State hand-off: Boundary 1 (raw -> Three) is `GlState.applyBaseline` followed
 * by `renderer.resetState()`; Boundary 2 (Three -> raw) is `GlState.applyBaseline`.
 */
export class ParticlePass implements RenderPass {
  readonly name = 'particles';
  private ctx!: GlContext;
  private renderer: THREE.WebGLRenderer | null = null;
  private target: THREE.WebGLRenderTarget | null = null;
  private failed = false;
  private failureReason: string | null = null;
  private w = 1;
  private h = 1;

  init(ctx: GlContext): void {
    this.ctx = ctx;
    this.w = Math.max(1, ctx.width);
    this.h = Math.max(1, ctx.height);
    try {
      THREE.ColorManagement.enabled = false; // before any Three object is created
      const renderer = new THREE.WebGLRenderer({ canvas: ctx.canvas, context: ctx.gl });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setClearColor(0x000000, 0);
      // Never call setSize / setPixelRatio: the canvas size is owned by GlContext.
      this.renderer = renderer;
      this.target = this.createTarget(this.w, this.h);
      this.selfTest();
    } catch (err) {
      this.disableWith(err instanceof Error ? err.message : String(err));
    }
  }

  /** True once the pass has been disabled by a failed self-test or init. */
  get isFailed(): boolean {
    return this.failed;
  }

  get failure(): string | null {
    return this.failureReason;
  }

  /** The particle texture handle (premultiplied RGBA8, resolved from MSAA), or null. */
  get texture(): WebGLTexture | null {
    return this.textureHandle();
  }

  enabled(frame: FrameState): boolean {
    return !this.failed && frame.burstStartMs !== null;
  }

  render(_frame: FrameState): void {
    const renderer = this.renderer;
    const target = this.target;
    if (this.failed || !renderer || !target) return;
    const gl = this.ctx.gl;
    // Boundary 1: raw -> Three.
    GlState.applyBaseline(gl);
    renderer.resetState();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    // Scene rendering is added in later tasks.
    renderer.setRenderTarget(null);
    // Boundary 2: Three -> raw.
    GlState.applyBaseline(gl);
    GlState.assertBaseline(gl);
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    if (this.failed || !this.renderer) return;
    this.target?.setSize(this.w, this.h);
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
    this.renderer?.dispose();
    this.renderer = null;
  }

  private createTarget(w: number, h: number): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.NoColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: true,
      samples: 4,
    });
    return rt;
  }

  private textureHandle(): WebGLTexture | null {
    if (!this.renderer || !this.target) return null;
    const props = this.renderer.properties.get(this.target.texture) as { __webglTexture?: WebGLTexture };
    return props.__webglTexture ?? null;
  }

  /** Renders one empty frame and verifies the internal texture handle is usable. */
  private selfTest(): void {
    const renderer = this.renderer!;
    const gl = this.ctx.gl;
    GlState.applyBaseline(gl);
    renderer.resetState();
    renderer.setRenderTarget(this.target);
    renderer.clear(true, true, false);
    renderer.setRenderTarget(null);
    GlState.applyBaseline(gl);
    const handle = this.textureHandle();
    if (!handle || !gl.isTexture(handle)) {
      throw new Error('ParticlePass self-test failed: Three render target texture handle is unavailable');
    }
  }

  private disableWith(reason: string): void {
    this.failed = true;
    this.failureReason = reason;
    console.warn('[ParticlePass] disabled:', reason);
    try {
      this.target?.dispose();
      this.renderer?.dispose();
    } catch {
      // ignore cleanup errors
    }
    this.target = null;
    this.renderer = null;
  }
}
