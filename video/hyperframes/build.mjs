// Writes one HyperFrames project per deliverable under projects/ (generated, not committed) from
// video/designs/specs.json, with every scene a sub-composition, and stages the fonts, mark and DeckCraft renders each
// project uses. Every number on screen comes from specs.json, which the DeckCraft engine computes
// (video/designs/build-designs.ts); the renders come from video/render-assets.sh.
//   node build.mjs   →   projects/reel-<slug> (1080x1920, 15s) · projects/showcase (1920x1080, 30s) · projects/bumper (6s)
import {copyFileSync,cpSync,existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';

const here=dirname(new URL(import.meta.url).pathname);
const specs=JSON.parse(readFileSync(join(here,'../designs/specs.json'),'utf8'));
const OUT=join(here,'../out');
const HF='0.8.134';
const URL_TEXT='goldenmaplelandscaping.ca/deck-designer';
const missing=new Set();
// GSAP is vendored into each project (render browsers may not reach a CDN, and offline renders stay deterministic).
const GSAP=join(here,'.vendor/gsap-3.14.2.min.js');
if(!existsSync(GSAP)){
  mkdirSync(dirname(GSAP),{recursive:true});
  const tgz=execFileSync('npm',['pack','gsap@3.14.2','--silent','--pack-destination',dirname(GSAP)],{encoding:'utf8'}).trim().split('\n').pop();
  execFileSync('tar',['xzf',join(dirname(GSAP),tgz),'-C',dirname(GSAP),'package/dist/gsap.min.js']);
  copyFileSync(join(dirname(GSAP),'package/dist/gsap.min.js'),GSAP);
}

const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const words=(text,cls='w')=>text.split(' ').map(w=>`<span class="${cls}"><span>${esc(w)}</span></span>`).join(' ');
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
const n2=i=>String(i+1).padStart(2,'0');

const fontFaces=[
  ...[500,600,700].flatMap(w=>['normal','italic'].map(st=>`@font-face{font-family:"Cormorant Garamond";font-style:${st};font-weight:${w};src:url("assets/fonts/cormorant-garamond-latin-${w}-${st}.woff2") format("woff2")}`)),
  ...[300,400,500,600,700].map(w=>`@font-face{font-family:"Inter";font-style:normal;font-weight:${w};src:url("assets/fonts/inter-latin-${w}-normal.woff2") format("woff2")}`),
].join('\n');

// Brand (design.md): sheet, ink, gold; Cormorant statements, Inter voice, JetBrains Mono data.
const baseCss=`${fontFaces}
:root{--sheet:#FAF8F4;--cream:#EAE4DA;--ink:#292824;--black:#23221F;--muted:#68645C;--gold:#C6A47D;--gold-deep:#78563E;--rule:#D8D2C8}
.sheet{position:absolute;inset:0;background:var(--sheet)}
.grid{position:absolute;inset:-120px;background-image:linear-gradient(var(--rule) 2px,transparent 2px),linear-gradient(90deg,var(--rule) 2px,transparent 2px),linear-gradient(rgba(216,210,200,.55) 1px,transparent 1px),linear-gradient(90deg,rgba(216,210,200,.55) 1px,transparent 1px);background-size:240px 240px,240px 240px,48px 48px,48px 48px;opacity:.7}
.mono{font-family:"JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.14em}
.serif{font-family:"Cormorant Garamond",serif;letter-spacing:-.02em}
.w{display:inline-block;overflow:hidden;vertical-align:bottom;padding:0 .02em .08em}
.w>span{display:inline-block}
.line{display:block}
.it>span{font-style:italic}
.plate{position:absolute;inset:0;overflow:hidden}
.plate img{position:absolute;display:block}
.scrim-top{position:absolute;left:0;right:0;top:0;background:linear-gradient(180deg,rgba(35,34,31,.82),rgba(35,34,31,.5) 55%,rgba(35,34,31,0))}
.scrim-bottom{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,rgba(35,34,31,.9),rgba(35,34,31,.66) 55%,rgba(35,34,31,0))}
.rule{position:absolute;height:3px;background:var(--gold);transform-origin:left center}
.mark{position:absolute;width:44px;height:44px;border-color:var(--gold);border-style:solid;border-width:0}
.mark.tl{border-top-width:3px;border-left-width:3px}.mark.tr{border-top-width:3px;border-right-width:3px}
.mark.bl{border-bottom-width:3px;border-left-width:3px}.mark.br{border-bottom-width:3px;border-right-width:3px}
.chip{display:inline-block;padding:12px 18px;border:2px solid var(--gold);color:var(--sheet);font-size:20px;background:rgba(35,34,31,.55)}
.cta-url{color:var(--gold-deep)}
.ink{position:absolute;inset:0;background:var(--black)}
.band-fade{position:absolute;left:0;right:0;top:0;height:260px;background:linear-gradient(180deg,#23221F,rgba(35,34,31,0))}
.pill{font-size:22px;font-weight:700;color:var(--sheet);padding:10px 16px;background:rgba(35,34,31,.72)}
`;

// Seek-safe helpers shared by every scene timeline (all fromTo, absolute values, no clocks or randomness).
const helpers=`
        const E = { out: "power3.out", soft: "power2.inOut", glide: "sine.inOut", snap: "expo.out" };
        const q = (sel) => root.querySelectorAll(sel);
        function countUp(sel, to, at, dur) {
          const el = root.querySelector(sel), p = { v: 0 };
          tl.fromTo(p, { v: 0 }, { v: to, duration: dur, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(p.v).toLocaleString("en-CA"); } }, at);
        }
        function rise(sel, at, o = {}) { tl.fromTo(q(sel), { yPercent: 110 }, { yPercent: 0, duration: o.d ?? 0.7, ease: o.ease ?? E.out, stagger: o.stagger ?? 0.07 }, at); }
        function fadeUp(sel, at, o = {}) { tl.fromTo(q(sel), { y: o.y ?? 28, opacity: 0 }, { y: 0, opacity: 1, duration: o.d ?? 0.6, ease: o.ease ?? E.out, stagger: o.stagger ?? 0 }, at); }
        function drawRule(sel, at, d = 0.8) { tl.fromTo(q(sel), { scaleX: 0 }, { scaleX: 1, duration: d, ease: E.snap }, at); }
        function marks(at) { tl.fromTo(q(".mark"), { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: E.out, stagger: 0.05 }, at); }
`;

const marks4=inset=>`<div class="mark tl" style="left:${inset}px;top:${inset}px"></div><div class="mark tr" style="right:${inset}px;top:${inset}px"></div><div class="mark bl" style="left:${inset}px;bottom:${inset}px"></div><div class="mark br" style="right:${inset}px;bottom:${inset}px"></div>`;

/** A scene sub-composition. `script` uses local time (0 = the scene's own start). */
const sceneFile=(id,w,h,dur,body,script,css='')=>`<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>${id}</title></head>
  <body>
    <template>
      <style>
${baseCss}
#root{position:absolute;inset:0;overflow:hidden;font-family:"Inter",sans-serif;color:var(--ink)}
${css}
      </style>
      <div id="root" data-composition-id="${id}" data-width="${w}" data-height="${h}" data-duration="${dur}">
${body}
      </div>
      <script>
        const root = document.querySelector('[data-composition-id="${id}"]');
        const tl = gsap.timeline({ paused: true });
${helpers}
${script}
        window.__timelines["${id}"] = tl;
      </script>
    </template>
  </body>
</html>
`;

function writeProject(name,{w,h,dur,title,scenes,renders}){
  const dir=join(here,'projects',name);
  rmSync(dir,{recursive:true,force:true});mkdirSync(join(dir,'compositions'),{recursive:true});
  cpSync(join(here,'assets/fonts'),join(dir,'assets/fonts'),{recursive:true});
  cpSync(join(here,'assets/brand'),join(dir,'assets/brand'),{recursive:true});
  for(const f of ['BRIEF.md','design.md'])copyFileSync(join(here,f),join(dir,f));
  mkdirSync(join(dir,'assets/vendor'),{recursive:true});copyFileSync(GSAP,join(dir,'assets/vendor/gsap.min.js'));
  for(const r of renders){
    const from=join(OUT,r.from),to=join(dir,'assets/renders',r.to);
    if(!existsSync(from)){missing.add(r.from);continue;}
    mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to);
  }
  for(const s of scenes)writeFileSync(join(dir,'compositions',s.id+'.html'),sceneFile(s.id,w,h,s.dur,(s.pre??'')+s.body,s.script,s.css));
  const hosts=scenes.map((s,i)=>`      <div id="${s.id}-host" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${s.dur}" data-track-index="${i}" data-width="${w}" data-height="${h}" style="position:absolute;inset:0;z-index:${i+1}"></div>`).join('\n');
  writeFileSync(join(dir,'index.html'),`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${w}, height=${h}" />
    <title>${esc(title)}</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #23221F; }
      #main { position: relative; width: 100%; height: 100%; overflow: hidden; background: #23221F; }
    </style>
  </head>
  <body>
    <div id="main" data-composition-id="${name}" data-start="0" data-duration="${dur}" data-width="${w}" data-height="${h}">
${hosts}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["${name}"] = tl;
    </script>
  </body>
</html>
`);
  writeFileSync(join(dir,'hyperframes.json'),JSON.stringify({$schema:'https://hyperframes.heygen.com/schema/hyperframes.json',paths:{blocks:'compositions',components:'compositions/components',assets:'assets'},media:{autoProxy:true}},null,2)+'\n');
  writeFileSync(join(dir,'meta.json'),JSON.stringify({id:name,name:title},null,2)+'\n');
  writeFileSync(join(dir,'package.json'),JSON.stringify({name,private:true,type:'module',scripts:{check:`npx --yes hyperframes@${HF} check`,render:`npx --yes hyperframes@${HF} render`,dev:`npx --yes hyperframes@${HF} preview`}},null,2)+'\n');
}

