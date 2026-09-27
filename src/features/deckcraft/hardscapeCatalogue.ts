import index from '../../data/hardscape-index.json';
import type {YardFeature} from './types';

/** The compact, generated engineering index is the authority for saved selections.
 * Product photos, prose and supplier pattern guides are fetched separately by the picker. */
export interface HardscapeUnit {id:string;widthMm:number;lengthMm:number;heightMm:number;role:string;shape?:string;colorIds?:string[]}
export interface HardscapeColor {id:string;imageUrl?:string;hex?:string}
export interface HardscapeRecipe {widthMm:number;depthMm:number;jointMm?:number;cells:{unitId:string;xMm:number;yMm:number;rotationDeg:number}[]}
export interface HardscapePattern {id:string;name:string;sourceUrl:string;layout:HardscapeRecipe}
export interface HardscapeVariant {id:string;colors:HardscapeColor[];units:HardscapeUnit[];patterns:HardscapePattern[]}
export interface HardscapeProduct {id:string;name:string;brand:string;category:string;sourceUrl:string;finishes:HardscapeVariant[]}
type Row=[string,string,string,string,string,[string,[string,string?,string?][],[string,number|null,number|null,number|null,string?,string?,string[]?][],HardscapePattern[]?][]];
export const HARDSCAPE_PRODUCTS:HardscapeProduct[]=(index.products as Row[]).map(([id,name,brand,category,sourceUrl,finishes])=>({id,name,brand,category,sourceUrl,finishes:finishes.map(([id,colors,units,patterns])=>({id,colors:colors.map(([id,imageUrl,hex])=>({id,imageUrl,hex})),units:units.filter(u=>[u[1],u[2],u[3]].every(n=>typeof n==='number'&&n>0)).map(([id,widthMm,lengthMm,heightMm,role,shape,colorIds])=>({id,widthMm:widthMm!,lengthMm:lengthMm!,heightMm:heightMm!,role:role??'standard',shape,colorIds})),patterns:patterns??[]}))}));
export const rectangularUnit=(u:HardscapeUnit)=>!u.shape||['rectangle','rectangular','rectangular-nominal','square','square-nominal'].includes(u.shape);
export const hardscapeBody=(role:string)=>!/(^|[- ])(cap|coping|corner|base|step|accessory)([- ]|$)/.test(role);
export const HARDSCAPE_PATTERNS=[{id:'running-bond',name:'Running bond'},{id:'stack-bond',name:'Stack bond'},{id:'herringbone',name:'Herringbone'},{id:'basket-weave',name:'Basket weave'}] as const;
export function hardscapeProduct(id:string){return HARDSCAPE_PRODUCTS.find(p=>p.id===id);}
export function hardscapeSelection(f:YardFeature){const product=hardscapeProduct(f.productId),finish=product?.finishes.find(v=>v.id===f.hardscape?.finishId),color=finish?.colors.find(c=>c.id===f.hardscape?.colorId),unit=finish?.units.find(u=>u.id===f.hardscape?.unitId),cap=finish?.units.find(u=>u.id===f.hardscape?.capUnitId);return product&&finish&&color&&unit?{product,finish,color,unit,cap}:undefined;}
export function hardscapeProblem(f:YardFeature):string{
 const p=hardscapeProduct(f.productId);if(!p)return f.hardscape?'A supplier variant needs a catalogue product.':'';
 if(f.kind==='water-feature'||(p.category==='wall')!==(f.kind==='retaining-wall'))return 'The supplier product does not match this feature.';
 const s=hardscapeSelection(f);if(!s)return 'Choose a documented finish, colour and unit size.';
 if(!hardscapeBody(s.unit.role))return 'Choose a paving or wall-body unit for this feature.';
 if(s.unit.colorIds&&!s.unit.colorIds.includes(s.color.id))return 'That stock unit is not listed in this colour.';
 if(f.hardscape?.capUnitId!==undefined&&(f.kind!=='retaining-wall'||!s.cap||!/(^|[- ])(cap|coping)([- ]|$)/.test(s.cap.role)||s.cap.colorIds&&!s.cap.colorIds.includes(s.color.id)||s.cap.heightMm/25.4>f.heightIn||s.cap.lengthMm<s.unit.lengthMm||s.cap.lengthMm>s.unit.lengthMm+304.8))return 'Choose a compatible cap in this colour, no taller than the exposed wall and at least as deep as its body unit.';
 const a=f.hardscape!,recipe=s.finish.patterns.find(p=>p.id===a.patternId);if(!HARDSCAPE_PATTERNS.some(p=>p.id===a.patternId)&&!recipe||!Number.isFinite(a.angleDeg)||a.angleDeg<0||a.angleDeg>=360||!Number.isFinite(a.jointMm)||a.jointMm<0||a.jointMm>25)return 'Invalid laying direction, pattern or joint size.';
 if(recipe){if(a.jointMm!==(recipe.layout.jointMm??0))return 'This manufacturer recipe retains its documented joint/module pitch.';if(recipe.layout.cells.some(cell=>{const u=s.finish.units.find(u=>u.id===cell.unitId);return !u||!hardscapeBody(u.role)||u.heightMm!==s.unit.heightMm||u.colorIds&&!u.colorIds.includes(s.color.id);}))return 'This supplier pattern is unavailable in the selected colour or thickness.';if(!recipe.layout.cells.some(cell=>cell.unitId===s.unit.id))return 'Choose a stock unit belonging to the manufacturer pattern.';}
 if(f.kind==='retaining-wall'&&a.patternId!=='running-bond'&&a.patternId!=='stack-bond')return 'Wall courses use running bond or stack bond.';
 if(f.kind==='retaining-wall'&&(a.angleDeg!==0||a.jointMm!==0))return 'Dry-laid wall courses follow the drawn path with zero mortar joint.';
 if(a.patternId==='basket-weave'&&Math.abs(s.unit.lengthMm+a.jointMm-2*(s.unit.widthMm+a.jointMm))>1)return 'Basket weave requires a documented two-to-one joint module; choose another unit or pattern.';
 if(f.kind==='retaining-wall'&&Math.abs(f.depthFt-s.unit.lengthMm/304.8)>1e-6)return 'Wall thickness must match the selected supplier unit.';
 return '';
}
export function hardscapeName(f:YardFeature){const s=hardscapeSelection(f);return s?`${s.product.brand} ${s.product.name} · ${s.color.id.replaceAll('-',' ')}`:f.productId;}
