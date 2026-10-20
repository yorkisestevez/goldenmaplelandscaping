/**
 * Seasons (S1, 2026-10-20): the 3D view shows a design in spring, summer, fall or winter. A view switch, never design
 * data. Every catalogue species and every generic plant model has a look for all four seasons, and the looks follow the
 * plant's habit: deciduous trees go bare in winter, evergreens never do, perennials are cut back, grasses stand tan.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANDSCAPE_ASSETS,PLANT_LIBRARY} from '../src/features/deckcraft/landscapeCatalogue';
import {DEFAULT_SEASON,MODEL_SEASONS,SEASONS,SPECIES_SEASONS,parseSeason,plantSeasonLook,type FlowerLook,type Season,type SeasonLook} from '../src/features/deckcraft/components/viewer3d/plantSeasons';
import {applySeasonSearch,getSeason,setSeason,subscribeSeason} from '../src/features/deckcraft/components/viewer3d/sceneSeason';

let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const source=(path:string)=>readFileSync(path,'utf8');
const HEX=/^#[0-9a-f]{6}$/;
const looks=(id:string)=>SEASONS.map(s=>[s,plantSeasonLook(id,PLANT_LIBRARY.find(p=>p.speciesId===id)!.assetId,s)] as [Season,SeasonLook]);

// 1. The switch: summer by default, the URL sets the first season once, and a later choice stands.
ok(DEFAULT_SEASON==='summer'&&getSeason()==='summer','Summer is the default, so nothing changes for anyone who never switches');
ok(SEASONS.join()==='spring,summer,fall,winter'&&parseSeason('winter')==='winter'&&parseSeason('autumn')===undefined&&parseSeason(null)===undefined,'Only the four season names parse');
let heard=0;const stop=subscribeSeason(()=>heard++);
applySeasonSearch('?deck-season=fall');ok(getSeason()==='fall'&&heard===1,'?deck-season= picks the first season');
setSeason('winter');applySeasonSearch('?deck-season=spring');ok(getSeason()==='winter','The query string is read once; it does not undo a later choice');
setSeason('winter');ok(heard===2,'Choosing the season already shown notifies no one');
stop();setSeason('summer');
ok(!/sceneSeason|plantSeasons/.test(source('src/features/deckcraft/showcaseMode.ts')),'The season lives outside showcaseMode.ts, which the designer route loads');

// 2. Coverage: every species in the library and every plant model.
const plantModels=LANDSCAPE_ASSETS.filter(a=>a.kind==='plant').map(a=>a.id);
ok(PLANT_LIBRARY.length===27&&PLANT_LIBRARY.every(p=>SPECIES_SEASONS[p.speciesId]),'All 27 catalogue species have a season record');
ok(plantModels.every(id=>MODEL_SEASONS[id]),'Every plant model has a season record for plants with no species');
ok(Object.keys(SPECIES_SEASONS).every(id=>PLANT_LIBRARY.some(p=>p.speciesId===id)),'No season record names a species the catalogue lacks');

// 3. Colours and flower cards are well formed.
const allLooks=[...Object.values(SPECIES_SEASONS),...Object.values(MODEL_SEASONS)].flatMap(r=>r?SEASONS.map(s=>r[s]):[]);
const flowers=allLooks.flatMap(l=>l.flowers?[l.flowers]:[]) as FlowerLook[];
ok(allLooks.every(l=>l.leaves===null||l.leaves==='summer'||HEX.test(l.leaves)),'Leaves are today\'s tint, a #rrggbb colour, or none');
ok(allLooks.every(l=>!l.stems||HEX.test(l.stems.color)&&l.stems.height>0&&l.stems.height<=1),'Bare stems have a colour and a height within the plant');
ok(flowers.every(f=>HEX.test(f.petals)&&HEX.test(f.center)&&f.count>0&&f.count<=300&&f.y0<f.y1&&f.size>0&&f.spread>0),'Flower cards have colours, a count, a height band and a size');

// 4. Summer is today's look: the species tint, no recolour.
ok(allLooks.length&&Object.values(SPECIES_SEASONS).every(r=>r.summer.leaves==='summer')&&Object.values(MODEL_SEASONS).every(r=>r!.summer.leaves==='summer'),'Every plant keeps today\'s summer leaves');

// 5. Habits.
const habit=(h:string)=>Object.entries(SPECIES_SEASONS).filter(([,r])=>r.habit===h).map(([id])=>id);
ok(habit('deciduous-tree').length===4&&habit('deciduous-tree').every(id=>looks(id).find(([s])=>s==='winter')![1].leaves===null),'Maples, serviceberry and redbud stand bare in winter');
ok(habit('evergreen').length===5&&habit('evergreen').every(id=>looks(id).every(([,l])=>l.leaves==='summer'&&!l.stems)),'Evergreens keep their needles all year');
ok(habit('deciduous-shrub').every(id=>{const w=SPECIES_SEASONS[id].winter;return w.leaves===null&&!!w.stems;}),'Deciduous shrubs show bare stems in winter');
ok(SPECIES_SEASONS['cornus-sericea'].winter.stems!.color==='#b0262a','Red-osier dogwood\'s winter stems are red');
ok(habit('perennial').every(id=>SPECIES_SEASONS[id].winter.leaves===null),'Perennials are cut back or gone in winter');
ok(habit('grass').every(id=>{const w=SPECIES_SEASONS[id].winter.leaves;return typeof w==='string'&&w!=='summer';}),'Grasses stand tan through the winter');
ok([...habit('deciduous-tree'),...habit('deciduous-shrub')].every(id=>{const f=SPECIES_SEASONS[id].fall.leaves;return typeof f==='string'&&HEX.test(f);}),'Every deciduous tree and shrub turns its own fall colour');
ok(SPECIES_SEASONS['acer-rubrum'].fall.leaves!==SPECIES_SEASONS['acer-saccharum'].fall.leaves,'Red maple and sugar maple turn different colours');

// 6. Flowering plants bloom in their own season.
const blooms=(id:string,s:Season)=>!!SPECIES_SEASONS[id][s].flowers&&SPECIES_SEASONS[id][s].flowers!.head!=='seed';
for(const id of ['amelanchier-canadensis','cercis-canadensis','syringa-vulgaris','physocarpus-opulifolius','spiraea-japonica','nepeta-faassenii','salvia-nemorosa'])ok(blooms(id,'spring'),`${id} flowers in spring`);
for(const id of ['echinacea-purpurea','rudbeckia-hirta','monarda-fistulosa','hydrangea-arborescens-annabelle','hydrangea-paniculata','hemerocallis','nepeta-faassenii','salvia-nemorosa','spiraea-japonica'])ok(blooms(id,'summer'),`${id} flowers in summer`);
ok(SPECIES_SEASONS['cercis-canadensis'].spring.leaves==='#c24a8c','Redbud\'s crown is magenta with flowers in spring, before its leaves');
ok(!blooms('hydrangea-arborescens-annabelle','spring')&&!blooms('echinacea-purpurea','spring'),'Summer bloomers are not shown flowering in spring');
ok(SPECIES_SEASONS['echinacea-purpurea'].winter.flowers?.head==='seed','Coneflower seed heads stand through the winter');
ok(Object.values(SPECIES_SEASONS).every(r=>!r.winter.flowers||r.winter.flowers.head==='seed'||r.habit==='deciduous-shrub'),'Nothing flowers in winter: only seed heads and dried hydrangea heads remain');

// 7. Rendering: summer materials never carry the recolour, and photo mode (which skips shader patches) still sees it.
const viewer='src/features/deckcraft/components/viewer3d/',landscape=source(viewer+'Landscape3D.tsx'),photo=source(viewer+'photoMaterials.ts');
ok(landscape.includes("const recolor=foliage&&mode==='recolor'&&isLeafMaterial(original),tone=recolor?season:'summer';")&&landscape.includes("return leaves===null?'bare':leaves==='summer'?'summer':'recolor';"),'Only a leaf part with a season colour takes the recolour patch; summer leaves compile exactly as before');
ok(landscape.includes("const parts=mode==='bare'?source.meshes.filter(m=>!isLeafMaterial("),'A bare plant drops only its leaf cards: branches and trunk stay');
ok(photo.includes("patches.includes('foliage-season-v1')?photoSeasonAtlas(material):null")&&photo.includes('material.color.setScalar(PHOTO_GREY_GAIN)'),'Photo mode paints seasonal leaves from a grey tone of their atlas, since the tracer skips the recolour shader');

console.log(`check-plant-seasons: ${checks} checks passed`);
