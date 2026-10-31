// Answers app://deckcraft requests from the standalone build folder. Kept free of Electron so it can be tested with node --test.
const path=require('node:path');
const fs=require('node:fs');
const {Readable}=require('node:stream');

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.hdr':'application/octet-stream','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.ktx2':'image/ktx2','.wasm':'application/wasm','.woff2':'font/woff2','.bin':'application/octet-stream','.txt':'text/plain'};
const HOST='deckcraft';
const CSP=["default-src 'self'","script-src 'self' 'wasm-unsafe-eval'","worker-src 'self' blob:","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self' data:","connect-src 'self' data: blob:","media-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'none'","frame-ancestors 'none'"].join('; ');
// Vite names everything under assets/ by content hash, so those files never change under the same URL.
const IMMUTABLE='public, max-age=31536000, immutable';
// Files at least this big (the supplier photos) are streamed rather than read whole.
const STREAM_FROM_BYTES=1024*1024;
// Hashed assets up to the stream size stay in memory once read: workers and lazy chunks ask for the same files again.
const MEMORY_CACHE_BYTES=48*1024*1024;
// The site's form and function endpoints do not exist in the app; they must fail rather than get the app page.
const SERVER_ONLY=/^\/(\.netlify|api)(\/|$)/;

const notFound=()=>new Response('Not found',{status:404});

function createAppHandler(root){
  const base=path.resolve(root);
  const cache=new Map();// insertion order = least recently used first
  let cachedBytes=0;
  const remember=(file,entry)=>{
    cache.set(file,entry);cachedBytes+=entry.body.byteLength;
    for(const [oldest,old] of cache){if(cachedBytes<=MEMORY_CACHE_BYTES)break;cache.delete(oldest);cachedBytes-=old.body.byteLength;}
  };
  const recall=file=>{const entry=cache.get(file);if(entry){cache.delete(file);cache.set(file,entry);}return entry;};

  async function locate(urlPath){
    let rel;
    try{rel=decodeURIComponent(urlPath).replace(/^\/+/,'');}catch{return null;}
    const file=path.resolve(base,rel);
    if(file!==base&&!file.startsWith(base+path.sep))return null;
    const stat=rel?await fs.promises.stat(file).catch(()=>null):null;
    if(stat?.isFile())return {file,stat};
    if(path.extname(rel))return null;// a missing asset is a 404; anything else is a route of the single-page app
    const index=path.join(base,'index.html');
    return {file:index,stat:await fs.promises.stat(index)};
  }

  return async function handle(request){
    const url=new URL(request.url);
    if(url.host!==HOST||SERVER_ONLY.test(url.pathname))return notFound();
    if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    const hashed=url.pathname.startsWith('/assets/');
    const hit=hashed?recall(url.pathname):null;
    const found=hit?null:await locate(url.pathname);
    if(!hit&&!found)return notFound();
    const file=hit?.file??found.file;
    const headers=new Headers({'Content-Type':MIME[path.extname(file).toLowerCase()]??'application/octet-stream','Cache-Control':hashed?IMMUTABLE:'no-cache','Last-Modified':(hit?.mtime??found.stat.mtime).toUTCString()});
    if(file.endsWith('.html'))headers.set('Content-Security-Policy',CSP);
    if(hit)return new Response(request.method==='HEAD'?null:hit.body,{status:200,headers});
    headers.set('Content-Length',String(found.stat.size));
    if(request.method==='HEAD')return new Response(null,{status:200,headers});
    if(found.stat.size>=STREAM_FROM_BYTES)return new Response(Readable.toWeb(fs.createReadStream(file)),{status:200,headers});
    const body=await fs.promises.readFile(file);
    if(hashed)remember(url.pathname,{file,body,mtime:found.stat.mtime});
    return new Response(body,{status:200,headers});
  };
}

module.exports={createAppHandler,CSP,STREAM_FROM_BYTES};
