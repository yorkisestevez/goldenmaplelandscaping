import type {GarageDoorStyle,WindowStyle} from './types';

/**
 * The window and garage-door styles a saved design may name. On their own so reading a saved design
 * (designPersistence.ts) does not load the opening presets and editing helpers in houseOpenings.ts with the page.
 */
export const WINDOW_STYLES:readonly WindowStyle[]=['Double-hung','Casement','Picture','Slider','Awning'];
export const GARAGE_DOOR_STYLES:readonly GarageDoorStyle[]=['Panel','Carriage','Flush','Glass'];
