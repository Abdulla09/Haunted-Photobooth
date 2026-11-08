import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE_VEC3, type Vec3 } from '../../app/palette.ts';

const P = PALETTE_VEC3;
const BODY_COLOR: Vec3 = P.ghostMint;
const EYE_COLOR: Vec3 = P.midnight;
/** Eyes sit slightly in front of the body to avoid z-fighting. */
const EYE_Z = 0.01;

/** Ghost silhouette about one unit wide: round head, straight sides, 3 bottom scallops. */
function ghostShape(): THREE.Shape {
  const s = new THREE.Shape();
  const r = 0.5;
  const base = -0.5;
  s.moveTo(-r, base);
  s.lineTo(-r, 0.05);
  s.absarc(0, 0.05, r, Math.PI, 0, true); // head arc, left to right over the top
  s.lineTo(r, base);
  const w = (2 * r) / 3;
  for (let i = 0; i < 3; i++) {
    const x0 = r - i * w;
    s.quadraticCurveTo(x0 - w / 2, base - 0.2, x0 - w, base);
  }
  return s;
}

function colored(geo: THREE.BufferGeometry, color: Vec3): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(color, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

function eye(x: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.absellipse(0, 0, 0.07, 0.1, 0, Math.PI * 2, false, 0);
  const g = new THREE.ShapeGeometry(s, 10);
  g.translate(x, 0.08, EYE_Z);
  return colored(g, EYE_COLOR);
}

/** Flat ghost body (ghost mint) with two dark oval eyes, as one vertex-colored geometry. */
export function buildGhostGeometry(): THREE.BufferGeometry {
  const body = colored(new THREE.ShapeGeometry(ghostShape(), 12), BODY_COLOR);
  const parts = [body, eye(-0.17), eye(0.17)];
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('ghost geometry merge failed');
  return merged;
}

/** Body-only silhouette used for the dark outline copy. */
export function buildGhostBodyGeometry(): THREE.BufferGeometry {
  return new THREE.ShapeGeometry(ghostShape(), 12);
}

export function triangleCount(geo: THREE.BufferGeometry): number {
  const index = geo.getIndex();
  return index ? index.count / 3 : geo.getAttribute('position').count / 3;
}
