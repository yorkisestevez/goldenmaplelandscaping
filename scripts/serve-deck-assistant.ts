/** Loopback-only production preview with the local Ollama editing assistant. */
import {createReadStream,existsSync,statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname,join,resolve,sep} from 'node:path';
import {createGzip} from 'node:zlib';
import {createDeckAssistantService,DECK_ASSISTANT_PATH,ASSISTANT_BACKEND_LIMITS} from '../server/deckAssistantBackend';

const root=resolve(import.meta.dirname,'../build/client');
const port=Number(process.argv.find(v=>v.startsWith('--port='))?.slice(7)??4319);
const model=process.argv.find(v=>v.startsWith('--model='))?.slice(8)??'qwen3:14b';
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use a local port from 1024 through 65535.');
if(!existsSync(join(root,'__spa-fallback.html')))throw Error('Build the client before starting the assistant preview.');
const assistant=createDeckAssistantService({ollamaUrl:'http://127.0.0.1:11434',model});
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain','.xml':'application/xml','.pdf':'application/pdf','.glb':'model/gltf-binary'};
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(self), geolocation=()'};
createServer(async(req,res)=>{
  const abort=new AbortController();
  req.once('aborted',()=>abort.abort());
  res.once('close',()=>{if(!res.writableFinished)abort.abort();});
  try{
    const host=req.headers.host;
    if(host===`localhost:${port}`&&(req.method==='GET'||req.method==='HEAD')){res.writeHead(307,{...headers,Location:`http://127.0.0.1:${port}${req.url?.startsWith('/')&&!req.url.startsWith('//')?req.url:'/'}`}).end();return;}
    if(host!==`127.0.0.1:${port}`){res.writeHead(403,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({ok:false,error:{code:'origin_rejected',message:`Open this local preview at http://127.0.0.1:${port}/deck-designer/.`}}));return;}
    const url=new URL(req.url??'/',`http://127.0.0.1:${port}`);
    if(url.origin!==`http://127.0.0.1:${port}`){res.writeHead(400,headers).end();return;}
    if(url.pathname===DECK_ASSISTANT_PATH){
      const chunks:Buffer[]=[];let bytes=0;
      if(req.method==='POST'){
        const reject=(status:number,code:string,message:string)=>res.writeHead(status,{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:false,error:{code,message}}));
        if(req.headers.origin&&req.headers.origin!==url.origin||req.headers['sec-fetch-site']==='cross-site'){reject(403,'origin_rejected','Use the assistant from this local app.');return;}
        if(!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(String(req.headers['content-type']??''))){reject(415,'content_type','Send application/json.');return;}
        const length=Number(req.headers['content-length']);if(Number.isFinite(length)&&length>ASSISTANT_BACKEND_LIMITS.bodyBytes){reject(413,'payload_too_large','The design request is too large.');return;}
        const deadline=setTimeout(()=>{if(!res.writableEnded){reject(408,'body_timeout','The design request took too long to arrive.');res.once('finish',()=>req.destroy());}},10000);
        try{for await(const chunk of req){if(res.writableEnded||abort.signal.aborted)return;bytes+=chunk.length;if(bytes>ASSISTANT_BACKEND_LIMITS.bodyBytes){reject(413,'payload_too_large','The design request is too large.');return;}chunks.push(Buffer.from(chunk));}}finally{clearTimeout(deadline);}
        if(res.writableEnded||abort.signal.aborted)return;
      }
      const requestHeaders=new Headers();
      for(const [key,value]of Object.entries(req.headers))if(value!==undefined)requestHeaders.set(key,Array.isArray(value)?value.join(','):value);
      const response=await assistant.handle(new Request(url,{method:req.method,headers:requestHeaders,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{}),signal:abort.signal}));
      if(abort.signal.aborted)return;
      res.writeHead(response.status,{...headers,...Object.fromEntries(response.headers)}).end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(404,headers).end();return;}
    const pathname=decodeURIComponent(url.pathname);
    if(pathname.includes('\0')||pathname.includes('\\')){res.writeHead(400,headers).end();return;}
    let file=resolve(root,pathname.replace(/^\/+/,''));
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(400,headers).end();return;}
    if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
    if(!existsSync(file)){
      if(pathname.startsWith('/assets/')){res.writeHead(404,headers).end();return;}
      file=join(root,'__spa-fallback.html');
    }
    const type=types[extname(file).toLowerCase()]??'application/octet-stream';
    const gzip=/gzip/.test(String(req.headers['accept-encoding']??''))&&/^(text\/|application\/(json|xml))/.test(type);
    res.writeHead(200,{...headers,'Content-Type':type,...(gzip?{'Content-Encoding':'gzip',Vary:'Accept-Encoding'}:{})});
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(file);stream.once('error',()=>res.destroy());
    (gzip?stream.pipe(createGzip()):stream).pipe(res);
  }catch{if(res.writableEnded)return;if(!res.headersSent)res.writeHead(500,{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:false,error:{code:'preview_error',message:'The local preview could not complete this request.'}}));else res.destroy();}
}).listen(port,'127.0.0.1',()=>console.log(`DeckCraft assistant preview: http://127.0.0.1:${port}/deck-designer/ (local model: ${model})`));
