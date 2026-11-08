import * as THREE from 'three';
import { CONFIG } from '../app/config.ts';
import { mulberry32 } from '../app/rng.ts';
import type { GlContext } from '../gl/GlContext.ts';
import { GlState } from '../gl/GlState.ts';
import { createParticleMeshes, type ParticleMeshSet } from './particles/toon.ts';
import { PARTICLE_KINDS } from './particles/kinds.ts';
import { ParticleSim, type Bounds, type Point } from './particles/simulation.ts';
import type { FrameState, RenderPass } from './Pass.ts';

const CAMERA_FOV = 40;
const CAMERA_Z = 6;
/** Uniform instance scale (geometries are about one unit wide). */
const INSTANCE_SCALE = 0.2;
/** Clear radius around the Person_Center as a fraction of viewport world height. */
const CLEAR_RADIUS_FRAC = 0.28;
const MIN_NEAR_SCALE = 0.05;
/** Largest number of simulation steps applied for a single rendered frame. */
const MAX_STEPS_PER_FRAME = 3;
const STEP_DT = 1 / CONFIG.STEP_RATE;

/**
 * Particle layer rendered by Three.js into its own 4x MSAA RGBA8 render target
 * on the shared WebGL2 context. The raw pipeline samples `texture` afterwards
 * (premultiplied alpha). This file family is the only place `three` is imported.
 *
 * The MSAA target's `texture` is the resolved single-sample texture (Three
 * resolves the multisampled renderbuffer into it at the end of `render`), so
 * the handle returned by `texture` is safe to sample directly.
 *
 * State hand-off: Boundary 1 (raw -> Three) is `GlState.applyBaseline` followed
 * by `renderer.resetState()`; Boundary 2 (Three -> raw) is `GlState.applyBaseline`.
 */
export class ParticlePass implements RenderPass {
  readonly name = 'particles';
  private ctx!: GlContext;
  private renderer: THREE.WebGLRenderer | null = null;
  private target: THREE.WebGLRenderTarget | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private meshes: ParticleMeshSet | null = null;
  private lights: THREE.Light[] = [];
  private sim: ParticleSim | null = null;
  private failed = false;
  private failureReason: string | null = null;
  private visible = true;
  private w = 1;
  private h = 1;
  /** Particle spawn point in world units, derived from the normalized center. */
  private worldCenter: Point = { x: 0, y: 0 };
  private lastStep: number | null = null;
  private matricesDirty = true;
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpAxis = new THREE.Vector3();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpScale = new THREE.Vector3(INSTANCE_SCALE, INSTANCE_SCALE, INSTANCE_SCALE);

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
      this.buildScene();
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

  get isVisible(): boolean {
    return this.visible;
  }

  /** World-space rectangle visible on the z = 0 plane. */
  viewportWorldBounds(): Bounds {
    const halfH = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
    const halfW = halfH * (this.w / this.h);
    return { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH };
  }

  /** Normalized screen point (origin top-left, y down) to world coordinates on z = 0. */
  private toWorld(p: Point): Point {
    const b = this.viewportWorldBounds();
    return { x: b.minX + p.x * (b.maxX - b.minX), y: b.maxY - p.y * (b.maxY - b.minY) };
  }

