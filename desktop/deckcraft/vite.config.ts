// The standalone DeckCraft build for the desktop app (npm run build:deckcraft → dist/deckcraft). The site's own
// vite.config.ts is React Router only, so this one builds the designer page as a plain single-page app.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {cp} from 'node:fs/promises';
import path from 'node:path';
import {defineConfig,type Plugin} from 'vite';
import {clipperPrivateMinification} from '../../buildTools/clipperPrivateMinification';

const REPO=path.resolve(__dirname,'../..');
const OUT=path.join(REPO,'dist/deckcraft');
// What the designer fetches from the site's public folder at runtime: the supplier library and photos, and the logo
// the proposal PDF draws. The rest of public/ (site photos, sitemaps) stays out of the installer.
const SITE_PUBLIC=['deckcraft','logo-mark.png','logo-mark.webp','favicon.ico','favicon-16.png','favicon-32.png'];

function copySitePublic():Plugin{
  return {name:'deckcraft-site-public',apply:'build',async closeBundle(){
    for(const item of SITE_PUBLIC)await cp(path.join(REPO,'public',item),path.join(OUT,item),{recursive:true});
  }};
}

export default defineConfig({
  root:path.join(__dirname,'web'),
  base:'/',
  build:{outDir:OUT,emptyOutDir:true,minify:'terser',terserOptions:{safari10:false,compress:{passes:3}},modulePreload:false},
  worker:{format:'es',plugins:()=>[clipperPrivateMinification()],rollupOptions:{output:{manualChunks(id){
    if(id.includes('/node_modules/clipper-lib/'))return 'geometry-clipping';
  }}}},
  plugins:[clipperPrivateMinification(),tailwindcss(),react(),copySitePublic()],
  resolve:{alias:{'@':REPO}},
});
