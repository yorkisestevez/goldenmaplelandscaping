import {test,expect} from '@playwright/test';
import {showProjectControls} from './nav';

test.use({viewport:{width:1440,height:1000}});
test.beforeEach(async({context,page})=>{
 await context.addInitScript(()=>{
  (window as any).__name=(value:any)=>value;localStorage.clear();
  class Recognition {onstart:any;onend:any;onresult:any;onerror:any;segments:any[]=[];start(){(window as any).qaMic=this;queueMicrotask(()=>this.onstart?.());}stop(){queueMicrotask(()=>this.onend?.());}abort(){}}
  (window as any).SpeechRecognition=Recognition;
  (window as any).qaSay=(text:string)=>{const mic=(window as any).qaMic;mic.segments.push(Object.assign([{transcript:text}],{isFinal:true}));mic.onresult?.({resultIndex:mic.segments.length-1,results:mic.segments});};
  Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(u:any){queueMicrotask(()=>u.onend?.());}}});
 });
 await page.route('**/.netlify/functions/deck-assistant',route=>route.fulfill({json:{ready:false,source:'exact-only'}}));
 await page.goto('/deck-designer/');await page.waitForFunction(()=>(window as any).deckcraft?.read().ready);
 await showProjectControls(page);await page.getByRole('button',{name:'Describe a change',exact:true}).click();
});
const read=(page:any)=>page.evaluate(()=>(window as any).deckcraft.read());
const say=async(page:any,text:string)=>{await page.waitForFunction(()=>!!(window as any).qaMic?.onresult);await page.evaluate((value:string)=>(window as any).qaSay(value),text);};
test('voice edits, selection, views, undo and stop share the live model',async({page})=>{
 const before=await read(page);await page.getByRole('button',{name:'Start voice control',exact:true}).click();
 await say(page,'make the deck 20 by 14 feet');await expect.poll(async()=>(await read(page)).design.width).toBe(20);await expect.poll(async()=>(await read(page)).design.length).toBe(14);
 await say(page,'undo');await expect.poll(async()=>(await read(page)).design.width).toBe(before.design.width);
 await say(page,'redo');await expect.poll(async()=>(await read(page)).design.width).toBe(20);
 const name=await page.evaluate(()=>(window as any).deckcraftWorkspace.read().objects.find((o:any)=>o.id.startsWith('deck:')).id);
 await say(page,`select ${name}`);await expect.poll(()=>page.evaluate(()=>(window as any).deckcraftWorkspace.read().selection.partIds[0])).toBe(name);
 await say(page,'show me from above');await expect.poll(async()=>(await read(page)).view).toBe('top');
 await expect(page.locator('.dd-selection-inspector')).toHaveJSProperty('open',true);
 await expect(page.locator('.dd-canvas canvas')).toBeVisible();await expect(page.getByText('Loading selected object…',{exact:true})).toHaveCount(0);
 await page.screenshot({path:'test-results/hands-free-desktop.png'});
 await say(page,'stop');await expect(page.getByRole('button',{name:'Start voice control',exact:true})).toBeVisible();
 const revision=(await read(page)).revision;await page.waitForTimeout(1200);expect((await read(page)).revision).toBe(revision);
});
test('preview mode applies by voice and typing ends listening',async({page})=>{
 const before=await read(page);await page.getByRole('button',{name:'Start voice control',exact:true}).click();await page.getByRole('checkbox',{name:'Apply changes automatically'}).uncheck();
  await say(page,'make the deck 22 by 14 feet');await expect(page.getByRole('region',{name:'Instruction preview',exact:true})).toBeVisible();expect((await read(page)).revision).toBe(before.revision);
  const dock=page.locator('.dd-selection-inspector');if(await dock.getAttribute('open')===null)await dock.locator('summary').click();
  await expect(page.getByText('Showing proposed geometry · apply the preview to save one undoable edit.',{exact:true})).toBeVisible();
 await say(page,'apply');await expect.poll(async()=>(await read(page)).design.width).toBe(22);
 await page.getByRole('textbox',{name:'What would you like to change?',exact:true}).fill('make the deck 18 by 12 feet');await expect(page.getByRole('button',{name:'Start voice control',exact:true})).toBeVisible();
});

