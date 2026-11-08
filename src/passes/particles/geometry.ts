import * as THREE from 'three';
import { PALETTE_VEC3, type Vec3 } from '../../app/palette.ts';
import type { ParticleKind } from './kinds.ts';

const P = PALETTE_VEC3;
const YELLOW_ORANGE: Vec3 = [1, 0.78, 0.2];

interface Part {
  geo: THREE.BufferGeometry;
  color: Vec3 | ((x: number, y: number, z: number) => Vec3);
}

function place(
  geo: THREE.BufferGeometry,
  pos: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
  rot: [number, number, number] = [0, 0, 0],
): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Merges parts into one non-indexed geometry with a per-vertex `color` attribute. */
function merge(parts: Part[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  for (const { geo, color } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      positions.push(x, y, z);
      const c = typeof color === 'function' ? color(x, y, z) : color;
      colors.push(c[0], c[1], c[2]);
    }
    g.dispose();
    if (g !== geo) geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.computeVertexNormals();
  return out;
}

function box(w: number, h: number, d: number, pos: [number, number, number], rot?: [number, number, number]) {
  return place(new THREE.BoxGeometry(w, h, d), pos, [1, 1, 1], rot);
}

function bat(): THREE.BufferGeometry {
  // Wing: triangle fan (3 triangles), double-sided so it is visible from both faces.
  const wing = (sign: number): THREE.BufferGeometry => {
    const v = [
      [0.15 * sign, 0.05, 0],
      [0.55 * sign, 0.45, 0],
      [0.95 * sign, 0.15, 0],
      [0.75 * sign, -0.2, 0],
      [0.3 * sign, -0.15, 0],
    ];
    const tris = [
      [0, 1, 2],
      [0, 2, 3],
      [0, 3, 4],
    ];
    const p: number[] = [];
    for (const [a, b, c] of tris) {
      p.push(...v[a], ...v[b], ...v[c]);
      p.push(...v[a], ...v[c], ...v[b]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return g;
  };
  return merge([
    { geo: place(new THREE.ConeGeometry(0.18, 0.5, 5), [0, 0, 0], [1, 1, 0.7]), color: P.black },
    { geo: wing(1), color: P.deepPurple },
    { geo: wing(-1), color: P.deepPurple },
    { geo: box(0.08, 0.08, 0.08, [0.07, 0.28, 0.1]), color: P.bone },
  ]);
}

function skull(): THREE.BufferGeometry {
  return merge([
    { geo: place(new THREE.IcosahedronGeometry(0.5, 0), [0, 0.1, 0]), color: P.bone },
    { geo: box(0.4, 0.22, 0.4, [0, -0.38, 0]), color: P.bone },
    { geo: box(0.14, 0.14, 0.05, [-0.17, 0.08, 0.47]), color: P.black },
    { geo: box(0.14, 0.14, 0.05, [0.17, 0.08, 0.47]), color: P.black },
  ]);
}

function pumpkin(): THREE.BufferGeometry {
  return merge([
    { geo: place(new THREE.IcosahedronGeometry(0.5, 1), [0, 0, 0], [1, 0.8, 1]), color: P.pumpkinOrange },
    { geo: place(new THREE.ConeGeometry(0.08, 0.22, 6), [0, 0.5, 0]), color: P.toxicGreen },
  ]);
}

function candyCorn(): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(0.4, 1, 3, 3);
  return merge([
    {
      geo: cone,
      // Cone spans y in [-0.5, 0.5]: base bone, middle orange, tip yellow-orange... bands by height.
      color: (_x, y) => (y < -0.17 ? P.bone : y < 0.17 ? P.pumpkinOrange : YELLOW_ORANGE),
    },
  ]);
}

function coffin(): THREE.BufferGeometry {
  // Elongated hexagon prism lying flat (extruded along z).
  const hex = (r: number, h: number, z: number) =>
    place(new THREE.CylinderGeometry(r, r, h, 6), [0, 0, z], [0.6, 1, 1], [Math.PI / 2, 0, 0]);
  return merge([
    { geo: place(hex(0.5, 0.25, 0), [0, 0, 0], [1, 1.6, 1]), color: P.deepPurple },
    { geo: place(hex(0.3, 0.05, 0.14), [0, 0, 0], [1, 1.6, 1]), color: P.bone },
  ]);
}

function eyeball(): THREE.BufferGeometry {
  return merge([
    { geo: new THREE.IcosahedronGeometry(0.5, 1), color: P.bone },
    { geo: place(new THREE.IcosahedronGeometry(0.2, 0), [0, 0, 0.42], [1, 1, 0.6]), color: P.toxicGreen },
  ]);
}

function tombstone(): THREE.BufferGeometry {
  return merge([
    { geo: box(0.7, 0.8, 0.2, [0, -0.2, 0]), color: P.bone },
    {
      geo: place(
        new THREE.CylinderGeometry(0.35, 0.35, 0.2, 6, 1, false, 0, Math.PI),
        [0, 0.2, 0],
        [1, 1, 1],
        [Math.PI / 2, 0, Math.PI / 2],
      ),
      color: P.deepPurple,
    },
  ]);
}

function spider(): THREE.BufferGeometry {
  const parts: Part[] = [
    { geo: new THREE.IcosahedronGeometry(0.22, 0), color: P.black },
  ];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 1 : -1;
    const k = i % 4;
    const ang = (k - 1.5) * 0.45;
    parts.push({
      geo: place(new THREE.BoxGeometry(0.5, 0.04, 0.04), [side * 0.4, 0, 0], [1, 1, 1], [0, ang, side * -0.35]),
      color: P.toxicGreen,
    });
  }
  return merge(parts);
}

const BUILDERS: Record<ParticleKind, () => THREE.BufferGeometry> = {
  bat,
  skull,
  pumpkin,
  candy_corn: candyCorn,
  coffin,
  eyeball,
  tombstone,
  spider,
};

/** Builds the procedural low-poly geometry (non-indexed, `position`/`normal`/`color`) for a kind. */
export function buildGeometry(kind: ParticleKind): THREE.BufferGeometry {
  return BUILDERS[kind]();
}

export function triangleCount(geo: THREE.BufferGeometry): number {
  return geo.getAttribute('position').count / 3;
}
