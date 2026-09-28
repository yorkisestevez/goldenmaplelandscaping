/**
 * Screen approximations of the manufacturer railing colours (the screenHex of railing-finish-provenance.json), for the
 * illustrative 3D railing and the colour chip only: never a colour match. TimberTech and Deckorators give some colours
 * the same name, so each brand has its own table. Kept apart from deckPartFinishes.ts so the page's first load carries
 * only the colour names; the 3D view and the finishes panel load these with themselves.
 */
const TIMBERTECH:Record<string,string>={White:'#f4f0ed','Matte White':'#fafbf6','Matte Black':'#202020','Matte Espresso':'#544c49',Black:'#363535','Dark Bronze':'#5b5141',Khaki:'#b7a67f'};
const DECKORATORS:Record<string,string>={'Textured Black':'#1e1e1d','Textured White':'#e4e4e1',Bronze:'#433836',White:'#f2f2f2','Matte Black':'#534a4d',Black:'#383838',Gray:'#7b7167',Brown:'#4b3d34'};
/** A railing system's colour on screen (TimberTech `tt_…` or Deckorators `dk_…` systems), or undefined for an unknown name. */
export function railingScreenHex(systemId:string,name:string):string|undefined{
  const table=systemId.startsWith('dk_')?DECKORATORS:TIMBERTECH;
  return Object.hasOwn(table,name)?table[name]:undefined;
}