test('spoken clarification answers return to the validated edit flow',async({page})=>{
 let requests=0;
 await page.route('**/.netlify/functions/deck-assistant',route=>{if(route.request().method()==='GET')return route.fulfill({json:{ready:true,source:'local-ai',model:'test-model'}});requests++;return route.fulfill({json:{ok:true,source:'local-ai',model:'test-model',plan:requests===1?{kind:'clarify',message:'Choose a width.',assumptions:[],commands:[],question:'How wide should the deck be?',choices:['22 feet','24 feet']}:{kind:'edit',message:'Set deck width to 22 feet.',assumptions:[],commands:[{type:'design.patch',patch:{width:22}}]}}});});
 await page.getByRole('button',{name:'Start voice control',exact:true}).click();await say(page,'make room for dinner');await expect(page.getByRole('region',{name:'Clarification needed'})).toBeVisible();
 await say(page,'22 feet');await expect.poll(async()=>(await read(page)).design.width).toBe(22);expect(requests).toBe(2);
});
test('cancel interrupts pending AI work and backgrounding stops the microphone',async({page})=>{
 const before=await read(page);
 await page.route('**/.netlify/functions/deck-assistant',async route=>{await new Promise(resolve=>setTimeout(resolve,3500));await route.fulfill({json:{ok:true,source:'local-ai',model:'test-model',plan:{kind:'edit',message:'Wider.',assumptions:[],commands:[{type:'design.patch',patch:{width:24}}]}}}).catch(()=>{});});
 await page.getByRole('button',{name:'Start voice control',exact:true}).click();await say(page,'give us more space');await expect(page.getByRole('button',{name:'Interpreting...',exact:true})).toBeVisible();await say(page,'cancel');
 await expect(page.getByText('Cancelled the pending request. Applied changes are unchanged.',{exact:true})).toBeVisible();await page.waitForTimeout(4000);expect((await read(page)).design).toEqual(before.design);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});});await expect(page.getByRole('button',{name:'Start voice control',exact:true})).toBeVisible();
});
test('desktop inspector stays clear of the canvas; phone has no horizontal overflow',async({page})=>{
 await page.getByRole('button',{name:'Close instruction assistant',exact:true}).click();
 for(const width of [1280,1440]){await page.setViewportSize({width,height:1000});const canvas=await page.locator('.dd-canvas').boundingBox(),panel=await page.locator('.dd-selection-inspector').boundingBox();expect(panel!.y).toBeGreaterThanOrEqual(canvas!.y+canvas!.height-1);expect(panel!.x).toBeGreaterThanOrEqual(0);expect(panel!.x+panel!.width).toBeLessThanOrEqual(width+1);}
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('AI assumptions require spoken approval even with automatic changes enabled',async({page})=>{
 const before=await read(page);
 await page.route('**/.netlify/functions/deck-assistant',route=>route.fulfill({json:route.request().method()==='GET'?{ready:true,source:'local-ai',model:'test-model'}:{ok:true,source:'local-ai',model:'test-model',plan:{kind:'edit',message:'Widen the deck.',assumptions:['A little wider means two feet.'],commands:[{type:'design.patch',patch:{width:18}}]}}}));
 await page.getByRole('button',{name:'Start voice control',exact:true}).click();await say(page,'a little wider please');await expect(page.getByRole('region',{name:'Instruction preview',exact:true})).toBeVisible();expect((await read(page)).revision).toBe(before.revision);
 await say(page,'apply');await expect.poll(async()=>(await read(page)).design.width).toBe(18);
});
