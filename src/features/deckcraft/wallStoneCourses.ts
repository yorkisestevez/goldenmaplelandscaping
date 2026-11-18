/**
 * Where a guillotined wall's random-length stones fall along each course. Loaded only with the advanced yard runtime,
 * which lays these walls (needsAdvancedYard), so none of it ships with the first estimate.
 */
/** Guillotined stone comes in random lengths; Ontario yards list 24 to 48 in. */
export const STONE_LENGTH_IN={min:24,max:48,step:2} as const;
/** A tight dry joint between neighbouring stones, wide enough to read in 3D. */
export const STONE_JOINT_IN=.375;
/** Each joint stays this far from every joint in the course below, so no joint runs up the wall. */
export const STONE_JOINT_CLEARANCE_IN=6;

const LENGTHS=Array.from({length:(STONE_LENGTH_IN.max-STONE_LENGTH_IN.min)/STONE_LENGTH_IN.step+1},(_,i)=>STONE_LENGTH_IN.min+i*STONE_LENGTH_IN.step);

/** A seeded generator (FNV-1a seed, LCG steps), as hardscapeAppearance uses for stone tones. */
function seeded(text:string){
 let seed=2166136261;for(const c of text)seed=Math.imul(seed^c.charCodeAt(0),16777619);
 return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}

/**
 * The joints of one run of a wall (a straight run of collinear segments, or an arc's control edge), per course, in run
 * stations shared by every course. A course is one or more stretches (a foundation step can stop and restart it), and
 * each stretch's list holds both its ends and every joint between. The same seed always lays the same stones. Stones
 * take listed lengths in a random order per position, and a short search backtracks until every joint clears the course
 * below and the stretch ends in a whole stone (24 in or more, unless the stretch itself is shorter). When no such
 * stretch exists (a run of 48-54 in leaves under 6 in for its joint), each stone takes the length whose joint comes
 * closest to clearing. A short first course (under 72 in) puts its joint at the near end, so the courses above can
 * alternate. Courses are laid bottom up; a course with none below has nothing to clear.
 */
export function stoneCourseJoints(seed:string){
 const rows=new Map<number,number[][]>();
 return (row:number,stretches:[number,number][]):number[][]=>{
  const saved=rows.get(row);if(saved)return saved;
  const next=seeded(`${seed}:${row}`),below=rows.get(row-1)?.flat()??[],gap=(at:number)=>Math.min(Infinity,...below.map(b=>Math.abs(at-b)));
  const lists=stretches.map(([fromIn,toIn]):number[]=>{
   if(!Number.isFinite(fromIn)||!Number.isFinite(toIn)||toIn-fromIn<=1e-6)return [fromIn,toIn];
   const nearEnd=!below.length&&toIn-fromIn<3*STONE_LENGTH_IN.min;
   // Lengths that leave room for a whole last stone, in this position's random order.
   const choices=(at:number)=>{const fits=LENGTHS.filter(length=>toIn-at-length>=STONE_LENGTH_IN.min);if(nearEnd)return fits;const first=Math.floor(next()*fits.length);return fits.map((_,i)=>fits[(first+i)%fits.length]);};
   const dead=new Set<number>(),key=(at:number)=>Math.round((at-fromIn)/STONE_LENGTH_IN.step);
   const clear=(at:number):number[]|null=>{
    if(toIn-at<=STONE_LENGTH_IN.max)return [toIn];
    if(dead.has(key(at)))return null;
    for(const length of choices(at))if(gap(at+length)>=STONE_JOINT_CLEARANCE_IN){const rest=clear(at+length);if(rest)return [at+length,...rest];}
    dead.add(key(at));return null;
   };
   const closest=(at:number):number[]=>{
    if(toIn-at<=STONE_LENGTH_IN.max)return [toIn];
    const best=choices(at).reduce((a,b)=>gap(at+b)>gap(at+a)?b:a);return [at+best,...closest(at+best)];
   };
   return [fromIn,...(clear(fromIn)??closest(fromIn))];
  });
  rows.set(row,lists);return lists;
 };
}
