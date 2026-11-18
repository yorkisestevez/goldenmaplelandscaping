import './siteModelRuntime';
import type {DeckData} from './types';
import type {AgentCommand} from './designer/deckAgentController';
import {validateSiteModel} from './siteModel';
import {assertUniqueObjectIds,assertUnlockedChanges,isObjectLocked} from './editorOrganization';
/** All site input methods use the same validated mutation; the controller owns revisions/history. */
export function applySiteOperation(data:DeckData,c:Extract<AgentCommand,{type:`site.${string}`}>):Partial<DeckData>{
 if(isObjectLocked(data.editorOrganization,'site'))throw Error('The site object or layer is locked. Unlock it first.');
 if(c.type==='site.replace'){const siteModel=c.site===undefined?undefined:validateSiteModel(c.site);const next={...data,siteModel};assertUniqueObjectIds(next);assertUnlockedChanges(data,next);return {siteModel};}
 if(!data.siteModel)throw Error('Create or import a measured site before editing elevations or transitions.');
 const site=structuredClone(data.siteModel);
 if(c.type==='site.transition'){const old=site.transitions??[];site.transitions=old.some(t=>t.id===c.transition.id)?old.map(t=>t.id===c.transition.id?c.transition:t):[...old,c.transition];}
 else if(c.type==='site.transition.remove'){if(!site.transitions?.some(t=>t.id===c.id))throw Error('Choose a current grading transition.');site.transitions=site.transitions.filter(t=>t.id!==c.id);}
 else if(c.type==='site.point'){if(!site.points.some(p=>p.id===c.id))throw Error('Read a current measured point ID.');site.points=site.points.map(p=>p.id===c.id?{id:c.id,xIn:c.xIn,zIn:c.zIn,elevationIn:c.elevationIn}:p);}
 else if(c.type==='site.grade')site.grading=site.grading.some(g=>g.id===c.region.id)?site.grading.map(g=>g.id===c.region.id?c.region:g):[...site.grading,c.region];
 else if(c.type==='site.remove'){if(c.target==='point')site.points=site.points.filter(p=>p.id!==c.id);else if(c.target==='grading')site.grading=site.grading.filter(g=>g.id!==c.id);else throw Error('Choose point or grading.');}
 else throw Error('Choose a supported site operation.');
 const next={...data,siteModel:validateSiteModel(site)};assertUniqueObjectIds(next);assertUnlockedChanges(data,next);return {siteModel:next.siteModel};
}
