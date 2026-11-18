import * as THREE from 'three';

/** Symmetric box basis with positive orientation: instance matrices cannot change per-instance front-face culling. */
export function outwardBoxBasis(along:THREE.Vector3,up:THREE.Vector3,across:THREE.Vector3){
  const normal=across.clone();
  if(new THREE.Vector3().crossVectors(along,up).dot(normal)<0)normal.negate();
  return new THREE.Matrix4().makeBasis(along,up,normal);
}
