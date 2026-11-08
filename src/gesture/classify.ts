import type { Landmark } from '../inference/HandTracker';

export type GestureClass = 'fist' | 'open_palm' | 'other';

const WRIST = 0;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const PINKY_MCP = 17;
const FINGER_TIPS = [8, 12, 16, 20] as const;
const FINGER_PIPS = [6, 10, 14, 18] as const;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Classifies a hand from its 21 normalized landmarks.
 * Fist: every finger tip is closer to the wrist than its PIP.
 * Open_Palm: every finger tip is farther than its PIP and the thumb is extended.
 * The fist and open palm conditions cannot both hold (they require opposite
 * orderings for the same fingers), so the result is exclusive by construction.
 */
export function classify(landmarks: readonly Landmark[]): GestureClass {
  if (landmarks.length < 21) return 'other';
  const wrist = landmarks[WRIST];
  let allCurled = true;
  let allExtended = true;
  for (let i = 0; i < FINGER_TIPS.length; i++) {
    const dTip = dist(landmarks[FINGER_TIPS[i]], wrist);
    const dPip = dist(landmarks[FINGER_PIPS[i]], wrist);
    if (!(dTip < dPip)) allCurled = false;
    if (!(dTip > dPip)) allExtended = false;
  }
  if (allCurled) return 'fist';
  if (allExtended) {
    const pinky = landmarks[PINKY_MCP];
    if (dist(landmarks[THUMB_TIP], pinky) > dist(landmarks[THUMB_IP], pinky)) {
      return 'open_palm';
    }
  }
  return 'other';
}
