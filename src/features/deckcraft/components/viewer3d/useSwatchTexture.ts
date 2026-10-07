// Board material: shows the solid fallback colour instantly, then upgrades in
// place when the manufacturer swatch has been turned into its board atlas
// (swatchMaps.ts: the photo's own boards, a normal map and a roughness map).
// Deliberately NOT Suspense/useTexture — the deck must never blank while a
// texture streams in at a customer's kitchen table.

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildSwatchMaps, type SwatchImage, type SwatchMaps } from './swatchMaps';
import type { SwatchResult } from './swatchMaps.worker';
import { clearSurfaceMaps, disposeSurface, setSurfaceMaps, surfaceMaterial } from './surfaceShaders';
import { useFixtureLit } from './fixtureLighting';

/** The photo is read at up to this many pixels on its longer side (one swatch is 2000 px square). */
const READ_EDGE = 900;
/** Processed swatches kept for re-use (a colour picked again, or the same colour on a part): newest last. */
const cache = new Map<string, Promise<SwatchMaps | null>>();
const CACHE_SIZE = 6;

/** Renderer-local material jobs, not the shared URL/atlas cache. Two hooks using one cached swatch still have
 * two applications to acknowledge. A failed active material prevents a proposal capture from reporting ready. */
export function createSwatchReadinessTracker() {
  type Job = {state:'pending'|'applied'|'failed';done:Promise<void>;resolve:()=>void};
  const jobs = new Set<Job>();
  let generation = 0;
  return {
    begin() {
      let resolve!:()=>void;
      const job:Job = {state:'pending',done:new Promise<void>(done=>{resolve=done;}),resolve:()=>resolve()};
      jobs.add(job);generation++;
      return {
        applied(success:boolean) {if(!jobs.has(job)||job.state!=='pending')return;job.state=success?'applied':'failed';generation++;job.resolve();},
        cancel() {if(!jobs.delete(job))return;generation++;job.resolve();},
      };
    },
    async ready(timeoutMs=15000):Promise<boolean> {
      // One deadline for the whole call, including replacement effects that start while it is waiting.
      if(!Number.isFinite(timeoutMs)||timeoutMs<=0)return false;
      const bounded=Math.min(15000,timeoutMs);
      let timer:ReturnType<typeof setTimeout>|undefined;
      const timeout=new Promise<false>(resolve=>{timer=setTimeout(()=>resolve(false),bounded);});
      try {
        for(;;) {
          const current=[...jobs],observed=generation;
          if(current.some(job=>job.state==='failed'))return false;
          if(current.every(job=>job.state==='applied')) {
            // Let already queued effect completions/cleanup run before accepting a stable applied set.
            await Promise.resolve();
            if(observed===generation)return true;
            continue;
          }
          const completed=await Promise.race([Promise.all(current.map(job=>job.done)).then(()=>true),timeout]);
          if(!completed)return false;
          // Do not trust the old promise list: it may include cleaned-up hooks or omit a new colour/part.
        }
      } finally {if(timer!==undefined)clearTimeout(timer);}
    },
  };
}
const rendererReadiness = new WeakMap<THREE.WebGLRenderer,ReturnType<typeof createSwatchReadinessTracker>>();
function readinessFor(gl:THREE.WebGLRenderer) {
  let tracker=rendererReadiness.get(gl);
  if(!tracker){tracker=createSwatchReadinessTracker();rendererReadiness.set(gl,tracker);}
  return tracker;
}
/** Waits for maps to be applied on all active swatch hooks in this renderer, at most 15 seconds. */
export const waitForSwatchTextures=(gl:THREE.WebGLRenderer,timeoutMs=15000):Promise<boolean>=>readinessFor(gl).ready(timeoutMs);

/** Real wood (cedar, pressure-treated) is rougher than a composite's capped surface. */
const isWood = (url: string) => /(^|\/)wood-[^/]*$/.test(url.split('?')[0]);

