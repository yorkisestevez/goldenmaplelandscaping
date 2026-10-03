import index from '../../data/hardscape-index.json';
import type {YardFeature} from './types';
import {shapedBond} from './hardscapeShapes';
import {wallCapOptions} from './wallCaps';

/** The compact, generated engineering index is the authority for saved selections.
 * Product photos, prose and supplier pattern guides are fetched separately by the picker. */
export interface HardscapeUnit {id:string;widthMm:number;lengthMm:number;heightMm:number;role:string;shape?:string;colorIds?:string[]}
/** `swatch` marks a local manufacturer photo; its path loads with the 3D view (hardscapeSwatchKey). */
export interface HardscapeColor {id:string;swatch?:boolean;hex?:string}
export interface HardscapeRecipe {widthMm:number;depthMm:number;jointMm?:number;angleDeg?:number;jointStatus?:string;jointNotes?:string;installationJointMm?:number;repeatBasisMm?:[[number,number],[number,number]];cells:{unitId:string;xMm:number;yMm:number;rotationDeg:number}[]}
export interface HardscapePattern {id:string;name:string;sourceUrl:string;layout:HardscapeRecipe}
export interface HardscapeVariant {id:string;colors:HardscapeColor[];units:HardscapeUnit[];patterns:HardscapePattern[]}
export interface HardscapeProduct {id:string;name:string;brand:string;category:string;sourceUrl:string;finishes:HardscapeVariant[]}
type IndexedCell=[number,number,number,number];
type IndexedLayout=Omit<HardscapeRecipe,'cells'>&{cells:(IndexedCell|HardscapeRecipe['cells'][number])[]};
type IndexedPattern=Omit<HardscapePattern,'layout'>&{layout:IndexedLayout|number};
type Row=[string,string,string,string,string,[string,[string,(1|string|null)?,string?][],[string,number|null,number|null,number|null,string?,string?,string[]?][],IndexedPattern[]?][]];
const indexedLayouts=(index as unknown as {layouts?:IndexedLayout[]}).layouts??[];
// Cells in the generated engineering index use a finish-local stock index.
// Resolve against the original unit array before filtering undocumented stock,
// so a retained pending unit cannot shift the IDs of valid pattern cells.
export const HARDSCAPE_PRODUCTS:HardscapeProduct[]=(index.products as unknown as Row[]).map(([id,name,brand,category,sourceUrl,finishes])=>({id,name,brand,category,sourceUrl,finishes:finishes.map(([id,colors,units,patterns])=>({id,colors:colors.map(([id,swatch,hex])=>({id,swatch:!!swatch,hex})),units:units.filter(u=>[u[1],u[2],u[3]].every(n=>typeof n==='number'&&n>0)).map(([id,widthMm,lengthMm,heightMm,role,shape,colorIds])=>({id,widthMm:widthMm!,lengthMm:lengthMm!,heightMm:heightMm!,role:role??'standard',shape,colorIds})),patterns:(patterns??[]).map(p=>{const layout=typeof p.layout==='number'?indexedLayouts[p.layout]:p.layout;return {...p,layout:{...layout,cells:layout.cells.map(cell=>Array.isArray(cell)?{unitId:units[cell[0]][0],xMm:cell[1],yMm:cell[2],rotationDeg:cell[3]}:cell)}};})}))}));
export const rectangularUnit=(u:HardscapeUnit)=>!u.shape||['rectangle','rectangular','rectangular-nominal','square','square-nominal'].includes(u.shape);
export const hardscapeBody=(role:string)=>!/(^|[- ])(cap|coping|corner|base|step|accessory)([- ]|$)/.test(role);
export const HARDSCAPE_PATTERNS=[{id:'running-bond',name:'Running bond'},{id:'stack-bond',name:'Stack bond'},{id:'herringbone',name:'Herringbone'},{id:'basket-weave',name:'Basket weave'}] as const;
export function hardscapeProduct(id:string){return HARDSCAPE_PRODUCTS.find(p=>p.id===id);}
/** Key of a colour's manufacturer photo in the lazily fetched public/deckcraft/hardscape-swatches.json. */
export const hardscapeSwatchKey=(productId:string,finishId:string,colorId:string)=>`${productId}/${finishId}/${colorId}`;
export function hardscapeSelection(f:YardFeature){const product=hardscapeProduct(f.productId),finish=product?.finishes.find(v=>v.id===f.hardscape?.finishId),color=finish?.colors.find(c=>c.id===f.hardscape?.colorId),unit=finish?.units.find(u=>u.id===f.hardscape?.unitId);if(!product||!finish||!color||!unit)return undefined;const caps=f.kind==='retaining-wall'?wallCapOptions(HARDSCAPE_PRODUCTS,product,finish,color.id,unit,f.heightIn):[],cap=caps.find(u=>u.id===f.hardscape?.capUnitId);return {product,finish,color,unit,cap,caps};}
export function hardscapeProblem(f:YardFeature):string{
 const p=hardscapeProduct(f.productId);if(!p)return f.hardscape?'A supplier variant needs a catalogue product.':'';
 if(f.kind==='water-feature'||(p.category==='wall')!==(f.kind==='retaining-wall'))return 'The supplier product does not match this feature.';
 const s=hardscapeSelection(f);if(!s)return 'Choose a documented finish, colour and unit size.';
 if(!hardscapeBody(s.unit.role))return 'Choose a paving or wall-body unit for this feature.';
 if(s.unit.colorIds&&!s.unit.colorIds.includes(s.color.id))return 'That stock unit is not listed in this colour.';
 if(f.hardscape?.capUnitId!==undefined&&(f.kind!=='retaining-wall'||!s.cap))return 'Choose a documented compatible cap that fits the selected wall and exposed height.';
 const a=f.hardscape!,recipe=s.finish.patterns.find(p=>p.id===a.patternId),bond=shapedBond(p.id,s.unit);if(!HARDSCAPE_PATTERNS.some(p=>p.id===a.patternId)&&!recipe&&a.patternId!==bond?.id||!Number.isFinite(a.angleDeg)||a.angleDeg<0||a.angleDeg>=360||!Number.isFinite(a.jointMm)||a.jointMm<0||a.jointMm>25)return 'Invalid laying direction, pattern or joint size.';
 // Older saved files allowed envelope-based contractor patterns on shaped stock.
 // Preserve them on restore; the picker offers source-compatible choices for new work.
 if(recipe){if(a.jointMm!==(recipe.layout.jointMm??0))return 'This manufacturer recipe retains its documented joint/module pitch.';if(recipe.layout.cells.some(cell=>{const u=s.finish.units.find(u=>u.id===cell.unitId);return !u||!hardscapeBody(u.role)||u.heightMm!==s.unit.heightMm||u.colorIds&&!u.colorIds.includes(s.color.id);}))return 'This supplier pattern is unavailable in the selected colour or thickness.';if(!recipe.layout.cells.some(cell=>cell.unitId===s.unit.id))return 'Choose a stock unit belonging to the manufacturer pattern.';}
 if(f.kind==='retaining-wall'&&a.patternId!=='running-bond'&&a.patternId!=='stack-bond')return 'Wall courses use running bond or stack bond.';
 if(f.kind==='retaining-wall'&&(a.angleDeg!==0||a.jointMm!==0))return 'Dry-laid wall courses follow the drawn path with zero mortar joint.';
 if(a.patternId==='basket-weave'&&Math.abs(s.unit.lengthMm+a.jointMm-2*(s.unit.widthMm+a.jointMm))>1)return 'Basket weave requires a documented two-to-one joint module; choose another unit or pattern.';
 if(f.kind==='retaining-wall'&&Math.abs(f.depthFt-s.unit.lengthMm/304.8)>1e-6)return 'Wall thickness must match the selected supplier unit.';
 return '';
}
export function hardscapeName(f:YardFeature){const s=hardscapeSelection(f);return s?`${s.product.brand} ${s.product.name} · ${s.color.id.replaceAll('-',' ')}`:f.productId;}
