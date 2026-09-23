// Serves the production build (build/client) the way netlify.toml does: a prerendered route is served as
// its own index.html, and anything else falls back to __spa-fallback.html. Form posts are intercepted by
// the tests themselves, so a POST here answers 404 to catch any submission that slips past them.
import {createReadStream,existsSync,statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname,join,normalize} from 'node:path';

const ROOT=join(import.meta.dirname,'..','build','client');
const PORT=Number(process.env.E2E_PORT||4031);
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain','.xml':'application/xml','.pdf':'application/pdf','.glb':'model/gltf-binary'};

if(!existsSync(join(ROOT,'__spa-fallback.html'))){console.error('No build found. Run `npm run build` first.');process.exit(1);}
createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(404).end();return;}
  const path=normalize(decodeURIComponent(new URL(req.url??'/','http://x').pathname)).replace(/^([/\\])+/,'');
  if(path.startsWith('..')){res.writeHead(400).end();return;}
  let file=join(ROOT,path);
  if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
  if(!existsSync(file))file=join(ROOT,'__spa-fallback.html');
  res.writeHead(200,{'Content-Type':TYPES[extname(file).toLowerCase()]??'application/octet-stream'});
  if(req.method==='HEAD'){res.end();return;}
  createReadStream(file).pipe(res);
}).listen(PORT,'127.0.0.1',()=>console.log(`e2e static server on http://127.0.0.1:${PORT}`));
