import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { CONFIG } from '../app/config';
import { floatMaskToU8, personCenter, type Point } from './maskMath';
import { WASM_PATH } from './HandTracker';

export interface MaskResult {
  /** Byte mask, MASK_SIZE x MASK_SIZE, unmirrored. Owned by the result (copied in the callback). */
  data: Uint8Array;
  width: number;
  height: number;
  /** Normalized, x-mirrored, y-down centroid. */
  center: Point;
}

export const SEGMENTER_MODEL_PATH = '/models/selfie_segmenter.tflite';

/** Wraps the MediaPipe ImageSegmenter (GPU delegate, same-origin assets). */
export class Segmenter {
  private segmenter: ImageSegmenter | null = null;
  private lastVideoTs = -1;

  async load(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: SEGMENTER_MODEL_PATH, delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  }

  /**
   * Synchronous inference. The mask is only valid inside the callback, so it is
   * copied to a byte array and Person_Center is computed there. Throws on failure.
   */
  segment(source: HTMLCanvasElement, nowMs: number): MaskResult | null {
    if (!this.segmenter) throw new Error('Segmenter not loaded');
    const ts = nowMs > this.lastVideoTs ? nowMs : this.lastVideoTs + 1;
    this.lastVideoTs = ts;
    let out: MaskResult | null = null;
    this.segmenter.segmentForVideo(source, ts, (result) => {
      const mask = result.confidenceMasks?.[0];
      if (!mask) return;
      const data = floatMaskToU8(mask.getAsFloat32Array());
      const w = mask.width || CONFIG.MASK_SIZE;
      const h = mask.height || CONFIG.MASK_SIZE;
      out = { data, width: w, height: h, center: personCenter(data, w, h) };
    });
    return out;
  }

  dispose(): void {
    this.segmenter?.close();
    this.segmenter = null;
  }
}
