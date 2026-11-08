import type { GestureClass } from '../gesture/classify';
import type { HandResult } from '../inference/HandTracker';
import type { MaskResult } from '../inference/Segmenter';
import type { ModeState } from '../mode/ModeController';
import { PALETTE_HEX } from '../app/palette';

/** Hand skeleton connections over the 21 MediaPipe landmarks. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export interface DebugFrame {
  nowMs: number;
  hand: HandResult | undefined;
  mask: MaskResult | undefined;
  maskVersion: number;
  gesture: GestureClass;
  mode: ModeState;
  handMs: number;
  segMs: number;
}

/**
 * Debug_Overlay: a separate 2D canvas plus a stats block, layered above the
 * Output_Canvas (never recorded). Hidden at start; toggled with `toggle()`.
 */
export class DebugOverlay {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stats = document.createElement('pre');
  private readonly maskCanvas = document.createElement('canvas');
  private readonly maskCtx: CanvasRenderingContext2D;
  private _visible = false;
  private maskDrawnVersion = -1;

  private frames = 0;
  private fpsWindowStart = 0;
  private fps = 0;

  private readonly outputCanvas: HTMLCanvasElement;

  constructor(container: HTMLElement, outputCanvas: HTMLCanvasElement) {
    this.outputCanvas = outputCanvas;
    const ctx = this.canvas.getContext('2d');
    const mctx = this.maskCanvas.getContext('2d');
    if (!ctx || !mctx) throw new Error('2D canvas unavailable for debug overlay');
    this.ctx = ctx;
    this.maskCtx = mctx;
    this.canvas.className = 'debug-canvas';
    this.stats.className = 'debug-stats';
    this.canvas.hidden = true;
    this.stats.hidden = true;
    container.append(this.canvas, this.stats);
  }

  get visible(): boolean {
    return this._visible;
  }

  setVisible(v: boolean): void {
    this._visible = v;
    this.canvas.hidden = !v;
    this.stats.hidden = !v;
    if (!v) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  toggle(): void {
    this.setVisible(!this._visible);
  }

  /** Call once per rendered frame. Cheap when hidden. */
  update(f: DebugFrame): void {
    this.frames++;
    if (this.fpsWindowStart === 0) this.fpsWindowStart = f.nowMs;
    const elapsed = f.nowMs - this.fpsWindowStart;
    if (elapsed >= 1000) {
      this.fps = (this.frames * 1000) / elapsed;
      this.frames = 0;
      this.fpsWindowStart = f.nowMs;
      if (this._visible) this.writeStats(f);
    }
    if (!this._visible) return;
    this.syncCanvas();
    this.draw(f);
  }

  private writeStats(f: DebugFrame): void {
    this.stats.textContent =
      `FPS ${this.fps.toFixed(1)}\n` +
      `Gesture ${f.gesture}\n` +
      `Mode ${f.mode}\n` +
      `Hand ${f.handMs.toFixed(1)} ms\n` +
      `Seg ${f.segMs.toFixed(1)} ms`;
  }

  private syncCanvas(): void {
    const o = this.outputCanvas;
    if (this.canvas.width !== o.width || this.canvas.height !== o.height) {
      this.canvas.width = o.width;
      this.canvas.height = o.height;
    }
    const r = o.getBoundingClientRect();
    const s = this.canvas.style;
    s.left = `${r.left}px`;
    s.top = `${r.top}px`;
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;
  }

  private draw(f: DebugFrame): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (f.mask) {
      this.drawMask(f.mask, f.maskVersion);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.translate(w, 0);
      ctx.scale(-1, 1); // mask is unmirrored; the feed is mirrored
      ctx.drawImage(this.maskCanvas, 0, 0, w, h);
      ctx.restore();
    }

    const lm = f.hand?.landmarks;
    if (lm && lm.length >= 21) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE_HEX.toxicGreen;
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo((1 - lm[a].x) * w, lm[a].y * h);
        ctx.lineTo((1 - lm[b].x) * w, lm[b].y * h);
      }
      ctx.stroke();
      ctx.fillStyle = PALETTE_HEX.pumpkinOrange;
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc((1 - p.x) * w, p.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawMask(mask: MaskResult, version: number): void {
    if (version === this.maskDrawnVersion) return;
    this.maskDrawnVersion = version;
    const mc = this.maskCanvas;
    if (mc.width !== mask.width || mc.height !== mask.height) {
      mc.width = mask.width;
      mc.height = mask.height;
    }
    const img = this.maskCtx.createImageData(mask.width, mask.height);
    const d = img.data;
    for (let i = 0; i < mask.data.length; i++) {
      const o = i * 4;
      d[o] = 255;
      d[o + 1] = 0;
      d[o + 2] = 255;
      d[o + 3] = mask.data[i] >= 128 ? 255 : 0;
    }
    this.maskCtx.putImageData(img, 0, 0);
  }
}
