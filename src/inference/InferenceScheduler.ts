import { CONFIG } from '../app/config';
import type { LatestSlot } from '../app/LatestSlot';
import { HandTracker, type HandResult } from './HandTracker';
import { Segmenter, type MaskResult } from './Segmenter';

const HAND_INPUT_WIDTH = 320;
const BASE_TICK_MS = 40; // ~25 Hz hand tracking
const MAX_TICK_MS = 100;
const MASK_MAX_INTERVAL_MS = 100; // floor: 10 Hz mask
const MAX_CONSECUTIVE_FAILURES = 3;
const EMA_ALPHA = 0.2;
const STALL_FALLBACK_MS = 250;

export interface InferenceStats {
  lastTickMs: number;
  handMs: number;
  segMs: number;
  handHz: number;
  maskHz: number;
}

export interface InferenceSchedulerOptions {
  video: HTMLVideoElement;
  handSlot: LatestSlot<HandResult>;
  maskSlot: LatestSlot<MaskResult>;
  /** Called when a model fails to load or is disabled after repeated failures. */
  onModelUnavailable?: (model: 'hands' | 'segmenter') => void;
}

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/**
 * Decoupled inference loop. Time-slices the synchronous MediaPipe calls: hand
 * tracking every tick, segmentation on every second tick in its own slice
 * (adaptive, never slower than 10 Hz). The render loop never calls or awaits it.
 */
export class InferenceScheduler {
  hasHands = false;
  hasSegmenter = false;
  readonly stats: InferenceStats = { lastTickMs: 0, handMs: 0, segMs: 0, handHz: 0, maskHz: 0 };

  private readonly video: VideoWithRvfc;
  private readonly handSlot: LatestSlot<HandResult>;
  private readonly maskSlot: LatestSlot<MaskResult>;
  private readonly onModelUnavailable?: (model: 'hands' | 'segmenter') => void;

  private readonly hands = new HandTracker();
  private readonly segmenter = new Segmenter();
  private readonly handCanvas = document.createElement('canvas');
  private readonly segCanvas = document.createElement('canvas');
  private readonly handCtx: CanvasRenderingContext2D;
  private readonly segCtx: CanvasRenderingContext2D;

  private running = false;
  private timer: number | undefined;
  private fallbackTimer: number | undefined;
  private rvfcId: number | undefined;
  private tickCount = 0;
  private handFailures = 0;
  private segFailures = 0;
  private lastMaskAt = 0;
  private lastHandAt = 0;
  private handCostEma = 0;
  private segCostEma = 0;

  constructor(opts: InferenceSchedulerOptions) {
    this.video = opts.video as VideoWithRvfc;
    this.handSlot = opts.handSlot;
    this.maskSlot = opts.maskSlot;
    this.onModelUnavailable = opts.onModelUnavailable;
    this.segCanvas.width = CONFIG.MASK_SIZE;
    this.segCanvas.height = CONFIG.MASK_SIZE;
    this.handCanvas.width = HAND_INPUT_WIDTH;
    this.handCanvas.height = Math.round((HAND_INPUT_WIDTH * 9) / 16);
    const hc = this.handCanvas.getContext('2d', { willReadFrequently: false });
    const sc = this.segCanvas.getContext('2d', { willReadFrequently: false });
    if (!hc || !sc) throw new Error('2D canvas unavailable for inference input');
    this.handCtx = hc;
    this.segCtx = sc;
  }

