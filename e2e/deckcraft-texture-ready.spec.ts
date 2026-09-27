import {expect,test} from '@playwright/test';
import type {AgentCommand} from '../src/features/deckcraft/designer/deckAgentController';

/** A proposal must depict the selected finish even when the actual atlas worker loads slowly. */
test('proposal cover matches the restored board finish and subsequent grey choice after slow texture loading',async({page,context},info)=>{
  await page.setViewportSize({width:768,height:1024});
  let delayed=0;
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(!['localhost','127.0.0.1'].includes(url.hostname)){await route.abort();return;}
    if(/swatchMaps.*worker/i.test(url.pathname)){delayed++;await new Promise(resolve=>setTimeout(resolve,3000));}
    await route.continue();
  });
  await page.goto('/deck-designer/');
  await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);
  const execute=async(id:string,commands:AgentCommand[])=>{
    const response=await page.evaluate(({id,commands})=>window.deckcraft!.execute({id,commands}),{id,commands});
    expect(response.ok,JSON.stringify(response)).toBe(true);
  };
  await execute('choose-grey',[{type:'design.patch',patch:{deckingColor:'Sea Salt Gray'}}]);
  await execute('restore-brown',[{type:'history.undo'}]);
  expect(await page.evaluate(()=>window.deckcraft!.read().design.deckingColor)).toBe('Coconut Husk');
  const cover=async(finish:string)=>{
    await execute(`proposal-${finish.replace(/\s/g,'-')}`,[{type:'action',action:'proposal.open'}]);
    const dialog=page.getByRole('dialog',{name:'Deck proposal preview'});
    await expect(dialog).toBeVisible();await expect(dialog.locator('.dd-proposal-page').first()).toContainText(finish);
    const hero=dialog.locator('.dd-proposal-hero-frame img');await expect(hero).toHaveAttribute('src',/^data:image\/jpeg/);
    const samples=await hero.evaluate((img:HTMLImageElement)=>{
      const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,0,0);
      return [.45,.5,.55].map(x=>Array.from(ctx.getImageData(Math.round(x*canvas.width),Math.round(.32*canvas.height),1,1).data).slice(0,3));
    });
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
    return samples;
  };
  const brown=await cover('Coconut Husk');
  await execute('choose-grey-final',[{type:'design.patch',patch:{deckingColor:'Sea Salt Gray'}}]);
  const grey=await cover('Sea Salt Gray');
  const warmth=(samples:number[][])=>samples.reduce((sum,[r,g])=>sum+r-g,0)/samples.length;
  expect(delayed).toBeGreaterThan(0);expect(warmth(brown)-warmth(grey)).toBeGreaterThan(15);
  await info.attach('actual-cover-colours',{body:JSON.stringify({delayed,brown,grey}),contentType:'application/json'});
});
