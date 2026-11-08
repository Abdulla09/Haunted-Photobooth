import type { Recorder, RecorderState } from '../recorder/Recorder';

export const RECORD_LABEL = 'Record 5s';

/**
 * Record button mounted in the #record container (outside the Output_Canvas,
 * so it is never captured).
 */
export class RecordButton {
  readonly button: HTMLButtonElement;
  private readonly message: HTMLElement;

  constructor(container: HTMLElement, recorder: Recorder) {
    const wrap = document.createElement('div');
    wrap.className = 'record-wrap';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'record-button';
    this.button.addEventListener('click', () => recorder.start());

    this.message = document.createElement('div');
    this.message.className = 'record-message';
    this.message.setAttribute('role', 'status');
    this.message.setAttribute('aria-live', 'polite');

    wrap.append(this.button, this.message);
    container.appendChild(wrap);

    recorder.onChange((s) => this.render(s));
    this.render(recorder.state);
  }

  private render(s: RecorderState): void {
    const b = this.button;
    switch (s.status) {
      case 'recording':
        b.disabled = true;
        b.textContent = `Recording… ${s.remaining}s`;
        break;
      case 'unsupported':
        b.disabled = true;
        b.textContent = RECORD_LABEL;
        break;
      default:
        b.disabled = false;
        b.textContent = RECORD_LABEL;
    }
    this.message.textContent = s.status === 'error' || s.status === 'unsupported' ? s.message : '';
  }
}