  /** Loads both models independently; a failure clears only that model's flag. Never rejects. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await Promise.all([this.loadHands(), this.loadSegmenter()]);
    if (!this.running) return;
    if (!this.hasHands && !this.hasSegmenter) return;
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    this.clearPending();
    this.hands.dispose();
    this.segmenter.dispose();
    this.hasHands = false;
    this.hasSegmenter = false;
  }

  private async loadHands(): Promise<void> {
    try {
      await this.hands.load();
      this.hasHands = true;
    } catch (err) {
      console.warn('Hand tracker failed to load', err);
      this.hasHands = false;
      this.onModelUnavailable?.('hands');
    }
  }

  private async loadSegmenter(): Promise<void> {
    try {
      await this.segmenter.load();
      this.hasSegmenter = true;
    } catch (err) {
      console.warn('Segmenter failed to load', err);
      this.hasSegmenter = false;
      this.onModelUnavailable?.('segmenter');
    }
  }

  private clearPending(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    if (this.fallbackTimer !== undefined) clearTimeout(this.fallbackTimer);
    if (this.rvfcId !== undefined) this.video.cancelVideoFrameCallback?.(this.rvfcId);
    this.timer = this.fallbackTimer = this.rvfcId = undefined;
  }

  private tickInterval(): number {
    // Grow the tick period when the per-tick work eats too much of the budget.
    const cost = this.handCostEma + this.segCostEma / 2;
    return Math.min(MAX_TICK_MS, Math.max(BASE_TICK_MS, cost * 1.5));
  }

  private maskInterval(): number {
    // Every second tick, but never slower than the 10 Hz floor.
    return Math.min(MASK_MAX_INTERVAL_MS, this.tickInterval() * 2);
  }

  /** Waits `delay`, then for a fresh video frame (when supported), then ticks. */
  private schedule(delay: number): void {
    if (!this.running) return;
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      if (!this.running) return;
      let fired = false;
      const go = (): void => {
        if (fired) return;
        fired = true;
        if (this.fallbackTimer !== undefined) clearTimeout(this.fallbackTimer);
        this.fallbackTimer = this.rvfcId = undefined;
        void this.tick();
      };
      if (this.video.requestVideoFrameCallback) {
        this.rvfcId = this.video.requestVideoFrameCallback(go);
        // Paused or stalled video never fires rVFC; keep ticking anyway.
        this.fallbackTimer = window.setTimeout(go, STALL_FALLBACK_MS);
      } else {
        go();
      }
    }, delay);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const t0 = performance.now();
    this.tickCount++;

    if (this.video.readyState >= 2 && this.video.videoWidth > 0) {
      if (this.hasHands) this.runHands(t0);
      const maskDue = this.tickCount % 2 === 0 || t0 - this.lastMaskAt >= this.maskInterval();
      if (this.hasSegmenter && maskDue && t0 - this.lastMaskAt >= this.maskInterval() * 0.5) {
        // Separate slice: let the event loop breathe between the two blocking calls.
        await new Promise<void>((r) => setTimeout(r, 0));
        if (!this.running) return;
        this.runSegmenter(performance.now());
      }
    }

    const end = performance.now();
    this.stats.lastTickMs = end - t0;
    if (!this.hasHands && !this.hasSegmenter) return; // both disabled: stop ticking
    this.schedule(Math.max(0, this.tickInterval() - (end - t0)));
  }

  private runHands(now: number): void {
    const v = this.video;
    this.handCanvas.height = Math.max(1, Math.round((HAND_INPUT_WIDTH * v.videoHeight) / v.videoWidth));
    const t = performance.now();
    try {
      // Unmirrored: the gesture layer mirrors positions itself.
      this.handCtx.drawImage(v, 0, 0, this.handCanvas.width, this.handCanvas.height);
      const res = this.hands.detect(this.handCanvas, now);
      this.handSlot.publish(res);
      this.handFailures = 0;
    } catch (err) {
      if (++this.handFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn('Hand tracker disabled after repeated failures', err);
        this.hasHands = false;
        this.hands.dispose();
        this.onModelUnavailable?.('hands');
      }
    }
    const cost = performance.now() - t;
    this.handCostEma = this.handCostEma ? this.handCostEma + EMA_ALPHA * (cost - this.handCostEma) : cost;
    this.stats.handMs = this.handCostEma;
    if (this.lastHandAt) this.stats.handHz = 1000 / Math.max(1, now - this.lastHandAt);
    this.lastHandAt = now;
  }

  private runSegmenter(now: number): void {
    const t = performance.now();
    try {
      this.segCtx.drawImage(this.video, 0, 0, CONFIG.MASK_SIZE, CONFIG.MASK_SIZE);
      const res = this.segmenter.segment(this.segCanvas, now);
      if (res) this.maskSlot.publish(res);
      this.segFailures = 0;
    } catch (err) {
      if (++this.segFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn('Segmenter disabled after repeated failures', err);
        this.hasSegmenter = false;
        this.segmenter.dispose();
        this.onModelUnavailable?.('segmenter');
      }
    }
    const cost = performance.now() - t;
    this.segCostEma = this.segCostEma ? this.segCostEma + EMA_ALPHA * (cost - this.segCostEma) : cost;
    this.stats.segMs = this.segCostEma;
    if (this.lastMaskAt) this.stats.maskHz = 1000 / Math.max(1, now - this.lastMaskAt);
    this.lastMaskAt = now;
  }
}
