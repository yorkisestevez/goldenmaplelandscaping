import type {LandscapeAssetId} from '../../landscapeTypes';

/**
 * How each placed plant looks in each season. A view switch, never design data: prices, quotes and share links do not
 * see it. Each season shows that season's highlights, every plant at its own peak (spring is the late-April to
 * early-June bloomers, summer June to August, fall September to October colour, winter dormant), not one calendar day.
 * Bloom windows and fall colour follow the extension pages each species already cites in landscapeCatalogue.ts.
 */
export type Season='spring'|'summer'|'fall'|'winter';
export const SEASONS:readonly Season[]=['spring','summer','fall','winter'];
export const DEFAULT_SEASON:Season='summer';
export const SEASON_LABELS:Record<Season,string>={spring:'Spring',summer:'Summer',fall:'Fall',winter:'Winter'};
export const parseSeason=(value:string|null|undefined):Season|undefined=>SEASONS.find(s=>s===value);

export type PlantHabit='deciduous-tree'|'deciduous-shrub'|'evergreen'|'perennial'|'grass';
/** Flower shapes, one texture each (plantBlooms.tsx). `seed` is a seed head: the dark centre with no petals. */
export type FlowerHead='daisy'|'drooping'|'trumpet'|'whorl'|'spike'|'mop'|'cone'|'panicle'|'flat'|'blossom'|'seed';
/** Flower cards in the plant's unit envelope: y0–y1 is the band of heights, spread the radius they scatter over. */
export interface FlowerLook {head:FlowerHead;petals:string;center:string;count:number;y0:number;y1:number;spread:number;size:number;stems?:boolean}
export interface SeasonLook {
 /** 'summer' keeps today's species tint; a colour recolours the leaf cards; null drops the leaves. */
 leaves:'summer'|string|null;
 flowers?:FlowerLook;
 /** Bare stems where the leaves have gone: their colour and height as a share of the plant's. */
 stems?:{color:string;height:number};
}
export interface PlantSeasons {habit:PlantHabit;spring:SeasonLook;summer:SeasonLook;fall:SeasonLook;winter:SeasonLook}

const SUMMER:SeasonLook={leaves:'summer'};
const EVERGREEN:PlantSeasons={habit:'evergreen',spring:SUMMER,summer:SUMMER,fall:SUMMER,winter:SUMMER};
const twigs=(color:string)=>({color,height:.92});
const stubs={color:'#a48c68',height:.32};
const tree=(spring:SeasonLook,fall:string):PlantSeasons=>({habit:'deciduous-tree',spring,summer:SUMMER,fall:{leaves:fall},winter:{leaves:null}});
const perennial=(p:Omit<PlantSeasons,'habit'>):PlantSeasons=>({habit:'perennial',...p});

/** Tree blossom: small flowers over the outside of the crown. */
const blossom=(petals:string,center:string,count:number):FlowerLook=>({head:'blossom',petals,center,count,y0:.4,y1:.97,spread:.46,size:.05});

