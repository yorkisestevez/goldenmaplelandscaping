import {expect,test,type Page} from '@playwright/test';

/**
 * Plants, beds and outdoor objects commit into the design when they are added.
 * Saving a camera or switching Day/Night must not drop them, and two adds must not share one point.
 * Lead-form and AI endpoints are blocked and never called.
 */
const KNOWN_CONSOLE=[/`selected` on <option>/,/THREE\./,/WebGL|GPU stall|swiftshader|GroupMarkerNotSet/i,/React DevTools/,/Failed to load resource/,/setstate-in-render/];

test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

const ribbon=(page:Page)=>page.getByRole('region',{name:'Ribbon',exact:true});
const library=(page:Page)=>page.getByRole('region',{name:'Plants, beds and outdoor objects'});
const objects=async(page:Page)=>page.evaluate(()=>{
  const design=(window as unknown as {deckcraft:{read:()=>{design:{landscapeObjects?:{id:string;name:string;kind:string;xIn:number;zIn:number;widthIn:number;enabled:boolean}[];sceneLighting?:string;scenePresentation?:{cameras?:unknown[]}}}}}).deckcraft.read().design;
  return {items:design.landscapeObjects??[],lighting:design.sceneLighting??'Daylight',cameras:design.scenePresentation?.cameras?.length??0};
});

async function openLibrary(page:Page){
  await page.goto('/deck-designer/?designer=1');
  await expect(page.getByRole('button',{name:'Presets',exact:true})).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:{read:()=>{ready:boolean}}}).deckcraft?.read().ready??false)).toBe(true);
  await ribbon(page).getByRole('tab',{name:'Landscape',exact:true}).click();
  await page.locator('#dd-pro-ribbon-panel').getByRole('button',{name:'Pools & backyard',exact:true}).click();
  await expect(library(page).getByRole('heading',{name:'Plants, beds and outdoor objects'})).toBeVisible();
}

test('added landscape objects stay after Day/Night and a saved camera',async({page})=>{
  const problems:string[]=[];
  const remote:string[]=[];
  page.on('console',message=>{if(message.type()==='error'&&!KNOWN_CONSOLE.some(pattern=>pattern.test(message.text())))problems.push(message.text());});
  page.on('pageerror',error=>problems.push(String(error)));
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.pathname.includes('/.netlify/functions/')||/anthropic/i.test(url.hostname))remote.push(request.url());
  });
  await openLibrary(page);
  const list=library(page);
  await list.getByRole('button',{name:'Add deciduous tree'}).click();
  await expect.poll(async()=>(await objects(page)).items.length).toBe(1);
  await expect(list.getByRole('combobox',{name:'Selected landscape object'})).toContainText('Deciduous tree');
  await expect(list.locator('.dd-landscape-quantities div',{hasText:'Plants'}).locator('dd')).toHaveText('1');
  await expect(list.getByRole('group',{name:'Review area changes'})).toHaveCount(0);
  const added=await objects(page);
  expect(added.items[0].kind).toBe('plant');
  expect(added.items[0].enabled).toBe(true);

  await ribbon(page).getByRole('tab',{name:'Plan Detail',exact:true}).click();
  await page.locator('#dd-pro-ribbon-panel').getByRole('button',{name:'3D',exact:true}).click();
  await page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:'Night'}).click();
  await expect.poll(async()=>(await objects(page)).lighting).toBe('Evening');
  await expect.poll(async()=>(await objects(page)).items.map(item=>item.id)).toEqual([added.items[0].id]);
  await expect(list.getByRole('combobox',{name:'Selected landscape object'})).toContainText('Deciduous tree');

  const save=page.getByRole('button',{name:'Save current camera',exact:true});
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(async()=>(await objects(page)).cameras).toBeGreaterThan(0);
  await expect.poll(async()=>(await objects(page)).items.map(item=>item.id)).toEqual([added.items[0].id]);

  await list.getByRole('button',{name:'Add hedge shrub'}).click();
  await expect.poll(async()=>(await objects(page)).items.length).toBe(2);
  const both=await objects(page);
  expect(both.items[0].xIn!==both.items[1].xIn||both.items[0].zIn!==both.items[1].zIn).toBe(true);
  await expect(list.locator('.dd-landscape-quantities div',{hasText:'Plants'}).locator('dd')).toHaveText('2');
  const priced=await page.evaluate(()=>{
    const snap=(window as unknown as {deckcraft:{read:()=>{pricing:{sections:{title:string;total:number}[]};quotes:string[]}}}).deckcraft.read();
    return {priced:snap.pricing.sections.filter(section=>/deciduous tree|hedge shrub/i.test(section.title)&&section.total>0),quotes:snap.quotes.filter(quote=>/deciduous tree|hedge shrub/i.test(quote))};
  });
  expect(priced.priced).toEqual([]);

  await page.waitForTimeout(600);
  await list.getByRole('button',{name:'Duplicate object',exact:true}).click();
  await expect.poll(async()=>(await objects(page)).items.length).toBe(3);
  await page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:'Day'}).click();
  await expect.poll(async()=>(await objects(page)).lighting).toBe('Daylight');
  await expect.poll(async()=>(await objects(page)).items.length).toBe(3);
  await list.getByRole('button',{name:'Remove object',exact:true}).click();
  await expect.poll(async()=>(await objects(page)).items.length).toBe(2);

  await ribbon(page).getByRole('tab',{name:'Main',exact:true}).click();
  const undo=page.locator('#dd-pro-ribbon-panel').getByRole('button',{name:'Undo',exact:true});
  await undo.click();
  await expect.poll(async()=>(await objects(page)).items.length).toBe(3);
  await undo.click();
  await expect.poll(async()=>(await objects(page)).lighting).toBe('Evening');
  await undo.click();
  await expect.poll(async()=>(await objects(page)).items.length).toBe(2);
  expect(problems).toEqual([]);
  expect(remote).toEqual([]);
});

test('a bed size edit stays staged through Day/Night until it is applied',async({page})=>{
  const remote:string[]=[];
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname.includes('/.netlify/functions/')||/anthropic/i.test(url.hostname))remote.push(request.url());});
  await openLibrary(page);
  const list=library(page);
  await list.getByRole('button',{name:'Add planting bed'}).click();
  await expect.poll(async()=>(await objects(page)).items.length).toBe(1);
  const width=list.getByRole('spinbutton',{name:'Design width (in)'});
  await width.fill('180');
  await width.blur();
  await expect(list.getByRole('group',{name:'Review area changes'})).toBeVisible();
  await expect.poll(async()=>(await objects(page)).items[0]?.widthIn).toBe(120);
  await ribbon(page).getByRole('tab',{name:'Plan Detail',exact:true}).click();
  await page.locator('#dd-pro-ribbon-panel').getByRole('button',{name:'3D',exact:true}).click();
  await page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:'Night'}).click();
  await expect.poll(async()=>(await objects(page)).lighting).toBe('Evening');
  await expect(list.getByRole('group',{name:'Review area changes'})).toBeVisible();
  await expect(width).toHaveValue('180');
  await expect.poll(async()=>(await objects(page)).items.map(item=>item.widthIn)).toEqual([120]);
  expect(remote).toEqual([]);
});
