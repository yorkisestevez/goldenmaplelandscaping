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
 night:{exposure:1.12,balance:[0.94,0.98,1.1],saturation:1},
};

/** The real sun: 0.27° angular radius, so shadows are crisp where a post or a trunk meets the ground and soften with
 * distance, as in a photograph. Golden hour is a touch wider for the haze at a low sun. A horizontal card still receives
 * the same direct irradiance as the raster key. */
export const SUN_DISTANCE_FT=220;
export const SUN_ANGULAR_RADIUS_DEG:Record<PhotoLook,number>={day:0.27,golden:0.35,night:0};

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
 pointEmissiveCap:2.4,
 windowNightEmissive:1.08,
 floorCaustic:0.16,
 nightFloorGlow:0.58,
 nightWallGlow:0.22,
 nightCopingGlow:0.1,
 nightEmissiveBoost:1.15,
 stepLightCandela:18,
 stepLightRangeFt:5,
 paverLightCandela:12,
 poolLightCandela:80,
 pergolaWashCandela:16,
};

/** A wide moon plus a softer overhead fill. Together they are moonlight, not a second sun. */
export const PHOTO_MOON={
 irradiance:0.2,
 angularRadiusDeg:12,
 elevationDeg:38,
 azimuthDeg:214,
 color:[0.58,0.72,1] as [number,number,number],
};

/** Blue fill from nearly overhead, so lawn, fence, siding and coping read without a hard shadow. */
export const PHOTO_NIGHT_FILL={
 irradiance:0.36,
 angularRadiusDeg:32,
 elevationDeg:82,
 azimuthDeg:18,
 color:[0.4,0.52,0.92] as [number,number,number],
};

/** Long-edge export, same rule as the raster still: 2048 or 4096, aspect kept. */
export function photoStillSize(longEdge:number,size:{x:number;y:number},maximum:number){
 if((longEdge!==2048&&longEdge!==4096)||!Number.isFinite(size.x)||!Number.isFinite(size.y)||size.x<=0||size.y<=0)throw Error('Choose a 2048 or 4096 pixel long-edge photo export.');
 const width=size.x>=size.y?longEdge:Math.max(1,Math.round(longEdge*size.x/size.y)),height=size.x>=size.y?Math.max(1,Math.round(longEdge*size.y/size.x)):longEdge;
 if(width>maximum||height>maximum||width*height>16777216)throw Error('This photo export exceeds the renderer’s supported image size.');
 return {width,height};
}
