import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

/**
 * The public deck designer's source as one text: the page plus every file under
 * src/features/deckcraft/designer/. Checks that look for wiring (which control reports which event,
 * where the send card lives) read this, so moving code between the page and its components never
 * hides it from them.
 */
export function designerSource():string{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const files=[join(root,'src/pages/DeckDesigner.tsx')];
  const walk=(dir:string)=>{for(const name of readdirSync(dir).sort()){const path=join(dir,name);if(statSync(path).isDirectory())walk(path);else if(/\.(ts|tsx)$/.test(name))files.push(path);}};
  walk(join(root,'src/features/deckcraft/designer'));
  return files.map(f=>readFileSync(f,'utf8')).join('\n');
}