  /**
   * Respawns every particle at the normalized `center`, keeping all GPU
   * resources. Idempotent: calling it again with the same center is a no-op in effect.
   */
  reset(center: Point): void {
    this.worldCenter = this.toWorld(center);
    this.sim?.reset(this.worldCenter);
    this.lastStep = null;
    this.matricesDirty = true;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  enabled(frame: FrameState): boolean {
    return !this.failed && this.visible && frame.burstStartMs !== null;
  }

  render(frame: FrameState): void {
    const renderer = this.renderer;
    const target = this.target;
    const scene = this.scene;
    const camera = this.camera;
    if (this.failed || !renderer || !target || !scene || !camera) return;
    const gl = this.ctx.gl;

    // CPU simulation and matrix rewrite only when the stepped clock advanced.
    if (this.lastStep === null || frame.step !== this.lastStep) {
      const steps =
        this.lastStep === null ? 0 : Math.min(MAX_STEPS_PER_FRAME, Math.max(1, frame.step - this.lastStep));
      this.lastStep = frame.step;
      if (steps > 0) {
        const bounds = this.viewportWorldBounds();
        for (let i = 0; i < steps; i++) this.sim!.step(STEP_DT, bounds, this.worldCenter);
        this.matricesDirty = true;
      }
    }
    if (this.matricesDirty) {
      this.writeMatrices();
      this.matricesDirty = false;
    }

    // Boundary 1: raw -> Three.
    GlState.applyBaseline(gl);
    renderer.resetState();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
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
    if (this.camera) {
      this.camera.aspect = this.w / this.h;
      this.camera.updateProjectionMatrix();
    }
    this.matricesDirty = true;
  }

  dispose(): void {
    this.meshes?.dispose();
    this.meshes = null;
    for (const l of this.lights) l.dispose?.();
    this.lights = [];
    this.scene?.clear();
    this.scene = null;
    this.camera = null;
    this.sim = null;
    this.target?.dispose();
    this.target = null;
    this.renderer?.dispose();
    this.renderer = null;
  }

  private buildScene(): void {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, this.w / this.h, 0.1, 50);
    camera.position.set(0, 0, CAMERA_Z);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const dir = new THREE.DirectionalLight(0xffffff, 2.2);
    dir.position.set(1.5, 2, 3);
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(dir, ambient);
    this.lights = [dir, ambient];
    const meshes = createParticleMeshes();
    meshes.addTo(scene);
    this.scene = scene;
    this.camera = camera;
    this.meshes = meshes;
    this.sim = new ParticleSim(mulberry32(0x9057), CONFIG.PARTICLE_COUNT);
    this.worldCenter = this.toWorld({ x: 0.5, y: 0.5 });
    this.sim.reset(this.worldCenter);
    this.matricesDirty = true;
  }

  /** Writes instance matrices for every particle (called only after a sim change). */
  private writeMatrices(): void {
    const sim = this.sim;
    const meshes = this.meshes;
    if (!sim || !meshes) return;
    const counts = new Array<number>(PARTICLE_KINDS.length).fill(0);
    const vb = this.viewportWorldBounds();
    const clearR = (vb.maxY - vb.minY) * CLEAR_RADIUS_FRAC;
    const cwx = this.worldCenter.x;
    const cwy = this.worldCenter.y;
    for (let i = 0; i < sim.count; i++) {
      const ki = sim.kind[i];
      const slot = counts[ki]++;
      const km = meshes.kinds[ki];
      this.tmpAxis.set(sim.ax[i], sim.ay[i], sim.az[i]);
      this.tmpQuat.setFromAxisAngle(this.tmpAxis, sim.angle[i]);
      this.tmpPos.set(sim.px[i], sim.py[i], sim.pz[i]);
      const dist = Math.hypot(sim.px[i] - cwx, sim.py[i] - cwy);
      const t = Math.min(1, Math.max(0, dist / clearR));
      const grow = MIN_NEAR_SCALE + (1 - MIN_NEAR_SCALE) * (t * t * (3 - 2 * t));
      this.tmpScale.setScalar(INSTANCE_SCALE * grow);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      km.mesh.setMatrixAt(slot, this.tmpMatrix);
    }
    meshes.kinds.forEach((km, ki) => {
      km.mesh.count = counts[ki];
      km.outline.count = counts[ki];
      km.mesh.instanceMatrix.needsUpdate = true;
    });
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

  /** Renders one frame and verifies the internal texture handle is usable. */
  private selfTest(): void {
    const renderer = this.renderer!;
    const gl = this.ctx.gl;
    GlState.applyBaseline(gl);
    renderer.resetState();
    renderer.setRenderTarget(this.target);
    renderer.clear(true, true, false);
    if (this.scene && this.camera) {
      this.writeMatrices();
      this.matricesDirty = false;
      renderer.render(this.scene, this.camera);
    }
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
      this.meshes?.dispose();
      this.target?.dispose();
      this.renderer?.dispose();
    } catch {
      // ignore cleanup errors
    }
    this.meshes = null;
    this.scene = null;
    this.camera = null;
    this.target = null;
    this.renderer = null;
  }
}
