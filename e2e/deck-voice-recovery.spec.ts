import {test,expect} from '@playwright/test';

for(const phone of [false,true])test.describe(phone?'phone voice recovery':'desktop voice recovery',()=>{
 test.use({viewport:phone?{width:390,height:844}:{width:1500,height:1050},isMobile:phone,hasTouch:phone});
 test(`${phone?'@phone ':''}typing, silent stop and backgrounding retain editable text without applying design edits`,async({context,page})=>{
  await context.addInitScript(()=>{
   (window as any).__name=(target:any)=>target;localStorage.clear();
   class Recognition {
    onstart:any=null;onend:any=null;onresult:any=null;onerror:any=null;
    start(){(window as any).qaMic=this;queueMicrotask(()=>this.onstart?.());}
    stop(){if(!(window as any).qaSilentStop)queueMicrotask(()=>this.onend?.());}
    abort(){}
   }
   (window as any).SpeechRecognition=Recognition;
   (window as any).qaSay=(text:string)=>(window as any).qaMic.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});
  });
  await page.goto('/deck-designer/');await page.waitForFunction(()=>(window as any).deckcraft?.read().ready);
  const before=await page.evaluate(()=>(window as any).deckcraft.read());
  await page.getByRole('button',{name:'Describe a change',exact:true}).click();
  const text=page.getByRole('textbox',{name:'What would you like to change?',exact:true});
  await page.getByRole('button',{name:'Talk',exact:true}).click();
  await page.evaluate(()=>{(window as any).qaSay('make the deck twenty feet wide');(window as any).qaLate=(window as any).qaMic.onresult;});
  await text.fill('make the deck eighteen feet wide');
  await page.evaluate(()=>(window as any).qaLate({resultIndex:0,results:[Object.assign([{transcript:'stale result'}],{isFinal:true})]}));
  await expect(text).toHaveValue('make the deck eighteen feet wide');
  await expect(page.getByRole('button',{name:'Talk',exact:true})).toBeVisible();
  await text.fill('');await page.getByRole('button',{name:'Talk',exact:true}).click();
  await page.evaluate(()=>{(window as any).qaSay('raise this wall six inches');(window as any).qaSilentStop=true;});
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('The speech service did not finish.',{timeout:8000});
  await expect(text).toHaveValue('raise this wall six inches');
  await expect(page.getByRole('button',{name:'Preview edit',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Talk',exact:true}).click();
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});});
  await expect(page.getByRole('button',{name:'Talk',exact:true})).toBeVisible();
  await expect(page.getByText('Dictation paused while the app is in the background. Your completed transcript is kept.',{exact:true})).toBeVisible();
  const after=await page.evaluate(()=>(window as any).deckcraft.read());
  expect(after.revision).toBe(before.revision);expect(after.design).toEqual(before.design);
 });
});
