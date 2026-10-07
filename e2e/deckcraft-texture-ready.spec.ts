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
      // Sample the deck, fascia and stairs as an area. A camera change can put a single fixed pixel on the house,
      // rail or lawn; corresponding samples across this area still have to show the selected board colour.
      return Array.from({length:400},(_,i)=>{
        const x=.22+(i%20+.5)/20*.6,y=.3+(Math.floor(i/20)+.5)/20*.44;
        return Array.from(ctx.getImageData(Math.round(x*canvas.width),Math.round(y*canvas.height),1,1).data).slice(0,3);
      });
    });
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
    return samples;
  };
  const brown=await cover('Coconut Husk');
  await execute('choose-grey-final',[{type:'design.patch',patch:{deckingColor:'Sea Salt Gray'}}]);
  const grey=await cover('Sea Salt Gray');
  const warmer=brown.filter(([r,g],i)=>r-g-(grey[i][0]-grey[i][1])>15).length;
  expect(delayed).toBeGreaterThan(0);
  expect(warmer,'At least 12% of the deck-area samples must visibly change from warm brown to grey').toBeGreaterThan(brown.length*.12);
  await info.attach('actual-cover-colours',{body:JSON.stringify({delayed,warmer,samples:brown.length,brown,grey}),contentType:'application/json'});
});
