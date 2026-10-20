import {expect,test} from '@playwright/test';
import {newLandscapeObject,newLandscapePlant} from '../src/features/deckcraft/landscapeCatalogue';

/**
 * Seasons (S2): winter covers the yard in snow (one shared patch) with snow falling on computers, and fall lays the
 * maples' leaves on the ground beneath them. Leaving winter switches the snow off without touching the design.
 */
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

type Seen={__renderers:{getContext:()=>WebGL2RenderingContext;info:{programs:{program:WebGLProgram}[]|null}}[];__scenes:{getObjectByName:(n:string)=>unknown}[]};

test('winter snows and fall drops leaves, and neither touches the design',async({page})=>{
  test.setTimeout(240_000);
  const problems:string[]=[];
  page.on('console',m=>{if(/Shader Error|ERROR: 0:/.test(m.text()))problems.push(m.text().slice(0,300));});
  page.on('pageerror',e=>problems.push(e.message));
  // three announces each renderer and scene it makes to window.__THREE_DEVTOOLS__, which is how the test reaches them.
  await page.addInitScript(()=>{const w=window as unknown as {__THREE_DEVTOOLS__:EventTarget;__renderers:unknown[];__scenes:unknown[]};w.__renderers=[];w.__scenes=[];w.__THREE_DEVTOOLS__=new EventTarget();w.__THREE_DEVTOOLS__.addEventListener('observe',e=>{const d=(e as CustomEvent).detail;if(d?.isWebGLRenderer)w.__renderers.push(d);else if(d?.isScene)w.__scenes.push(d);});});
  await page.goto('/deck-designer/?deck-season=winter');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:{read:()=>{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
  const bed={...newLandscapeObject('mulch-bed','e2e-bed',96,276),widthIn:300,depthIn:96};
  const plants=['acer-saccharum','thuja-occidentalis-smaragd'].map((id,i)=>newLandscapePlant(id,`e2e-plant-${i}`,i*80,276));
  const result=await page.evaluate(objects=>(window as unknown as {deckcraft:{execute:(r:unknown)=>Promise<{ok:boolean}>}}).deckcraft.execute({id:'e2e-snow',commands:[{type:'design.patch',patch:{landscapeObjects:objects}}]}),[bed,...plants]);
  expect(result.ok).toBe(true);
  await page.getByRole('tab',{name:'3D',exact:true}).click();
  await expect(page.locator('canvas').first()).toBeVisible({timeout:60_000});
  const seasons=page.getByRole('group',{name:'Season'});
  // ?deck-season=winter opens the view in winter.
  await expect(seasons.getByRole('button',{name:'Winter'})).toHaveAttribute('aria-pressed','true');
  const design=()=>page.evaluate(()=>JSON.stringify((window as unknown as {deckcraft:{read:()=>{design:unknown}}}).deckcraft.read().design));
  const before=await design();
  const snowPrograms=()=>page.evaluate(()=>{
    const r=(window as unknown as Seen).__renderers.at(-1);if(!r)return 0;const gl=r.getContext();
    return (r.info.programs??[]).filter(({program})=>{for(let i=0,n=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i<n;i++)if(gl.getActiveUniform(program,i)?.name==='uSnowOn')return true;return false;}).length;
  });
  const named=(name:string)=>page.evaluate(n=>(window as unknown as Seen).__scenes.some(scene=>scene.getObjectByName(n)),name);
  await expect.poll(snowPrograms,{timeout:120_000,intervals:[1000]}).toBeGreaterThanOrEqual(3);
  // Snow falls on computers; a software or phone renderer (CI's SwiftShader is one) shows settled snow only.
  const canvas=page.locator('canvas').first();
  await expect(canvas).toHaveAttribute('data-snowfall',/^(on|off)$/,{timeout:30_000});
  const falling=await canvas.getAttribute('data-snowfall')==='on';
  await expect.poll(()=>named('season-snowfall'),{timeout:30_000,intervals:[500]}).toBe(falling);
  await seasons.getByRole('button',{name:'Fall'}).click();
  await expect.poll(()=>named('season-fallen-leaves'),{timeout:60_000,intervals:[500]}).toBe(true);
  expect(await named('season-snowfall')).toBe(false);
  await seasons.getByRole('button',{name:'Summer'}).click();
  await expect.poll(()=>named('season-fallen-leaves'),{timeout:30_000,intervals:[500]}).toBe(false);
  expect(await design()).toBe(before);
  expect(problems).toEqual([]);
});
