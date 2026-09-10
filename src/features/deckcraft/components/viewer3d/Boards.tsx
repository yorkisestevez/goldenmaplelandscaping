// All decking boards — field + picture frame + herringbone — as ONE
// InstancedMesh sharing the swatch material: a single draw call regardless of
// board count. Real 0.25" gaps come from the row pitch in deckGeometry.

import React, { useMemo, useLayoutEffect, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BoardRun, FootprintPlan, getBoardRows, getPictureFrameRuns } from '../../lib/deckGeometry';
import { DeckData } from '../../types';
import { setBoxInstance, planYawRad } from './instancing';

const GAP = 0.25;
const BOARD_THICKNESS = 1;

/** Point-in-polygon (ray cast) — used to clip herringbone tiles. */
function inside(outline: { x: number; y: number }[], x: number, y: number): boolean {
  let odd = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) odd = !odd;
  }
  return odd;
}

/**
 * Herringbone, stated v1 approximation: a 45° zigzag grid of short boards with
 * alternating ±45° rotation, kept when the tile centre falls inside the
 * footprint. Ragged perimeter ends hide behind the fascia / border rows.
 */
function herringboneRuns(fp: FootprintPlan, boardWidth: number, inset: number): BoardRun[] {
  const runs: BoardRun[] = [];
  const seg = (boardWidth + GAP) * 3; // short-board length
  const pitch = (boardWidth + GAP) * Math.SQRT1_2 * 2;
  for (let row = 0, y = inset; y < fp.bounds.h - inset; y += pitch, row++) {
    for (let col = 0, x = inset + (row % 2 ? pitch / 2 : 0); x < fp.bounds.w - inset; x += pitch, col++) {
      if (!inside(fp.outline, x, y)) continue;
      runs.push({ cx: x, cy: y, length: seg, angleDeg: col % 2 ? 45 : -45 });
    }
  }
  return runs;
}

interface Props {
  data: DeckData;
  footprint: FootprintPlan;
  topY: number;
  material: THREE.MeshStandardMaterial;
}

export const Boards = React.memo(function Boards({ data, footprint, topY, material }: Props) {
  const invalidate = useThree(s => s.invalidate);
  const ref = useRef<THREE.InstancedMesh>(null);
  const boardWidth = Number(data.boardWidth) || 5.5;

  const runs = useMemo<BoardRun[]>(() => {
    const pfRows = data.pattern === 'Picture Frame' ? ((data.pictureFrameRows || 1) as 1 | 2) : 0;
    const fieldInset = pfRows * (boardWidth + GAP);
    const frame = pfRows ? getPictureFrameRuns(footprint, pfRows, boardWidth, GAP) : [];
    if (data.pattern === 'Herringbone') {
      return [...frame, ...herringboneRuns(footprint, boardWidth, fieldInset + boardWidth)];
    }
    const angle = data.pattern === 'Diagonal' ? 45 : 0;
    return [...frame, ...getBoardRows(footprint, { boardWidth, gap: GAP, angleDeg: angle, inset: fieldInset })];
  }, [data.pattern, data.pictureFrameRows, boardWidth, footprint]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      setBoxInstance(mesh, i, r.cx, topY - BOARD_THICKNESS / 2, r.cy, r.length, BOARD_THICKNESS, boardWidth, planYawRad(r.angleDeg));
    }
    mesh.count = runs.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [runs, topY, boardWidth, invalidate]);

  return (
    <instancedMesh castShadow receiveShadow
      key={runs.length} // instance buffer is fixed-size; remount when count changes
      ref={ref}
      args={[undefined, undefined, Math.max(1, runs.length)]}
      material={material}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
});
