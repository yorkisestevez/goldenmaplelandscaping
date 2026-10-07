import {expect,test,type Page} from '@playwright/test';

/**
 * The Pro workspace's rulers (Designer Mode, `?designer=1`): feet along the plan's top and left edges that follow pan,
 * zoom and Fit. The public designer has none, so the last test opens it without the flag.
 */
const KNOWN_CONSOLE=[/`selected` on <option>/,/THREE\./,/WebGL|GPU stall|swiftshader|GroupMarkerNotSet/i,/React DevTools/,/Failed to load resource/];

test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

const strip=(page:Page)=>page.locator('.dd-pro-strip');
const viewport=(page:Page)=>page.locator('.dd-plan-viewport');
const rulers=(page:Page)=>viewport(page).locator('.dd-pro-rulers');

function watchConsole(page:Page){
  const problems:string[]=[];
  page.on('console',m=>{if(m.type()==='error'&&!KNOWN_CONSOLE.some(r=>r.test(m.text())))problems.push(m.text());});
  page.on('pageerror',e=>problems.push(String(e)));
  return problems;
}

/** Each labelled tick on both rulers, with where the site plan's SVG itself puts that many feet on screen (from its
 * screen transform, which includes the stage's pan and zoom). A ruler that tracks the drawing lands within a pixel. */
async function readRulers(page:Page){
  return viewport(page).evaluate(box=>{
    const plan=box.querySelector<SVGSVGElement>('.dd-plan-stage>svg.dd-site-plan')!,m=plan.getScreenCTM()!,b=box.getBoundingClientRect();
    const read=(axis:'x'|'y')=>[...box.querySelectorAll<SVGTextElement>(`.dd-pro-ruler-${axis} text`)].map(t=>{
      const ft=Number(t.dataset.ft),at=Number(t.dataset.at);
      const drawn=axis==='x'?m.a*ft*12+m.e-b.left:m.d*ft*12+m.f-b.top;
      return {text:t.textContent??'',ft,at,drawn};
    });
    return {x:read('x'),y:read('y')};
  });
}
const signature=(r:Awaited<ReturnType<typeof readRulers>>)=>[...r.x,...r.y].map(t=>`${t.text}@${t.at}`).join(' ');
function expectRealFeet(r:Awaited<ReturnType<typeof readRulers>>){
  expect(r.x.length).toBeGreaterThan(1);expect(r.y.length).toBeGreaterThan(1);
  for(const t of [...r.x,...r.y]){
    expect(t.text).toMatch(/^-?\d+'$/);
    expect(t.text).toBe(`${t.ft}'`);
    expect(Math.abs(t.ft%5)).toBe(0);
    expect(Math.abs(t.at-t.drawn)).toBeLessThan(1.5);
  }
}

test('Pro rulers mark real feet along the plan and follow zoom and Fit',async({page},info)=>{
  const problems=watchConsole(page);
  await page.goto('/deck-designer/?designer=1');
  await expect(page.getByRole('menubar',{name:'Pro workspace menu'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Presets',exact:true})).toBeEnabled();
  await page.setViewportSize({width:1440,height:900});
  await strip(page).getByRole('button',{name:'Select parts'}).click();
  const zoom=strip(page).getByRole('group',{name:'Drawing navigation'});
  await expect(zoom.getByLabel('Drawing zoom')).toHaveText('100%');

  await expect(rulers(page)).toBeVisible();
  await expect(rulers(page)).toHaveAttribute('aria-hidden','true');
  await expect(rulers(page).locator('.dd-pro-ruler-x text').first()).toBeVisible();
  const fitted=await readRulers(page);
  expectRealFeet(fitted);

  // The rulers never take a pointer from the drawing, and never sit over the docked pan and zoom controls.
  const probe=await viewport(page).evaluate(box=>{
    const b=box.getBoundingClientRect(),hit=(x:number,y:number)=>document.elementFromPoint(x,y);
    return {style:getComputedStyle(box.querySelector('.dd-pro-rulers')!).pointerEvents,
      top:!!hit(b.left+b.width/2,b.top+8)?.closest('.dd-pro-rulers'),left:!!hit(b.left+8,b.top+b.height/2)?.closest('.dd-pro-rulers')};
  });
  expect(probe).toEqual({style:'none',top:false,left:false});
  const controls=await zoom.boundingBox(),ruler=await rulers(page).boundingBox(),top=await rulers(page).locator('.dd-pro-ruler-x').boundingBox(),left=await rulers(page).locator('.dd-pro-ruler-y').boundingBox();
  expect(controls&&ruler&&top&&left).toBeTruthy();
  const overlaps=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
  expect(overlaps(controls!,top!)||overlaps(controls!,left!)).toBe(false);
  await page.screenshot({path:info.outputPath('pro-rulers.png')});

  // Zooming in spreads the feet apart: the labels move (and fewer fit), and still land on the drawing's own feet.
  await zoom.getByRole('button',{name:'Zoom in'}).click();
  await expect(zoom.getByLabel('Drawing zoom')).toHaveText('125%');
  await expect.poll(async()=>signature(await readRulers(page))).not.toBe(signature(fitted));
  const zoomed=await readRulers(page);
  expectRealFeet(zoomed);
  await page.screenshot({path:info.outputPath('pro-rulers-zoomed.png')});

  // Fit brings the whole design back, and the rulers with it.
  await zoom.getByRole('button',{name:'Fit drawing'}).click();
  await expect(zoom.getByLabel('Drawing zoom')).toHaveText('100%');
  await expect.poll(async()=>signature(await readRulers(page))).not.toBe(signature(zoomed));
  const refit=await readRulers(page);
  expectRealFeet(refit);
  expect(signature(refit)).toBe(signature(fitted));
  expect(problems).toEqual([]);
});

test('the public designer’s plan has no rulers',async({page})=>{
  const problems=watchConsole(page);
  await page.goto('/deck-designer/');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.getByRole('radiogroup',{name:'Plan tools'})).toBeVisible();
  await expect(page.getByRole('menubar',{name:'Pro workspace menu'})).toHaveCount(0);
  await expect(viewport(page)).toBeVisible();
  await expect(viewport(page)).not.toHaveAttribute('data-rulers',/.*/);
  await expect(page.locator('.dd-pro-rulers')).toHaveCount(0);
  expect(problems).toEqual([]);
});
