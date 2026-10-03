import type {DeckData} from './types';

export interface FramelessSystem {
  id:string;name:string;mount:'spigot'|'shoe';glassThicknessIn:number;panelMaxIn:number;
  glassBottomIn:number;panelGapIn?:number;hardwareWidthIn:number;hardwareDepthIn:number;hardwareHeightIn:number;previewHeightIn:number;
  sourceUrl:string;availability:string;dimensionNote:string;
  documents:{title:string;url:string;kind:'product'|'installation'|'engineering'|'municipal'}[];
  installationNotes:string[];limitations:string[];
}

/** Visual envelopes are deliberately separate from a supplier's order/engineering schedule.
 * panelMaxIn is a preview subdivision target, NOT an approved structural span. */
export const FRAMELESS_SYSTEMS:FramelessSystem[]=[
  {
    id:'nv_spigot',name:'NorthVue · frameless spigot glass',mount:'spigot',
    glassThicknessIn:12/25.4,panelMaxIn:48,glassBottomIn:2,
    hardwareWidthIn:4,hardwareDepthIn:4,hardwareHeightIn:6,previewHeightIn:44,
    sourceUrl:'https://www.northvueglass.com/',
    availability:'Ontario supplier with pickup in Orillia. Confirm current stock, finish and project supply.',
    dimensionNote:'Supplier: 12 mm glass; 42 in-high panels; 6 in-high spigots with 4 × 4 in bases. Preview: 2 in glass clearance, 44 in assembled height, 1 in joints and approximately 48 in bays are illustrative. Generated panel widths are NOT a stock order or cutting list.',
    documents:[
      {title:'NorthVue product specifications and Ontario supply',url:'https://www.northvueglass.com/',kind:'product'},
      {title:'NorthVue FAQ — panel sizes and blocking requirement',url:'https://www.northvueglass.com/faq',kind:'product'},
    ],
    installationNotes:[
      'Obtain the current NorthVue installation manual and project-matched engineering before setting out or drilling. A public download was not located.',
      'NorthVue identifies proper blocking and 6 in GRK structural screws. This does not specify screw diameter, count, embedment, edge distances or a complete deck connection.',
      'Have the load path through blocking, joists/rim, connections and supporting structure checked for the actual deck. Deck boards and decorative fascia are not a substitute for designed structural support.',
      'Confirm spigot locations, finished glass clearance, supplied panel sizes, glass type, restraint/top-rail requirements and stair handrails in the approved system schedule.',
    ],
    limitations:['No verified manual or project-matched stamped anchorage detail is bundled.','Sloped stair guards, custom corners and graspable handrails require separate design; they are not modeled here.','No approval for drilling lights, adding screens or attaching accessories to glass or spigots.'],
  },
  {
    id:'tag_ninfa4',name:'TAG Hardware · Faraone NINFA 4 base-shoe glass',mount:'shoe',
    glassThicknessIn:0.5,panelMaxIn:48,glassBottomIn:1.5,
    hardwareWidthIn:97/25.4,hardwareDepthIn:97/25.4,hardwareHeightIn:130/25.4,previewHeightIn:42,panelGapIn:20/25.4,
    sourceUrl:'https://taghardware.ca/architectural-railings/heavy-glass-baseshoe-accessories/ninfa-base-shoe/ew3fadj13523sa-base-shoe/',
    availability:'Ontario distributor. Exact NINFA 4 variant, finish, stock and substrate suitability require written confirmation.',
    dimensionNote:'1/2 in glass variant shown. TAG booklet: NINFA 4/100 family envelope 97 mm wide × 130 mm high and 20 mm panel joints. Exact supplied profile and glass engagement need confirmation. The 1.5 in glass-bottom elevation inside the shoe, 42 in height and approximately 48 in bays are illustrative, not an approved panel schedule.',
    documents:[{title:'TAG NINFA instruction booklet — check supplied revision and substrate',url:'https://store-hf989x.mybigcommerce.com/content/Tag%20-%20Ninfa%20Instruction%20Booklet.pdf',kind:'installation'}],
    installationNotes:[
      'Obtain the NINFA 4 instruction booklet, exact profile drawing, compatible glass/gasket selection and project-specific engineering for the supplied version.',
      'Do not transfer an anchor schedule from concrete to a timber deck. Confirm the continuous support, fasteners, edge distances, drainage and complete structural load path.',
      'Set out only from the accepted shop drawing; preserve the system drainage paths, glass engagement, wedges/gaskets and manufacturer tightening sequence.',
      'Have a qualified reviewer resolve post-breakage retention, any required top rail and separate continuous stair handrails before ordering glass.',
    ],
    limitations:['Profile geometry is schematic until an exact current profile drawing is confirmed.','No timber-deck anchorage approval or stamped project drawing is bundled.','Stair assemblies are not modeled. A level base-shoe preview is not a stair guard or handrail detail.'],
  },
];

export function getFramelessSystem(data:Pick<DeckData,'catalogueRailingId'|'railingType'>){
  return data.railingType==='Glass Panels'?FRAMELESS_SYSTEMS.find(s=>s.id===data.catalogueRailingId):undefined;
}
