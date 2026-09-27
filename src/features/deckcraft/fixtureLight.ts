import {LEGACY_HYDE,type FixturePlacement} from './extrasLayout';
import {getLightingProduct} from './lightingCatalogue';

/**
 * What a fixture does in the night preview, shared by the live 3D view and the check scripts (and later the path-traced
 * photo). Pure data, no three import. Local positions are model inches in the fixture's own frame (as LightingFixtures
 * draws it: +y up, +z the way the fixture faces out of its mount); candela and ranges are in world feet, as three
 * lights take them. Brightness and colour are illustrative, not photometric claims.
 *
 * - 'glow-only': a lens that lights nothing near it (a PUCK in a post cap faces the sky), so only its glow shows.
 * - 'patch': a near-field light (under a step, on a post, on a screen post). Every one lights its surroundings through
 *   the fixture light patch on the receiving materials (fixtureLighting.ts), with no count limit and no shadows.
 * - 'real': a long-throw light (house wall, bollard, spot, pendant, deck uplight) drawn as a three light, within
 *   MAX_PREVIEW_LIGHTS; only these can cast shadows.
 */
export type FixtureRoute='none'|'glow-only'|'patch'|'real';
export type V3=[number,number,number];
export interface FixtureSource{kind:'spot'|'point';position:V3;direction:V3;
  /** Half the lit length, along local x, for a strip light (0 for a point). */
  halfLengthIn:number;
  /** The lens's own size: light falls off as 1/(d²+radius²), so a surface right beside the lens is bright but never a
   * burnt-out pinpoint (a real lens is not a point). Fixture light patch only; real three lights keep three's own falloff. */
  radiusIn:number;
  /** Outer cone half-angle (radians) and the soft share of it, as three's SpotLight takes them. */
  angle:number;penumbra:number;candela:number;rangeFt:number}
export interface FixtureLens{position:V3;
  /** The way the lens faces; [0,0,0] glows the same all round. */
  normal:V3;radiusIn:number;lengthIn:number;strength:number}
export interface FixtureNight{route:FixtureRoute;kelvin:number;lens:FixtureLens|null;source:FixtureSource|null;
  /** Who gets the few shadow-casting lights first (higher first); 0 never casts. */
  shadowPriority:number}

/** Fixtures still drawn with their original hand-made shapes (LightingFixtures.tsx); the rest use CatalogueFixture. */
export const LEGACY_FIXTURE_SHAPES=['puck','fusion','hyve','evo_hyde','wedge','blink','ace','liv','scope','hub50','hub100','smart_hub150','smart_move','smart_bridge','smart_extender','cable_14_2','cable_12_2'];
export {LEGACY_HYDE};
export const DEFAULT_KELVIN=3000;
/** Rows in the fixture light texture: more than every simple option at its per-product cap together. */
export const FX_MAX_FIXTURES=128;
export const FX_TEXELS=4;

const NONE:FixtureNight={route:'none',kelvin:DEFAULT_KELVIN,lens:null,source:null,shadowPriority:0};
const UP:V3=[0,1,0],DOWN:V3=[0,-1,0],OMNI:V3=[0,0,0];
const norm=(v:V3):V3=>{const l=Math.hypot(...v)||1;return [v[0]/l,v[1]/l,v[2]/l];};
const deg=(d:number)=>d*Math.PI/180;
/** Down and tipped 5° back toward the riser: an under-nose light washes the riser below and pools on the tread. */
const UNDER_NOSE:V3=norm([0,-Math.cos(deg(5)),-Math.sin(deg(5))]);

