import type {AgentCommand,AgentSnapshot} from './deckAgentController';
import type {SelectionState} from './selectionState';
const normalized=(value:string)=>value.toLowerCase().trim().replace(/[.!?]+$/,'').replace(/^the /,'').replace(/\s+/g,' ');
export function workspaceViewCommand(text:string):AgentCommand|null {
 const query=normalized(text).replace(/^(?:please )?(?:show me |show |switch to |open )/,'').replace(/^(?:the |from )/,'').replace(/ view$/,'');
 const views={plan:'plan','2d':'plan','3d':'3d',corner:'3d',overview:'overview',front:'front',above:'top',top:'top',framing:'structure',hardware:'hardware',foundation:'foundation'} as const;
 return Object.hasOwn(views,query)?{type:'view.set',view:views[query as keyof typeof views]}:null;
}
export function workspaceObjects(snapshot:AgentSnapshot):{id:string;name:string;selection:SelectionState}[] {
 const items=snapshot.parts.map(p=>({id:p.id,name:p.label,selection:{partIds:[p.id],boards:[]} as SelectionState}));
 for(const [kind,objects] of [['yard',snapshot.design.yardFeatures??[]],['pool',snapshot.design.pools??[]],['landscape',snapshot.design.landscapeObjects??[]]] as const)
  for(const object of objects)items.push({id:object.id,name:object.name,selection:{partIds:[],boards:[],hardscape:{kind,id:object.id}}});
 if(snapshot.design.pergola&&!items.some(o=>o.id==='pergola:main'))items.push({id:'pergola:main',name:'Pergola',selection:{partIds:['pergola:main'],boards:[]}});
 return items;
}
export function resolveWorkspaceSelection(name:string,snapshot:AgentSnapshot):{ok:true;selection:SelectionState;message:string}|{ok:false;message:string} {
 const query=normalized(name);
 if(['nothing','none','clear selection'].includes(query))return {ok:true,selection:{partIds:[],boards:[]},message:'Selection cleared.'};
 const objects=workspaceObjects(snapshot),exact=objects.filter(o=>normalized(o.name)===query||normalized(o.id)===query);
 const matches=exact.length?exact:objects.filter(o=>normalized(o.name).includes(query));
 if(query&&matches.length===1)return {ok:true,selection:matches[0].selection,message:`Selected ${matches[0].name}.`};
 return {ok:false,message:matches.length>1?`Which object? Say select followed by an exact name or ID: ${matches.slice(0,5).map(o=>`${o.name} (${o.id})`).join(', ')}.`:`No object matches “${name}”. Name an existing object to select it.`};
}
