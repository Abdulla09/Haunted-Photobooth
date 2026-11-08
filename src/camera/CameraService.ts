export type CameraErrorKind = 'denied' | 'no_camera' | 'unavailable'

export class CameraError extends Error {
  readonly kind: CameraErrorKind

  constructor(kind: CameraErrorKind, message: string) {
    super(message)
    this.name = 'CameraError'
    this.kind = kind
  }
}

/** Maps a getUserMedia rejection to one of the app's error kinds. */
export function classifyCameraError(err: unknown): CameraErrorKind {
  const name = (err as { name?: string } | null)?.name ?? ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no_camera'
    default:
      // NotReadableError (camera in use), AbortError, missing API, etc.
      return 'unavailable'
  }
}

/** Requests the webcam and owns the video element that plays it. Frames never leave the browser. */
export class CameraService {
  readonly video: HTMLVideoElement
  private stream: MediaStream | null = null

  constructor(video: HTMLVideoElement = document.createElement('video')) {
    this.video = video
    this.video.autoplay = true
    this.video.muted = true
    this.video.playsInline = true
  }

  /** Starts (or restarts) the camera. Rejects with a CameraError. */
  async start(): Promise<HTMLVideoElement> {
    this.stop()
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('unavailable', 'Camera API is not available in this browser')
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
    } catch (err) {
      const kind = classifyCameraError(err)
      throw new CameraError(kind, (err as Error)?.message ?? 'Camera request failed')
    }
    this.stream = stream
    this.video.srcObject = stream
    try {
      await this.video.play()
    } catch (err) {
      this.stop()
      throw new CameraError('unavailable', (err as Error)?.message ?? 'Video playback failed')
    }
    return this.video
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
  }
}
