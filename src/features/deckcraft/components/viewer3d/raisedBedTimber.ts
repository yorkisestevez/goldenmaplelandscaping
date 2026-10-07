import * as THREE from 'three';
import {boardVariation} from './surfaceShaders';

/** Stacked landscape timbers: a course every 6 in down from the top (the lowest partly below ground), TIMBER_IN thick. */
const COURSE_IN=6,TIMBER_IN=1.5;

/**
 * The timber edging's faces with board coordinates for the swatch material (surfaceShaders.ts, "mesh" mode): u along the
 * run at 48 in a repeat, so the grain follows the edge, and one unit of v per 6 in course down from the top, so every
 * course is its own board; one board pick a side. raisedBedFaces draws six vertices a run (a low, b low, b top, a low,
 * b top, a top, in feet); each run also gets the top edge of its top course, TIMBER_IN wide over the face line.
 */
export function timberFaceGeometry(faces:number[]){
 const pos:number[]=[],uv:number[]=[],pick:number[]=[];let crown=-Infinity;
 for(let i=1;i<faces.length;i+=3)crown=Math.max(crown,faces[i]*12);
 for(let i=0;i+17<faces.length;i+=18){
  const ax=faces[i],az=faces[i+2],bx=faces[i+3],bz=faces[i+5],y=faces[i+7],len=Math.hypot(bx-ax,bz-az)||1,ux=(bx-ax)/len,uz=(bz-az)/len;
  const side=boardVariation(Math.round(Math.atan2(uz,ux)*1000)/1000,Math.round((ux*az-uz*ax)*120)/10),along=(x:number,z:number)=>(x*ux+z*uz)*12/48;
  const put=(x:number,py:number,z:number,v:number)=>{pos.push(x,py,z);uv.push(along(x,z),v);pick.push(...side);};
  for(let k=0;k<6;k++){const j=i+k*3;put(faces[j],faces[j+1],faces[j+2],(crown-faces[j+1]*12)/COURSE_IN);}
  const h=TIMBER_IN/24,nx=-uz*h,nz=ux*h;
  for(const [x,z,s] of [[ax,az,-1],[bx,bz,-1],[bx,bz,1],[ax,az,-1],[bx,bz,1],[ax,az,1]] as const)put(x+nx*s,y,z+nz*s,s<0?.25:.75);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aVar',new THREE.Float32BufferAttribute(pick,4));
 if(pos.length)g.computeVertexNormals();return g;
}
