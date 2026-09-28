import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
test.beforeEach(async({context})=>{await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method()))return route.abort();if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))return route.fallback();return route.fulfill({status:200,contentType:request.resourceType()==='script'?'text/javascript':request.resourceType()==='stylesheet'?'text/css':'text/plain',body:''});});});
const read=(page:Page)=>page.evaluate(()=>window.deckcraft!.read());
async function open(page:Page){await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);const response=await page.evaluate(()=>window.deckcraft!.execute({id:'easy-dimension-seed',commands:[{type:'design.patch',patch:{deckType:'Freestanding',houseVisible:false,stairFlights:0}},{type:'boundary.set',level:1,points:[{x:0,y:0},{x:192,y:0},{x:192,y:144},{x:0,y:144}]}]}));expect(response.ok,JSON.stringify(response)).toBe(true);await page.locator('#dd-tool-outline').click();}
async function proof(page:Page,name:string){if(process.env.DECK_EASY_DIMENSION_PROOF==='1'){const dir=resolve('../../outputs/deckcraft-easy-edit-review/dimensions');mkdirSync(dir,{recursive:true});await page.locator('.dd-plan-viewport').screenshot({path:resolve(dir,name)});}}
async function assertLabelsReachable(page:Page){
 const labels=page.locator('.dd-boundary-dimension-label');await expect(labels).toHaveCount(4);
 for(let i=0;i<4;i++){
  const label=labels.nth(i);await label.scrollIntoViewIfNeeded();
  await expect.poll(()=>label.evaluate(el=>{const r=el.getBoundingClientRect(),clip=el.closest('.dd-plan-viewport')!.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.left>=clip.left&&r.right<=clip.right&&r.top>=clip.top&&r.bottom<=clip.bottom&&!!target&&el.contains(target);})).toBe(true);
  await label.click();await expect(page.getByRole('dialog',{name:'Edit edge dimension'})).toBeVisible();await page.getByRole('button',{name:'Cancel edge dimension',exact:true}).click();
 }
}

test('tap actual edge label stages endpoint preview, cancels safely and applies one undoable dimension',async({page})=>{
 await open(page);await assertLabelsReachable(page);await proof(page,'desktop-all-edge-labels.png');const label=page.getByRole('button',{name:'Edit Main deck edge 1 dimension',exact:true}),before=await read(page);await label.click();
 const dialog=page.getByRole('dialog',{name:'Edit edge dimension'});await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Selected edge length')).toBeFocused();
 await dialog.getByLabel('Selected edge length').fill('18');await dialog.getByLabel('Selected edge angle in degrees').fill('15');await expect(page.locator('.dd-boundary-dimension-endpoint')).toBeVisible();
 await expect.poll(()=>page.locator('.dd-boundary-dimension-endpoint').evaluate(el=>{const point=el.getBoundingClientRect(),dialog=el.closest('.dd-boundary-editor')!.querySelector('.dd-boundary-inline')!.getBoundingClientRect(),x=point.x+point.width/2,y=point.y+point.height/2;return x<dialog.left||x>dialog.right||y<dialog.top||y>dialog.bottom;})).toBe(true);
 expect((await read(page)).design).toEqual(before.design);expect((await read(page)).pricing).toEqual(before.pricing);await proof(page,'desktop-edge-draft.png');
 await dialog.getByRole('button',{name:'Cancel edge dimension'}).click();await expect(dialog).toBeHidden();expect((await read(page)).design).toEqual(before.design);await expect(label).toBeFocused();
 await label.click();await dialog.getByLabel('Selected edge length').fill('18');await dialog.getByRole('button',{name:'Apply edge dimension',exact:true}).click();await expect(dialog).toBeHidden();
 await expect.poll(async()=>((await read(page)).boundaries[0].points[1].x)).toBe(216);expect((await read(page)).boundaries[0].points[0]).toEqual(before.boundaries[0].points[0]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>((await read(page)).boundaries)).toEqual(before.boundaries);
});

