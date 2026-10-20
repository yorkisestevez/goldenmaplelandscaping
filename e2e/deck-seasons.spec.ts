import {expect,test} from '@playwright/test';
import {newLandscapeObject,newLandscapePlant} from '../src/features/deckcraft/landscapeCatalogue';

/**
 * Seasons (S1): the 3D bar switches Spring, Summer, Fall and Winter. It is a view, not design data: the design and its
 * revision do not move. Fall and spring compile the seasonal leaf recolour; winter drops the maple's leaves and draws bare
 * shrub stems; summer is the default and compiles no recolour at all.
 */
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

type Renderers={__renderers:{getContext:()=>WebGL2RenderingContext;info:{programs:{program:WebGLProgram}[]|null}}[];__scenes:{getObjectByName:(n:string)=>unknown}[]};

test('the season switch changes the plants, never the design',async({page})=>{
  test.setTimeout(240_000);
  const problems:string[]=[];
  page.on('console',m=>{if(/Shader Error|ERROR: 0:/.test(m.text()))problems.push(m.text().slice(0,300));});
  page.on('pageerror',e=>problems.push(e.message));
  // three announces each renderer and scene it makes to window.__THREE_DEVTOOLS__, which is how the test reaches them.
  await page.addInitScript(()=>{const w=window as unknown as {__THREE_DEVTOOLS__:EventTarget;__renderers:unknown[];__scenes:unknown[]};w.__renderers=[];w.__scenes=[];w.__THREE_DEVTOOLS__=new EventTarget();w.__THREE_DEVTOOLS__.addEventListener('observe',e=>{const d=(e as CustomEvent).detail;if(d?.isWebGLRenderer)w.__renderers.push(d);else if(d?.isScene)w.__scenes.push(d);});});
  await page.goto('/deck-designer/');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:{read:()=>{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
  const bed={...newLandscapeObject('mulch-bed','e2e-bed',96,276),widthIn:300,depthIn:96};
  const species=['acer-saccharum','amelanchier-canadensis','cornus-sericea','echinacea-purpurea','thuja-occidentalis-smaragd'];
  const plants=species.map((id,i)=>newLandscapePlant(id,`e2e-plant-${i}`,-40+i*60,276));
  const result=await page.evaluate(objects=>(window as unknown as {deckcraft:{execute:(r:unknown)=>Promise<{ok:boolean}>}}).deckcraft.execute({id:'e2e-seasons',commands:[{type:'design.patch',patch:{landscapeObjects:objects}}]}),[bed,...plants]);
  expect(result.ok).toBe(true);
  await page.getByRole('tab',{name:'3D',exact:true}).click();
  await expect(page.locator('canvas').first()).toBeVisible({timeout:60_000});
  const seasons=page.getByRole('group',{name:'Season'});
  await expect(seasons.getByRole('button',{name:'Summer'})).toHaveAttribute('aria-pressed','true');
  const design=()=>page.evaluate(()=>{const r=(window as unknown as {deckcraft:{read:()=>{design:unknown;revision:number}}}).deckcraft.read();return JSON.stringify([r.design,r.revision]);});
  const before=await design();
  const programs=(uniform:string)=>page.evaluate(name=>{
    const r=(window as unknown as Renderers).__renderers.at(-1);if(!r)return 0;const gl=r.getContext();
    return (r.info.programs??[]).filter(({program})=>{for(let i=0,n=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i<n;i++)if(gl.getActiveUniform(program,i)?.name===name)return true;return false;}).length;
  },uniform);
  const named=(name:string)=>page.evaluate(n=>(window as unknown as Renderers).__scenes.some(scene=>scene.getObjectByName(n)),name);
  // Leaves load after the view is up; summer compiles the leaf shader with no seasonal recolour.
  await expect.poll(()=>programs('uCrownBend'),{timeout:120_000,intervals:[1000]}).toBeGreaterThanOrEqual(1);
  expect(await programs('uLeafLum')).toBe(0);
  await seasons.getByRole('button',{name:'Fall'}).click();
  await expect(seasons.getByRole('button',{name:'Fall'})).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>programs('uLeafLum'),{timeout:60_000,intervals:[500]}).toBeGreaterThanOrEqual(1);
  await seasons.getByRole('button',{name:'Winter'}).click();
  await expect.poll(()=>named('landscape-bare-stems'),{timeout:60_000,intervals:[500]}).toBe(true);
  await seasons.getByRole('button',{name:'Spring'}).click();
  // Tree blossom draws at every distance (perennial and shrub flowers only up close), so the default camera sees it.
  await expect.poll(()=>named('plant-blooms-blossom'),{timeout:60_000,intervals:[500]}).toBe(true);
  await seasons.getByRole('button',{name:'Summer'}).click();
  await expect.poll(()=>named('plant-blooms-blossom'),{timeout:60_000,intervals:[500]}).toBe(false);
  expect(await named('landscape-bare-stems')).toBe(false);
  expect(await design()).toBe(before);
  expect(problems).toEqual([]);
});
