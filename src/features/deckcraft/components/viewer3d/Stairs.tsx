// Stair flight from the deck edge to grade: instanced treads + two solid
// stringer wedges. Landing splits the flight with a mid-height platform and a
// 90-degree turn; Winder renders as Straight in v1 (footnoted in the UI).

import React, { useMemo, useLayoutEffect, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { StairPlacement } from '../../lib/deckGeometry';
import { DeckData } from '../../types';
import { setBoxInstance } from './instancing';

const TREAD_DEPTH = 11.5; // two 5.5" boards + gap
const TREAD_THICK = 1;

interface Tread { cx: number; cy: number; cz: number; len: number; w: number; yaw: number }

export const Stairs = React.memo(function Stairs({ data, stair, topY, woodMaterial, fasciaColor }: {
  data: DeckData;
  stair: StairPlacement;
  topY: number;
  woodMaterial: THREE.MeshStandardMaterial;
  fasciaColor: string;
}) {
  const invalidate = useThree(s => s.invalidate);

  const { treads, stringers } = useMemo(() => {
    const treads: Tread[] = [];
    const stringers: { x: number; z: number; yaw: number; rise: number; run: number }[] = [];
    const risers = Math.max(2, Math.round(topY / 7.5));
    const rise = topY / risers;
    const o = stair.origin;
    const out = stair.outward;
    const alongMidX = o.x + stair.along.x * (stair.width / 2);
    const alongMidZ = o.y + stair.along.y * (stair.width / 2);
    const yaw = -Math.atan2(out.y, out.x); // tread long axis is perpendicular to outward
    const isLanding = data.stairType === 'Landing' && risers >= 5;
    const split = isLanding ? Math.ceil(risers / 2) : risers;

    // Upper run: straight out from the deck edge
    for (let i = 1; i <= split; i++) {
      const dist = (i - 0.5) * TREAD_DEPTH;
      treads.push({
        cx: alongMidX + out.x * dist,
        cz: alongMidZ + out.y * dist,
        cy: topY - i * rise + TREAD_THICK / 2,
        len: stair.width, w: TREAD_DEPTH, yaw: yaw + Math.PI / 2,
      });
    }
    stringers.push({ x: alongMidX, z: alongMidZ, yaw, rise: topY, run: split * TREAD_DEPTH });

    if (isLanding) {
      // 36" landing platform, then the lower run turns 90° along the edge
      const landDist = split * TREAD_DEPTH + 18;
      const landY = topY - split * rise;
      treads.push({
        cx: alongMidX + out.x * landDist, cz: alongMidZ + out.y * landDist,
        cy: landY + TREAD_THICK / 2, len: 36, w: 36, yaw,
      });
      const turn = { x: stair.along.x, y: stair.along.y };
      for (let i = 1; i <= risers - split; i++) {
        const dist = 18 + (i - 0.5) * TREAD_DEPTH;
        treads.push({
          cx: alongMidX + out.x * landDist + turn.x * dist,
          cz: alongMidZ + out.y * landDist + turn.y * dist,
          cy: landY - i * rise + TREAD_THICK / 2,
          len: TREAD_DEPTH, w: 36, yaw,
        });
      }
    }
    return { treads, stringers };
  }, [data.stairType, stair, topY]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    treads.forEach((t, i) => setBoxInstance(mesh, i, t.cx, t.cy, t.cz, t.len, TREAD_THICK, t.w, t.yaw));
    mesh.count = treads.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [treads, invalidate]);

  // Stringer wedge: right triangle (rise x run), extruded to the stair width
  const stringerGeo = useMemo(() => {
    const s = stringers[0];
    if (!s) return null;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(s.run, -s.rise);
    shape.lineTo(0, -s.rise);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
    return geo;
  }, [stringers]);
  useEffect(() => () => stringerGeo?.dispose(), [stringerGeo]);

  const s0 = stringers[0];
  return (
    <group>
      <instancedMesh castShadow receiveShadow key={treads.length} ref={ref} args={[undefined, undefined, Math.max(1, treads.length)]} material={woodMaterial}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {stringerGeo && s0 && [0, 1].map(side => (
        <mesh castShadow receiveShadow
          key={side}
          geometry={stringerGeo}
          position={[
            stair.origin.x + stair.along.x * (side ? stair.width - 2 : 0),
            topY,
            stair.origin.y + stair.along.y * (side ? stair.width - 2 : 0),
          ]}
          rotation={[0, -Math.atan2(stair.outward.y, stair.outward.x), 0]}
        >
          <meshStandardMaterial color={fasciaColor} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
});