export const SPECIES_SEASONS:Record<string,PlantSeasons>={
 'acer-saccharum':tree({leaves:'#b4cf6e'},'#e5822a'),
 'acer-rubrum':tree({leaves:'#b9c270'},'#c4301f'),
 'pinus-strobus':EVERGREEN,
 // Serviceberry flowers white as its first leaves open; redbud flowers magenta before its leaves.
 'amelanchier-canadensis':tree({leaves:'#e9e6d6',flowers:blossom('#f7f5ee','#e6dfc4',150)},'#d6542a'),
 // Its flowers crowd the bare branches, so the whole crown reads magenta: the leaf cards carry the colour.
 'cercis-canadensis':tree({leaves:'#c24a8c',flowers:blossom('#d0589a','#9a2c66',220)},'#d9b23a'),
 'picea-pungens':EVERGREEN,
 'thuja-occidentalis-smaragd':EVERGREEN,
 'buxus-microphylla':EVERGREEN,
 'taxus-media':EVERGREEN,
 'physocarpus-opulifolius':{habit:'deciduous-shrub',
  spring:{leaves:'summer',flowers:{head:'flat',petals:'#f1e3e0',center:'#d9b8b4',count:16,y0:.55,y1:.95,spread:.5,size:.15}},
  summer:SUMMER,fall:{leaves:'#8c4a2c'},winter:{leaves:null,stems:twigs('#8a6650')}},
 'cornus-sericea':{habit:'deciduous-shrub',
  spring:{leaves:'summer',flowers:{head:'flat',petals:'#f4f1e4',center:'#e2dcc0',count:10,y0:.6,y1:.95,spread:.5,size:.12}},
  summer:SUMMER,fall:{leaves:'#8a2a3a'},winter:{leaves:null,stems:twigs('#b0262a')}},
 'hydrangea-arborescens-annabelle':{habit:'deciduous-shrub',
  spring:{leaves:'#b9d27e'},
  summer:{leaves:'summer',flowers:{head:'mop',petals:'#f6f3ec',center:'#f6f3ec',count:13,y0:.5,y1:.95,spread:.5,size:.18}},
  fall:{leaves:'#c3ba6a',flowers:{head:'mop',petals:'#c9b98a',center:'#c9b98a',count:12,y0:.5,y1:.95,spread:.5,size:.17}},
  winter:{leaves:null,stems:twigs('#b09a7c'),flowers:{head:'mop',petals:'#a8936c',center:'#a8936c',count:7,y0:.7,y1:.92,spread:.5,size:.15}}},
 'hydrangea-paniculata':{habit:'deciduous-shrub',
  spring:{leaves:'#b9d27e'},
  summer:{leaves:'summer',flowers:{head:'cone',petals:'#f4f0e4',center:'#efe4c4',count:11,y0:.6,y1:.85,spread:.36,size:.13}},
  fall:{leaves:'#b9b46a',flowers:{head:'cone',petals:'#d99aa2',center:'#c47a86',count:11,y0:.6,y1:.85,spread:.36,size:.13}},
  winter:{leaves:null,stems:twigs('#a88c70'),flowers:{head:'cone',petals:'#a88a68',center:'#94785a',count:8,y0:.66,y1:.9,spread:.3,size:.11}}},
 'spiraea-japonica':{habit:'deciduous-shrub',
  spring:{leaves:'#d8b25a',flowers:{head:'flat',petals:'#e07aa8',center:'#c4568a',count:16,y0:.62,y1:.96,spread:.5,size:.16}},
  summer:{leaves:'summer',flowers:{head:'flat',petals:'#d870a0',center:'#b84e82',count:16,y0:.62,y1:.96,spread:.5,size:.16}},
  fall:{leaves:'#c8642a'},winter:{leaves:null,stems:twigs('#94735c')}},
 'syringa-vulgaris':{habit:'deciduous-shrub',
  spring:{leaves:'summer',flowers:{head:'panicle',petals:'#b896dc',center:'#8f6cb8',count:14,y0:.6,y1:.95,spread:.5,size:.2}},
  summer:SUMMER,fall:{leaves:'#a8a860'},winter:{leaves:null,stems:twigs('#8a8076')}},
 'echinacea-purpurea':perennial({
  spring:{leaves:'#a9cf6c'},
  summer:{leaves:'summer',flowers:{head:'drooping',petals:'#c4639e',center:'#c8641a',count:9,y0:.66,y1:.95,spread:.3,size:.22,stems:true}},
  fall:{leaves:'#9a8a58',flowers:{head:'seed',petals:'#3a2a1c',center:'#3a2a1c',count:9,y0:.66,y1:.95,spread:.3,size:.14,stems:true}},
  winter:{leaves:null,stems:stubs,flowers:{head:'seed',petals:'#2e2218',center:'#2e2218',count:5,y0:.5,y1:.75,spread:.22,size:.1,stems:true}}}),
 'rudbeckia-hirta':perennial({
  spring:{leaves:'#a9cf6c'},
  summer:{leaves:'summer',flowers:{head:'daisy',petals:'#e8a812',center:'#24180c',count:11,y0:.6,y1:.92,spread:.34,size:.19,stems:true}},
  // Black-eyed Susan flowers on into October.
  fall:{leaves:'#a49a5c',flowers:{head:'daisy',petals:'#dc9a12',center:'#24180c',count:6,y0:.6,y1:.9,spread:.32,size:.17,stems:true}},
  winter:{leaves:null,stems:stubs,flowers:{head:'seed',petals:'#20160c',center:'#20160c',count:4,y0:.5,y1:.75,spread:.22,size:.08,stems:true}}}),
 'monarda-fistulosa':perennial({
  spring:{leaves:'#a9cf6c'},
  summer:{leaves:'summer',flowers:{head:'whorl',petals:'#c6a8dc',center:'#7d5c98',count:12,y0:.6,y1:.95,spread:.36,size:.15}},
  fall:{leaves:'#8e8656',flowers:{head:'seed',petals:'#5a4c3e',center:'#5a4c3e',count:8,y0:.55,y1:.9,spread:.32,size:.07,stems:true}},
  winter:{leaves:null,stems:stubs}}),
 'hosta':perennial({
  spring:{leaves:'#a8d470'},
  summer:{leaves:'summer',flowers:{head:'spike',petals:'#c8b6e4',center:'#a28cc8',count:3,y0:.55,y1:.7,spread:.16,size:.2,stems:true}},
  fall:{leaves:'#d6bf5c'},winter:{leaves:null}}),
 'matteuccia-struthiopteris':perennial({spring:{leaves:'#b2dc6a'},summer:SUMMER,fall:{leaves:'#c8a050'},winter:{leaves:null}}),
 'hemerocallis':perennial({
  spring:{leaves:'#a9cf6c'},
  summer:{leaves:'summer',flowers:{head:'trumpet',petals:'#ec9a1c',center:'#c4600e',count:8,y0:.66,y1:.98,spread:.34,size:.19,stems:true}},
  fall:{leaves:'#c8b060'},winter:{leaves:null}}),
 'nepeta-faassenii':perennial({
  spring:{leaves:'summer',flowers:{head:'spike',petals:'#a99ad8',center:'#8676bc',count:16,y0:.3,y1:.55,spread:.4,size:.1}},
  summer:{leaves:'summer',flowers:{head:'spike',petals:'#b7a6dc',center:'#8e78b8',count:16,y0:.3,y1:.55,spread:.4,size:.1}},
  fall:{leaves:'#a8ae8a',flowers:{head:'spike',petals:'#a99ad0',center:'#8e78b8',count:5,y0:.3,y1:.5,spread:.36,size:.08}},
  winter:{leaves:null,stems:stubs}}),
 'salvia-nemorosa':perennial({
  spring:{leaves:'summer',flowers:{head:'spike',petals:'#7350b8',center:'#4c3282',count:12,y0:.35,y1:.6,spread:.22,size:.12}},
  summer:{leaves:'summer',flowers:{head:'spike',petals:'#7b58c2',center:'#4f3486',count:12,y0:.35,y1:.6,spread:.22,size:.12}},
  fall:{leaves:'#93986a'},winter:{leaves:null,stems:stubs}}),
 'calamagrostis-karl-foerster':{habit:'grass',spring:{leaves:'#9fc864'},summer:SUMMER,fall:{leaves:'#d8c08a'},winter:{leaves:'#c8b48a'}},
 'schizachyrium-scoparium':{habit:'grass',spring:{leaves:'#a9c47e'},summer:SUMMER,fall:{leaves:'#c06a3a'},winter:{leaves:'#b07a50'}},
 'panicum-virgatum':{habit:'grass',spring:{leaves:'#a3c46e'},summer:SUMMER,fall:{leaves:'#d4b050'},winter:{leaves:'#c0a880'}},
};

