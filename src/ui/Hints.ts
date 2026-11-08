import type { ModeController, ModeState } from '../mode/ModeController';

export const HINT_FIST = 'Make a fist to transform';
export const HINT_PALM = 'Open palm to return';

const SVG_ATTR = 'class="hint-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false"';
const FIST_SVG = `<svg ${SVG_ATTR}><rect x="14" y="20" width="36" height="28" rx="9"/><rect x="16" y="12" width="8" height="14" rx="4"/><rect x="25" y="10" width="8" height="16" rx="4"/><rect x="34" y="10" width="8" height="16" rx="4"/><rect x="43" y="12" width="8" height="14" rx="4"/><rect x="6" y="26" width="16" height="9" rx="4.5" transform="rotate(25 14 30)"/></svg>`;
const PALM_SVG = `<svg ${SVG_ATTR}><rect x="17" y="30" width="30" height="26" rx="10"/><rect x="15" y="8" width="7" height="30" rx="3.5"/><rect x="24" y="4" width="7" height="34" rx="3.5"/><rect x="33" y="4" width="7" height="34" rx="3.5"/><rect x="42" y="8" width="7" height="30" rx="3.5"/><rect x="4" y="30" width="7" height="22" rx="3.5" transform="rotate(-35 8 40)"/></svg>`;

/**
 * Bottom-center instructional hint (HTML, outside the Output_Canvas so it is
 * never recorded). The element is an aria-live region; text is updated
 * synchronously on every mode change and screen visibility change.
 */
export class Hints {
  private state: ModeState;
  private screenVisible = false;

  private readonly el: HTMLElement;

  constructor(el: HTMLElement, mode: ModeController) {
    this.el = el;
    this.state = mode.state;
    el.classList.add('hint');
    mode.onChange((next) => {
      this.state = next;
      this.render();
    });
    this.render();
  }

  /** Wire to PermissionScreen's visibility callback. */
  setScreenVisible(visible: boolean): void {
    this.screenVisible = visible;
    this.render();
  }

  private render(): void {
    const el = this.el;
    if (this.screenVisible || this.state === 'transitioning') {
      el.replaceChildren();
      el.classList.remove('hint-fist', 'hint-palm');
      return;
    }
    const fist = this.state === 'normal';
    const label = fist ? HINT_FIST : HINT_PALM;
    el.innerHTML = `${fist ? FIST_SVG : PALM_SVG}<span class="sr-only">${label}</span>`;
    el.classList.toggle('hint-fist', fist);
    el.classList.toggle('hint-palm', !fist);
  }
}
