export interface Point {
  x: number;
  y: number;
}

export interface DriverCallbacks {
  /** Called when the particle burst should begin. */
  onBurstStart(nowMs?: number): void;
  /** Called when the transition has finished. */
  onComplete(): void;
}

export interface TransitionDriver {
  start(origin: Point, callbacks: DriverCallbacks): void;
}

/** Phases 1-4: no visual transition; burst starts and completes at once. */
export class ImmediateDriver implements TransitionDriver {
  start(_origin: Point, callbacks: DriverCallbacks): void {
    callbacks.onBurstStart();
    callbacks.onComplete();
  }
}
