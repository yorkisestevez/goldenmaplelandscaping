import type {HydrangeaCultivar} from '../../../hydrangeaCultivars';

/**
 * Hydrangea botany for the in-repo models, in inches, as research/botany.md sources it (docs/deckcraft/hydrangeas-2026-10-20).
 * Leaf and floret sizes are real and do not scale with the plant; head size follows a younger, smaller plant a little.
 * Colours are sRGB estimates from the RHS codes and colour words in those sources (mid-July to August look).
 */
export interface HydrangeaSpec {
 /** Palette height the head sizes belong to (landscapeCatalogue PLANT_LIBRARY). */
 refHeightIn:number;
 canes:[number,number];
 /** Leafy shoots without a head, which fill the lower crown. */
 fill:[number,number];
 crownIn:number;caneBaseIn:number;caneTipIn:number;
 /** How far a flowering head's axis leans out from upright (0 upright, 1 level). */
 lean:[number,number];
 /** Rise of the cane's middle above its tip, as a share of the tip height: an arching, flopping cane. */
 arch:number;
 stem:string;
 /** leafTo: share of a flowering cane carrying leaves; above it the head stands on a bare stalk (Limelight's peduncle). */
 leaf:{bladeIn:number;widthIn:number;petioleIn:number;nodeIn:number;whorl3:number;leafTo:number;front:string;back:string;roughness:number};
 head:{shape:'panicle'|'dome';lengthIn:number;widthIn:number;floretIn:number;coverage:number;color:string;young:string;core:string};
}
export const HYDRANGEA_SPECS:Record<HydrangeaCultivar,HydrangeaSpec>={
 // USPP12874 (leaf 3.3–3.9 × 1.6–2.2 in, petiole 0.6–0.7, internodes 1.2–1.4 in on laterals, panicle 6–10 × 4.7–7 in,
 // floret 1.1–1.85 in), Proven Winners, Purdue, Chicago Botanic Garden.
 limelight:{refHeightIn:48,canes:[17,22],fill:[12,16],crownIn:7,caneBaseIn:.34,caneTipIn:.13,lean:[.12,.36],arch:.04,stem:'#7a4a3e',
  leaf:{bladeIn:3.7,widthIn:1.95,petioleIn:.65,nodeIn:1.6,whorl3:.45,leafTo:.88,front:'#4e6a2c',back:'#8fa35e',roughness:.7},
  head:{shape:'panicle',lengthIn:9,widthIn:6,floretIn:1.4,coverage:2.4,color:'#eef0d8',young:'#cbdc93',core:'#bdb78c'}},
 // Purdue, Oregon State, RHS (head up to 10–12 in; a young plant's about 8), Trees and Shrubs Online (flopping canes).
 annabelle:{refHeightIn:36,canes:[14,20],fill:[14,18],crownIn:9,caneBaseIn:.2,caneTipIn:.1,lean:[.42,.72],arch:.22,stem:'#7d8a55',
  leaf:{bladeIn:5,widthIn:3.5,petioleIn:1.4,nodeIn:2.8,whorl3:0,leafTo:.93,front:'#3f5e2e',back:'#a3b38a',roughness:.72},
  head:{shape:'dome',lengthIn:6,widthIn:8,floretIn:.75,coverage:1.5,color:'#f3f2e7',young:'#d4dfab',core:'#c8ceaa'}},
 // USPP15298 (head 3–6 in, about 100 florets, floret 0.8–1.0 in, leaf petiole 0.4–1.2 in), Endless Summer, NC State
 // (glossy leaves). Pink: Ontario's mostly alkaline soil.
 'endless-summer':{refHeightIn:36,canes:[10,14],fill:[9,12],crownIn:7,caneBaseIn:.22,caneTipIn:.11,lean:[.18,.4],arch:.05,stem:'#7e9a3c',
  leaf:{bladeIn:5,widthIn:3.7,petioleIn:.8,nodeIn:2.3,whorl3:0,leafTo:.97,front:'#3b5a2c',back:'#7e9460',roughness:.38},
  head:{shape:'dome',lengthIn:4.5,widthIn:6,floretIn:.9,coverage:1.5,color:'#e48cb2',young:'#f0b6cb',core:'#a8607c'}},
};
