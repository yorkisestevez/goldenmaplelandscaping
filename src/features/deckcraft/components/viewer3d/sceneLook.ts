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
  ao:{radius:2,distanceExponent:2,thickness:3,distanceFallOff:1,scale:1.4,samples:16,resolution:.5,
    intensity:{day:.9,evening:.35},denoise:{lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:16}},
  /** Evening only, on the HDR image, so only real light sources (fixtures, lit windows) glow. */
  bloom:{strength:.45,radius:.5,threshold:1.1},
  /** The sun's shadow frustum is fitted to what casts, with this margin, at up to this map size. */
  sunShadow:{mapSize:4096,radius:2.5,marginFt:2},
  /** Paint, not metal: dark powder coat at metalness 0 still catches the sky in a clear coat. */
  powderCoat:{roughness:.5,metalness:0,clearcoat:.6,clearcoatRoughness:.28},powderCoatColor:'#2a2d2e',
  /** The sky (Sky3D.tsx, built by scripts/build-deck-sky.ts): its sun is turned to come from the front right (azimuth
   * atan2(z, x) in degrees), as the studio light always has; the evening sky is dimmed so the fixtures carry the scene;
   * distance haze thickens to 10% at 300 ft; the sky dome sits inside the camera's far plane. */
  sky:{sunAzimuthDeg:55.3,evening:.1,fogDensity:.0011,domeRadiusFt:1900,cameraNear:.25,cameraFar:2400},
};
