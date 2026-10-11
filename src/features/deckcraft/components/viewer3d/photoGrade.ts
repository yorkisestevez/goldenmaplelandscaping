/** Photographic grade and sun disc for stills. Plain numbers, no three.js.
 * The editor keeps Khronos Neutral (sceneLook.ts). This grade is photo mode only. */

export type PhotoLook='day'|'golden'|'night';
export const PHOTO_LOOKS:PhotoLook[]=['day','golden','night'];

export interface PhotoGrade{
 /** Stops-ish multiplier on the linear path-traced image, before the curve. */
 exposure:number;
 /** Linear white balance. Day stays near neutral so swatch colour is not pushed. */
 balance:[number,number,number];
 /** Mix toward luminance. 1 keeps the path-traced chroma. */
 saturation:number;
}

/** AgX does the highlight shoulder. These are only the exposure and balance in front of it. */
export const PHOTO_GRADE:Record<PhotoLook,PhotoGrade>={
 day:{exposure:1.4,balance:[1.02,1,0.98],saturation:1.02},
 golden:{exposure:2.05,balance:[1.08,0.99,0.88],saturation:1.04},
 night:{exposure:2.15,balance:[0.96,1,1.08],saturation:1.04},
};

/** A print-like sun: a little larger than the real 0.27° so the penumbra reads in a still,
 * while a horizontal card still receives the same direct irradiance as the raster key. */
export const SUN_DISTANCE_FT=220;
export const SUN_ANGULAR_RADIUS_DEG:Record<PhotoLook,number>={day:0.9,golden:1.45,night:0};

export interface SunDisc{diameterFt:number;radiance:number;angularRadiusDeg:number;distanceFt:number}

/** Radiance of a disc whose integrated irradiance on a facing surface equals `irradiance`. */
export function sunDisc(irradiance:number,angularRadiusDeg:number,distanceFt=SUN_DISTANCE_FT):SunDisc{
 const theta=angularRadiusDeg*Math.PI/180,radius=distanceFt*Math.tan(theta);
 const factor=Math.PI*(radius/distanceFt)**2;
 return {diameterFt:radius*2,radiance:factor>0?irradiance/factor:0,angularRadiusDeg,distanceFt};
}

/** Direct irradiance a facing Lambertian card receives from that disc. */
export function sunDiscIrradiance(disc:SunDisc){
 const radius=disc.diameterFt/2;
 return disc.radiance*Math.PI*(radius/disc.distanceFt)**2;
}

/** Golden-hour key, same azimuth, low elevation. Night has no sun. */
export function photoSunElevationDeg(look:PhotoLook,dayElevationDeg:number){
 if(look==='golden')return 11;
 if(look==='night')return 0;
 return dayElevationDeg;
}

export function photoSunIrradiance(look:PhotoLook,dayIrradiance:number){
 if(look==='night')return 0;
 if(look==='golden')return dayIrradiance*0.85;
 return dayIrradiance;
}

/** Linear sun colour. Day keeps the extracted HDR sun. Golden hour is the warm key. */
export function photoSunColor(look:PhotoLook,dayColor:[number,number,number]):[number,number,number]{
 if(look==='golden')return [1,0.58,0.32];
 return dayColor;
}

export const PHOTO_FALLBACK='Photo mode needs a graphics device that can path trace. This view stays on the real-time renderer.';

/** Area-light stand-ins. Spot radius is in feet (world units). Point lights keep their
 * candela — the tracer can sample those — and gain a small bulb so the fixture is visible.
 * The bulb is capped so it does not become a second sun at low sample counts. */
export const PHOTO_LIGHT={
 spotRadiusFt:0.32,
 pointKeep:1,
 pointSphereRadiusFt:0.16,
 pointEmissiveScale:0.06,
 pointEmissiveCap:12,
 windowNightEmissive:7,
 floorCaustic:0.16,
 nightEmissiveBoost:2.8,
};

/** A dim, wide moon so the night still has fill on the deck and planting. Not a saved scene light. */
export const PHOTO_MOON={
 irradiance:0.42,
 angularRadiusDeg:7.5,
 elevationDeg:32,
 azimuthDeg:214,
 color:[0.62,0.74,1] as [number,number,number],
};

/** Long-edge export, same rule as the raster still: 2048 or 4096, aspect kept. */
export function photoStillSize(longEdge:number,size:{x:number;y:number},maximum:number){
 if((longEdge!==2048&&longEdge!==4096)||!Number.isFinite(size.x)||!Number.isFinite(size.y)||size.x<=0||size.y<=0)throw Error('Choose a 2048 or 4096 pixel long-edge photo export.');
 const width=size.x>=size.y?longEdge:Math.max(1,Math.round(longEdge*size.x/size.y)),height=size.x>=size.y?Math.max(1,Math.round(longEdge*size.y/size.x)):longEdge;
 if(width>maximum||height>maximum||width*height>16777216)throw Error('This photo export exceeds the renderer’s supported image size.');
 return {width,height};
}
