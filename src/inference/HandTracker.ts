import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandResult {
  /** Normalized landmarks of the first hand (unmirrored frame), or null when no hand is visible. */
  landmarks: Landmark[] | null;
  /** performance.now()-based timestamp of the sample. */
  timestampMs: number;
}

export const WASM_PATH = '/mediapipe/wasm';
export const HAND_MODEL_PATH = '/models/hand_landmarker.task';

/** Wraps the MediaPipe HandLandmarker (GPU delegate, same-origin assets). */
export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private lastVideoTs = -1;

  async load(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_PATH, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  }

  /** Synchronous inference on the given reduced-size source. Throws on failure. */
  detect(source: HTMLCanvasElement, nowMs: number): HandResult {
    if (!this.landmarker) throw new Error('HandTracker not loaded');
    // MediaPipe requires strictly increasing timestamps.
    const ts = nowMs > this.lastVideoTs ? nowMs : this.lastVideoTs + 1;
    this.lastVideoTs = ts;
    const res = this.landmarker.detectForVideo(source, ts);
    const first = res.landmarks[0];
    return {
      landmarks: first ? first.map((l) => ({ x: l.x, y: l.y, z: l.z })) : null,
      timestampMs: nowMs,
    };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
