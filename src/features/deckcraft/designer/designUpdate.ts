import type {DeckData} from '../types';
import {deckReleaseData} from '../deckRelease';
import {pruneEdgeNames} from '../designPersistence';
import {resizeBoundaryPatch} from '../lib/freeOutline';
import {validateBoundaryLocks} from './boundaryLocks';
import {assertUnlockedChanges} from '../editorOrganization';

/** An empty layout is the same drawing as no layout. Persistence drops the empty object, so keeping it would make autosave refuse the design. */
function withoutEmptyBoardLayout(data:DeckData):DeckData {
  const layout=data.boardLayout;
  if(!Object.hasOwn(data,'boardLayout')||layout&&(layout.regions.length||layout.breakers.length||layout.pieces.length))return data;
  const {boardLayout:_empty,...rest}=data;
  return rest;
}
/** All UI edits preserve measured edges, including changes made outside the drawing tools. */
export function prepareDesignUpdate(data:DeckData,patch:Partial<DeckData>):DeckData {
  const next=withoutEmptyBoardLayout(pruneEdgeNames(deckReleaseData({...data,...resizeBoundaryPatch(data,patch)})));
  if(next.boundaryLocks?.length)validateBoundaryLocks(next.boundaryLocks,next);
  assertUnlockedChanges(data,next);
  return next;
}
