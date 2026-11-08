import { CONFIG } from '../app/config';
import type { Point, TransitionDriver } from './TransitionDriver';

export type ModeState = 'normal' | 'transitioning' | 'monster';

export type ModeEvent =
  | { type: 'trigger'; fistPosition?: Point }
  | { type: 'return' };

export type ChangeListener = (state: ModeState, prev: ModeState) => void;
/** `burstStartMs` is null when the burst ends (return to Normal). */
export type BurstListener = (burstStartMs: number | null) => void;

export class ModeController {
  private _state: ModeState = 'normal';
  private _burstStartMs: number | null = null;
  private cooldownUntil = -Infinity;
  private readonly changeListeners: ChangeListener[] = [];
  private readonly burstListeners: BurstListener[] = [];

  /** Latest time passed to dispatch; used to stamp burst start. */
  private lastNowMs = 0;

  private driver: TransitionDriver;

  constructor(driver: TransitionDriver) {
    this.driver = driver;
  }

  get state(): ModeState {
    return this._state;
  }

  get burstStartMs(): number | null {
    return this._burstStartMs;
  }

  setDriver(driver: TransitionDriver): void {
    this.driver = driver;
  }

  onChange(listener: ChangeListener): void {
    this.changeListeners.push(listener);
  }

  onBurst(listener: BurstListener): void {
    this.burstListeners.push(listener);
  }

  /** Returns true if the event was accepted. */
  dispatch(event: ModeEvent, nowMs: number): boolean {
    this.lastNowMs = nowMs;
    if (nowMs < this.cooldownUntil) return false;

    if (this._state === 'normal' && event.type === 'trigger') {
      this.cooldownUntil = nowMs + CONFIG.TRIGGER_COOLDOWN_MS;
      this.setState('transitioning');
      const origin = event.fistPosition ?? { x: 0.5, y: 0.5 };
      this.driver.start(origin, {
        onBurstStart: (burstNowMs?: number) => this.handleBurstStart(burstNowMs),
        onComplete: () => this.handleComplete(),
      });
      return true;
    }

    if (this._state === 'monster' && event.type === 'return') {
      this.cooldownUntil = nowMs + CONFIG.RETURN_COOLDOWN_MS;
      this._burstStartMs = null;
      this.setState('normal');
      this.notifyBurst(null);
      return true;
    }

    return false;
  }

  private handleBurstStart(nowMs?: number): void {
    if (this._state !== 'transitioning') return;
    this._burstStartMs = nowMs ?? this.lastNowMs;
    this.notifyBurst(this._burstStartMs);
  }

  private handleComplete(): void {
    if (this._state !== 'transitioning') return;
    this.setState('monster');
  }

  private setState(next: ModeState): void {
    const prev = this._state;
    this._state = next;
    for (const l of this.changeListeners) l(next, prev);
  }

  private notifyBurst(v: number | null): void {
    for (const l of this.burstListeners) l(v);
  }
}
