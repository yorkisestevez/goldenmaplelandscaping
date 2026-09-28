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
