import {PERGOLA_PRODUCTS,type PergolaSupplier} from './pergolaCatalog';
export const PERGOLA_SUPPLIERS:PergolaSupplier[]=[
  {id:'lousol',name:'LOUSOL',role:'manufacturer',location:'Mississauga, Ontario',origin:'Ontario, Canada',sourceUrl:'https://www.aluminumpergola.ca/about-us/'},
  {id:'kimbel',name:'Kimbel',role:'manufacturer',location:'Mississauga, Ontario',origin:'Canada; Ontario operations',sourceUrl:'https://www.kimbel.ca/company'},
  {id:'stobag',name:'STOBAG',role:'manufacturer',location:'Burlington, Ontario (North America)',origin:null,sourceUrl:'https://aboveallawnings.ca/products/louvered-pergolas/'},
  {id:'mirador',name:'Mirador / Zhejiang Zhengte',role:'manufacturer',location:'Imported retail product',origin:null,sourceUrl:PERGOLA_PRODUCTS.find(p=>p.id==='costco-mirador')!.source.url},
  {id:'yardistry',name:'Yardistry',role:'manufacturer',location:'Canadian retail distribution',origin:null,sourceUrl:PERGOLA_PRODUCTS.find(p=>p.id==='costco-yardistry')!.source.url},
  {id:'corriveau',name:'F. Corriveau International',role:'manufacturer',location:'Canadian retail distribution',origin:null,sourceUrl:PERGOLA_PRODUCTS.find(p=>p.id==='melia')!.source.url},
  {id:'domi',name:'Domi',role:'manufacturer',location:'Online Canadian store',origin:null,sourceUrl:PERGOLA_PRODUCTS.find(p=>p.id==='domi-louvered')!.source.url},
  {id:'purple',name:'Purple Leaf',role:'manufacturer',location:'Online Canadian store',origin:null,sourceUrl:PERGOLA_PRODUCTS.find(p=>p.id==='purple-leaf')!.source.url},
  {id:'costco',name:'Costco Canada',role:'retailer',location:'Canada',origin:null,sourceUrl:'https://www.costco.ca/'},
  {id:'homedepot',name:'Home Depot Canada',role:'retailer',location:'Canada',origin:null,sourceUrl:'https://www.homedepot.ca/'},
];
