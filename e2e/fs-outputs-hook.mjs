let root='';
export function initialize(data){root=data?.root??'';}

export async function resolve(specifier,context,nextResolve){
  if(!root)return nextResolve(specifier,context);
  if(specifier==='node:fs'||specifier==='fs')return {url:new URL('./fs-shim.mjs',import.meta.url).href,shortCircuit:true};
  if(specifier==='node:fs/promises'||specifier==='fs/promises')return {url:new URL('./fs-promises-shim.mjs',import.meta.url).href,shortCircuit:true};
  return nextResolve(specifier,context);
}
