import assert from 'node:assert/strict';
import * as THREE from 'three';
import {outwardBoxBasis} from '../src/features/deckcraft/components/viewer3d/boxBasis';
import {guardGlass,GUARD_GLASS} from '../src/features/deckcraft/components/viewer3d/guardGlass';

// Independently compare transformed triangle winding with its surface normal. A negative instance determinant
// leaves these opposed because WebGL can only change front-face culling for a whole draw, not one instance.
let cases=0;
const cube=new THREE.BoxGeometry(1,1,1),p=cube.getAttribute('position'),n=cube.getAttribute('normal'),ix=cube.index!;
for(const az of [0,45,90,180,270])for(const rise of [-18,0,18])for(const sign of [-1,1]){
  const a=az*Math.PI/180,along=new THREE.Vector3(Math.cos(a)*48,rise,Math.sin(a)*48),up=new THREE.Vector3(0,42,0),across=new THREE.Vector3(-Math.sin(a)*.5*sign,0,Math.cos(a)*.5*sign);
  const raw=new THREE.Matrix4().makeBasis(along,up,across),m=outwardBoxBasis(along,up,across),normalM=new THREE.Matrix3().getNormalMatrix(m);
  assert(m.determinant()>0,'All glass runs and raked stair panes face outward');
  const corners=(matrix:THREE.Matrix4)=>[-.5,.5].flatMap(x=>[-.5,.5].flatMap(y=>[-.5,.5].map(z=>new THREE.Vector3(x,y,z).applyMatrix4(matrix))));
  const original=corners(raw);assert(corners(m).every(v=>original.some(o=>o.distanceTo(v)<1e-8)),'Orientation correction must preserve every panel corner');
  for(let i=0;i<ix.count;i+=3){
    const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)],v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(m));
    const geometric=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
    const shading=new THREE.Vector3().fromBufferAttribute(n,ids[0]).applyMatrix3(normalM).normalize();
    assert(geometric.dot(shading)>.9999,'Visible triangle and shading normal must agree');
  }
  cases++;
}
const glass=guardGlass();assert(glass.transparent&&!glass.depthWrite&&glass.premultipliedAlpha);
assert.equal(glass.ior,1.52);assert.equal(GUARD_GLASS.thicknessIn,.5);
const f0=((glass.ior-1)/(glass.ior+1))**2;assert(f0>.04&&f0<.045,'Clear glass reflects about four percent head-on');
cube.dispose();glass.dispose();
console.log(`CLEAR GLASS OK: ${cases} straight/raked runs preserve corners and have correct surface normals; thin-pane Fresnel blending and physical thickness verified.`);
