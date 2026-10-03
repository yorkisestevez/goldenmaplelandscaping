import {loadStepAssemblyRuntime,stepAssemblyReady} from './stepAssemblyRegistry';
import {configuration,descriptorValue,arrayHasItems,hasAdvancedYard,hasWallTopSteps,hasYardAssemblies,hasStepAssemblies} from './designExtensionPresence';
export {hasAdvancedYard,hasWallTopSteps,hasYardAssemblies,hasStepAssemblies} from './designExtensionPresence';
import {loadPoolDesignExtensions,poolDesignReady} from './poolDesignExtensions';
import {loadStairTargetsRuntime,stairTargetsReady} from './stairTargets';
import {loadWallTopStepsRuntime,wallTopStepsReady,loadYardAssembliesRuntime,yardAssembliesReady} from './yardFinishedSettings';
import {loadWallStationRuntime,wallStationReady} from './yardPathGeometry';
import {loadSiteModelRuntime,siteModelReady} from './siteModel';
import {loadLandscapeTypesRuntime,landscapeTypesReady} from './landscapeTypes';
import {loadEditorOrganizationRuntime,editorOrganizationReady} from './editorOrganization';
import {loadLandscapeModelRuntime,landscapeModelReady} from './landscapeModel';
import {loadSiteEngine,siteEngineReady} from './siteSurface';
import {loadAdvancedYardRuntime,advancedYardRuntimeReady} from './yardModel';
import {DesignExtensionLoadError} from './designExtensionState';
/** Descriptor reads never invoke user accessors. Schemas load only for present
 * optional fields; legacy designs fetch no extension runtime. Geometry loads
 * separately after validated values are ready to become live state. */
export async function ensureDesignExtensions(raw:unknown):Promise<void>{
 const d=configuration(raw),present=(key:string)=>descriptorValue(d,key)!==undefined,loads:Promise<void>[]=[];
 const pools=arrayHasItems(descriptorValue(d,'pools')),privatePools=present('poolQuoteInputs');if(pools||privatePools)loads.push(loadPoolDesignExtensions(pools,privatePools));
 if(hasAdvancedYard(raw))loads.push(loadAdvancedYardRuntime().catch(error=>{throw new DesignExtensionLoadError('Finished-elevation geometry',error);}));
 if(hasYardAssemblies(raw))loads.push(loadYardAssembliesRuntime());
 if(hasStepAssemblies(raw))loads.push(loadStepAssemblyRuntime());
 if(present('stairTargets'))loads.push(loadStairTargetsRuntime());
 if(hasWallTopSteps(raw))loads.push(loadWallTopStepsRuntime(),loadWallStationRuntime());
 if(present('siteModel'))loads.push(loadSiteModelRuntime());
 if(present('landscapeObjects')){loads.push(loadLandscapeTypesRuntime());if(arrayHasItems(descriptorValue(d,'landscapeObjects')))loads.push(loadLandscapeModelRuntime());}
 if(present('editorOrganization'))loads.push(loadEditorOrganizationRuntime());await Promise.all(loads);
}
export function designExtensionsReady(raw:unknown){const d=configuration(raw),present=(key:string)=>descriptorValue(d,key)!==undefined;return (!hasStepAssemblies(raw)||stepAssemblyReady())&&poolDesignReady(arrayHasItems(descriptorValue(d,'pools')),present('poolQuoteInputs'))&&(!hasYardAssemblies(raw)||yardAssembliesReady())&&(!hasAdvancedYard(raw)||advancedYardRuntimeReady())&&(!present('stairTargets')||stairTargetsReady())&&(!hasWallTopSteps(raw)||wallTopStepsReady()&&wallStationReady())&&(!present('siteModel')||siteModelReady())&&(!present('landscapeObjects')||landscapeTypesReady()&&(!arrayHasItems(descriptorValue(d,'landscapeObjects'))||landscapeModelReady()))&&(!present('editorOrganization')||editorOrganizationReady());}
export async function ensureLiveDesignExtensions(raw:unknown){await ensureDesignExtensions(raw);const d=configuration(raw);if(d.siteModel&&'value'in d.siteModel&&d.siteModel.value!==undefined&&!siteEngineReady())try{await loadSiteEngine();}catch(error){throw new DesignExtensionLoadError('Measured terrain',error);}}