test('failed locked dimension keeps entered draft and explicitly unlocks before apply',async({page})=>{
 await open(page);const locked=await page.evaluate(()=>window.deckcraft!.execute({id:'lock-label-edge',commands:[{type:'boundary.lock',level:1,index:0,locked:true}]}));expect(locked.ok).toBe(true);
 await page.getByRole('button',{name:'Edit Main deck edge 1 dimension',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit edge dimension'}),before=await read(page);
 await dialog.getByLabel('Selected edge length').fill('20');await dialog.getByRole('button',{name:'Apply edge dimension',exact:true}).click();await expect(dialog).toContainText('locked');await expect(dialog.getByLabel('Selected edge length')).toHaveValue('20');expect((await read(page)).design).toEqual(before.design);
 await expect(page.locator('.dd-boundary-dimension-preview[data-invalid]')).toBeVisible();await proof(page,'desktop-locked-draft.png');
 await dialog.getByRole('button',{name:'Unlock edge',exact:true}).click();await expect.poll(async()=>((await read(page)).design.boundaryLocks)).toBeUndefined();await expect(dialog.getByLabel('Selected edge length')).toHaveValue('20');
 await dialog.getByRole('button',{name:'Apply edge dimension',exact:true}).click();await expect.poll(async()=>((await read(page)).boundaries[0].points[1].x)).toBe(240);
});

test('alignment guides snap to a corner axis and Free movement bypasses snapping',async({page})=>{
 await open(page);const endpoint=page.getByRole('button',{name:'Main deck point 2',exact:true}),corner=page.getByRole('button',{name:'Main deck point 3',exact:true});await endpoint.scrollIntoViewIfNeeded();
 const a=(await endpoint.boundingBox())!,b=(await corner.boundingBox())!,pixelsPerIn=(b.y-a.y)/144;
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2+3*pixelsPerIn,a.y+a.height/2+20*pixelsPerIn,{steps:3});
 await expect(page.locator('.dd-boundary-snap-status')).toBeVisible();await expect.poll(()=>page.locator('.dd-boundary-snap-guide').first().evaluate(node=>{const line=node as SVGLineElement,matrix=line.getScreenCTM(),style=getComputedStyle(line),clip=line.closest('.dd-plan-viewport')!.getBoundingClientRect();if(!matrix)return false;const a=new DOMPoint(line.x1.baseVal.value,line.y1.baseVal.value).matrixTransform(matrix),b=new DOMPoint(line.x2.baseVal.value,line.y2.baseVal.value).matrixTransform(matrix),inside=(p:DOMPoint)=>p.x>=clip.left&&p.x<=clip.right&&p.y>=clip.top&&p.y<=clip.bottom;return style.stroke!=='none'&&Number.parseFloat(style.strokeWidth)>0&&Number(style.opacity)>0&&style.display!=='none'&&style.visibility!=='hidden'&&Math.hypot(a.x-b.x,a.y-b.y)>1&&inside(a)&&inside(b);})).toBe(true);await proof(page,'desktop-alignment-guide.png');await page.mouse.up();await expect.poll(async()=>((await read(page)).boundaries[0].points[1].x)).toBe(192);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>((await read(page)).boundaries[0].points[1].y)).toBe(0);
 await page.getByRole('switch',{name:/^Free movement/}).check();await endpoint.scrollIntoViewIfNeeded();const fresh=(await endpoint.boundingBox())!;
 await page.mouse.move(fresh.x+fresh.width/2,fresh.y+fresh.height/2);await page.mouse.down();await page.mouse.move(fresh.x+fresh.width/2+3*pixelsPerIn,fresh.y+fresh.height/2+20*pixelsPerIn,{steps:3});await expect(page.locator('.dd-boundary-snap-status')).toBeHidden();await page.mouse.up();
 await expect.poll(async()=>((await read(page)).boundaries[0].points[1].x)).toBeCloseTo(195,1);
});

test('phone tap opens concise edge editor inside the plan and Escape preserves design @phone',async({page})=>{
 await open(page);await assertLabelsReachable(page);await proof(page,'phone-all-edge-labels.png');const before=await read(page);await page.getByRole('button',{name:'Edit Main deck edge 3 dimension',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit edge dimension'});await expect(dialog).toBeVisible();
 await dialog.getByLabel('Selected edge length').fill('15.5');await expect(dialog.getByLabel('Selected edge length')).toHaveValue('15.5');
 expect(await dialog.evaluate(el=>{const box=el.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth;})).toBe(true);
 for(const name of ['Apply edge dimension','Cancel']){const box=(await dialog.getByRole('button',{name,exact:true}).boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);}
 await proof(page,'phone-edge-popup.png');await dialog.getByLabel('Selected edge length').press('Escape');await expect(dialog).toBeHidden();expect((await read(page)).design).toEqual(before.design);
});

test('a level moved externally keeps entered draft and rejects applying its old origin',async({page})=>{
 await open(page);const added=await page.evaluate(()=>window.deckcraft!.execute({id:'second-level-popup',commands:[{type:'design.patch',patch:{levels:2,width2:8,length2:8}},{type:'boundary.set',level:2,points:[{x:0,y:0},{x:96,y:0},{x:96,y:96},{x:0,y:96}]}]}));expect(added.ok,JSON.stringify(added)).toBe(true);
 await page.getByRole('button',{name:'Edit Level 2 edge 1 dimension',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit edge dimension'});await dialog.getByLabel('Selected edge length').fill('9');
 const result=await page.evaluate(async()=>{const api=window.deckcraft!,offset=api.read().boundaries.find(b=>b.level===2)!.offset;return api.execute({id:'external-origin',commands:[{type:'design.patch',patch:{deckOutlineOffsets:{second:{x:offset.x/12+2,y:offset.y/12}}}}]});});expect(result.ok,JSON.stringify(result)).toBe(true);
 await expect(dialog).toContainText('outline changed');await expect(dialog.getByLabel('Selected edge length')).toHaveValue('9');const moved=await read(page);await dialog.getByRole('button',{name:'Apply edge dimension',exact:true}).click();expect((await read(page)).design).toEqual(moved.design);
 await dialog.getByRole('button',{name:'Cancel edge dimension'}).click();await expect(dialog).toBeHidden();
});
