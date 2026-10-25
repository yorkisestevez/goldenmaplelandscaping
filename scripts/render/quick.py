import asyncio, sys, time
sys.path.insert(0,'/workspace/sage/recut')
from harness import guard, BASE
from playwright.async_api import async_playwright
C={'hero':([840,204,1296],[168,36,540],52,'golden'),'nighteye':([840,204,1296],[168,36,540],52,True),'overhead':([216,2000,744],[216,0,743],55,False),'eye':(None,None,0,False),'wall':([-24,66,1080],[-120,30,1250],55,False),'night':([216,2000,744],[216,0,743],55,True)}
n=sys.argv[1];dbg='dbg' in sys.argv;lo=len(sys.argv)>2;W,H=(960,540) if lo else (3840,2160)
async def main():
    h=open('/workspace/sage/lit146/.scratch/resort-hash.txt').read().strip()
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx=await b.new_context(viewport={'width':W,'height':H}); await ctx.route('**/*',guard)
        pg=await ctx.new_page(); pg.set_default_timeout(1800000)
        night=C[n][3] is True
        await pg.goto(BASE+('?deck-lighting=evening&deck-quality=showcase' if night else '?deck-hour=golden&deck-quality=showcase' if C[n][3]=='golden' else '')+h,wait_until='load',timeout=600000)
        await pg.wait_for_function('window.deckcraft && window.deckcraft.read().ready',timeout=600000)
        async def ex(cmds):
            rev=await pg.evaluate('window.deckcraft.read().revision')
            r=await pg.evaluate("r=>window.deckcraft.execute(r)",{'id':n+str(rev),'expectedRevision':rev,'commands':cmds});print(r.get('ok'),flush=True)
        await ex([{'type':'view.set','view':'3d'}])
        d=await pg.evaluate('window.deckcraft.read().design.scenePresentation')
        cams=d['cameras']
        if C[n][0]: cams=[{'id':'q','name':'q','positionIn':C[n][0],'targetIn':C[n][1],'fov':C[n][2]}]; act='q'
        else: act='eye'
        await ex([{'type':'design.patch','patch':{'sceneLighting':'Evening' if night else 'Daylight','lightingPreviewOn':night,'scenePresentation':{**d,'viewMode':'finished','cameras':cams,'activeCameraId':act}}}])
        await pg.add_style_tag(content='#deck-live-preview div[class*="aspect-video"]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483000!important;aspect-ratio:auto!important;max-width:none!important}#deck-live-preview div[class*="aspect-video"] div{width:100%!important;height:100%!important}#deck-live-preview div[class*="aspect-video"] canvas{width:100vw!important;height:100vh!important}*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}')
        await pg.evaluate('window.dispatchEvent(new Event("resize"))')
        await pg.wait_for_timeout(60000 if lo else 150000)
        await pg.add_style_tag(content='#deck-live-preview *{visibility:hidden!important}#deck-live-preview canvas{visibility:visible!important}*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}')
        c=pg.locator('#deck-live-preview canvas').first; await c.scroll_into_view_if_needed(); await pg.wait_for_timeout(3000)
        if dbg:
            print('HITS',await pg.evaluate("""()=>{const s=window.__dbg.get?window.__dbg.get():window.__dbg;const T=s.scene,cam=s.camera,R=new (s.raycaster.constructor)();const out=[];for(const [u,v] of [[.2,.97],[.28,.97],[.33,.95],[.25,.99],[.3,.92]]){R.setFromCamera({x:u*2-1,y:v*2-1},cam);const h=R.intersectObjects(T.children,true).slice(0,3);out.push([u,v,h.map(x=>{let n=x.object,p=[];while(n&&p.length<6){p.push(n.name||n.type);n=n.parent}return x.distance.toFixed(0)+' '+p.join('<')})]);}return JSON.stringify(out)}"""),flush=True)
        r=await c.bounding_box();print('over',await pg.evaluate('''([x,y])=>{const e=document.elementsFromPoint(x,y);return e.slice(0,4).map(n=>n.tagName+'.'+String(n.className).slice(0,60)+' '+getComputedStyle(n).visibility)}''',[r['x']+r['width']*0.28,r['y']+15]),flush=True)
        await c.screenshot(path=f'/workspace/sage/paradise/resort/{"" if lo else "4k/"}{n}{"-lo" if lo else ""}.png',timeout=1800000); print(time.strftime('%T'),'saved',n,await pg.evaluate('(()=>{const c=document.querySelector("#deck-live-preview canvas");return [c.width,c.height]})()'),flush=True)
        await b.close()
asyncio.run(main())
