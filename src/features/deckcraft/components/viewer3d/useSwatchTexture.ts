// Board material: shows the solid fallback colour instantly, then upgrades in
// place when the real manufacturer swatch JPG loads as a repeating texture.
// Deliberately NOT Suspense/useTexture — the deck must never blank while a
// texture streams in at a customer's kitchen table.

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function useSwatchTexture(url: string, fallbackColor: string): THREE.MeshStandardMaterial {
  const gl = useThree(s => s.gl);
  const invalidate = useThree(s => s.invalidate);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 0.65, metalness: 0 }),
    // A new material per colour choice is intentional — disposal handled below.
    [fallbackColor]
  );

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    material.color.set(fallbackColor);
    loader.load(url, source => {
      if (cancelled) { source.dispose(); return; }
      // Crop the bitmap BEFORE repetition. UV offset/repeat on the complete
      // product photo wraps back into pictured seams and its perpendicular border.
      const img=source.image as HTMLImageElement,canvas=document.createElement('canvas');
      canvas.width=512;canvas.height=128;const context=canvas.getContext('2d');
      if(!context){source.dispose();return;}
      if(url.includes('tt-'))context.drawImage(img,img.width*.025,img.height*.29,img.width*.69,img.height*.16,0,0,512,128);
      else context.drawImage(img,0,img.height*.15,img.width,img.height*.65,0,0,512,128);
      const tex=new THREE.CanvasTexture(canvas);source.dispose();
      tex.wrapS=THREE.MirroredRepeatWrapping;tex.wrapT=THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
      tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;
      material.map = tex;
      material.bumpMap = tex;
      material.bumpScale = 0.035;
      material.color.set('#ffffff');
      material.needsUpdate = true;
      invalidate();
    });
    return () => {
      cancelled = true;
      material.map?.dispose();
      material.map = null;
    };
  }, [url, material, gl, invalidate, fallbackColor]);

  // Acceptance gate: dispose on unmount path.
  useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);

  return material;
}
