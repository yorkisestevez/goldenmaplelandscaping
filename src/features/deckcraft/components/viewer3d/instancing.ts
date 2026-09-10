// Shared instancing helper — composes a box instance matrix without allocating
// inside loops (temps are module-scoped, per the perf gate).

import * as THREE from 'three';

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _mat = new THREE.Matrix4();

/**
 * Writes instance `i` of a unit BoxGeometry as a box centred at (cx, cy, cz)
 * with dimensions (lenX, height, depthZ), yawed around Y by `yawRad`.
 * Plan convention: plan (x, y) maps to world (x, z); plan angle θ → yaw -θ.
 */
export function setBoxInstance(
  mesh: THREE.InstancedMesh, i: number,
  cx: number, cy: number, cz: number,
  lenX: number, height: number, depthZ: number,
  yawRad = 0
): void {
  _pos.set(cx, cy, cz);
  _euler.set(0, yawRad, 0);
  _quat.setFromEuler(_euler);
  _scale.set(Math.max(lenX, 0.01), Math.max(height, 0.01), Math.max(depthZ, 0.01));
  _mat.compose(_pos, _quat, _scale);
  mesh.setMatrixAt(i, _mat);
}

export const planYawRad = (angleDeg: number) => (-angleDeg * Math.PI) / 180;
