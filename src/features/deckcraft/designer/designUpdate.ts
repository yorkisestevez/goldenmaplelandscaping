import type {DeckData} from '../types';
import {deckReleaseData} from '../deckRelease';
import {pruneEdgeNames} from '../designPersistence';
import {resizeBoundaryPatch} from '../lib/freeOutline';
import {validateBoundaryLocks} from './boundaryLocks';
import {assertUnlockedChanges} from '../editorOrganization';

/** All UI edits preserve measured edges, including changes made outside the drawing tools. */
export function prepareDesignUpdate(data:DeckData,patch:Partial<DeckData>):DeckData {
  const next=pruneEdgeNames(deckReleaseData({...data,...resizeBoundaryPatch(data,patch)}));
  if(next.boundaryLocks?.length)validateBoundaryLocks(next.boundaryLocks,next);
  assertUnlockedChanges(data,next);
  return next;
}
