/**
 * Design-tools smoke: every plan tool opens its editor, shape shortcuts (including Draw my own)
 * keep real geometry, and core gestures commit once without blanking the drawing.
 */
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {pickPlanTool,savedConfiguration,showProjectControls} from './nav';

const proof=resolve(process.env.E2E_OUTPUTS??'/opt/cursor/artifacts','design-tools-review');
mkdirSync(proof,{recursive:true});

const slider=(page:Page,name:string)=>page.getByRole('slider',{name,exact:true});
const TOOLS=[
  {name:'Deck size',kind:'slider' as const,probe:['Deck depth, front edge','Deck width, right end']},
  {name:'Shape & points',kind:'button' as const,probe:['Add point','Main deck point 1']},
  {name:'Stairs',kind:'slider' as const,probe:['Stairs, position along the edge']},
  {name:'House',kind:'slider' as const,probe:['House width, right wall']},
  {name:'Rails & screens',kind:'region' as const,probe:['Railing and privacy screen controls']},
  {name:'Patios & walls',kind:'label' as const,probe:['Patio and wall shape controls']},
  {name:'Landscape',kind:'button' as const,probe:['Add editable area']},
  {name:'Board layout',kind:'button' as const,probe:['Select board']},
  {name:'Inlays',kind:'label' as const,probe:['Inlay plan controls']},
  {name:'Select parts',kind:'label' as const,probe:['Plan component type','Select plan part']},
] as const;

const SHAPES=['Rectangle','L-shape','Multi-corner','Curved','Wrap left','Wrap right','Wrap both','Split level','Draw my own'] as const;

const fixture={
  ...DEFAULT_DECK,
  width:20,
  length:12,
  height:36,
  stairFlights:1,
  stairPosition:'Front' as const,
  railingType:'None' as const,
  customerName:'Design tools QA',
  projectAddress:'Local design-tools review',
  yardFeatures:[{
    id:'qa-patio',kind:'patio' as const,name:'QA patio',enabled:true,
    xFt:6,zFt:26,widthFt:12,depthFt:10,heightIn:0,rotationDeg:0,
    productId:'permacon-melville',color:'#aaa69b',
  }],
};

const read=(page:Page)=>page.evaluate(()=>window.deckcraft!.read());
const shortcuts=(page:Page)=>page.getByRole('group',{name:'Shape shortcuts'});
const shot=async(page:Page,name:string)=>{await page.locator('#deck-live-preview').screenshot({path:resolve(proof,`${name}.png`)});};

async function ready(page:Page){
  await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);
  await showProjectControls(page);
}

test.beforeEach(async({page,context})=>{
  await context.addInitScript('window.__name=(target,value)=>target;');
  await context.addInitScript(configuration=>{
    const key='golden-maple.deck-studio.deck-only.v1';
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));
  },fixture);
  await context.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(['127.0.0.1','localhost'].includes(host)&&['GET','HEAD'].includes(route.request().method()))return route.continue();
    return route.fulfill({status:200,body:''});
  });
  await page.goto('/deck-designer/');
  await ready(page);
});

test('every plan tool opens its editor without console crashes',async({page})=>{
  const problems:string[]=[];
  page.on('pageerror',e=>problems.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!/Download the React DevTools|favicon|net::ERR/.test(m.text()))problems.push(m.text());});

  for(const tool of TOOLS){
    await test.step(tool.name,async()=>{
      await pickPlanTool(page,tool.name);
      await expect(page.getByRole('radio',{name:tool.name,exact:true})).toHaveAttribute('aria-checked','true');
      for(const label of tool.probe){
        const hit=tool.kind==='slider'?slider(page,label)
          :tool.kind==='region'?page.getByRole('region',{name:label,exact:true})
          :tool.kind==='label'?page.getByLabel(label,{exact:true})
          :page.getByRole('button',{name:label,exact:true});
        await expect(hit.first(),`${tool.name} → ${label}`).toBeVisible({timeout:20_000});
      }
      await expect(page.getByText('outline editor could not load')).toHaveCount(0);
      await shot(page,`tool-${tool.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`);
    });
  }
  expect(problems,problems.join('\n')).toEqual([]);
});

