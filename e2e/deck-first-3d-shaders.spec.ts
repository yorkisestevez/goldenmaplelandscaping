import {expect,test} from '@playwright/test';

/**
 * The first 3D open on a new device (no GPU shader cache) compiles each scene shader once, for the state it draws in.
 * It used to compile them for states it left at once: before the sky's light, with the screen's tone mapping (a plain
 * first frame, then the photographic chain draws into its own image), and with the editor's shadows before the realistic
 * look's contact shadows loaded. Each of those rounds froze the page while it compiled, about 6-8 s in all on a desktop
 * GPU. The test records every shader program the page links.
 */
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

interface Linked {toneMapped:boolean;shadows:string|null}

test('opening 3D compiles each scene shader once, for the state it draws in',async({page})=>{
  test.setTimeout(180_000);
  await page.addInitScript(()=>{
    try{localStorage.setItem('deckcraft.realistic-look','on');}catch{/* the test then runs the editor look */}
    const gl=WebGL2RenderingContext.prototype,source=new WeakMap<WebGLShader,string>(),attached=new WeakMap<WebGLProgram,WebGLShader[]>();
    const linked:Linked[]=[];(window as unknown as {__linked:Linked[]}).__linked=linked;
    const shaderSource=gl.shaderSource,attachShader=gl.attachShader,linkProgram=gl.linkProgram;
    gl.shaderSource=function(shader,text){source.set(shader,text);return shaderSource.call(this,shader,text);};
    gl.attachShader=function(program,shader){attached.set(program,[...(attached.get(program)??[]),shader]);return attachShader.call(this,program,shader);};
    gl.linkProgram=function(program){
      const text=(attached.get(program)??[]).map(shader=>source.get(shader)??'').join('\n');
      linked.push({toneMapped:/#define TONE_MAPPING\b/.test(text),shadows:text.match(/#define SHADOWMAP_TYPE_(\w+)/)?.[1]??null});
      return linkProgram.call(this,program);
    };
  });
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/deck-designer/');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:{read():{ready:boolean}}}).deckcraft?.read().ready??false)).toBe(true);
  await page.getByRole('tab',{name:'3D',exact:true}).click();
  const canvas=page.locator('.dd-canvas canvas');
  await expect(canvas).toHaveAttribute('data-photographic-pipeline','active',{timeout:60_000});
  await expect(canvas).toHaveAttribute('data-realistic-look','1');
  // Settled: no program linked for 3 s.
  let count=-1;
  await expect.poll(async()=>{const now=await page.evaluate(()=>(window as unknown as {__linked:Linked[]}).__linked.length);const still=now===count;count=now;return still;},{intervals:[3000],timeout:90_000}).toBe(true);
  const linked=await page.evaluate(()=>(window as unknown as {__linked:Linked[]}).__linked);
  const toneMapped=linked.filter(p=>p.toneMapped).length,editorShadows=linked.filter(p=>p.shadows&&p.shadows!=='BASIC').length;
  console.log(`first 3D open linked ${linked.length} programs: ${toneMapped} tone-mapped, ${editorShadows} with the editor's shadows`);
  // It saw the scene's programs (a three.js upgrade renaming the defines would otherwise pass unseen), and no second round.
  expect(linked.length).toBeGreaterThan(20);
  expect(linked.length,'programs linked opening 3D (95 when every state compiled its own round)').toBeLessThan(70);
  expect(toneMapped,'scene shaders compiled with the screen tone mapping the photographic chain never draws with').toBe(0);
  expect(editorShadows,"scene shaders compiled with the editor's shadows while the realistic look's contact shadows load").toBe(0);
});
