import {showcasePostEnabled} from './showcaseMode';

type Post=typeof import('./showcasePost');
type Shadows=typeof import('./pcssShadows');

/**
 * The showcase grade (depth of field, SMAA, the filmic grade, jittered stills) and its contact-hardening shadows load
 * only once showcase quality and its grade are on, so the everyday 3D view never downloads them. Until they arrive the
 * view draws without them; listeners hear when they are in and again when SMAA's lookup images have decoded.
 */
let post:Post|null=null,shadows:Shadows|null=null,loading:Promise<void>|null=null;
const listeners=new Set<()=>void>();
const notify=()=>{for(const listen of listeners)listen();};

export function showcasePostActive(){return showcasePostEnabled();}
export function loadShowcasePost(){
  return loading??=Promise.all([import('./showcasePost'),import('./pcssShadows')]).then(([p,s])=>{post=p;shadows=s;p.onShowcasePostReady(notify);notify();});
}
/** The post passes, or null while they are not wanted or still loading (asking starts the load). */
export function showcasePostModule(){if(!post&&showcasePostEnabled())void loadShowcasePost();return post;}
/** The shadow patch once loaded. It also restores the stock shadows after showcase is switched off. */
export function showcaseShadowsModule(){if(!shadows&&showcasePostEnabled())void loadShowcasePost();return shadows;}
export function onShowcasePostLoaded(listen:()=>void){listeners.add(listen);return()=>{listeners.delete(listen);};}