// ================================================================= vertical reel (1080x1920, 15s)
function reel(s,i){
  const W=1080,H=1920,PW=2560,PH=1920; // the 2560x1920 *-t plates are scaled into the photo band and glide sideways
  const R=(scene,shot)=>`assets/renders/${scene}/${shot}.jpg`;
  const BAND=600,BH=H-BAND,BW=Math.round(BH*PW/PH),btravel=BW-W;
  const bandMarks=`<div class="mark tl" style="left:40px;top:${BAND+24}px"></div><div class="mark tr" style="right:40px;top:${BAND+24}px"></div><div class="mark bl" style="left:40px;bottom:40px"></div><div class="mark br" style="right:40px;bottom:40px"></div>`;
  const scenes=[
    {id:'plan',start:0,dur:3.6,body:`
        <div class="sheet"></div><div class="grid" data-layout-allow-overflow id="plan-grid"></div>
        <div class="mono" id="plan-kicker" style="position:absolute;left:88px;top:150px;font-size:26px;color:var(--gold-deep);font-weight:700">DeckCraft · Plan ${n2(i)}</div>
        <div class="mono" id="plan-meta" style="position:absolute;right:88px;top:150px;font-size:22px;color:var(--muted);text-align:right;font-weight:700"><span class="line">Golden Maple</span><span class="line">Landscaping</span></div>
        <div class="rule" id="plan-dim-top" style="left:88px;top:262px;width:904px;height:2px;background:var(--gold-deep)"></div>
        <div class="rule" id="plan-dim-side" style="left:62px;top:300px;width:1020px;height:2px;background:var(--gold-deep);transform-origin:left top"></div>
        <div id="plan-frame" style="position:absolute;left:88px;top:300px;width:904px;height:1020px;border:3px solid var(--ink);overflow:hidden;background:#e9edf0">
          <div id="plan-img" style="position:absolute;inset:0"><img src="${R('day','plan')}" style="position:absolute;top:0;height:100%;width:auto;left:-${Math.round((1020*16/9-904)/2)}px" alt="" /></div>
          <div id="plan-cover" style="position:absolute;inset:0;background:var(--sheet);transform-origin:center top"></div>
        </div>
        <p class="mono" id="plan-spec" style="position:absolute;left:88px;top:1346px;font-size:24px;color:var(--muted);font-weight:700">${s.sqft} sq ft · ${plural(s.levels,'level')} · not to scale</p>
        <h1 class="serif" style="position:absolute;left:84px;top:1420px;font-size:132px;line-height:1;font-weight:600;color:var(--ink)">${words('Drawn first.')}</h1>`,
      script:`
        tl.fromTo("#plan-grid", { x: 0, y: 0 }, { x: -48, y: -48, duration: 3.6, ease: "none" }, 0);
        fadeUp("#plan-kicker, #plan-meta", 0.1, { y: 16 });
        tl.fromTo("#plan-frame", { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.7, ease: E.out }, 0.15);
        tl.fromTo("#plan-cover", { scaleY: 1 }, { scaleY: 0, duration: 1.1, ease: "power4.inOut" }, 0.5);
        tl.fromTo("#plan-img", { scale: 1.12 }, { scale: 1, duration: 3.3, ease: E.glide }, 0.3);
        drawRule("#plan-dim-top", 0.85, 0.9);
        tl.fromTo("#plan-dim-side", { scaleX: 0, rotation: 90 }, { scaleX: 1, rotation: 90, duration: 0.9, ease: E.snap }, 0.95);
        fadeUp("#plan-spec", 1.25, { y: 12 });
        rise("h1 .w > span", 1.5, { stagger: 0.09 });`},
    // 2–3 · Photo band (y 600–1920) under an ink type zone: the plate is scaled to show the whole deck and glides
    // sideways; the band stays put across both scenes while the type above it changes.
    {id:'render',start:3.2,dur:4.8,body:`
        <div class="plate" data-layout-allow-overflow id="hero-plate" style="top:${BAND}px"><div id="hero-pan" style="position:absolute;left:0;top:0;width:${BW}px;height:${BH}px"><img src="${R('day','hero-t')}" style="left:0;top:0;width:${BW}px;height:${BH}px" alt="" /></div>
          <div class="band-fade"></div></div>
        ${bandMarks}
        <div class="mono" id="hero-kicker" style="position:absolute;left:88px;top:150px;font-size:26px;color:var(--gold);font-weight:700">Then built · Design ${n2(i)}</div>
        <h1 class="serif" id="hero-name" style="position:absolute;left:82px;top:200px;font-size:168px;line-height:1.02;font-weight:600;color:var(--sheet)">${words(s.name)}</h1>
        <div class="rule" id="hero-rule" style="left:88px;top:405px;width:340px"></div>
        <p id="hero-tag" style="position:absolute;left:88px;top:436px;width:900px;font-size:44px;line-height:1.25;color:var(--sheet)">${esc(s.tagline)}</p>`,
      script:`
        tl.fromTo("#hero-bg", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E.soft }, 0);
        tl.fromTo("#hero-plate", { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.9, ease: E.soft }, 0.1);
        tl.fromTo("#hero-pan", { x: ${Math.round(-btravel*.1)} }, { x: ${Math.round(-btravel*.85)}, duration: 4.8, ease: E.glide }, 0);
        marks(0.4);
        fadeUp("#hero-kicker", 0.35, { y: 14 });
        rise("#hero-name .w > span", 0.5, { stagger: 0.1, d: 0.8 });
        drawRule("#hero-rule", 1.05);
        fadeUp("#hero-tag", 1.2, { y: 22 });`,
      css:`#root{background:var(--black)}`, pre:`<div class="ink" id="hero-bg"></div>`},
    {id:'facts',start:8,dur:4.4,body:`
        <div class="plate" data-layout-allow-overflow id="spec-plate" style="top:${BAND}px"><div id="spec-pan" style="position:absolute;left:0;top:0;width:${BW}px;height:${BH}px">
          <img src="${R('day','front-t')}" style="left:0;top:0;width:${BW}px;height:${BH}px" alt="" />
          <img id="spec-night" src="${R('night','front-t')}" style="left:0;top:0;width:${BW}px;height:${BH}px" alt="" />
        </div><div class="band-fade"></div></div>
        ${bandMarks}
        <div class="mono" id="spec-kicker" style="position:absolute;left:88px;top:140px;font-size:26px;color:var(--gold);font-weight:700">${esc(s.name)} · By the numbers</div>
        <div style="position:absolute;left:88px;top:222px;display:flex;align-items:flex-end;gap:22px">
          <span class="serif" id="spec-sqft" style="font-size:170px;line-height:.8;font-weight:600;color:var(--sheet);font-variant-numeric:lining-nums tabular-nums">0</span>
          <span class="mono" id="spec-unit" style="font-size:30px;color:var(--gold);font-weight:700;padding-bottom:8px">Sq ft</span>
        </div>
        <div class="rule" id="spec-rule" style="left:88px;top:372px;width:904px;height:2px"></div>
        <div id="spec-lines" style="position:absolute;left:88px;top:392px;width:904px">
          <p class="spec-line mono" style="font-size:24px;color:var(--gold);font-weight:700">${plural(s.levels,'level')} · ${esc(s.railing)} railing</p>
          <p class="spec-line" style="margin-top:10px;font-size:36px;color:var(--sheet);font-weight:500">${esc(s.decking)}</p>
        </div>
        <div id="spec-chips" style="position:absolute;left:88px;top:508px;width:940px;display:flex;flex-wrap:wrap;gap:12px">
          ${s.features.map(f=>`<span class="chip mono">${esc(f)}</span>`).join('')}
        </div>
        <div class="mono pill" data-layout-allow-overlap id="spec-day" style="position:absolute;left:88px;top:${BAND+60}px">Daylight</div>
        <div class="mono pill" data-layout-allow-overlap id="spec-dusk" style="position:absolute;left:88px;top:${BAND+60}px;color:var(--gold)">After dark · Lit in DeckCraft</div>`,
      script:`
        // A hard cut from the render: same photo band, new page of type above it.
        tl.fromTo("#spec-pan", { x: ${Math.round(-btravel*.8)} }, { x: ${Math.round(-btravel*.25)}, duration: 4.4, ease: E.glide }, 0);
        fadeUp("#spec-kicker", 0.15, { y: 12 });
        countUp("#spec-sqft", ${s.sqft}, 0.25, 1.3);
        fadeUp("#spec-unit", 0.55, { y: 10 });
        drawRule("#spec-rule", 0.6);
        fadeUp("#spec-lines .spec-line", 0.8, { stagger: 0.12 });
        tl.fromTo(q("#spec-chips .chip"), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.45, ease: E.out, stagger: 0.12 }, 1.15);
        tl.fromTo("#spec-day", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: E.out }, 0.4);
        // Day turns to night on the same camera pose: the night plate rides the same pan.
        tl.fromTo("#spec-night", { opacity: 0 }, { opacity: 1, duration: 1.2, ease: E.soft }, 2.6);
        tl.fromTo("#spec-day", { opacity: 1 }, { opacity: 0, duration: 0.35, ease: "power1.in", immediateRender: false }, 2.6);
        tl.fromTo("#spec-dusk", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: E.out }, 3.0);`,
      css:`#root{background:var(--black)}`},
    {id:'ask',start:12,dur:3,body:`
        <div class="sheet" id="end-sheet"></div><div class="grid" data-layout-allow-overflow id="end-grid"></div>
        <div id="end-logo" style="position:absolute;left:340px;top:500px;width:400px"><img src="assets/brand/logo-mark.png" style="width:400px;height:auto;display:block" alt="Golden Maple" /></div>
        <h2 class="serif" style="position:absolute;left:0;right:0;top:930px;text-align:center;font-size:132px;line-height:1.02;font-weight:600;color:var(--ink)"><span class="line">${words('Design yours')}</span><span class="line">${words('free.','w it')}</span></h2>
        <div class="rule" id="end-rule" style="left:290px;top:1250px;width:500px"></div>
        <p class="mono cta-url" id="end-url" style="position:absolute;left:0;right:0;top:1290px;text-align:center;font-size:29px;font-weight:700">${URL_TEXT}</p>
        <p id="end-sub" style="position:absolute;left:0;right:0;top:1370px;text-align:center;font-size:32px;color:var(--muted)">Golden Maple Landscaping · Barrie, Ontario</p>`,
      script:`
        tl.fromTo("#end-sheet", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E.soft }, 0);
        tl.fromTo("#end-grid", { opacity: 0, x: 0 }, { opacity: 0.7, x: -36, duration: 3, ease: "none" }, 0);
        tl.fromTo("#end-logo", { opacity: 0, scale: 0.86, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "back.out(1.4)" }, 0.2);
        rise("h2 .w > span", 0.5, { stagger: 0.08 });
        drawRule("#end-rule", 1.0);
        fadeUp("#end-url", 1.15, { y: 14 });
        fadeUp("#end-sub", 1.35, { y: 10 });`},
  ];
  const renders=[['day','plan'],['day','hero-t'],['day','front-t'],['night','front-t']].map(([sc,sh])=>({from:`stills/${s.slug}/${sc}/${sh}.jpg`,to:`${sc}/${sh}.jpg`}));
  writeProject(`reel-${s.slug}`,{w:W,h:H,dur:15,title:`${s.name} — DeckCraft reel`,scenes,renders});
}

