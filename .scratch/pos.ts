const m:any=await import('../src/features/deckcraft/showcaseSample');
const fn=Object.values(m).find((f:any)=>typeof f==='function'&&/showcase/i.test(f.name)) as any;
const d=await fn();const D=d.data??d;
for(const o of D.landscapeObjects)if(/kitchen|stool/.test(o.id))console.log(o.id,o.xIn|0,o.zIn|0,o.rotationDeg);
for(const s of (D.stairs??[]))console.log('stair',JSON.stringify(s).slice(0,200));
console.log(Object.keys(m).join(','));
