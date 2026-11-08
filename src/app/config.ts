/** Central constants: timings, sizes, counts. */
export const CONFIG = {
  /** Hold durations (ms) */
  FIST_HOLD_MS: 250,
  OPEN_PALM_HOLD_MS: 500,
  /** Cooldowns (ms) */
  TRIGGER_COOLDOWN_MS: 3000,
  RETURN_COOLDOWN_MS: 1500,
  /** Stepped animation rate */
  STEP_RATE: 18,
  /** Particles */
  PARTICLE_COUNT: 20,
  /** Face clear zone (ellipse), as fractions of viewport world height. */
  GHOST_CLEAR_RX_FRAC: 0.22,
  GHOST_CLEAR_RY_FRAC: 0.3,
  /** Clear zone center is shifted up (toward the head) by this fraction of viewport height. */
  GHOST_CLEAR_UP_FRAC: 0.05,
  /** Recording */
  RECORD_DURATION_MS: 5000,
  /** Shatter transition (ms) */
  SHATTER_CRACK_MS: 400,
  SHATTER_SEPARATE_MS: 1200,
  /** Output canvas max width (px) */
  MAX_CANVAS_WIDTH: 1280,
  /** Segmentation mask side (px) */
  MASK_SIZE: 256,
} as const;
