import type { ModeController, ModeState } from '../mode/ModeController';

export const HINT_FIST = 'Make a fist to transform';
export const HINT_PALM = 'Open palm to return';

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
      el.textContent = '';
      el.classList.remove('hint-fist', 'hint-palm');
      return;
    }
    const fist = this.state === 'normal';
    el.textContent = fist ? HINT_FIST : HINT_PALM;
    el.classList.toggle('hint-fist', fist);
    el.classList.toggle('hint-palm', !fist);
  }
}
