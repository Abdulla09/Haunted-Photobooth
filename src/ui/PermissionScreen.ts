import type { CameraErrorKind } from '../camera/CameraService'

const MESSAGES: Record<CameraErrorKind, { title: string; body: string }> = {
  denied: {
    title: 'Camera access is required',
    body: 'Haunted Photobooth needs your camera to work. Allow camera access in your browser, then try again.',
  },
  no_camera: {
    title: 'No camera detected',
    body: 'We could not find a camera on this device. Connect one, then try again.',
  },
  unavailable: {
    title: 'Camera unavailable',
    body: 'The camera could not be started. It may be in use by another app. Close other apps using it, then try again.',
  },
}

const PRIVACY = 'Your camera data stays in your browser and is never uploaded.'

/**
 * Full-screen overlay shown when the camera cannot be opened.
 * "Try again" calls `retry`; on success the screen hides, on failure it updates its message.
 */
export class PermissionScreen {
  private readonly root: HTMLElement
  private readonly titleEl: HTMLElement
  private readonly bodyEl: HTMLElement
  private readonly button: HTMLButtonElement
  private readonly retry: () => Promise<void>
  private readonly onVisibilityChange?: (visible: boolean) => void
  private busy = false

  constructor(
    container: HTMLElement,
    retry: () => Promise<void>,
    onVisibilityChange?: (visible: boolean) => void,
  ) {
    this.retry = retry
    this.onVisibilityChange = onVisibilityChange
    this.root = document.createElement('div')
    this.root.className = 'screen permission-screen'
    this.root.setAttribute('role', 'alertdialog')
    this.root.setAttribute('aria-labelledby', 'permission-title')
    this.root.hidden = true

    this.titleEl = document.createElement('h1')
    this.titleEl.id = 'permission-title'
    this.bodyEl = document.createElement('p')
    const privacy = document.createElement('p')
    privacy.className = 'screen-note'
    privacy.textContent = PRIVACY

    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.textContent = 'Try again'
    this.button.addEventListener('click', () => void this.onTryAgain())

    this.root.append(this.titleEl, this.bodyEl, privacy, this.button)
    container.appendChild(this.root)
  }

  get visible(): boolean {
    return !this.root.hidden
  }

  show(kind: CameraErrorKind): void {
    const m = MESSAGES[kind]
    this.titleEl.textContent = m.title
    this.bodyEl.textContent = m.body
    const wasHidden = this.root.hidden
    this.root.hidden = false
    if (wasHidden) this.onVisibilityChange?.(true)
    this.button.focus()
  }

  hide(): void {
    if (this.root.hidden) return
    this.root.hidden = true
    this.onVisibilityChange?.(false)
  }

  private async onTryAgain(): Promise<void> {
    if (this.busy) return
    this.busy = true
    this.button.disabled = true
    try {
      await this.retry()
      this.hide()
    } catch (err) {
      const kind = (err as { kind?: CameraErrorKind } | null)?.kind ?? 'unavailable'
      this.show(kind)
    } finally {
      this.busy = false
      this.button.disabled = false
    }
  }
}
