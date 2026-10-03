/** Manually reviewed CAD catalog. Listing prices are budgets, never dealer costs or confirmed quotations. */
export const PERGOLA_CATALOG_VERSION='2026-09-26';
export interface PergolaSupplier{id:string;name:string;role:'manufacturer'|'retailer';location:string;origin:string|null;sourceUrl:string}
export interface PergolaSource{url:string;checkedAt:string;note?:string}
export interface PergolaDimensions{widthIn:number;depthIn:number;heightIn:number}
export interface PergolaFinish{id:string;name:string;hex:string}
export interface PergolaAccessory{id:string;name:string;priceCad:number|null;source:PergolaSource;kind:'motor'|'led'|'screen';side?:'front'|'back'|'left'|'right'}
export interface PergolaVariant{
  id:string;sku:string|null;currency:'CAD';priceBasis:'supply-only';label:string;nominalFt:[number,number]|null;dimensions:PergolaDimensions|null;
  priceCad:number|null;regularPriceCad?:number;availability:'listed'|'sold-out'|'quote-required'|'unverified';
  source:PergolaSource;dimensionNote:string;manualUrls:string[];
}
export interface PergolaProduct{
  id:string;name:string;manufacturerId:string;retailerId:string|null;custom:boolean;operation:'manual'|'motorized';
  source:PergolaSource;variants:PergolaVariant[];frameFinishes:PergolaFinish[];roofFinishes:PergolaFinish[];
  drainage:string;warranty:string|null;accessories:PergolaAccessory[];postIn:number|null;maxLouverDeg:number|null;
  sizeLimits?:{widthFt:[number,number];depthFt:[number,number];heightFt:[number,number]};
  installedBudget?:{lowPerSqft:number;highPerSqft:number;openEnded:boolean;source:PergolaSource};notes:string[];
}
export interface PergolaSelection{
  productId:string;variantId:string;frameFinish:string;roofFinish:string;accessories:string[];
  supplyMode:'supply-install'|'install-only';target:{kind:'deck';level:number}|{kind:'patio';featureId:string};
  xFt:number;zFt:number;rotationDeg:number;louverDeg:number;
  lighting?:'perimeter-led';
  customSize?:{widthFt:number;depthFt:number;heightFt:number};
}
const source=(url:string,note?:string):PergolaSource=>({url,checkedAt:PERGOLA_CATALOG_VERSION,...(note?{note}:{})});
const urls={
  lousol:'https://www.aluminumpergola.ca/collections/louvered-pergolas/louvered-pergola-kit-with-zip-screen/',
  custom:'https://www.aluminumpergola.ca/pergola-cost/',kimbel:'https://www.kimbel.ca/products/residentialpatio',
  stobag:'https://www.stobag.ca/us/en/products/patio-and-canopy/pavilion-and-pergola/bavona-hardtop',
  mirador:'https://www.costco.ca/p/-/mirador-88-ft-x-144-ft-adjustable-louvered-aluminum-pergola/4000307043',
  miradorPrice:'https://www.costco.ca/CompareProductsDisplay?partNumbers=4000307043',
  yardistry:'https://www.costco.ca/p/-/yardistry-aluminum-louvered-pergola/4000348342',
  melia13:'https://www.homedepot.ca/product/f-corriveau-international-melia-adjustable-louvered-aluminum-pergola-10-x13/1001935752',
  melia19:'https://www.homedepot.ca/product/f-corriveau-international-melia-adjustable-louvered-aluminum-pergola-10-x19-/1001935753',
  domi:'https://domioutdoorliving.ca/products/aluminum-louvered-pergola',
  purple:'https://purpleleafshop.ca/products/purple-leaf-louvered-pergola-outdoor-aluminum-pergola-patio-pergola-with-adjustable-roof-for-deck-garden-yard-hardtop-gazebo',
};
const finish=(id:string,name:string,hex:string):PergolaFinish=>({id,name,hex});
const grey=finish('grey','Grey','#55595b'),white=finish('white','White','#e7e7e2'),black=finish('black','Black','#242627');
const variant=(id:string,label:string,nominalFt:[number,number]|null,url:string,priceCad:number|null,extra:Partial<PergolaVariant>={}):PergolaVariant=>({id,label,nominalFt,sku:null,currency:'CAD',priceBasis:'supply-only',dimensions:null,priceCad,availability:priceCad===null?'quote-required':'listed',source:source(url),dimensionNote:'',manualUrls:[],...extra});
const common={drainage:'Integrated gutters and drainage through posts',warranty:null,accessories:[],postIn:null,maxLouverDeg:null,notes:[]} satisfies Partial<PergolaProduct>;
const customVariant=(url:string)=>[variant('custom','Custom configuration',null,url,null)];
export const PERGOLA_PRODUCTS:PergolaProduct[]=[
  {...common,id:'lousol-junior',name:'LOUSOL Junior',manufacturerId:'lousol',retailerId:null,custom:false,operation:'manual',source:source(urls.lousol),
    variants:[variant('10x12','10 × 12 ft',[10,12],urls.lousol,9950,{dimensionNote:''})],
    frameFinishes:[finish('umbra-grey','Umbra Grey · RAL 7022','#4b4d46')],roofFinishes:[finish('traffic-white','Traffic White · RAL 9016','#e7e7e2')],maxLouverDeg:135,
    warranty:null,
    accessories:[{id:'motor',name:'Louver motor',kind:'motor',priceCad:2200,source:source(urls.lousol)},{id:'led',name:'Warm white LED lighting',kind:'led',priceCad:1850,source:source(urls.lousol)},
      ...(['front','right','back','left'] as const).map((side,i)=>({id:`screen-${side}`,name:`Manual ZIP screen · ${side} · ${i%2?12:10} × 9 ft`,kind:'screen' as const,side,priceCad:i%2?2550:2350,source:source(urls.lousol)}))]},
  {...common,id:'lousol-custom',name:'LOUSOL Custom',manufacturerId:'lousol',retailerId:null,custom:true,operation:'motorized',source:source(urls.custom),variants:customVariant(urls.custom),frameFinishes:[grey,black,white],roofFinishes:[white,black],installedBudget:{lowPerSqft:130,highPerSqft:200,openEnded:true,source:source(urls.custom,'Installed project budget, not a supply cost. The 10×12 area row in this guide is incorrect and is not used.')},notes:[]},
  {...common,id:'kimbel-custom',name:'Kimbel Louvered',manufacturerId:'kimbel',retailerId:null,custom:true,operation:'motorized',source:source(urls.kimbel),variants:customVariant(urls.kimbel),frameFinishes:[black,white,grey],roofFinishes:[white,grey],warranty:null,notes:[]},
  {...common,id:'stobag-bavona',name:'STOBAG BAVONA Hard-Top',manufacturerId:'stobag',retailerId:null,custom:true,operation:'motorized',source:source(urls.stobag),variants:customVariant(urls.stobag),frameFinishes:[white,black,grey],roofFinishes:[white,grey],notes:[]},
  {...common,id:'costco-mirador',name:'Mirador',manufacturerId:'mirador',retailerId:'costco',custom:false,operation:'manual',source:source(urls.mirador),variants:[variant('8-8x14-4','8.8 × 14.4 ft',[8.8,14.4],urls.miradorPrice,2999.99,{sku:'Costco item 1807326 / product 4000307043',dimensions:{widthIn:2650/25.4,depthIn:4380/25.4,heightIn:2510/25.4},dimensionNote:''})],frameFinishes:[grey],roofFinishes:[grey],warranty:null},
  {...common,id:'costco-yardistry',name:'Yardistry Aluminum',manufacturerId:'yardistry',retailerId:'costco',custom:false,operation:'manual',source:source(urls.yardistry),variants:([10,12,14] as const).map((d)=>variant(`12x${d}`,`12 × ${d} ft`,[12,d],urls.yardistry,null,{dimensions:{widthIn:3700/25.4,depthIn:({10:3100,12:3700,14:4200}[d])/25.4,heightIn:2500/25.4},availability:'unverified',dimensionNote:''})),frameFinishes:[grey],roofFinishes:[white],postIn:6,warranty:null,notes:[]},
  {...common,id:'melia',name:'F. Corriveau Mélia',manufacturerId:'corriveau',retailerId:'homedepot',custom:false,operation:'manual',source:source(urls.melia13),variants:[variant('10x13','10 × 13 ft',[10,13],urls.melia13,3198,{sku:'N101304-F96-000 / 1001935752',dimensionNote:''}),variant('10x19','10 × 19 ft',[10,19],urls.melia19,5098,{sku:'N101904-F96-000 / 1001935753',dimensions:{widthIn:118,depthIn:228,heightIn:94.5},dimensionNote:''})],frameFinishes:[black],roofFinishes:[black],warranty:null,notes:[]},
  {...common,id:'domi-louvered',name:'Domi Louvered',manufacturerId:'domi',retailerId:null,custom:false,operation:'manual',source:source(urls.domi),variants:[variant('10x10','10 × 10 ft',[10,10],urls.domi,2199.99,{sku:'LGFA1693-G',regularPriceCad:2798.99,availability:'sold-out'}),variant('10x12','10 × 12 ft',[10,12],urls.domi,null,{availability:'unverified'})],frameFinishes:[grey],roofFinishes:[grey],warranty:null},
  {...common,id:'purple-leaf',name:'Purple Leaf Louvered',manufacturerId:'purple',retailerId:null,custom:false,operation:'manual',source:source(urls.purple),variants:[variant('13x15','13 × 15 ft',[13,15],urls.purple,4189,{sku:'ZYCA05KSPRG1315',regularPriceCad:4999}),variant('10x12','10 × 12 ft',[10,12],urls.purple,null,{availability:'unverified'}),variant('10x16','10 × 16 ft',[10,16],urls.purple,null,{availability:'unverified'})],frameFinishes:[grey],roofFinishes:[grey],notes:[]},
];
export const pergolaProduct=(s:Pick<PergolaSelection,'productId'>)=>PERGOLA_PRODUCTS.find(p=>p.id===s.productId);
export const pergolaVariant=(s:Pick<PergolaSelection,'productId'|'variantId'>)=>pergolaProduct(s)?.variants.find(v=>v.id===s.variantId);
export function pergolaSize(s:PergolaSelection):PergolaDimensions{
  const p=pergolaProduct(s),v=pergolaVariant(s);
  if(p?.custom&&s.customSize)return {widthIn:s.customSize.widthFt*12,depthIn:s.customSize.depthFt*12,heightIn:s.customSize.heightFt*12};
  return v?.dimensions??{widthIn:(v?.nominalFt?.[0]??12)*12,depthIn:(v?.nominalFt?.[1]??12)*12,heightIn:p?.id==='lousol-junior'?108:96};
}
export function newPergola(productId:string,variantId?:string):PergolaSelection{
  const p=PERGOLA_PRODUCTS.find(p=>p.id===productId);if(!p)throw new Error('Unknown pergola product.');
  const v=p.variants.find(v=>v.id===variantId)??p.variants[0];
  const s:PergolaSelection={productId:p.id,variantId:v.id,frameFinish:p.frameFinishes[0].id,roofFinish:p.roofFinishes[0].id,accessories:[],supplyMode:'supply-install',target:{kind:'deck',level:0},xFt:8,zFt:7,rotationDeg:0,louverDeg:0,...(p.custom?{customSize:{widthFt:12,depthFt:12,heightFt:9}}:{})};return s;
}
/** Explicit public allowlist. A design file cannot supply prices, confirmations or arbitrary source URLs. */
export function validatePergola(value:unknown):PergolaSelection{
  const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid pergola configuration.');return v as Record<string,unknown>;};
  const v=obj(value),p=PERGOLA_PRODUCTS.find(p=>p.id===v.productId),variant=p?.variants.find(x=>x.id===v.variantId);
  if(!p||!variant)throw new Error('This pergola product or variant is unavailable.');
  const n=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Pergola dimension or placement is out of range.');return v;};
  const t=obj(v.target);let target:PergolaSelection['target'];
  if(t.kind==='deck'&&Number.isInteger(t.level))target={kind:'deck',level:n(t.level,0,2)};
  else if(t.kind==='patio'&&typeof t.featureId==='string'&&t.featureId.length<=100)target={kind:'patio',featureId:t.featureId};
  else throw new Error('Invalid pergola support surface.');
  if(!p.frameFinishes.some(f=>f.id===v.frameFinish)||!p.roofFinishes.some(f=>f.id===v.roofFinish))throw new Error('Unsupported pergola finish.');
  if(v.supplyMode!=='supply-install'&&v.supplyMode!=='install-only')throw new Error('Invalid pergola supply mode.');
  if(!Array.isArray(v.accessories)||v.accessories.length>8||!v.accessories.every(id=>typeof id==='string'&&p.accessories.some(a=>a.id===id)))throw new Error('Unsupported pergola accessory.');
  const clean:PergolaSelection={productId:p.id,variantId:variant.id,frameFinish:v.frameFinish as string,roofFinish:v.roofFinish as string,accessories:[...new Set(v.accessories as string[])],supplyMode:v.supplyMode,target,xFt:n(v.xFt,-200,200),zFt:n(v.zFt,-200,200),rotationDeg:n(v.rotationDeg,-180,180),louverDeg:n(v.louverDeg,0,p.maxLouverDeg??90)};
  if(v.lighting!==undefined&&v.lighting!=='perimeter-led')throw new Error('Invalid pergola lighting.');
  if(v.lighting==='perimeter-led'&&!clean.accessories.includes('led'))clean.lighting='perimeter-led';
  if(p.custom){const c=obj(v.customSize);clean.customSize={widthFt:n(c.widthFt,...(p.sizeLimits?.widthFt??[4,30])),depthFt:n(c.depthFt,...(p.sizeLimits?.depthFt??[4,30])),heightFt:n(c.heightFt,...(p.sizeLimits?.heightFt??[7,14]))};}
  return clean;
}
