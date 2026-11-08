import { CameraError, CameraService } from '../camera/CameraService'
import { classify, type GestureClass } from '../gesture/classify'
import { GestureDetector } from '../gesture/GestureDetector'
import { GlContext } from '../gl/GlContext'
import { GlState } from '../gl/GlState'
import { createTarget, disposeTarget, type Target } from '../gl/Targets'
import { createMaskTexture, createVideoTexture, uploadMask, uploadVideoFrame } from '../gl/Textures'
import type { HandResult } from '../inference/HandTracker'
import { InferenceScheduler } from '../inference/InferenceScheduler'
import type { MaskResult } from '../inference/Segmenter'
import { ModeController } from '../mode/ModeController'
import { ImmediateDriver } from '../mode/TransitionDriver'
import type { FrameState } from '../passes/Pass'
import { Pipeline } from '../passes/Pipeline'
import { DebugOverlay } from '../ui/DebugOverlay'
import { Hints } from '../ui/Hints'
import { PermissionScreen } from '../ui/PermissionScreen'
import { WebGLMissingScreen } from '../ui/WebGLMissingScreen'
import { CONFIG } from './config'
import { fitRect } from './fitRect'
import { LatestSlot } from './LatestSlot'
import { SteppedClock } from './SteppedClock'

/** A hand sample older than this is treated as "no hand". */
const HAND_STALE_MS = 500

/** Per-step smoothing factor for Person_Center. */
const CENTER_LERP = 0.25

