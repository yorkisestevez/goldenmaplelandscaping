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
 * Joint stations for one run of a wall, in inches from the run's start (which is station 0), per course. The same
 * seed always lays the same stones, however far each course is asked to reach. A stone's length starts at a random
 * listed length and takes the first one, in turn, whose far joint clears every joint below; when none can, the one
 * that comes closest.
 */
export function stoneCourseJoints(seed:string){
 const rows=new Map<number,{joints:number[];next:()=>number}>();
 const joints=(row:number,toIn:number):number[]=>{
  let course=rows.get(row);if(!course){course={joints:[0],next:seeded(`${seed}:${row}`)};rows.set(row,course);}
  const list=course.joints;if(list.at(-1)!>=toIn)return list;
  const below=row>0?joints(row-1,toIn+STONE_LENGTH_IN.max):[];
  while(list.at(-1)!<toIn){
   const at=list.at(-1)!,first=Math.floor(course.next()*LENGTHS.length);let best=LENGTHS[first],bestGap=-1;
   for(let i=0;i<LENGTHS.length;i++){
    const length=LENGTHS[(first+i)%LENGTHS.length],gap=Math.min(Infinity,...below.map(b=>Math.abs(at+length-b)));
    if(gap>=STONE_JOINT_CLEARANCE_IN){best=length;break;}
    if(gap>bestGap){best=length;bestGap=gap;}
   }
   list.push(at+best);
  }
  return list;
 };
 return joints;
}
