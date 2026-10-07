import type {YardBox} from '../../yardModel';
import {hardscapeAppearance,sampleInteriorUv} from './hardscapeAppearance';
import {untiltStockPoint,planeAt,planeNormalScale} from '../../yardElevationGeometry';

/** UV coordinates in the original manufacturer image. A cap photo includes its
 * front edge; this window restricts rendering to its planar top surface. */
export interface SampleWindow {u0:number;v0:number;u1:number;v1:number}

/** Face projection in the stock unit's local frame. Side faces include height,
 * and end faces include depth, so a rotated block does not stretch a single
 * photo column across its entire exposed end. No stock geometry is modified. */
export function supplierFaceUv(b:YardBox,point:{x:number;y:number;z:number},normal:{x:number;y:number;z:number},window?:SampleWindow,appearance=hardscapeAppearance(b)):[number,number]{
 const s=b.surface;
 if(!s)throw new Error('Manufacturer UV projection needs a stock surface.');
 const depth=b.topPlane&&b.normalThicknessIn!==undefined?(planeAt(b.topPlane,point.x,point.z)-point.y)/planeNormalScale(b.topPlane):0;
 const flat=b.topPlane&&b.normalThicknessIn!==undefined?untiltStockPoint({x:point.x-b.topPlane.x*depth/planeNormalScale(b.topPlane),y:point.z-b.topPlane.z*depth/planeNormalScale(b.topPlane)},b.topPlane,{x:s.cx,y:s.cz}):{x:point.x,y:point.z};
 const cos=Math.cos(s.angle),sin=Math.sin(s.angle),u=(flat.x-s.cx)*cos+(flat.y-s.cz)*sin,v=-(flat.x-s.cx)*sin+(flat.y-s.cz)*cos;
 const au=Math.abs(normal.x*cos+normal.z*sin),av=Math.abs(-normal.x*sin+normal.z*cos),ay=Math.abs(normal.y),top=ay>=Math.max(au,av);
 let a=top?u/s.lengthIn+.5:av>=au?u/s.lengthIn+.5:v/s.widthIn+.5;
 let c=top?v/s.widthIn+.5:b.topPlane&&b.normalThicknessIn!==undefined?1-depth/s.heightIn:(point.y-b.y+b.h/2)/s.heightIn;
 const directional=/borealis|wood/.test(s.swatchKey);
 // Only isotropic smooth faces rotate; directional grain retains the specified orientation.
 if(top&&!directional&&/smooth|fine-blasted/.test(s.swatchKey)){
  for(let i=0;i<appearance.quarterTurn;i++)[a,c]=[1-c,a];
 }
 a=sampleInteriorUv(a,appearance.shiftU,directional);c=sampleInteriorUv(c,appearance.shiftV,directional);
 return window?[window.u0+a*(window.u1-window.u0),window.v0+c*(window.v1-window.v0)]:[a,c];
}
