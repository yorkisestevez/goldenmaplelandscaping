import {expect,test,type Request} from '@playwright/test';

/**
 * Counts real Google page_view hits. DeckCraft specs abort third parties; this
 * one does not. A route that leaves before gtag.js answers still has to send
 * one GA4 and one Ads page_view, with that page's location and title.
 */

type Hit = {kind:'G'|'AW'; title:string; path:string};

function paramsOf(req:Request){
  const bag = new URL(req.url()).searchParams;
  const post = req.postData()??'';
  if(post && !post.startsWith('{')){
    for(const [key,value] of new URLSearchParams(post)) if(!bag.has(key)) bag.set(key,value);
  }
  return bag;
}

function note(req:Request,hits:Hit[]){
  const bag = paramsOf(req);
  if(bag.get('en')!=='page_view') return;
  const tid = bag.get('tid')??'';
  const kind = tid.startsWith('G-')?'G':tid.startsWith('AW-')?'AW':null;
  if(!kind) return;
  let path = '';
  try{path = new URL(bag.get('dl')??'').pathname;}catch{path = bag.get('dl')??'';}
  hits.push({kind,title:bag.get('dt')??'',path});
}

function pathOf(url:string | URL){
  const href = typeof url === 'string' ? url : url.href;
  const path = href.startsWith('/') ? href.split('?')[0] : new URL(href).pathname;
  return path.length>1 && path.endsWith('/') ? path.slice(0,-1) : path;
}

test('each navigation sends one GA4 and one Ads page_view',async({page})=>{
  test.setTimeout(120_000);
  const hits:Hit[] = [];
  let gtagAt = 0;
  const started = Date.now();
  page.on('request',req=>{
    if(!gtagAt && req.url().includes('/gtag/js')) gtagAt = Date.now();
    note(req,hits);
  });

  const html = await (await page.request.get('/')).text();
  expect(html).toContain("gtag('consent','default'");
  expect(html).not.toContain('googletagmanager.com/gtag/js');

  await page.goto('/',{waitUntil:'domcontentloaded'});
  const consent = await page.evaluate(()=>{
    const entry = (window as unknown as {dataLayer?:{0?:string;1?:string;2?:{ad_storage?:string;analytics_storage?:string}}[]}).dataLayer?.[0];
    return {command:entry?.[0],action:entry?.[1],ad:entry?.[2]?.ad_storage,analytics:entry?.[2]?.analytics_storage};
  });
  expect(consent).toEqual({command:'consent',action:'default',ad:'denied',analytics:'denied'});

  // No click. The scheduler is requestIdleCallback capped at 2.5s after hydration,
  // so a slow runner may spend most of this on the document, not on the cap.
  await expect.poll(()=>gtagAt,{timeout:20_000}).toBeGreaterThan(0);
  expect(gtagAt-started).toBeLessThan(20_000);

  const expectOneEach = async (from:number) => {
    await expect.poll(()=>hits.slice(from).filter(hit=>hit.kind==='G').length,{timeout:12_000}).toBe(1);
    await expect.poll(()=>hits.slice(from).filter(hit=>hit.kind==='AW').length,{timeout:12_000}).toBe(1);
    // The history listener used to add another hit about a second later, and a
    // stale-title GA4 hit a few seconds after that. Stay and make sure neither arrives.
    await page.waitForTimeout(5_500);
    const mine = hits.slice(from);
    expect(mine.filter(hit=>hit.kind==='G')).toHaveLength(1);
    expect(mine.filter(hit=>hit.kind==='AW')).toHaveLength(1);
    const title = await page.title();
    const path = pathOf(page.url());
    for(const hit of mine){
      expect(hit.title).toBe(title);
      expect(pathOf(new URL(hit.path,page.url()).href)).toBe(path);
    }
  };

  await expectOneEach(0);
  for(const href of ['/contact/','/about/','/reviews/']){
    const from = hits.length;
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(url=>pathOf(url.href)===pathOf(href));
    await expectOneEach(from);
  }
  console.log(hits.map(hit=>`${hit.kind} ${hit.title} ${hit.path}`).join('\n'));
});

