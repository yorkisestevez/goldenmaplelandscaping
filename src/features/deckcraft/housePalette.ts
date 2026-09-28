/**
 * Named house colours for the exterior studio. Illustrative screen colours with generic names, not any
 * manufacturer's colour: confirm with samples. Appearance only, never priced. Loaded with the lazy studio only.
 */
export interface PaletteColour {name:string;hex:string}
export interface PaletteGroup {id:'walls'|'masonry'|'roof'|'trim'|'doors';label:string;colours:PaletteColour[]}
export const PALETTE_NOTE='Illustrative colours: confirm with samples.';

export const HOUSE_PALETTE:PaletteGroup[]=[
  {id:'walls',label:'Wall colours',colours:[
    {name:'Studio grey',hex:'#c5c7be'},{name:'Warm white',hex:'#f1ede3'},{name:'Linen',hex:'#e8e1d2'},{name:'Cream',hex:'#eadfc4'},
    {name:'Pale grey',hex:'#d3d4cf'},{name:'Pewter',hex:'#9a9d98'},{name:'Slate grey',hex:'#6f7477'},{name:'Charcoal',hex:'#3d4043'},
    {name:'Navy',hex:'#2f3d52'},{name:'Harbour blue',hex:'#5c7a93'},{name:'Sky blue',hex:'#9fb6c8'},{name:'Sage',hex:'#9aa68f'},
    {name:'Forest green',hex:'#3f5443'},{name:'Olive',hex:'#6f6d4c'},{name:'Sandstone',hex:'#c9b28c'},{name:'Tan',hex:'#b59b78'},
    {name:'Barn red',hex:'#7c2f2a'},{name:'Mocha',hex:'#6a5344'},{name:'Espresso',hex:'#3e3029'},{name:'Soft black',hex:'#2a2b2d'},
  ]},
  {id:'masonry',label:'Brick & stone tones',colours:[
    {name:'Red clay',hex:'#9a4b3a'},{name:'Rust',hex:'#8a4f33'},{name:'Burgundy',hex:'#6e3530'},{name:'Buff',hex:'#cdb38a'},
    {name:'Sand',hex:'#d6c3a0'},{name:'Grey stone',hex:'#8e8b84'},{name:'Blue-grey stone',hex:'#7b8189'},{name:'Brown stone',hex:'#7a6552'},
    {name:'Charcoal stone',hex:'#4f4d4b'},{name:'Whitewash',hex:'#dcd6cc'},
  ]},
  {id:'roof',label:'Roof colours',colours:[
    {name:'Studio charcoal',hex:'#424748'},{name:'Black',hex:'#2a2c2e'},{name:'Weathered wood',hex:'#7d7466'},{name:'Dual brown',hex:'#5d4a3a'},
    {name:'Slate grey',hex:'#5b6166'},{name:'Terracotta',hex:'#b35d3c'},{name:'Clay red',hex:'#a14a32'},{name:'Forest green',hex:'#3c4e3f'},
    {name:'Galvanised silver',hex:'#a9adae'},{name:'Copper',hex:'#9c5a36'},{name:'Patina green',hex:'#6f8f84'},{name:'Cedar',hex:'#8b6448'},
  ]},
  {id:'trim',label:'Trim & accents',colours:[
    {name:'Studio white',hex:'#f0eee6'},{name:'Bright white',hex:'#f7f6f1'},{name:'Almond',hex:'#ddd2bc'},{name:'Ivory',hex:'#e9dfc8'},
    {name:'Light grey',hex:'#c9cac5'},{name:'Bronze',hex:'#4b3b2e'},{name:'Dark anodised',hex:'#3b3d3e'},{name:'Black',hex:'#1f2021'},
  ]},
  {id:'doors',label:'Door colours',colours:[
    {name:'Studio slate',hex:'#4a5452'},{name:'Red',hex:'#8b2320'},{name:'Navy',hex:'#25334a'},{name:'Forest',hex:'#2f4a38'},
    {name:'Teal',hex:'#2f6a6a'},{name:'Mustard',hex:'#b98a2e'},{name:'Natural oak',hex:'#9b7147'},{name:'Walnut',hex:'#5a3f2b'},
    {name:'Grey',hex:'#6c7072'},{name:'White',hex:'#f2f0ea'},
  ]},
];

/** The palette groups offered for each colour, most relevant first. */
export const PALETTE_FOR:Record<'cladding'|'roof'|'trim'|'door',PaletteGroup['id'][]>={
  cladding:['walls','masonry'],roof:['roof'],trim:['trim','walls'],door:['doors','trim'],
};
export function paletteName(hex:string){
  const h=hex.toLowerCase();
  for(const g of HOUSE_PALETTE)for(const c of g.colours)if(c.hex===h)return c.name;
  return null;
}
