"""Read public PageSpeed Insights field-data availability through browser_operator."""
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, 'C:/Users/yorki/OneDrive/Desktop/Antigravity projects')
from browser_operator.engine import StealthBrowserEngine

async def main():
    output = Path(__file__).resolve().parents[1] / 'docs' / 'performance-baseline'
    output.mkdir(parents=True, exist_ok=True)
    engine = StealthBrowserEngine(profile_name='default', headless=True)
    results=[]
    try:
        await engine.start()
        for host in ['goldenmaplelandscaping.ca', 'seo.goldenmaplelandscaping.ca']:
            url=f'https://pagespeed.web.dev/analysis?url=https%3A%2F%2F{host}%2F&form_factor=mobile'
            await engine.navigate(url)
            try:
                await engine.page.wait_for_function("() => /No Data|Core Web Vitals Assessment|Unable to resolve|Something went wrong|not have sufficient real-world/.test(document.body.innerText)", timeout=90000)
            except Exception as exc:
                error=type(exc).__name__
            else:
                error=None
            text=await engine.page.locator('body').inner_text()
            (output/f'{host}-pagespeed.txt').write_text(text,encoding='utf-8')
            await engine.page.screenshot(path=str(output/f'{host}-pagespeed.png'),full_page=True)
            results.append({'host':host,'observedAt':datetime.now(timezone.utc).isoformat(),'source':engine.page.url,'waitError':error,'text':text})
        (output/'field-data-evidence.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
        print(json.dumps(results,indent=2))
    finally:
        await engine.close()

if __name__=='__main__':
    asyncio.run(main())
