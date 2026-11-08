/** Three-free particle kind constants, shared with the pure simulation. */
export const PARTICLE_KINDS = ['ghost'] as const;

export type ParticleKind = (typeof PARTICLE_KINDS)[number];

export const KIND_COUNT = PARTICLE_KINDS.length;

/** Maximum ghost instances (PARTICLE_COUNT is 20). */
export const KIND_CAPACITY = 20;

/** Upper bound on triangles for the procedural ghost geometry (design: under about 60 for the body). */
export const MAX_TRIANGLES_PER_KIND = 120;
