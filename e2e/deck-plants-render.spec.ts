import {expect,test} from '@playwright/test';
import {newLandscapeObject,newLandscapePlant} from '../src/features/deckcraft/landscapeCatalogue';

/**
 * The 3D canvas is opaque, so leaf edges drawn with alpha-to-coverage cannot let the page show through (the white speckle
 * on placed plants). A bed covering every leaf program variant (canopy crown, grass blade, the spruce's physical twig and
 * the untextured fern) compiles the v2 foliage shader without an error.
 */
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

test('placed plants render on an opaque canvas with the v2 foliage shader',async({page})=>{
  test.setTimeout(180_000);
  const shaderProblems:string[]=[];
  page.on('console',m=>{if(/Shader Error|WebGLProgram|ERROR: 0:/.test(m.text()))shaderProblems.push(m.text().slice(0,300));});
  // three announces each renderer it makes to window.__THREE_DEVTOOLS__, which is how the test reaches the live one.
  await page.addInitScript(()=>{const w=window as unknown as {__THREE_DEVTOOLS__:EventTarget;__renderers:unknown[]};w.__renderers=[];w.__THREE_DEVTOOLS__=new EventTarget();w.__THREE_DEVTOOLS__.addEventListener('observe',e=>{const d=(e as CustomEvent).detail;if(d?.isWebGLRenderer)w.__renderers.push(d);});});
  await page.goto('/deck-designer/');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:{read:()=>{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
  const bed={...newLandscapeObject('mulch-bed','e2e-bed',96,276),widthIn:300,depthIn:96};
  const species=['acer-saccharum','thuja-occidentalis-smaragd','picea-pungens','hydrangea-arborescens-annabelle','calamagrostis-karl-foerster','matteuccia-struthiopteris','hosta'];
  const plants=species.map((id,i)=>newLandscapePlant(id,`e2e-plant-${i}`,-40+i*44,276));
  const result=await page.evaluate(objects=>(window as unknown as {deckcraft:{execute:(r:unknown)=>Promise<{ok:boolean}>}}).deckcraft.execute({id:'e2e-plants',commands:[{type:'design.patch',patch:{landscapeObjects:objects}}]}),[bed,...plants]);
  expect(result.ok).toBe(true);
  await page.getByRole('tab',{name:'3D',exact:true}).click();
  const canvas=page.locator('canvas').first();
  await expect(canvas).toBeVisible({timeout:60_000});
  // Count the compiled programs that carry the leaf patch: the canopy crown, the grass blade, the spruce's physical twig and
  // the untextured fern compile to separate programs.
  const leafPrograms=()=>page.evaluate(()=>{
    type Program={program:WebGLProgram};
    const r=(window as unknown as {__renderers:{getContext:()=>WebGL2RenderingContext;info:{programs:Program[]|null}}[]}).__renderers.at(-1);
    if(!r)return 0;
    const gl=r.getContext();
    return (r.info.programs??[]).filter(({program})=>{for(let i=0,n=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i<n;i++)if(gl.getActiveUniform(program,i)?.name==='uCrownBend')return true;return false;}).length;
  });
  await expect.poll(leafPrograms,{timeout:120_000,intervals:[1000]}).toBeGreaterThanOrEqual(3);
  // The context three draws into reports alpha:false, so the browser composites it as an opaque surface.
  expect(await canvas.evaluate(c=>(c as HTMLCanvasElement).getContext('webgl2')?.getContextAttributes()?.alpha)).toBe(false);
  expect(shaderProblems).toEqual([]);
});
