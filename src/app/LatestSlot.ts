/** Latest-value handoff. Non-blocking; version strictly increases per publish. */
export class LatestSlot<T> {
  private value: T | undefined;
  private version = 0;

  publish(v: T): void {
    this.value = v;
    this.version += 1;
  }

  read(): { value: T | undefined; version: number } {
    return { value: this.value, version: this.version };
  }
}