// ================================================================= 16:9 showcase (1920x1080, 30s)
function showcase(){
  const W=1920,H=1080,SEG=6,T0=3;
  const R=(slug,scene,shot)=>`assets/renders/${slug}/${scene}/${shot}.jpg`;
  const scenes=[{id:'open',start:0,dur:3.4,body:`
        <div class="sheet"></div><div class="grid" data-layout-allow-overflow id="o-grid"></div>
        <div class="mono" id="o-kicker" style="position:absolute;left:120px;top:150px;font-size:24px;color:var(--gold-deep);font-weight:700">Golden Maple × DeckCraft</div>
        <h1 class="serif" style="position:absolute;left:112px;top:220px;width:840px;font-size:118px;line-height:1.02;font-weight:600;color:var(--ink)">${words('Four decks, drawn before a board was cut.')}</h1>
        <div class="rule" id="o-rule" style="left:120px;top:842px;width:300px"></div>
        <div id="o-tiles" style="position:absolute;left:1010px;top:150px;width:790px;height:780px;display:grid;grid-template-columns:1fr 1fr;gap:22px">
          ${specs.map(s=>`<div class="o-tile" style="position:relative;overflow:hidden;border:3px solid var(--ink);background:#e9edf0"><img src="${R(s.slug,'day','plan')}" style="position:absolute;top:0;height:100%;width:auto;left:-${Math.round((379*16/9-384)/2)}px" alt="" /><span class="mono" style="position:absolute;left:14px;bottom:12px;font-size:17px;color:var(--sheet);background:rgba(35,34,31,.82);padding:6px 10px;font-weight:700">${esc(s.name)}</span></div>`).join('')}
        </div>`,
    script:`
        tl.fromTo("#o-grid", { x: 0 }, { x: -48, duration: 3.4, ease: "none" }, 0);
        fadeUp("#o-kicker", 0.1, { y: 12 });
        rise("h1 .w > span", 0.25, { stagger: 0.06, d: 0.75 });
        drawRule("#o-rule", 1.1);
        tl.fromTo(q(".o-tile"), { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: E.out, stagger: 0.12 }, 0.5);`}];
  specs.forEach((s,i)=>{
    const last=i===specs.length-1,dur=SEG+(last?0.4:0.4);
    scenes.push({id:`deck-${s.slug}`,start:T0+i*SEG,dur,body:`
        <video id="d-orbit" data-start="0" data-duration="4.3" src="assets/renders/${s.slug}-orbit.mp4" muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>
        <div class="plate" data-layout-allow-overflow id="d-plate"><div id="d-push" style="position:absolute;inset:0">
          <img src="${R(s.slug,'day','front')}" style="inset:0;width:100%;height:100%" alt="" />
          <img id="d-night" src="${R(s.slug,'night','front')}" style="inset:0;width:100%;height:100%" alt="" />
        </div></div>
        <div class="scrim-bottom" style="height:520px"></div>
        ${marks4(48)}
        <div class="mono" id="d-idx" style="position:absolute;left:120px;top:690px;font-size:22px;color:var(--gold);font-weight:700">${n2(i)} / ${n2(specs.length-1)} · Designed in DeckCraft</div>
        <h2 class="serif" id="d-name" style="position:absolute;left:114px;top:730px;font-size:124px;line-height:1.02;font-weight:600;color:var(--sheet)">${words(s.name)}</h2>
        <p id="d-tag" style="position:absolute;left:120px;top:880px;width:860px;font-size:34px;color:var(--sheet)">${esc(s.tagline)}</p>
        <div id="d-specs" style="position:absolute;right:120px;top:700px;width:600px;text-align:right">
          <div><span class="serif" id="d-sqft" style="font-size:132px;line-height:.9;font-weight:600;color:var(--sheet);font-variant-numeric:lining-nums tabular-nums">0</span> <span class="mono" style="font-size:24px;color:var(--gold);font-weight:700">Sq ft</span></div>
          <p class="mono d-line" style="margin-top:16px;font-size:20px;color:var(--gold);font-weight:700">${plural(s.levels,'level')} · ${esc(s.railing)}</p>
          <p class="d-line" style="margin-top:8px;font-size:26px;color:var(--sheet)">${esc(s.decking)}</p>
        </div>
        <div class="mono" id="d-dusk" style="position:absolute;right:120px;top:110px;font-size:22px;color:var(--gold);font-weight:700;padding:8px 12px;background:rgba(35,34,31,.6)">After dark</div>`,
      script:`
        tl.fromTo("#d-orbit", { opacity: 0 }, { opacity: 1, duration: 0.45, ease: E.soft }, 0);
        // At 3.8s the orbit hands over to the front view, which turns from day to night.
        tl.fromTo("#d-plate", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E.soft }, 3.8);
        tl.fromTo("#d-push", { scale: 1 }, { scale: 1.06, duration: ${(dur-3.8).toFixed(1)}, ease: E.glide }, 3.8);
        tl.fromTo("#d-night", { opacity: 0 }, { opacity: 1, duration: 1.0, ease: E.soft }, 4.5);
        tl.fromTo("#d-dusk", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: E.out }, 4.9);
        marks(0.2);
        fadeUp("#d-idx", 0.35, { y: 12 });
        rise("#d-name .w > span", 0.45, { stagger: 0.09, d: 0.8 });
        fadeUp("#d-tag", 0.95, { y: 18 });
        countUp("#d-sqft", ${s.sqft}, 0.7, 1.2);
        fadeUp(".d-line", 1.1, { stagger: 0.12, y: 14 });`});
  });
  const tEnd=T0+specs.length*SEG;
  scenes.push({id:'ask',start:tEnd,dur:30-tEnd,body:`
        <div class="sheet" id="end-sheet"></div><div class="grid" data-layout-allow-overflow id="end-grid"></div>
        <div id="end-logo" style="position:absolute;left:250px;top:330px;width:440px"><img src="assets/brand/logo-mark.png" style="width:440px;height:auto;display:block" alt="Golden Maple" /></div>
        <h2 class="serif" style="position:absolute;left:840px;top:330px;font-size:150px;line-height:1;font-weight:600;color:var(--ink)"><span class="line">${words('Design yours')}</span><span class="line">${words('free.','w it')}</span></h2>
        <div class="rule" id="end-rule" style="left:846px;top:660px;width:420px"></div>
        <p class="mono cta-url" id="end-url" style="position:absolute;left:846px;top:700px;font-size:32px;font-weight:700">${URL_TEXT}</p>
        <p id="end-sub" style="position:absolute;left:846px;top:770px;font-size:30px;color:var(--muted)">Golden Maple Landscaping · Barrie, Ontario</p>`,
    script:`
        tl.fromTo("#end-sheet", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: E.soft }, 0);
        tl.fromTo("#end-grid", { opacity: 0, x: 0 }, { opacity: 0.7, x: -36, duration: 3, ease: "none" }, 0);
        tl.fromTo("#end-logo", { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.4)" }, 0.2);
        rise("h2 .w > span", 0.4, { stagger: 0.08 });
        drawRule("#end-rule", 0.9);
        fadeUp("#end-url", 1.05, { y: 12 });
        fadeUp("#end-sub", 1.25, { y: 10 });`});
  const renders=specs.flatMap(s=>[
    {from:`stills/${s.slug}/day/plan.jpg`,to:`${s.slug}/day/plan.jpg`},{from:`stills/${s.slug}/day/front.jpg`,to:`${s.slug}/day/front.jpg`},
    {from:`stills/${s.slug}/night/front.jpg`,to:`${s.slug}/night/front.jpg`},{from:`clips/${s.slug}-orbit.mp4`,to:`${s.slug}-orbit.mp4`}]);
  writeProject('showcase',{w:W,h:H,dur:30,title:'DeckCraft showcase',scenes,renders});
}

