import type { Recorder, RecorderState } from '../recorder/Recorder';
import { CONFIG } from '../app/config';

export const RECORD_LABEL = 'Record 5 seconds';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Icon-only record button mounted in the #record container (outside the
 * Output_Canvas, so it is never captured). Shows a red dot; while recording a
 * ring drains over RECORD_DURATION_MS (CSS animation, linear).
 */
export class RecordButton {
  readonly button: HTMLButtonElement;
  private readonly message: HTMLElement;
  private readonly ring: SVGCircleElement;

  constructor(container: HTMLElement, recorder: Recorder) {
    const wrap = document.createElement('div');
    wrap.className = 'record-wrap';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'record-button';
    this.button.addEventListener('click', () => recorder.start());

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('record-icon');

    const track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('class', 'record-track');
    track.setAttribute('cx', '32');
    track.setAttribute('cy', '32');
    track.setAttribute('r', String(RING_R));

    this.ring = document.createElementNS(SVG_NS, 'circle');
    this.ring.setAttribute('class', 'record-ring');
    this.ring.setAttribute('cx', '32');
    this.ring.setAttribute('cy', '32');
    this.ring.setAttribute('r', String(RING_R));
    this.ring.setAttribute('transform', 'rotate(-90 32 32)');
    this.ring.style.strokeDasharray = String(RING_C);
    this.ring.style.setProperty('--ring-c', String(RING_C));
    this.ring.style.setProperty('--ring-ms', `${CONFIG.RECORD_DURATION_MS}ms`);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'record-dot');
    dot.setAttribute('cx', '32');
    dot.setAttribute('cy', '32');
    dot.setAttribute('r', '16');

    svg.append(track, this.ring, dot);
    this.button.appendChild(svg);

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
    const recording = s.status === 'recording';
    b.disabled = recording || s.status === 'unsupported';
    b.classList.toggle('recording', recording);
    b.setAttribute(
      'aria-label',
      recording ? `Recording, ${s.remaining} seconds remaining` : RECORD_LABEL,
    );
    this.message.textContent = s.status === 'error' || s.status === 'unsupported' ? s.message : '';
  }
}