type Kind = 'composite' | 'wood';
const pending = new Map<number, { resolve: (maps: SwatchMaps | null) => void; image: SwatchImage; kind: Kind }>();
let worker: Worker | null | undefined, nextId = 0;
const onMainThread = (image: SwatchImage, kind: Kind) => buildSwatchMaps(image, kind, () => new Promise(resolve => setTimeout(resolve, 0)));
// The worker lives for the page, so its listeners are module functions: written inline, the build folds this code into
// the hook's effect and the listener kept the first 3D view's renderer, canvas and context alive.
function onWorkerMessage(event: MessageEvent<SwatchResult>) { pending.get(event.data.id)?.resolve(event.data.maps); pending.delete(event.data.id); }
/** A worker that fails to load hands its jobs back to the main thread, and no more are sent to it. */
function onWorkerError() { worker = null; for (const job of pending.values()) onMainThread(job.image, job.kind).then(job.resolve, () => job.resolve(null)); pending.clear(); }
/** Atlases are built in a worker (swatchMaps.worker.ts); where none can start, on the main thread a strip at a time. */
function buildAtlas(image: SwatchImage, kind: Kind): Promise<SwatchMaps | null> {
  if (worker === undefined) {
    try { worker = typeof Worker === 'function' ? new Worker(new URL('./swatchMaps.worker.ts', import.meta.url), { type: 'module' }) : null; } catch { worker = null; }
    worker?.addEventListener('message', onWorkerMessage);
    worker?.addEventListener('error', onWorkerError);
  }
  if (!worker) return onMainThread(image, kind);
  const id = nextId++, job = worker;
  return new Promise(resolve => { pending.set(id, { resolve, image, kind }); job.postMessage({ id, image, kind }); });
}

function swatchMaps(url: string): Promise<SwatchMaps | null> {
  const hit = cache.get(url);
  if (hit) { cache.delete(url); cache.set(url, hit); return hit; }
  const job = (async () => {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const scale = Math.min(1, READ_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale), height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(img, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return buildAtlas({ width, height, data }, isWood(url) ? 'wood' : 'composite');
  })().catch(() => null);
  cache.set(url, job);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return job;
}

function atlasTexture(pixels: Uint8Array, maps: SwatchMaps, colorSpace: THREE.ColorSpace, anisotropy: number) {
  const texture = new THREE.DataTexture(pixels, maps.width, maps.height, THREE.RGBAFormat);
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function useSwatchTexture(url: string, fallbackColor: string): THREE.MeshStandardMaterial {
  const gl = useThree(s => s.gl);
  const invalidate = useThree(s => s.invalidate);

  // A new material per colour choice is intentional — disposal handled below.
  const material = useMemo(() => surfaceMaterial(fallbackColor), [fallbackColor]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const application = readinessFor(gl).begin();
    swatchMaps(url).then(maps => {
      if (cancelled) return;
      if (!maps) { application.applied(false); return; }
      const anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
      setSurfaceMaps(material, {
        map: atlasTexture(maps.albedo, maps, THREE.SRGBColorSpace, anisotropy),
        normalMap: atlasTexture(maps.normal, maps, THREE.NoColorSpace, anisotropy),
        roughnessMap: atlasTexture(maps.roughness, maps, THREE.NoColorSpace, anisotropy),
      }, maps.strips);
      invalidate();
      // Decode/worker completion alone is insufficient: all three maps and box variants must be swapped first.
      application.applied(true);
    }).catch(() => { if(!cancelled)application.applied(false); });
    return () => { cancelled = true; application.cancel(); clearSurfaceMaps(material); };
  }, [url, material, gl, invalidate]);

  // Boards, treads, risers, fascia and skirting take the night's step and post lights.
  useFixtureLit(material);

  // Acceptance gate: dispose on unmount path.
  useEffect(() => () => disposeSurface(material), [material]);

  return material;
}