export function fixtureNight(productId:string,zone?:string):FixtureNight{
  const p=getLightingProduct(productId);
  if(!p||!p.supported||['transformer','cable','accessory'].includes(p.geometry))return NONE;
  const g=p.geometry,d=p.dimensionsIn,kelvin=p.colorTemperatureK??DEFAULT_KELVIN,legacy=LEGACY_FIXTURE_SHAPES.includes(productId);
  if(g==='recessed'){
    const lens:FixtureLens=legacy?{position:[0,.21,0],normal:UP,radiusIn:productId==='puck'?.55:1.02,lengthIn:0,strength:.9}
      :{position:[0,.14,0],normal:UP,radiusIn:(d.diameter??d.width??2.2)/2*.83,lengthIn:0,strength:.85};
    // A lens in a post cap or a tread faces the sky: it glows and lights nothing around it.
    if(zone==='posts'||zone==='stairs')return {route:'glow-only',kelvin,lens,source:null,shadowPriority:0};
    return {route:'real',kelvin,lens,source:{kind:'spot',position:[0,.5,0],direction:UP,halfLengthIn:0,radiusIn:0,angle:1.25,penumbra:.8,candela:3,rangeFt:12},shadowPriority:1};
  }
  if(g==='undercap'){
    const length=legacy?LEGACY_HYDE.length:d.length??12,height=legacy?LEGACY_HYDE.height:d.height??.5;
    const lens:FixtureLens={position:[0,-height/2-.03,0],normal:DOWN,radiusIn:.9,lengthIn:Math.max(0,length-.5),strength:.55};
    // The light leaves the diffuser on the underside, so nothing level with the fixture or above it (the riser beside
    // its ends, the tread it hangs from) is inside its cone.
    return {route:'patch',kelvin,lens,source:{kind:'spot',position:[0,-height/2-.1,0],direction:UNDER_NOSE,halfLengthIn:Math.max(0,length/2-.5),radiusIn:2,angle:deg(70),penumbra:1,candela:2.5,rangeFt:2.2},shadowPriority:0};
  }
  if(g==='wall'){
    const lens:FixtureLens=productId==='wedge'?{position:[0,-1.35,.5],normal:norm([0,-.95,.3]),radiusIn:1,lengthIn:2,strength:.6}
      :productId==='blink'?{position:[0,-.6,.67],normal:norm([0,-.5,.87]),radiusIn:.8,lengthIn:0,strength:.6}
      :{position:[0,-(d.diameter??d.height??3)/2-.02,0],normal:DOWN,radiusIn:.9,lengthIn:0,strength:.6};
    if(zone==='house')return {route:'real',kelvin,lens,source:{kind:'spot',position:[0,-.7,2],direction:norm([0,-1,1]),halfLengthIn:0,radiusIn:0,angle:.9,penumbra:.8,candela:9,rangeFt:12},shadowPriority:2};
    // On a post or a screen post, the light falls onto the deck in front of it.
    if(zone==='posts'||zone==='privacy')return {route:'patch',kelvin,lens,source:{kind:'spot',position:[0,-1.2,.9],direction:norm([0,-Math.sin(deg(55)),Math.cos(deg(55))]),halfLengthIn:0,radiusIn:1.5,angle:deg(65),penumbra:1,candela:zone==='posts'?18:14,rangeFt:7},shadowPriority:0};
    // On a riser, a step light throws down and out across the tread below.
    if(zone==='stairs')return {route:'patch',kelvin,lens,source:{kind:'spot',position:[0,-1,.8],direction:norm([0,-1,.9]),halfLengthIn:0,radiusIn:1.2,angle:deg(60),penumbra:1,candela:6,rangeFt:3.5},shadowPriority:0};
    // On the fascia, it washes down the deck edge onto the ground.
    return {route:'patch',kelvin,lens,source:{kind:'spot',position:[0,-1,.8],direction:norm([0,-1,.6]),halfLengthIn:0,radiusIn:1.5,angle:deg(60),penumbra:1,candela:9,rangeFt:6},shadowPriority:0};
  }
  if(g==='bollard'){
    const height=d.height??19.5;
    const lens:FixtureLens={position:[0,legacy?17.7:height-1.5,0],normal:OMNI,radiusIn:1.4,lengthIn:0,strength:.5};
    if(productId==='liv')return {route:'real',kelvin,lens,source:{kind:'point',position:[0,height-1.5,0],direction:DOWN,halfLengthIn:0,radiusIn:0,angle:Math.PI,penumbra:0,candela:5,rangeFt:12},shadowPriority:3};
    return {route:'real',kelvin,lens,source:{kind:'spot',position:[0,height-1.5,2],direction:norm([0,-(24+height-1.5),22]),halfLengthIn:0,radiusIn:0,angle:.9,penumbra:.8,candela:9,rangeFt:12},shadowPriority:3};
  }
  if(g==='spot'){
    const height=d.height??5;
    return {route:'real',kelvin,lens:null,source:{kind:'spot',position:[0,height*.65,1],direction:norm([0,24-height*.65,59]),halfLengthIn:0,radiusIn:0,angle:.42,penumbra:.65,candela:16,rangeFt:20},shadowPriority:3};
  }
  if(g==='pendant'||g==='ceiling'){
    const height=d.height??5,y=g==='pendant'?-18-height-.1:-height-.1;
    return {route:'real',kelvin,lens:{position:[0,y,0],normal:DOWN,radiusIn:(d.diameter??2.2)/2*.8,lengthIn:0,strength:.6},source:{kind:'spot',position:[0,y,0],direction:DOWN,halfLengthIn:0,radiusIn:0,angle:.9,penumbra:.8,candela:9,rangeFt:12},shadowPriority:2};
  }
  return NONE;
}

