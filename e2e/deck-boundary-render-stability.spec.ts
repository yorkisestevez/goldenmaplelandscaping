import {expect,test,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';

const proof=resolve(process.cwd(),'../../outputs/deckcraft-stair-path-review/boundary-render');mkdirSync(proof,{recursive:true});
const errors=new WeakMap<Page,string[]>();
const outline=[{x:0,y:0},{x:329.004,y:0},{x:329.004,y:233.316},{x:173.701,y:233.316},{x:173.701,y:201.837},{x:0,y:201.837}];
const configuration={...DEFAULT_DECK,width:27.417,length:19.443,height:36,levels:1,stairFlights:0,deckOutlines:{main:outline.map(p=>({x:p.x/12,y:p.y/12}))},customerName:'Fractional outline QA',projectAddress:'Local-only render fixture'};
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
async function stable(page:Page){
 await expect(page.locator('.dd-boundary-editor')).toBeVisible();await expect(page.locator('.dd-boundary-dimension-label')).toHaveCount(outline.length);
 // A render loop must stop producing label layout mutations after a view interaction. Four animation
 // frames allow ordinary state/layout effects; another 20 frames must keep the same screen positions.
 const frames=await page.evaluate(async()=>{
  const labels=[...document.querySelectorAll<HTMLElement>('.dd-boundary-dimension-label')],samples:{left:number;top:number;width:number;height:number}[][]=[];
  let mutations=0;const observer=new MutationObserver(records=>{mutations+=records.length;});for(const label of labels)observer.observe(label,{attributes:true,attributeFilter:['style']});
  try{for(let i=0;i<24;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));samples.push(labels.map(label=>{const r=label.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};}));}return {samples,mutations};}finally{observer.disconnect();}
 });
 const settled=frames.samples.slice(4),first=settled[0];for(const sample of settled)for(let i=0;i<first.length;i++)for(const key of ['left','top','width','height'] as const)expect(Math.abs(sample[i][key]-first[i][key]),`Label ${i+1} ${key} must settle`).toBeLessThan(.3);
 expect(frames.mutations,'Label styles must not keep updating on every render').toBeLessThanOrEqual(24);expect(errors.get(page)??[]).toEqual([]);
 return frames;
}
test.beforeEach(async({page,context})=>{
 const caught:string[]=[];errors.set(page,caught);page.on('pageerror',error=>caught.push(error.message));
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(configuration=>{const key='golden-maple.deck-studio.deck-only.v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));},configuration);
 await context.route('**/*',route=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(route.request().url())&&route.request().method()==='GET'?route.continue():route.fulfill({status:200,body:''}));
});
test.afterEach(async({page},info)=>{
 writeFileSync(resolve(proof,`${info.project.name}-errors.json`),JSON.stringify({errors:errors.get(page)??[],status:info.status},null,2));if(info.status!==info.expectedStatus)await page.screenshot({path:resolve(proof,`${info.project.name}-failure.png`)});expect(errors.get(page)??[]).toEqual([]);
});

for(const touch of [false,true])test(`${touch?'@phone ':''}fractional custom outline dimension labels settle after resizing, zooming and native pan`,async({page,context})=>{
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
 await page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{name:'Shape & points',exact:true}).click();const original=await read(page);expect(original.boundaries[0].points).toHaveLength(outline.length);for(let i=0;i<outline.length;i++){expect(original.boundaries[0].points[i].x).toBeCloseTo(outline[i].x,6);expect(original.boundaries[0].points[i].y).toBeCloseTo(outline[i].y,6);}
 const samples:unknown[]=[await stable(page)],sizes=touch?[{width:390,height:844},{width:768,height:1024},{width:430,height:932}]:[{width:1440,height:1000},{width:1177,height:901},{width:979,height:833}];
 for(const viewport of sizes){
  await page.setViewportSize(viewport);await page.getByRole('button',{name:'Fit drawing',exact:true}).click();samples.push({viewport,frames:await stable(page)});
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.getByLabel('Drawing zoom')).toHaveText('125%');samples.push({zoom:'125%',frames:await stable(page)});
  await page.getByRole('button',{name:'Pan drawing',exact:true}).click();const canvas=page.getByLabel('Deck drawing canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!,x=b.x+b.width/2,y=b.y+76;
  if(touch){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+27.75,y:y+13.25,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+27.75,y+13.25,{steps:4});await page.mouse.up();}
  await page.getByRole('button',{name:'Pan drawing',exact:true}).click();samples.push({pan:true,frames:await stable(page)});expect((await read(page)).design).toEqual(original.design);expect((await read(page)).pricing).toEqual(original.pricing);expect((await read(page)).history).toEqual(original.history);
 }
 await page.getByRole('button',{name:'Fit drawing',exact:true}).click();const label=page.getByRole('button',{name:'Edit Main deck edge 1 dimension',exact:true});await label.click();await expect(page.getByRole('dialog',{name:'Edit edge dimension',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel edge dimension',exact:true}).click();await expect(label).toBeFocused();samples.push({afterInlineEditor:await stable(page)});
 writeFileSync(resolve(proof,`${touch?'phone':'desktop'}-label-stability.json`),JSON.stringify(samples,null,2));await page.locator('#deck-live-preview').screenshot({path:resolve(proof,`${touch?'phone':'desktop'}-fractional-outline.png`)});
});
