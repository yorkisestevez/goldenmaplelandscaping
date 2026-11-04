/** Width of the 1K board atlas (swatchMaps.ts). Its own module, so the 3D viewer can size atlases without bundling the
 * atlas builder, which runs in its worker and loads on the main thread only when no worker can start. */
export const ATLAS_WIDTH=1024;
