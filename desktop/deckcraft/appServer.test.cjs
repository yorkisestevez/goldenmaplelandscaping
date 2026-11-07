// desktop/deckcraft/appServer.test.cjs
//
// The desktop shell serves dist/deckcraft to the app:// scheme. These pin what the handler answers for each kind of
// request, against a throwaway build folder, so the shell can change without launching Electron.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createAppHandler,STREAM_FROM_BYTES}=require('./appServer.cjs');

const made=[];
test.after(()=>{for(const root of made){fs.rmSync(root,{recursive:true,force:true});fs.rmSync(root+'-secret.txt',{force:true});}});

function makeBuild(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'deckcraft-shell-'));
  made.push(root);
  fs.mkdirSync(path.join(root,'assets'));
  fs.mkdirSync(path.join(root,'deckcraft'));
  fs.writeFileSync(path.join(root,'index.html'),'<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(root,'assets','index-abc123.js'),'console.log(1)');
  fs.writeFileSync(path.join(root,'deckcraft','catalogue.json'),'{"a":1}');
  fs.writeFileSync(path.join(root,'deckcraft','big.webp'),Buffer.alloc(STREAM_FROM_BYTES+1,7));
  fs.writeFileSync(root+'-secret.txt','outside');
  return root;
}
const get=(handler,url,init)=>handler(new Request(`app://deckcraft${url}`,init));

test('serves the app page with the content security policy and no caching',async()=>{
  const handler=createAppHandler(makeBuild());
  const res=await get(handler,'/');
  assert.equal(res.status,200);
  assert.equal(res.headers.get('content-type'),'text/html; charset=utf-8');
  assert.match(res.headers.get('content-security-policy'),/default-src 'self'/);
  assert.equal(res.headers.get('cache-control'),'no-cache');
  assert.match(await res.text(),/id="root"/);
});

test('hashed assets are immutable and carry Last-Modified, so V8 can keep their code cache',async()=>{
  const root=makeBuild();
  const handler=createAppHandler(root);
  const res=await get(handler,'/assets/index-abc123.js');
  assert.equal(res.status,200);
  assert.equal(res.headers.get('content-type'),'text/javascript');
  assert.equal(res.headers.get('cache-control'),'public, max-age=31536000, immutable');
  assert.equal(res.headers.get('last-modified'),fs.statSync(path.join(root,'assets','index-abc123.js')).mtime.toUTCString());
  assert.equal(await res.text(),'console.log(1)');
});

test('a hashed asset is read from disk once, then served from memory',async()=>{
  const root=makeBuild();
  const handler=createAppHandler(root);
  await (await get(handler,'/assets/index-abc123.js')).text();
  fs.rmSync(path.join(root,'assets','index-abc123.js'));
  const again=await get(handler,'/assets/index-abc123.js');
  assert.equal(again.status,200);
  assert.equal(await again.text(),'console.log(1)');
});

test('large files are streamed with their length',async()=>{
  const handler=createAppHandler(makeBuild());
  const res=await get(handler,'/deckcraft/big.webp');
  assert.equal(res.status,200);
  assert.equal(res.headers.get('content-length'),String(STREAM_FROM_BYTES+1));
  assert.ok(res.body instanceof ReadableStream);
  assert.equal((await res.arrayBuffer()).byteLength,STREAM_FROM_BYTES+1);
});

test('routes fall back to the app page; missing files with an extension are 404',async()=>{
  const handler=createAppHandler(makeBuild());
  assert.equal((await get(handler,'/deck-designer')).status,200);
  assert.equal((await get(handler,'/deckcraft/missing.json')).status,404);
});

test('form and function endpoints are 404, not the app page',async()=>{
  const handler=createAppHandler(makeBuild());
  assert.equal((await get(handler,'/.netlify/functions/deck-assistant')).status,404);
  assert.equal((await get(handler,'/api/leads')).status,404);
  assert.equal((await get(handler,'/%2Enetlify/functions/x')).status,404);
  assert.equal((await get(handler,'/API/leads')).status,404);
});

test('an extension-less path under assets/ is the app page, not an immutable asset',async()=>{
  const handler=createAppHandler(makeBuild());
  const res=await get(handler,'/assets/route');
  assert.equal(res.status,200);
  assert.equal(res.headers.get('cache-control'),'no-cache');
});

test('a HEAD request for a remembered asset still gives its length',async()=>{
  const handler=createAppHandler(makeBuild());
  await (await get(handler,'/assets/index-abc123.js')).text();
  const head=await get(handler,'/assets/index-abc123.js',{method:'HEAD'});
  assert.equal(head.headers.get('content-length'),String('console.log(1)'.length));
});

test('a form post is refused, so the page cannot report a lead as sent',async()=>{
  const handler=createAppHandler(makeBuild());
  const res=await get(handler,'/',{method:'POST',body:'form-name=deck-design'});
  assert.equal(res.status,405);
});

test('paths cannot leave the build folder or reach another host',async()=>{
  const root=makeBuild();
  const handler=createAppHandler(root);
  assert.equal((await get(handler,`/..%2F${path.basename(root)}-secret.txt`)).status,404);
  assert.equal((await handler(new Request('app://other/index.html'))).status,404);
});
