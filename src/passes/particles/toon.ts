import * as THREE from 'three';
import { PALETTE_HEX } from '../../app/palette.ts';
import { buildGhostBodyGeometry, buildGhostGeometry } from './geometry.ts';
import { KIND_CAPACITY } from './kinds.ts';

/** Outline is a slightly enlarged dark copy of the body, drawn behind. */
export const OUTLINE_SCALE = 1.12;
const OUTLINE_Z = -0.02;

/** Flat (unlit) material using the per-vertex mint body / dark eye colors. */
export function createGhostMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
}

export function createOutlineMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE_HEX.midnight), side: THREE.DoubleSide });
}

export interface ParticleMeshSet {
  mesh: THREE.InstancedMesh;
  outline: THREE.InstancedMesh;
  /** Adds both meshes to the scene. */
  addTo(scene: THREE.Scene): void;
  dispose(): void;
}

/** One InstancedMesh for the ghost plus an outline InstancedMesh sharing its matrices (2 draws). */
export function createParticleMeshes(): ParticleMeshSet {
  const material = createGhostMaterial();
  const outlineMaterial = createOutlineMaterial();
  const geo = buildGhostGeometry();
  const hullGeo = buildGhostBodyGeometry().scale(OUTLINE_SCALE, OUTLINE_SCALE, 1).translate(0, 0, OUTLINE_Z);
  const mesh = new THREE.InstancedMesh(geo, material, KIND_CAPACITY);
  const outline = new THREE.InstancedMesh(hullGeo, outlineMaterial, KIND_CAPACITY);
  outline.instanceMatrix = mesh.instanceMatrix;
  mesh.count = 0;
  outline.count = 0;
  mesh.frustumCulled = false;
  outline.frustumCulled = false;
  return {
    mesh,
    outline,
    addTo(scene) {
      scene.add(outline, mesh);
    },
    dispose() {
      geo.dispose();
      hullGeo.dispose();
      mesh.dispose();
      outline.dispose();
      material.dispose();
      outlineMaterial.dispose();
    },
  };
}
