import {expect,test} from '@playwright/test';
import {newLandscapeObject,newLandscapePlant} from '../src/features/deckcraft/landscapeCatalogue';

/**
 * Hydrangea pilot: Limelight, Annabelle and Endless Summer draw from their own models (canes, photo leaves, floret heads),
 * not the shared shrub GLB, and their leaf and floret programs compile without an error.
 */
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

test('hydrangeas render as canes, leaves and floret heads',async({page})=>{
  test.setTimeout(180_000);
  const shaderProblems:string[]=[];
  page.on('console',m=>{if(/Shader Error|WebGLProgram|ERROR: 0:/.test(m.text()))shaderProblems.push(m.text().slice(0,300));});
  // three announces each scene it makes to window.__THREE_DEVTOOLS__, which is how the test reaches the live one.
  await page.addInitScript(()=>{const w=window as unknown as {__THREE_DEVTOOLS__:EventTarget;__scenes:unknown[]};w.__scenes=[];w.__THREE_DEVTOOLS__=new EventTarget();w.__THREE_DEVTOOLS__.addEventListener('observe',e=>{const d=(e as CustomEvent).detail;if(d?.isScene)w.__scenes.push(d);});});
  await page.goto('/deck-designer/');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:{read:()=>{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
  const bed={...newLandscapeObject('mulch-bed','e2e-bed',96,276),widthIn:300,depthIn:96};
  const species=['hydrangea-paniculata','hydrangea-arborescens-annabelle','hydrangea-macrophylla-endless-summer'];
  const plants=species.map((id,i)=>newLandscapePlant(id,`e2e-hydrangea-${i}`,-20+i*72,276));
  const result=await page.evaluate(objects=>(window as unknown as {deckcraft:{execute:(r:unknown)=>Promise<{ok:boolean}>}}).deckcraft.execute({id:'e2e-hydrangeas',commands:[{type:'design.patch',patch:{landscapeObjects:objects}}]}),[bed,...plants]);
  expect(result.ok).toBe(true);
  await page.getByRole('tab',{name:'3D',exact:true}).click();
  await expect(page.locator('canvas').first()).toBeVisible({timeout:60_000});
  const drawn=()=>page.evaluate(()=>{
    type Node={name:string;count?:number;isInstancedMesh?:boolean;traverse:(f:(o:Node)=>void)=>void};
    const out:Record<string,number>={};
    for(const scene of (window as unknown as {__scenes:Node[]}).__scenes)scene.traverse(o=>{if(/^landscape-hydrangea-/.test(o.name)&&o.isInstancedMesh)out[o.name.replace(/-lod\d$/,'')]=(out[o.name.replace(/-lod\d$/,'')]??0)+(o.count??0);if(/^landscape-asset-rounded-shrub$/.test(o.name))out.sharedShrub=(out.sharedShrub??0)+1;});
    return out;
  });
  await expect.poll(async()=>{const d=await drawn();return ['limelight','annabelle','endless-summer'].every(c=>(d[`landscape-hydrangea-${c}-florets`]??0)>40&&(d[`landscape-hydrangea-${c}-leaves`]??0)>40&&(d[`landscape-hydrangea-${c}-cores`]??0)>4);},{timeout:120_000,intervals:[1000]}).toBe(true);
  expect((await drawn()).sharedShrub??0).toBe(0);
  // A plant is picked and outlined by one box; its thousands of cards carry no pick ids, so a selection draws one outline.
  const picking=await page.evaluate(()=>{
    type Node={name:string;userData:{pickPartId?:string;pickPartIds?:unknown[]};traverse:(f:(o:Node)=>void)=>void};
    let boxes=0,cards=0;
    for(const scene of (window as unknown as {__scenes:Node[]}).__scenes)scene.traverse(o=>{if(o.name==='landscape-hydrangea-pick'&&o.userData.pickPartId?.startsWith('landscape/e2e-hydrangea-'))boxes++;else if(/^landscape-hydrangea-/.test(o.name)&&(o.userData.pickPartId||o.userData.pickPartIds))cards++;});
    return {boxes,cards};
  });
  expect(picking).toEqual({boxes:3,cards:0});
  expect(shaderProblems).toEqual([]);
});
