import {lazy,type ComponentType} from 'react';

/**
 * lazy() for a piece of the prerendered designer. React hydrates a prerendered Suspense boundary only if it can draw its
 * contents in the same pass. When an update reaches the boundary first (the page's effects run right after hydration)
 * while its chunk is still loading, React deletes the prerendered HTML, shows the fallback and draws the piece again
 * once the chunk lands: the tools ribbon and the plan vanish and pop back. A plain lazy() never draws in the same pass,
 * even for a module that has loaded (an import() promise settles on a later tick), so this one hands React the module
 * directly once preload() has fetched it. Until then it is lazy(load).
 */
export function preloadable<M extends {default:ComponentType<any>}>(load:()=>Promise<M>){
  let loaded:M|undefined,loading:Promise<M>|undefined;
  // A failed preload() can be called again (a deploy may have replaced the chunk); a lazy that has rendered keeps its
  // failure, as React.lazy does, for the route's error boundary.
  const preload=()=>loading??=load().then(mod=>loaded=mod,error=>{loading=undefined;throw error;});
  // Resolves as React subscribes, so React reads the module in the same call. A fresh one each time: React's development
  // build writes its status onto it.
  const now=(mod:M)=>({then:(resolve:(mod:M)=>void)=>resolve(mod)}) as unknown as Promise<M>;
  return Object.assign(lazy(()=>loaded?now(loaded):preload()),{preload});
}

/**
 * Settles once every load has settled, or after `ms`, and then once React's streamed HTML has moved the prerendered pieces
 * into place: it reveals them in batches ($RB, the first on a frame, later ones on a timer), and a piece still waiting
 * for its move cannot hydrate (at most 400 ms more). Never rejects: a missing or slow chunk must not keep the page from
 * starting; it then loads as it did before. The outcome is left on window.__deckcraftPieces ('settled' or 'timeout')
 * for the first-paint test.
 */
export function whenSettled(loads:readonly Promise<unknown>[],ms:number):Promise<void>{
  const w=window as typeof window&{__deckcraftPieces?:string;$RB?:unknown[]};
  return Promise.race([Promise.allSettled(loads).then(()=>'settled'),new Promise<string>(done=>setTimeout(done,ms,'timeout'))])
    .then(outcome=>new Promise<void>(done=>{
      w.__deckcraftPieces=outcome;
      const until=performance.now()+400,frame=(next:()=>void)=>typeof requestAnimationFrame==='function'&&document.visibilityState==='visible'?requestAnimationFrame(next):setTimeout(next,16);
      const check=()=>document.readyState!=='loading'&&!w.$RB?.length||performance.now()>until?done():frame(check);
      frame(check);
    }));
}
