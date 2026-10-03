import * as THREE from 'three';
import {yardSignedArea,type YardBox} from '../../yardModel';
import {untiltStockPoint,tiltStockPoint,planeNormalScale,planeAt} from '../../yardElevationGeometry';
/** Render-only edge relief; stock footprints and full heights remain unchanged. */
const PAVER_CHAMFER_IN=.085;
export function yardFinishGeometry(b:YardBox){
 if(b.role==='rock'){const g=new THREE.IcosahedronGeometry(1,1),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const k=.88+.12*(Math.abs(Math.sin(p.getX(i)*91+p.getY(i)*71+p.getZ(i)*31))%1);p.setXYZ(i,p.getX(i)*b.w*.5*k,p.getY(i)*b.h*.5*k,p.getZ(i)*b.d*.5*k);}g.translate(b.x,b.y,b.z);g.computeVertexNormals();return g;}
 if(b.polygon?.length){const rigid=b.topPlane&&b.normalThicknessIn!==undefined,origin={x:b.x,y:b.z},contours=(b.renderContours??[b.polygon]).map(p=>rigid?p.map(v=>untiltStockPoint(v,b.topPlane!,origin)):p),make=(poly:typeof b.polygon)=>{const path=new THREE.Shape();poly!.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));path.closePath();return path;},shapes=contours.filter(p=>yardSignedArea(p)>0).map(make);const inside=(p:typeof b.polygon,q:{x:number;y:number})=>{let hit=false;for(let i=0,j=p!.length-1;i<p!.length;j=i++){const a=p![i],z=p![j];if((a.y>q.y)!==(z.y>q.y)&&q.x<(z.x-a.x)*(q.y-a.y)/(z.y-a.y)+a.x)hit=!hit;}return hit;};for(const hole of contours.filter(p=>yardSignedArea(p)<0)){const i=contours.filter(p=>yardSignedArea(p)>0).findIndex(p=>inside(p,hole[0]));if(i>=0)shapes[i].holes.push(make(hole));}
  // A paver's top edge is chamfered (PAVER_CHAMFER_IN), which is what shows its joints from across the yard.
  // The larger visible chamfers catch grazing daylight like the actual cast concrete edges.
  // Bevel offset keeps the nominal stock footprint and full height unchanged.
  const edge=b.role==='stone-step'?.08:b.role==='wall-cap'?.13:b.role==='wall-block'?.10:b.role==='paver'&&!b.illustrative?PAVER_CHAMFER_IN:0,c=Math.min(b.w,b.d)>edge*4&&b.h>edge*3?edge:0;
  const g=new THREE.ExtrudeGeometry(shapes,c?{depth:b.h-2*c,bevelEnabled:true,bevelThickness:c,bevelSize:c,bevelOffset:-c,bevelSegments:b.role==='paver'?1:2}:{depth:b.h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,b.y+b.h/2-c,0);
  if(rigid){const p=g.getAttribute('position'),plane=b.topPlane!,scale=planeNormalScale(plane),flatTop=b.y+b.h/2;for(let i=0;i<p.count;i++){const q=tiltStockPoint({x:p.getX(i),y:p.getZ(i)},plane,origin),down=(flatTop-p.getY(i))/scale;p.setXYZ(i,q.x+plane.x*down,planeAt(plane,q.x,q.y)-down,q.y+plane.z*down);}g.computeVertexNormals();}
  else if(b.topPlane&&(b.bottomIn!==undefined||b.bottomPlane)){const p=g.getAttribute('position'),lo=b.y-b.h/2;for(let i=0;i<p.count;i++){const top=b.topPlane.x*p.getX(i)+b.topPlane.z*p.getZ(i)+b.topPlane.constant,t=Math.max(0,Math.min(1,(p.getY(i)-lo)/b.h));const bottom=b.bottomPlane?planeAt(b.bottomPlane,p.getX(i),p.getZ(i)):b.bottomIn!;p.setY(i,bottom+t*(top-bottom));}g.computeVertexNormals();}
  return g;}
 const g=new THREE.BoxGeometry(b.w,b.h,b.d);g.rotateY(b.angle||0);g.translate(b.x,b.y,b.z);return g.toNonIndexed();
}
