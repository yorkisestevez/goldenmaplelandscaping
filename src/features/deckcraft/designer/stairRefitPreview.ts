import type {DeckData} from '../types';
import type {StairRefitOptions} from '../stairRefit';
import {ensureLiveDesignExtensions} from '../designExtensions';

/** A fresh legacy project can produce its first stair target here. Prepare
 * both the source and candidate before synchronous geometry/quantity reads. */
export async function prepareStairRefitPreview(data:DeckData,options:StairRefitOptions={}){
 await ensureLiveDesignExtensions(data);
 const {previewStairRefit}=await import('../stairRefit');
 const result=previewStairRefit(data,options);
 if(result.status==='ready')await ensureLiveDesignExtensions({...data,...result.patch});
 return result;
}
