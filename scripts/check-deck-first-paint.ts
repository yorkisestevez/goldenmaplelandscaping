import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/**
 * The designer's first paint (October 16). The page is prerendered with its drawing in place, so:
 * - each lazy piece of it is preloaded before hydration (designer/hydrationLazy.ts), or React throws its HTML away on the
 *   first update of a slow load and draws it again later (the tools ribbon and plan vanish and pop back);
 * - the page's own stylesheet places and sizes it. workspace.css copies what it needs from the lazy sheets, and every
 *   copied declaration must stay equal to its source, or the drawing jumps when that sheet lands.
 * Source only: e2e/deck-first-paint.spec.ts measures the page and check-deck-bundle.ts the build.
 */
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8').replace(/\r\n/g,'\n');
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const page=read('src/pages/DeckDesigner.tsx'),panel=read('src/features/deckcraft/designer/PreviewPanel.tsx');
ok(page.includes("const PreviewPanel=preloadable(()=>import('../features/deckcraft/designer/PreviewPanel'));")&&page.includes('DimensionsStep=preloadable(loadDimensionsStep)'),'The drawing and the Deck section body (both prerendered) are preloadable');
ok(page.includes("const piecesReady=typeof document==='undefined'?undefined:whenSettled([PreviewPanel.preload().then(panel=>panel.partsReady),DimensionsStep.preload(),loadArchitectShortcuts(),loadPlanToolPicker(),loadPlanEditingWorkspace()],4000);"),'They load before hydration, together, at most 4 s, never in the prerender');
ok(/export function DeckCraftWorkspace\([^\n]*\{\n\s*if\(piecesReady\)use\(piecesReady\);/.test(page),'The designer (the page and the cost estimator studio) waits for them before it renders');
const loaders=read('src/features/deckcraft/designer/previewLoaders.ts');
for(const part of ['ArchitectShortcuts','PlanToolPicker','PlanEditingWorkspace'])ok(loaders.includes(`export const load${part}=()=>import('./${part}');`)&&panel.includes(`const ${part}=preloadable(load${part});`)&&new RegExp(`export const partsReady=[^\\n]*\\b${part}\\b`).test(panel),`${part}, in the prerendered drawing, loads before hydration`);
ok(panel.includes("const CanvasContextMenu=lazy(()=>import('./CanvasContextMenu'));")&&panel.includes('{mounted&&!snapshotLighting&&<Suspense fallback={null}><CanvasContextMenu '),'The context menu (nothing on screen until a right-click) mounts after the page starts, outside the prerendered drawing');
ok(page.includes("import '../features/deckcraft/designer/planToolPicker.css';")&&!read('src/features/deckcraft/designer/PlanToolPicker.tsx').includes(".css'"),"The tools ribbon's styles come with the page's stylesheet, not with its lazy chunk");
type Rules=Map<string,Map<string,string>>;
/** A sheet as {"@media…|selector": {property: value}}, one @media level deep. */
function rules(css:string,into:Rules=new Map(),media=''):Rules{
  for(const [,head,body] of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g)){
    const selector=head.trim();
    if(selector.startsWith('@media')){rules(body,into,selector.replace(/\s+/g,''));continue;}
    const key=`${media}|${selector}`,props=into.get(key)??new Map<string,string>();
    for(const declaration of body.split(';')){const colon=declaration.indexOf(':');if(colon>0)props.set(declaration.slice(0,colon).trim(),declaration.slice(colon+1).trim());}
    into.set(key,props);
  }
  return into;
}
const workspace=read('src/features/deckcraft/designer/workspace.css');
for(const sheet of ['architectWorkspace.css','planViewport.css']){
  const block=workspace.split(`/* first paint: ${sheet}`)[1]?.split('/* first paint: ')[0]??'';
  const copy=rules(block.slice(block.indexOf('*/')+2)),source=rules(read(`src/features/deckcraft/designer/${sheet}`));
  ok(copy.size>0,`workspace.css has its first-paint copy of ${sheet}`);
  for(const [key,props] of copy)for(const [property,value] of props)ok(source.get(key)?.get(property)===value,`workspace.css copies ${key} {${property}:${value}} from ${sheet} exactly: change both, or the drawing jumps when ${sheet} loads`);
}
console.log(`DECK FIRST PAINT OK — ${checks} checks.`);
