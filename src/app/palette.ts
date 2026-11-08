export type Vec3 = readonly [number, number, number];

function hexToVec3(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const PALETTE_HEX = {
  toxicGreen: '#39FF14',
  deepPurple: '#2A0845',
  pumpkinOrange: '#FF6A00',
  bone: '#F2EAD3',
  black: '#0A0A0A',
} as const;

export const PALETTE_VEC3 = {
  toxicGreen: hexToVec3(PALETTE_HEX.toxicGreen),
  deepPurple: hexToVec3(PALETTE_HEX.deepPurple),
  pumpkinOrange: hexToVec3(PALETTE_HEX.pumpkinOrange),
  bone: hexToVec3(PALETTE_HEX.bone),
  black: hexToVec3(PALETTE_HEX.black),
} as const;