// ================================================================= bumper (1920x1080, 6s)
function bumper(){
  const W=1920,H=1080;
  const scenes=[{id:'strips',start:0,dur:3.4,body:`
        <div class="sheet"></div>
        ${specs.map((s,i)=>`<div class="strip" style="position:absolute;top:0;left:${i*480}px;width:480px;height:1080px;overflow:hidden;border-right:${i<3?'4px solid var(--sheet)':'0'}"><div class="strip-pan" style="position:absolute;top:-34px;left:${-480*i-60}px;width:2040px;height:1148px"><img src="assets/renders/${s.slug}/${i%2?'night':'day'}/hero.jpg" style="inset:0;width:2040px;height:1148px" alt="" /></div></div>`).join('')}
        <div class="scrim-bottom" style="height:420px"></div>
        <p class="mono" id="b-names" style="position:absolute;left:0;right:0;bottom:84px;display:flex;justify-content:space-around;font-size:22px;color:var(--sheet);font-weight:700">${specs.map(s=>`<span>${esc(s.name)}</span>`).join('')}</p>`,
    script:`
        tl.fromTo(q(".strip"), { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: "power4.out", stagger: 0.12 }, 0.05);
        tl.fromTo(q(".strip-pan"), { x: 50 }, { x: -50, duration: 3.4, ease: E.glide }, 0);
        fadeUp("#b-names span", 1.0, { stagger: 0.1, y: 14 });`},
  {id:'lockup',start:2.9,dur:3.1,body:`
        <div class="sheet" id="lock-sheet"></div><div class="grid" data-layout-allow-overflow id="lock-grid"></div>
        <div id="lock-logo" style="position:absolute;left:300px;top:330px;width:420px"><img src="assets/brand/logo-mark.png" style="width:420px;height:auto;display:block" alt="Golden Maple" /></div>
        <p class="mono" id="lock-kicker" style="position:absolute;left:840px;top:372px;font-size:26px;color:var(--gold-deep);font-weight:700">Golden Maple Landscaping</p>
        <h2 class="serif" style="position:absolute;left:834px;top:418px;font-size:140px;line-height:1;font-weight:600;color:var(--ink)"><span class="line">${words('Designed in')}</span><span class="line">${words('DeckCraft.','w it')}</span></h2>
        <div class="rule" id="lock-rule" style="left:840px;top:720px;width:380px"></div>
        <p class="mono cta-url" id="lock-url" style="position:absolute;left:840px;top:752px;font-size:28px;font-weight:700">${URL_TEXT}</p>`,
    script:`
        tl.fromTo("#lock-sheet", { clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)", duration: 0.7, ease: "power4.inOut" }, 0);
        tl.fromTo("#lock-grid", { opacity: 0, x: 0 }, { opacity: 0.7, x: -36, duration: 3.1, ease: "none" }, 0.3);
        tl.fromTo("#lock-logo", { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.4)" }, 0.5);
        fadeUp("#lock-kicker", 0.65, { y: 12 });
        rise("h2 .w > span", 0.75, { stagger: 0.08 });
        drawRule("#lock-rule", 1.25);
        fadeUp("#lock-url", 1.4, { y: 12 });`}];
  const renders=specs.map((s,i)=>({from:`stills/${s.slug}/${i%2?'night':'day'}/hero.jpg`,to:`${s.slug}/${i%2?'night':'day'}/hero.jpg`}));
  writeProject('bumper',{w:W,h:H,dur:6,title:'DeckCraft bumper',scenes,renders});
}

specs.forEach(reel);showcase();bumper();
console.log(`wrote projects/: ${specs.map(s=>'reel-'+s.slug).join(', ')}, showcase, bumper`);
if(missing.size)console.warn(`${missing.size} render(s) not there yet (run video/render-assets.sh):\n  `+[...missing].join('\n  '));