test('shape shortcuts stay reachable and Draw my own keeps an L-shape as free points',async({page})=>{
  await pickPlanTool(page,'Deck size');
  const presets=page.locator('details.dd-boundary-presets');
  if(!await presets.evaluate(el=>(el as HTMLDetailsElement).open))await presets.locator('summary').click();
  for(const name of SHAPES)await expect(shortcuts(page).getByRole('button',{name,exact:true}),name).toBeVisible();

  await shortcuts(page).getByRole('button',{name:'L-shape',exact:true}).click();
  await expect.poll(async()=>(await read(page)).design.shape).toBe('L-Shape');
  await shot(page,'shape-lshape');

  await shortcuts(page).getByRole('button',{name:'Draw my own',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Shape & points',exact:true})).toHaveAttribute('aria-checked','true');
  await expect.poll(async()=>{
    const d=await read(page);
    return {shape:d.design.shape,n:d.design.deckOutlines?.main?.length??0};
  }).toEqual({shape:'Custom',n:6});
  await expect(page.getByRole('button',{name:'Main deck point 1',exact:true})).toBeVisible();
  await expect(page.locator('.dd-boundary-handle')).not.toHaveCount(0);
  await shot(page,'shape-draw-my-own-keeps-l');

  // Drag a corner; commit once; undo restores.
  await page.getByRole('switch',{name:/^Free movement/}).check();
  const before=(await read(page)).design.deckOutlines!.main!;
  const handle=page.getByRole('button',{name:'Main deck point 3',exact:true});
  await handle.scrollIntoViewIfNeeded();
  const box=(await handle.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+36,box.y+box.height/2+24,{steps:6});
  await page.mouse.up();
  await expect.poll(async()=>JSON.stringify((await read(page)).design.deckOutlines?.main)).not.toBe(JSON.stringify(before));
  const dragged=(await read(page)).design.deckOutlines!.main!;
  expect(dragged).toHaveLength(6);
  await shot(page,'shape-draw-my-own-drag');

  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(async()=>(await read(page)).design.deckOutlines?.main).toEqual(before);
  await expect.poll(async()=>(await savedConfiguration(page))?.deckOutlines?.main?.length).toBe(6);
});

test('Deck size, Stairs and House plan handles edit and undo atomically',async({page})=>{
  await pickPlanTool(page,'Deck size');
  const start=await read(page);
  const depth=slider(page,'Deck depth, front edge');
  await expect(depth).toBeVisible();
  await depth.evaluate(el=>{el.scrollIntoView({block:'center'});return new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));});
  const b=(await depth.boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2+48,{steps:8});
  expect((await read(page)).design).toEqual(start.design);
  await page.mouse.up();
  await expect.poll(async()=>(await read(page)).design.length).not.toBe(start.design.length);
  const sized=await read(page);
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(async()=>(await read(page)).design).toEqual(start.design);
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Redo',exact:true}).click();
  await expect.poll(async()=>(await read(page)).design).toEqual(sized.design);
  await shot(page,'size-handle-drag');

  await pickPlanTool(page,'Stairs');
  await expect(slider(page,'Stairs, position along the edge')).toBeVisible();
  await expect(page.locator('[data-stair-drag], [data-select-stairs]').first()).toBeVisible();
  await shot(page,'stairs-tool');

  await pickPlanTool(page,'House');
  await expect(slider(page,'House width, right wall')).toBeVisible();
  await expect(slider(page,'House width, left wall')).toBeVisible();
  await shot(page,'house-tool');
});

test('drawing navigation zoom and fit stay independent of design history',async({page})=>{
  await pickPlanTool(page,'Shape & points');
  const before=await read(page);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await expect(page.getByLabel('Drawing zoom',{exact:true})).toHaveText('125%');
  expect((await read(page)).design).toEqual(before.design);
  expect((await read(page)).history).toEqual(before.history);
  await page.getByRole('button',{name:'Fit drawing',exact:true}).click();
  await expect(page.getByLabel('Drawing zoom',{exact:true})).toHaveText('100%');
  expect((await read(page)).design).toEqual(before.design);
  await shot(page,'navigation-fit');
});

test('Board layout and Rails & screens expose their canvas controls',async({page})=>{
  await pickPlanTool(page,'Board layout');
  await expect(page.getByRole('button',{name:'Select board',exact:true})).toBeVisible();
  await expect(page.locator('.dd-board-layout-svg, [aria-label="Board layout selection canvas"]').first()).toBeVisible();
  await shot(page,'boards-tool');

  await pickPlanTool(page,'Rails & screens');
  await expect(page.getByRole('region',{name:'Railing and privacy screen controls',exact:true})).toBeVisible();
  await expect(page.locator('.dd-edge-section-editor svg')).toBeVisible();
  await shot(page,'edges-tool');

  await pickPlanTool(page,'Patios & walls');
  await expect(page.getByLabel('Patio and wall shape controls',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'QA patio point 1',exact:true})).toBeVisible();
  await shot(page,'yard-tool');
});
