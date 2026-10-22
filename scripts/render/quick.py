import asyncio, sys, time
sys.path.insert(0,'/workspace/sage/recut')
from harness import guard, BASE
from playwright.async_api import async_playwright
C={'hero':([984,132,792],[150,10,1060],60,'golden'),'nighteye':([984,132,792],[150,10,1060],60,True),'overhead':([216,2000,744],[216,0,743],55,False),'eye':(None,None,0,False),'wall':([-24,66,1080],[-120,30,1250],55,False),'night':([216,2000,744],[216,0,743],55,True)}
n=sys.argv[1]
async def main():
    h=open('/workspace/sage/lit146/.scratch/resort-hash.txt').read().strip()
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx=await b.new_context(viewport={'width':1300,'height':1000}); await ctx.route('**/*',guard)
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
        await ex([{'type':'design.patch','patch':{'sceneLighting':'Evening' if night else 'Daylight','lightingPreviewOn':night,'scenePresentation':{'viewMode':'finished','cameras':cams,'activeCameraId':act}}}])
        await pg.wait_for_timeout(150000)
        await pg.add_style_tag(content='#deck-live-preview *{visibility:hidden!important}#deck-live-preview canvas{visibility:visible!important}')
        c=pg.locator('#deck-live-preview canvas').first; await c.scroll_into_view_if_needed(); await pg.wait_for_timeout(3000)
        await c.screenshot(path=f'/workspace/sage/paradise/resort/{n}.png',timeout=1800000); print(time.strftime('%T'),'saved',n,flush=True)
        await b.close()
asyncio.run(main())