test('a call click before gtag.js arrives is queued and then sent',async({page})=>{
  let release = ()=>{};
  const gate = new Promise<void>(resolve=>{release = resolve;});
  await page.route('**/gtag/js**',async route=>{
    await gate;
    await route.continue();
  });
  const conversions:string[] = [];
  page.on('request',req=>{
    const bag = paramsOf(req);
    const sendTo = bag.get('send_to')??bag.get('en')??'';
    const blob = `${req.url()} ${req.postData()??''}`;
    if(blob.includes('0CDHCIO2iPEbEJ3hwbAo') || sendTo.includes('0CDHCIO2iPEbEJ3hwbAo')) conversions.push(blob.slice(0,180));
  });

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    document.querySelectorAll('a[href^="tel:"]').forEach(link=>{
      link.addEventListener('click',event=>event.preventDefault(),true);
    });
  });
  await page.locator('a[href^="tel:"]').first().click();

  await expect.poll(()=>page.evaluate(()=>{
    const layer = (window as unknown as {dataLayer?:unknown[]}).dataLayer??[];
    const consent = layer.findIndex(entry=>Array.isArray(entry) ? false : (entry as {0?:string})?.[0]==='consent' || (entry as unknown[])[0]==='consent');
    const conversion = layer.findIndex(entry=>{
      const item = entry as {0?:string;1?:string;2?:{send_to?:string}};
      return item?.[0]==='event' && item?.[1]==='conversion' && String(item?.[2]?.send_to??'').includes('0CDHCIO2iPEbEJ3hwbAo');
    });
    return {consent,conversion,scripts:document.querySelectorAll('script[src*="gtag/js"]').length};
  })).toEqual(expect.objectContaining({consent:0,scripts:1}));

  await expect.poll(()=>page.evaluate(()=>{
    const layer = (window as unknown as {dataLayer?:unknown[]}).dataLayer??[];
    return layer.findIndex(entry=>{
      const item = entry as {0?:string;1?:string;2?:{send_to?:string}};
      return item?.[0]==='event' && item?.[1]==='conversion' && String(item?.[2]?.send_to??'').includes('0CDHCIO2iPEbEJ3hwbAo');
    });
  })).toBeGreaterThan(0);

  release();
  await expect.poll(()=>conversions.length,{timeout:10_000}).toBeGreaterThan(0);
});

test('accepted consent renders, navigates, and sends one page view per tag',async({page})=>{
  test.setTimeout(150_000);
  const errors:string[] = [];
  page.on('pageerror',error=>errors.push(`${error.name}: ${error.message}`));
  const hits:Hit[] = [];
  page.on('request',req=>note(req,hits));

  const healthy = async () => {
    await expect(page.getByRole('heading',{level:1})).toBeVisible();
    await expect(page.getByText('Application Error')).toHaveCount(0);
    expect(errors,errors.join('\n')).toEqual([]);
  };
  const expectOneEach = async (from:number) => {
    await expect.poll(()=>hits.slice(from).filter(hit=>hit.kind==='G').length,{timeout:12_000}).toBe(1);
    await expect.poll(()=>hits.slice(from).filter(hit=>hit.kind==='AW').length,{timeout:12_000}).toBe(1);
    await page.waitForTimeout(5_500);
    const mine = hits.slice(from);
    expect(mine.filter(hit=>hit.kind==='G'),mine.map(hit=>`${hit.kind} ${hit.path}`).join(', ')).toHaveLength(1);
    expect(mine.filter(hit=>hit.kind==='AW')).toHaveLength(1);
    const title = await page.title();
    const path = pathOf(page.url());
    for(const hit of mine){
      expect(hit.title).toBe(title);
      expect(pathOf(new URL(hit.path,page.url()).href)).toBe(path);
    }
  };

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Accept',exact:true}).click();
  await healthy();
  await expectOneEach(0);

  for(const href of ['/contact/','/about/']){
    const from = hits.length;
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(url=>pathOf(url.href)===pathOf(href));
    await healthy();
    await expectOneEach(from);
  }

  const from = hits.length;
  await page.reload({waitUntil:'domcontentloaded'});
  await healthy();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('gm-consent'))).toBe('granted');
  await expectOneEach(from);
  console.log(hits.map(hit=>`${hit.kind} ${hit.title} ${hit.path}`).join('\n'));
});
