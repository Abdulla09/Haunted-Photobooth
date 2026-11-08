import * as THREE from 'three';
import { PALETTE_HEX } from '../../app/palette.ts';
import { buildGeometry } from './geometry.ts';
import { KIND_CAPACITY, PARTICLE_KINDS, type ParticleKind } from './kinds.ts';

export const OUTLINE_SCALE = 1.06;

/** 4x1 gradient map: at most four discrete shading bands (NearestFilter). */
export function createGradientMap(): THREE.DataTexture {
  const data = new Uint8Array([70, 70, 70, 255, 130, 130, 130, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createToonMaterial(gradientMap: THREE.Texture): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap });
}

export function createOutlineMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE_HEX.black), side: THREE.BackSide });
}

export interface KindMeshes {
  kind: ParticleKind;
  mesh: THREE.InstancedMesh;
  outline: THREE.InstancedMesh;
}

export interface ParticleMeshSet {
  kinds: KindMeshes[];
  /** Adds every mesh to the scene. */
  addTo(scene: THREE.Scene): void;
  dispose(): void;
}

/**
 * One InstancedMesh per kind (capacity 19) plus an inverted-hull outline mesh
 * that shares the instance matrices, for 16 draws total.
 */
export function createParticleMeshes(): ParticleMeshSet {
  const gradientMap = createGradientMap();
  const material = createToonMaterial(gradientMap);
  const outlineMaterial = createOutlineMaterial();
  const geometries: THREE.BufferGeometry[] = [];
  const kinds: KindMeshes[] = PARTICLE_KINDS.map((kind) => {
    const geo = buildGeometry(kind);
    const hullGeo = geo.clone().scale(OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE);
    geometries.push(geo, hullGeo);
    const mesh = new THREE.InstancedMesh(geo, material, KIND_CAPACITY);
    const outline = new THREE.InstancedMesh(hullGeo, outlineMaterial, KIND_CAPACITY);
    outline.instanceMatrix = mesh.instanceMatrix;
    mesh.count = 0;
    outline.count = 0;
    mesh.frustumCulled = false;
    outline.frustumCulled = false;
    return { kind, mesh, outline };
  });
  return {
    kinds,
    addTo(scene) {
      for (const k of kinds) scene.add(k.outline, k.mesh);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const k of kinds) {
        k.mesh.dispose();
        k.outline.dispose();
      }
      material.dispose();
      outlineMaterial.dispose();
      gradientMap.dispose();
    },
  };
}
