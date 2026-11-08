/** Three-free particle kind constants, shared with the pure simulation. */
export const PARTICLE_KINDS = [
  'bat',
  'skull',
  'pumpkin',
  'candy_corn',
  'coffin',
  'eyeball',
  'tombstone',
  'spider',
] as const;

export type ParticleKind = (typeof PARTICLE_KINDS)[number];

export const KIND_COUNT = PARTICLE_KINDS.length;

/** Maximum instances per kind: ceil(150 / 8) = 19. */
export const KIND_CAPACITY = 19;

/** Upper bound on triangles per procedural geometry (design: under about 120). */
export const MAX_TRIANGLES_PER_KIND = 120;
