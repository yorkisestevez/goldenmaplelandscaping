/**
 * Saves a file from the browser. On its own so the page can save a design without loading the section controls and
 * the swatch images that fields.tsx brings with it.
 */
export function downloadFile(body:BlobPart,type:string,name:string){
  const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
