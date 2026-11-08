import { CONFIG } from '../app/config';

const pad = (n: number): string => String(n).padStart(2, '0');

/** haunted-photobooth-YYYYMMDD-HHmmss.webm in local time. */
export function recordingFileName(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  return (
    `haunted-photobooth-${y}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.webm`
  );
}

/** Whole seconds remaining, ceil'd and clamped to [0, duration seconds]. */
export function remainingSeconds(elapsedMs: number): number {
  const total = CONFIG.RECORD_DURATION_MS;
  const r = Math.ceil((total - elapsedMs) / 1000);
  return Math.min(Math.ceil(total / 1000), Math.max(0, r));
}
