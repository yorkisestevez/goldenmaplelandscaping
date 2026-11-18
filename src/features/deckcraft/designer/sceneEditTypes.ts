import type {AgentCommand} from './deckAgentController';
import type {useHardscapePreview} from './useHardscapePreview';
import type {LandscapeHandle} from '../landscapeOutline';
export type ReturnTypeOfPreview=ReturnType<typeof useHardscapePreview>;
export type SceneEditMode='move'|'rotate'|'shape'|'resize'|'elevation';
export interface SceneDragTarget {part:'move'|'rotate'|'resize'|'elevation'|'point'|'bend'|'c1'|'c2'|'cup';index?:number;ring?:number}
export interface SceneDragValue {dxIn:number;dzIn:number;dyIn:number;angleDeg:number;world:{x:number;z:number}}
export interface SceneEditInteraction {mode:SceneEditMode;snapIn:number;onDraft:(target:SceneDragTarget,value:SceneDragValue)=>void;onFinish:(target:SceneDragTarget,value:SceneDragValue)=>void;onCancel:()=>void}
