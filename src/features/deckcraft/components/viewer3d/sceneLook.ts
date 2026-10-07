import type {RenderQuality} from './renderQuality';
/**
 * The 3D view's photographic settings, shared by the live renderer (renderPipeline.tsx) and the path-traced photo:
 * tone mapping, ambient occlusion, bloom, the sun's shadow and the powder-coat finish. Plain data with no three.js
 * import, so the check scripts and the photo engine can read it. Distances are in feet (the scene's world unit).
 */
export const SCENE_LOOK={
  /** Khronos PBR Neutral keeps a product's base colour faithful (AgX greys it, ACES shifts it orange). */
  toneMapping:'Neutral' as const,exposure:1,
  msaaSamples:4,
  /** Ambient occlusion at half the drawing-buffer size, from the scene's own depth. */
  ao:{radius:.8,distanceExponent:2,thickness:1,distanceFallOff:1,scale:1.4,samples:16,resolution:.5,
    intensity:{day:.5,evening:.25},denoise:{lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:16}},
  /** Evening only, on the HDR image, so only real light sources (fixtures, lit windows) glow. */
  bloom:{strength:.45,radius:.5,threshold:1.1},
  /** The sun's shadow frustum is fitted to what casts, with this margin, at up to this map size. */
  sunShadow:{mapSize:4096,radius:5,marginFt:2},
  /** Paint, not metal: dark powder coat at metalness 0 still catches the sky in a clear coat. */
  powderCoat:{roughness:.42,metalness:0,clearcoat:.35,clearcoatRoughness:.32},powderCoatColor:'#2a2d2e',
  /** The sky (Sky3D.tsx, built by scripts/build-deck-sky.ts): its sun is turned to come from the front right (azimuth
   * atan2(z, x) in degrees), as the studio light always has; the evening sky is dimmed so the fixtures carry the scene;
   * distance haze thickens to 10% at 300 ft; the sky dome sits inside the camera's far plane. */
  // A tree-filtered HDR has no extracted sun. Redistribute part of its measured horizontal irradiance to a
  // neutral directional key, keeping the same total energy. This gives rails and steps legible cast shadows.
  sky:{sunAzimuthDeg:34.7,dayEnvironment:.55,dayFill:2.2,evening:.16,fogDensity:.0011,domeRadiusFt:1900,cameraNear:.25,cameraFar:2400},
};

/** Device budgets are applied by the actual target/pass constructors, including
 * captures. Low-capability devices keep fewer AO rays and smaller denoise/bloom
 * buffers; none of these values affect design geometry. */
export function sceneQuality(quality:RenderQuality,capabilities:{maxSamples:number;maxTextureSize:number}){
 const low=quality.tier==='constrained',middle=quality.tier==='balanced';
 return {msaaSamples:Math.max(0,Math.min(quality.msaaSamples,capabilities.maxSamples)),
  aoSamples:quality.aoSamples,aoResolution:quality.aoResolution,
  denoiseSamples:quality.aoSamples,denoiseRadius:low?3:middle?4:SCENE_LOOK.ao.denoise.radius,
  bloomResolution:low?.5:middle?.75:1,
  shadowSize:Math.min(quality.shadowSize,capabilities.maxTextureSize)};
}
