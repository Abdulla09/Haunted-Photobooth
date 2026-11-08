import { CONFIG } from './config';

export interface ClockTick {
  step: number;
  stepTimeSec: number;
  changed: boolean;
}

/** Quantizes time to an 18 fps step index. */
export class SteppedClock {
  private last: number | null = null;

  private readonly rate: number;

  constructor(rate: number = CONFIG.STEP_RATE) {
    this.rate = rate;
  }

  update(nowMs: number): ClockTick {
    const step = Math.floor((nowMs * this.rate) / 1000);
    const changed = step !== this.last;
    this.last = step;
    return { step, stepTimeSec: step / this.rate, changed };
  }
}