/** Plants placed from a model with no species record. */
export const MODEL_SEASONS:Partial<Record<LandscapeAssetId,PlantSeasons>>={
 'deciduous-tree':tree({leaves:'#b4cf6e'},'#d8762a'),
 'conifer-tree':EVERGREEN,'pine-tree':EVERGREEN,'hedge-shrub':EVERGREEN,'evergreen-shrub':EVERGREEN,
 'rounded-shrub':{habit:'deciduous-shrub',spring:{leaves:'#b9d27e'},summer:SUMMER,fall:{leaves:'#c27a34'},winter:{leaves:null,stems:twigs('#8c7864')}},
 'hosta-clump':SPECIES_SEASONS['hosta'],
 'fern-clump':SPECIES_SEASONS['matteuccia-struthiopteris'],
 'perennial-bloom':perennial({spring:{leaves:'#a9cf6c'},summer:SUMMER,fall:{leaves:'#9a9058'},winter:{leaves:null,stems:stubs}}),
 'perennial-gold':perennial({spring:{leaves:'#a9cf6c'},summer:SUMMER,fall:{leaves:'#a49a5c'},winter:{leaves:null,stems:stubs}}),
 'grass-clump':{habit:'grass',spring:{leaves:'#a3c46e'},summer:SUMMER,fall:{leaves:'#cdb46a'},winter:{leaves:'#c0aa82'}},
 'reed-grass':SPECIES_SEASONS['calamagrostis-karl-foerster'],
};

/** The look of one placed plant in a season: its species first, then its model. Unknown plants keep summer. */
export function plantSeasonLook(speciesId:string|undefined,assetId:LandscapeAssetId,season:Season):SeasonLook{
 const record=(speciesId?SPECIES_SEASONS[speciesId]:undefined)??MODEL_SEASONS[assetId];
 return record?.[season]??SUMMER;
}
/** The background tree line's broadleaves: a mixed maple stand. */
export const CONTEXT_BROADLEAF=MODEL_SEASONS['deciduous-tree']!;
