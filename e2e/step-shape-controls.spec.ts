import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {convertStoneSteps} from '../src/features/deckcraft/stepAssembly';
import type {YardFeature} from '../src/features/deckcraft/types';
const legacy:YardFeature={id:'steps',name:'Test stone steps',kind:'patio',enabled:true,xFt:25,zFt:12,widthFt:4,depthFt:8,heightIn:0,rotationDeg:0,productId:'permacon-mondrian-plus',color:'#b8b5ae',finishedElevationIn:24,stoneSteps:{lowerElevationIn:0,riserCount:4,treadRunIn:24,stockWidthIn:48,stockDepthIn:24,stockThicknessIn:6,baseDepthIn:6,settingBedIn:1,jointIn:0,productName:'Recorded step stock',support:{kind:'full-step',courses:[0,1,2,3]}}};
const read=(p:Page)=>p.evaluate(()=>(window as any).deckcraft.read().design);
for(const phone of [false,true])test(`stone and paver width, wraps, cancel, undo and persistence ${phone?'@phone':''}`,async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const placed={...legacy,xFt:40},feature=phone?convertStoneSteps(placed):placed;
 if(phone){feature.stepAssembly!.family='cap-block';feature.stepAssembly!.riser={...feature.stepAssembly!.tread,thicknessIn:2};}
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(configuration=>{const k='golden-maple.deck-studio.deck-only.v1';if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));},{...DEFAULT_DECK,houseVisible:false,stairFlights:0,railingType:'None',yardFeatures:[feature]});
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
 await expect(page.locator('[data-step-surface="steps"]').first()).toBeVisible();
 await page.locator('.dd-hardscape-plan-picks polygon').first().click();
 const h=page.getByRole('button',{name:'Resize step right side',exact:true});await expect(h).toBeVisible();
 async function pull(inches:number,cancel=false){await h.scrollIntoViewIfNeeded();const r=(await h.boundingBox())!,scale=await h.evaluate(e=>{const m=(e as SVGCircleElement).getScreenCTM()!;return Math.hypot(m.a,m.b);});const x=r.x+r.width/2,y=r.y+r.height/2;
  if(phone){const touch=await context.newCDPSession(page);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+inches*scale*i/8,y}]});await expect(page.getByText(/release to save/i)).toBeVisible();if(cancel)await page.keyboard.press('Escape');await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();}
  else {await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+inches*scale,y,{steps:8});await expect(page.getByText(/release to save/i)).toBeVisible();if(cancel)await page.keyboard.press('Escape');await page.mouse.up();}
 }
 const original=await read(page);await pull(12);await expect.poll(async()=>(await read(page)).yardFeatures[0].stepAssembly?.flights[0].widthIn).toBe(60);
 await pull(24);await expect.poll(async()=>(await read(page)).yardFeatures[0].stepAssembly.flights[0].widthIn).toBe(84);const wide=await read(page);
 await pull(-12,true);expect(await read(page)).toEqual(wide);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await read(page)).yardFeatures[0].stepAssembly.flights[0].widthIn).toBe(60);
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await read(page)).toEqual(original);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await read(page)).toEqual(wide);
 await page.getByRole('button',{name:'Wrap steps around left corner',exact:true}).click();await expect.poll(async()=>(await read(page)).yardFeatures[0].stepAssembly.flights[0].wrapSides).toEqual(['back','left']);
 await page.getByRole('button',{name:'Wrap steps around right corner',exact:true}).click();const wrapped=await read(page);expect(wrapped.yardFeatures[0].stepAssembly.flights[0].wrapSides).toEqual(['back','left','right']);
 expect(wrapped.yardFeatures[0].stepAssembly.tread.widthIn).toBe(48);expect(wrapped.yardFeatures[0].stepAssembly.flights[0].upperElevationIn).toBe(24);
 await page.getByRole('button',{name:'Fit drawing',exact:true}).click();await h.scrollIntoViewIfNeeded();await expect(page.locator('[data-step-surface="steps"]').first()).toBeVisible();await page.screenshot({path:`../outputs/stair-controls/${phone?'phone':'desktop'}-wrap.png`});
 await expect(page.getByText(/^Saved on this device at/)).toBeVisible();await page.reload();await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);expect(await read(page)).toEqual(wrapped);expect(errors).toEqual([]);
});
test('a wrap into deck supports is rejected without changing the design',async({page,context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(configuration=>localStorage.setItem('golden-maple.deck-studio.deck-only.v1',JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration})),{...DEFAULT_DECK,houseVisible:false,stairFlights:0,railingType:'None',yardFeatures:[{...legacy,widthFt:7}]});
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
 await page.locator('.dd-hardscape-plan-picks polygon').first().click();const before=await read(page);
 await page.getByRole('button',{name:'Wrap steps around left corner',exact:true}).click();
 await expect(page.getByText(/Cannot change steps:.*intersects/)).toBeVisible();expect(await read(page)).toEqual(before);await expect(page.locator('[data-step-surface="steps"]').first()).toBeVisible();
});
