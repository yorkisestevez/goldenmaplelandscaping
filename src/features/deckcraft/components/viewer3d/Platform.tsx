// The deck slab: footprint polygon extruded into a rim-joist-deep platform.
// Sides double as fascia (darker tint of the board colour) and mask the
// ragged board ends of diagonal/herringbone fields at the perimeter.

import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { FootprintPlan } from '../../lib/deckGeometry';

export const SLAB_THICKNESS = 10.5; // 9.5" joist look + 1" decking

interface Props {
  footprint: FootprintPlan;
  /** Top-of-decking height, inches. */
  topY: number;
  boardColor: string;
}

export const Platform = React.memo(function Platform({ footprint, topY, boardColor }: Props) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    footprint.outline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: SLAB_THICKNESS, bevelEnabled: false });
    // Shape (x, y) + extrude z → rotateX(90°) lands at world (x, -z_extrude, y):
    // plan y becomes world z, and the slab body hangs below its top face.
    geo.rotateX(Math.PI / 2);
    return geo;
  }, [footprint]);

  const material = useMemo(() => {
    const fascia = new THREE.Color(boardColor).multiplyScalar(0.55);
    return new THREE.MeshStandardMaterial({ color: fascia, roughness: 0.9 });
  }, [boardColor]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Slab top sits 1" below topY — that inch is the board layer, so the board
  // instances never z-fight the slab's top face.
  return <mesh castShadow receiveShadow geometry={geometry} material={material} position={[0, topY - 1, 0]} />;
});