/**
 * A colour temperature as display (sRGB) red, green and blue in 0–1 (Tanner Helland's fit to the black-body curve).
 * The viewer turns it into linear light with Color.setRGB(…, SRGBColorSpace).
 */
export function kelvinSrgb(kelvin:number):V3{
  const t=Math.min(40000,Math.max(1000,kelvin))/100,c=(v:number)=>Math.min(255,Math.max(0,v))/255;
  const r=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592);
  const g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492);
  const b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;
  return [c(r),c(g),c(b)];
}
const srgbToLinear=(v:number)=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
export const kelvinLinear=(kelvin:number):V3=>kelvinSrgb(kelvin).map(srgbToLinear) as V3;

/** A local point or direction of a fixture in world feet (the scene is drawn at 1/12 scale, in inches). */
function toWorld(p:FixturePlacement,v:V3,point:boolean):V3{
  const c=Math.cos(p.angle),s=Math.sin(p.angle),x=v[0]*c+v[2]*s,z=-v[0]*s+v[2]*c;
  return point?[(p.x+x)/12,(p.y+v[1])/12,(p.z+z)/12]:[x,v[1],z];
}

/**
 * The near-field ('patch') fixtures packed for the fixture light patch: FX_TEXELS RGBA texels per fixture, one row each.
 * 0: position (ft) + range (ft) · 1: aim + cos(outer angle) · 2: linear colour × candela + cos(inner angle)
 * · 3: half the strip (ft, 0 for a point) + the lens radius (ft). Nothing is lit by day or with the preview lights off.
 */
export function packFixtureLights(fixtures:FixturePlacement[],{evening,enabled}:{evening:boolean;enabled:boolean}){
  const data=new Float32Array(FX_TEXELS*FX_MAX_FIXTURES*4);
  let count=0,dropped=0;
  if(!evening||!enabled)return {data,count,dropped};
  for(const f of fixtures){
    const night=fixtureNight(f.productId,f.zone),s=night.source;
    if(night.route!=='patch'||!s)continue;
    if(count>=FX_MAX_FIXTURES){dropped++;continue;}
    const pos=toWorld(f,s.position,true),aim=toWorld(f,s.direction,false),half=toWorld(f,[s.halfLengthIn,0,0],false).map(v=>v/12);
    const colour=kelvinLinear(night.kelvin),o=count*FX_TEXELS*4;
    data.set([...pos,s.rangeFt,...aim,Math.cos(s.angle),...colour.map(v=>v*s.candela),Math.cos(s.angle*(1-s.penumbra)),...half,(s.radiusIn??0)/12],o);
    count++;
  }
  return {data,count,dropped};
}

/** A fixture's lens in world feet, for the glow drawn over it; null for fixtures without a visible lens. */
export function fixtureGlow(f:FixturePlacement){
  const night=fixtureNight(f.productId,f.zone),lens=night.lens;
  if(night.route==='none'||!lens)return null;
  return {position:toWorld(f,lens.position,true),normal:toWorld(f,lens.normal,false),axis:toWorld(f,[1,0,0],false),
    radiusFt:lens.radiusIn/12,lengthFt:lens.lengthIn/12,strength:lens.strength,kelvin:night.kelvin};
}
