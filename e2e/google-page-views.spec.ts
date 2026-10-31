import {expect,test,type Page,type Request} from '@playwright/test';
import {NO_TRACK_KEY} from '../src/utils/trackingGate';

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

/** One parameter bag per event: GA4 batches events into one request, one body line each. */
function eventsOf(req:Request){
  const shared = new URL(req.url()).searchParams;
  const lines = (req.postData()??'').split('\n').filter(line=>line && !line.startsWith('{'));
  if(!lines.length) return [shared];
  return lines.map(line=>{
    const bag = new URLSearchParams(shared);
    for(const [key,value] of new URLSearchParams(line)) bag.set(key,value);
    return bag;
  });
}

/** Every host the site's tags (Google, Meta, Clarity) load from or report to. */
const TAG_HOSTS = /^https:\/\/([\w-]+\.)*(googletagmanager\.com|google-analytics\.com|google\.[a-z]{2,3}(\.[a-z]{2})?|googlesyndication\.com|doubleclick\.net|googleadservices\.com|facebook\.net|facebook\.com|clarity\.ms)\//;

/**
 * Tags only run for real visitors on the live host (utils/trackingGate.ts), so these specs opt in.
 * gtag.js and its tag-manager libraries load for real (fetching them records nothing); every hit, and the Meta and Clarity
 * scripts, are answered here, so nothing the run does reaches Google, Meta or Clarity.
 */
async function optIn(page:Page){
  await page.addInitScript(()=>{(window as unknown as {__gmAnalyticsTest?:boolean}).__gmAnalyticsTest = true;});
  await page.route(TAG_HOSTS,route=>{
    const req = route.request();
    if(req.resourceType()==='script' && new URL(req.url()).hostname.endsWith('googletagmanager.com')) return route.continue();
    return req.resourceType()==='script' ? route.fulfill({status:200,contentType:'text/javascript',body:''}) : route.fulfill({status:204,body:''});
  });
}

function pathOf(url:string | URL){
  const href = typeof url === 'string' ? url : url.href;
  const path = href.startsWith('/') ? href.split('?')[0] : new URL(href).pathname;
  return path.length>1 && path.endsWith('/') ? path.slice(0,-1) : path;
}

test('each navigation sends one GA4 and one Ads page_view',async({page})=>{
  test.setTimeout(120_000);
  await optIn(page);
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
  await optIn(page);
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
  await optIn(page);
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

test('DeckCraft events fired before gtag.js loads still reach GA4',async({page})=>{
  test.setTimeout(120_000);
  await optIn(page);
  const sent:string[] = [];
  page.on('request',req=>{
    for(const bag of eventsOf(req)) if((bag.get('tid')??'').startsWith('G-') && bag.get('en')) sent.push(bag.get('en')!);
  });
  // deckcraft_step and deckcraft_view fire as the designer mounts, before the idle-deferred tag.
  await page.goto('/deck-designer/',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>sent.includes('page_view'),{timeout:20_000}).toBe(true);
  // GA4 holds events for a batch; hiding the page sends it.
  await page.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(()=>sent,{timeout:15_000}).toEqual(expect.arrayContaining(['deckcraft_step','deckcraft_view']));
  // Held until the tag's config, then sent after the page view.
  expect(sent.indexOf('page_view')).toBeLessThan(sent.indexOf('deckcraft_step'));
});

test('our own automated runs load no tags and send nothing',async({page})=>{
  const tags:string[] = [];
  // Answered here, so a regression is caught without sending this run to Google, Meta or Clarity.
  await page.route(TAG_HOSTS,route=>route.fulfill({status:204,body:''}));
  page.on('request',req=>{
    if(TAG_HOSTS.test(req.url())) tags.push(req.url());
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  // Consent plus a first input would load every tag, and a call click asks for gtag.js at once.
  await page.getByRole('button',{name:'Accept',exact:true}).click();
  await page.evaluate(()=>{
    document.querySelectorAll('a[href^="tel:"]').forEach(link=>{
      link.addEventListener('click',event=>event.preventDefault(),true);
    });
  });
  await page.locator('a[href^="tel:"]').first().click();
  // Past the 2.5 s gtag cap and the 3 s Meta and Clarity timer.
  await page.waitForTimeout(5_000);
  expect(tags).toEqual([]);
  const commands = await page.evaluate(()=>((window as unknown as {dataLayer?:ArrayLike<unknown>[]}).dataLayer??[]).map(entry=>String(entry[0])));
  expect(commands).not.toContain('config');
});

test('?notrack=1 marks this browser and ?notrack=0 clears it',async({page})=>{
  const stored = ()=>page.evaluate(key=>localStorage.getItem(key),NO_TRACK_KEY);
  await page.goto('/?notrack=1',{waitUntil:'domcontentloaded'});
  await expect.poll(stored).toBe('1');
  // A link copied from the address bar must not opt out whoever opens it.
  await expect.poll(()=>new URL(page.url()).searchParams.has('notrack')).toBe(false);
  await page.goto('/?notrack=0',{waitUntil:'domcontentloaded'});
  await expect.poll(stored).toBeNull();
});