function byId(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id} in index.html`)
  return el
}

/** Application root: bootstraps GL, camera and inference, then runs the render loop. */
export class App {
  private readonly canvas = byId('canvas') as HTMLCanvasElement
  private readonly overlays = byId('overlays')
  private readonly screens = byId('screens')

  private readonly mode = new ModeController(new ImmediateDriver())
  private readonly hints = new Hints(byId('hint'), this.mode)
  private readonly gestures = new GestureDetector()
  private readonly clock = new SteppedClock()
  private readonly handSlot = new LatestSlot<HandResult>()
  private readonly maskSlot = new LatestSlot<MaskResult>()
  private readonly camera = new CameraService()
  private readonly pipeline = new Pipeline()

  private ctx: GlContext | null = null
  private debug: DebugOverlay | null = null
  private inference: InferenceScheduler | null = null
  private permission: PermissionScreen | null = null

  private videoTex: WebGLTexture | null = null
  private maskTex: WebGLTexture | null = null
  private targets: { monster: Target; normal: Target } | null = null

  private rafId = 0
  private loopStarted = false
  private disposed = false
  private canvasW = 0
  private canvasH = 0
  private lastMaskVersion = 0
  private hasMask = false
  private center = { x: 0.5, y: 0.5 }
  private readonly smoothCenter = { x: 0.5, y: 0.5 }
  private gestureClass: GestureClass = 'other'

  private readonly onResize = (): void => this.layoutCss()
  private readonly onPageHide = (): void => this.dispose()
  private readonly onKeyDown = (e: KeyboardEvent): void => this.handleKey(e)

  async start(): Promise<void> {
    // Keyboard and lifecycle listeners are active from the start.
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('resize', this.onResize)
    window.addEventListener('pagehide', this.onPageHide)

    const ctx = GlContext.create(this.canvas)
    if (!ctx) {
      WebGLMissingScreen.show(this.screens)
      this.hints.setScreenVisible(true)
      return
    }
    this.ctx = ctx
    ctx.onContextLost(() => this.handleContextLost())
    const gl = ctx.gl
    GlState.applyBaseline(gl)
    this.videoTex = createVideoTexture(gl)
    this.maskTex = createMaskTexture(gl)
    this.pipeline.init(ctx)
    GlState.applyBaseline(gl)
    this.mode.onBurst((burstStartMs) => {
      if (burstStartMs !== null) this.pipeline.startParticles(this.center)
      else this.pipeline.stopParticles()
    })
    this.debug = new DebugOverlay(this.overlays, this.canvas)

    this.permission = new PermissionScreen(
      this.screens,
      async () => {
        await this.camera.start()
        this.onCameraReady()
      },
      (visible) => this.hints.setScreenVisible(visible),
    )

    try {
      await this.camera.start()
      this.onCameraReady()
    } catch (err) {
      const kind = err instanceof CameraError ? err.kind : 'unavailable'
      this.permission.show(kind)
    }
  }

  private onCameraReady(): void {
    if (this.disposed) return
    if (!this.inference) {
      this.inference = new InferenceScheduler({
        video: this.camera.video,
        handSlot: this.handSlot,
        maskSlot: this.maskSlot,
      })
      // Never awaited by the render loop.
      void this.inference.start()
    }
    if (!this.loopStarted) {
      this.loopStarted = true
      this.rafId = requestAnimationFrame(this.frame)
    }
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      e.preventDefault()
      const now = performance.now()
      if (this.mode.state === 'normal') {
        this.mode.dispatch({ type: 'trigger', fistPosition: { x: 0.5, y: 0.5 } }, now)
      } else if (this.mode.state === 'monster') {
        this.mode.dispatch({ type: 'return' }, now)
      }
    } else if (e.code === 'KeyD' && !e.repeat) {
      this.debug?.toggle()
    }
  }

  /** Recomputes only the CSS rectangle; the canvas resolution is untouched. */
  private layoutCss(): void {
    if (this.canvasW === 0) return
    const r = fitRect(
      { w: window.innerWidth, h: window.innerHeight },
      { w: this.canvasW, h: this.canvasH },
    )
    this.canvas.style.width = `${r.w}px`
    this.canvas.style.height = `${r.h}px`
  }

  /** Sets canvas resolution (max 1280 wide) and render targets from the video size. */
  private ensureCanvasSize(vw: number, vh: number): void {
    const ctx = this.ctx
    if (!ctx) return
    const w = Math.min(vw, CONFIG.MAX_CANVAS_WIDTH)
    const h = Math.max(1, Math.round((w * vh) / vw))
    if (w === this.canvasW && h === this.canvasH) return
    this.canvasW = w
    this.canvasH = h
    ctx.setSize(w, h)
    const gl = ctx.gl
    if (this.targets) {
      disposeTarget(gl, this.targets.monster)
      disposeTarget(gl, this.targets.normal)
    }
    this.targets = { monster: createTarget(gl, w, h), normal: createTarget(gl, w, h) }
    this.pipeline.resize(w, h)
    this.layoutCss()
  }

  private readonly frame = (nowMs: number): void => {
    if (this.disposed || !this.ctx || this.ctx.lost) return
    this.rafId = requestAnimationFrame(this.frame)

    const video = this.camera.video
    // Skip until the camera has produced a frame.
    if (video.videoWidth <= 0 || video.readyState < 2) return
    this.ensureCanvasSize(video.videoWidth, video.videoHeight)
    const targets = this.targets
    if (!targets || !this.videoTex || !this.maskTex) return

    const gl = this.ctx.gl

    // Latest inference results (non-blocking reads).
    const hand = this.handSlot.read()
    const mask = this.maskSlot.read()

    const lm =
      hand.value?.landmarks && nowMs - hand.value.timestampMs <= HAND_STALE_MS
        ? hand.value.landmarks
        : null
    this.gestureClass = lm ? classify(lm) : 'other'
    const event = this.gestures.update(lm, nowMs, this.mode.state)
    if (event && !this.mode.dispatch(event, nowMs)) this.gestures.rearm()

    if (mask.value && mask.version !== this.lastMaskVersion) {
      this.lastMaskVersion = mask.version
      if (mask.value.width === CONFIG.MASK_SIZE && mask.value.height === CONFIG.MASK_SIZE) {
        uploadMask(gl, this.maskTex, mask.value.data)
        this.hasMask = true
      }
      this.center = mask.value.center
    }

    const tick = this.clock.update(nowMs)
    if (tick.changed) {
      // Per-step lerp so the light rays glide toward the person.
      this.smoothCenter.x += (this.center.x - this.smoothCenter.x) * CENTER_LERP
      this.smoothCenter.y += (this.center.y - this.smoothCenter.y) * CENTER_LERP
      this.pipeline.setBackgroundCenter(this.smoothCenter.x, this.smoothCenter.y)
    }
    uploadVideoFrame(gl, this.videoTex, video)

    const state: FrameState = {
      gl,
      nowMs,
      step: tick.step,
      stepTimeSec: tick.stepTimeSec,
      mode: this.mode.state,
      burstStartMs: this.mode.burstStartMs,
      size: { w: this.canvasW, h: this.canvasH },
      textures: { video: this.videoTex, mask: this.maskTex },
      maskVersion: mask.version,
      personCenter: this.center,
      hasSegmenter: (this.inference?.hasSegmenter ?? false) && this.hasMask,
      transition: null,
      targets,
    }
    this.pipeline.render(state)
    GlState.assertBaseline(gl)

    this.debug?.update({
      nowMs,
      hand: hand.value,
      mask: mask.value,
      maskVersion: mask.version,
      gesture: this.gestureClass,
      mode: this.mode.state,
      handMs: this.inference?.stats.handMs ?? 0,
      segMs: this.inference?.stats.segMs ?? 0,
    })
  }

  private handleContextLost(): void {
    cancelAnimationFrame(this.rafId)
    const root = document.createElement('div')
    root.className = 'screen context-lost-screen'
    root.setAttribute('role', 'alert')
    const title = document.createElement('h1')
    title.textContent = 'Graphics context lost'
    const body = document.createElement('p')
    body.textContent = 'The graphics context was lost. Reload the page to continue.'
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Reload'
    button.addEventListener('click', () => window.location.reload())
    root.append(title, body, button)
    this.screens.appendChild(root)
    this.hints.setScreenVisible(true)
    button.focus()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('pagehide', this.onPageHide)
    this.inference?.stop()
    this.camera.stop()
    const ctx = this.ctx
    if (ctx && !ctx.lost) {
      const gl = ctx.gl
      this.pipeline.dispose()
      if (this.targets) {
        disposeTarget(gl, this.targets.monster)
        disposeTarget(gl, this.targets.normal)
      }
      if (this.videoTex) gl.deleteTexture(this.videoTex)
      if (this.maskTex) gl.deleteTexture(this.maskTex)
    }
  }
}
