import profiles from '../../data/hardscape-profiles.json';
import type {HardscapeUnit} from './hardscapeCatalogue';
import type {PlanPoint} from './lib/deckGeometry';

export interface HardscapeProfile {polygons:number[][][];sourceUrl:string;page:number;basis:string;bond?:string}
export function hardscapeProfile(productId:string,unit:Pick<HardscapeUnit,'id'>):HardscapeProfile|undefined{
 const suffix=productId==='techo-industria-paver'?unit.id.includes('triangle')?':triangle':':rectangle':productId==='unilock-umbriano'?unit.id.includes('hex')?':hex':':rectangle':'';
 return (profiles as Record<string,HardscapeProfile>)[productId+suffix];
}
const names:Record<string,string>={'hex-point':'Hexagonal bond','hex-flat':'Hexagonal bond',diamond:'Diamond lattice',triangle:'Paired triangles',vertex:'Vertex A/B stack'};
export function shapedBond(productId:string,unit:Pick<HardscapeUnit,'id'>){const p=hardscapeProfile(productId,unit);return p?.bond?{id:'shape-'+p.bond,name:names[p.bond]}:undefined;}
/** Signed contours preserve open-grid voids. Coordinates use the original
 * supplier drawing at nominal size; they are not fabrication/CAD templates. */
export function hardscapeStockPolygons(productId:string,unit:HardscapeUnit,cx:number,cy:number,angle:number):PlanPoint[][]{
 const profile=hardscapeProfile(productId,unit),c=Math.cos(angle),s=Math.sin(angle),l=unit.lengthMm/25.4,w=unit.widthMm/25.4;
 const contours=profile?.polygons??[[[0,0],[1,0],[1,1],[0,1]]];
 return contours.map(poly=>poly.map(([u,v])=>{const x=(u-.5)*l,y=(v-.5)*w;return {x:cx+c*x-s*y,y:cy+s*x+c*y};}));
}
