import { CONFIG } from '../app/config';
import { recordingFileName, remainingSeconds } from './format';

const CODECS = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const BITRATE = 5_000_000;
const MIN_FRAME_INTERVAL_MS = 33;
const TICK_MS = 250;

export type RecorderStatus = 'idle' | 'recording' | 'error' | 'unsupported';

export interface RecorderState {
  status: RecorderStatus;
  /** Whole seconds remaining while recording. */
  remaining: number;
  message: string;
}

type Listener = (state: RecorderState) => void;

/** Picks the preferred supported WebM mime type, or null when unsupported. */
export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const c of CODECS) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

/**
 * Records the Output_Canvas only (never DOM overlays) to an in-memory WebM and
 * downloads it locally. Nothing is uploaded.
 */
export class Recorder {
  private readonly canvas: HTMLCanvasElement;
  private readonly listeners = new Set<Listener>();
  private recorder: MediaRecorder | null = null;
  private track: CanvasCaptureMediaStreamTrack | null = null;
  private chunks: Blob[] = [];
  private lastFrameMs = -Infinity;
  private startedAt = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private current: RecorderState;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.current = {
      status: this.isSupported() ? 'idle' : 'unsupported',
      remaining: 0,
      message: this.isSupported() ? '' : 'Recording is not supported in this browser',
    };
  }

  get state(): RecorderState {
    return this.current;
  }

  get isRecording(): boolean {
    return this.current.status === 'recording';
  }

  isSupported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof this.canvas.captureStream === 'function' &&
      pickMimeType() !== null
    );
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.isRecording) return;
    const mimeType = pickMimeType();
    if (!this.isSupported() || !mimeType) {
      this.set({ status: 'unsupported', remaining: 0, message: 'Recording is not supported in this browser' });
      return;
    }
    try {
      const stream = this.canvas.captureStream(0);
      this.track = (stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack) ?? null;
      const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
      this.chunks = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      rec.onerror = () => this.fail('Recording failed');
      rec.onstop = () => this.finish(mimeType);
      this.recorder = rec;
      this.lastFrameMs = -Infinity;
      this.startedAt = performance.now();
      rec.start();
      this.set({ status: 'recording', remaining: remainingSeconds(0), message: '' });
      this.tickTimer = setInterval(() => {
        if (this.current.status !== 'recording') return;
        this.set({
          status: 'recording',
          remaining: remainingSeconds(performance.now() - this.startedAt),
          message: '',
        });
      }, TICK_MS);
      this.stopTimer = setTimeout(() => this.stop(), CONFIG.RECORD_DURATION_MS);
    } catch {
      this.fail('Recording failed');
    }
  }

  /** Call after each rendered frame; pushes a frame at most every 33 ms. */
  onFrame(nowMs: number): void {
    if (!this.isRecording || !this.track) return;
    if (nowMs - this.lastFrameMs < MIN_FRAME_INTERVAL_MS) return;
    this.lastFrameMs = nowMs;
    this.track.requestFrame();
  }

  /** Stops any active recording without downloading (e.g. on pagehide). */
  dispose(): void {
    const rec = this.recorder;
    this.cleanup();
    if (rec) {
      rec.onstop = null;
      rec.ondataavailable = null;
      rec.onerror = null;
      if (rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
    }
    this.listeners.clear();
  }

  private stop(): void {
    const rec = this.recorder;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        this.fail('Recording failed');
      }
    }
  }

  private finish(mimeType: string): void {
    if (this.current.status !== 'recording') return; // failed already
    const chunks = this.chunks;
    this.cleanup();
    try {
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) throw new Error('empty');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = recordingFileName(new Date());
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.set({ status: 'idle', remaining: 0, message: '' });
    } catch {
      this.fail('Could not save the recording');
    }
  }

  private fail(message: string): void {
    const rec = this.recorder;
    this.cleanup();
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    this.set({ status: 'error', remaining: 0, message });
  }

  private cleanup(): void {
    if (this.tickTimer !== null) clearInterval(this.tickTimer);
    if (this.stopTimer !== null) clearTimeout(this.stopTimer);
    this.tickTimer = null;
    this.stopTimer = null;
    this.recorder?.stream.getTracks().forEach((t) => t.stop());
    this.recorder = null;
    this.track = null;
    this.chunks = [];
  }

  private set(next: RecorderState): void {
    this.current = next;
    for (const fn of this.listeners) fn(next);
  }
}
