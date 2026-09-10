// Railing per family: instanced posts + top/bottom rails on every rail
// segment, then family-specific infill — pickets (wood/metal), 4-run cable,
// or translucent glass panels. Segments already skip the stair opening and
// the house edge (deckGeometry.getRailingSegments).

import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { RailSegment } from '../../lib/deckGeometry';
import { DeckData, RAILING_COSTS, RailingType } from '../../types';
import { setBoxInstance } from './instancing';

const WOOD_FAMILY = new Set<RailingType>(['Wood Picket', 'Trex Select', 'Trex Transcend']);
const POST = 3.5; // 4x4 nominal
const RAIL_H_STD = 36;
const RAIL_H_TALL = 42; // OBC: decks over 70" above grade

interface Bar { cx: number; cz: number; len: number; yaw: number; cy: number; h: number; w: number }

export const Railing = React.memo(function Railing({ data, segments, topY, heightIn, woodMaterial }: {
  data: DeckData;
  segments: RailSegment[];
  topY: number;
  heightIn: number;
  woodMaterial: THREE.MeshStandardMaterial;
}) {
  const invalidate = useThree(s => s.invalidate);
  const railH = heightIn > 70 ? RAIL_H_TALL : RAIL_H_STD;
  const type = data.railingType;

  const { frame, infill, panels } = useMemo(() => {
    const frame: Bar[] = [];
    const infill: Bar[] = [];
    const panels: Bar[] = [];
    if (type === 'None') return { frame, infill, panels };
    const spacingIn = ((RAILING_COSTS as any)[type]?.spacing ?? 6) * 12;
    const postSeen = new Set<string>();

    const post = (x: number, z: number) => {
      const key = `${Math.round(x)}|${Math.round(z)}`; // dedupe shared corners
      if (postSeen.has(key)) return;
      postSeen.add(key);
      frame.push({ cx: x, cz: z, len: POST, yaw: 0, cy: topY + railH / 2, h: railH, w: POST });
    };

    for (const s of segments) {
      const dx = s.b.x - s.a.x;
      const dy = s.b.y - s.a.y;
      const len = Math.hypot(dx, dy);
      if (len < 6) continue;
      const yaw = -Math.atan2(dy, dx);
      const mx = (s.a.x + s.b.x) / 2;
      const mz = (s.a.y + s.b.y) / 2;

      // Posts at both ends + intermediates at the family's spacing
      const bays = Math.max(1, Math.ceil(len / spacingIn));
      for (let i = 0; i <= bays; i++) {
        const t = i / bays;
        post(s.a.x + dx * t, s.a.y + dy * t);
      }

      // Top + bottom rails
      frame.push({ cx: mx, cz: mz, len, yaw, cy: topY + railH - 1.25, h: 2.5, w: 2 });
      frame.push({ cx: mx, cz: mz, len, yaw, cy: topY + 3, h: 2, w: 1.5 });

      if (type === 'Cable') {
        for (let c = 1; c <= 4; c++) {
          infill.push({ cx: mx, cz: mz, len, yaw, cy: topY + 3 + c * ((railH - 6) / 5), h: 0.35, w: 0.35 });
        }
      } else if (type === 'Glass Panels') {
        for (let i = 0; i < bays; i++) {
          const t0 = i / bays;
          const t1 = (i + 1) / bays;
          const bl = len / bays - POST - 1;
          if (bl < 6) continue;
          panels.push({
            cx: s.a.x + dx * ((t0 + t1) / 2), cz: s.a.y + dy * ((t0 + t1) / 2),
            len: bl, yaw, cy: topY + 3 + (railH - 6) / 2, h: railH - 8, w: 0.5,
          });
        }
      } else {
        // Picket families — 4" clear opening code rule drives the pitch
        const pw = WOOD_FAMILY.has(type) ? 1.5 : 0.75;
        const pitch = pw + 3.9;
        const count = Math.floor(len / pitch);
        for (let i = 1; i < count; i++) {
          const t = i / count;
          infill.push({ cx: s.a.x + dx * t, cz: s.a.y + dy * t, len: pw, yaw, cy: topY + railH / 2, h: railH - 8, w: pw });
        }
      }
    }
    return { frame, infill, panels };
  }, [type, segments, topY, railH]);

  const metalColor = type === 'Cable' ? '#94a3b8' : '#1e293b';
  const useWood = WOOD_FAMILY.has(type);

  const frameRef = useRef<THREE.InstancedMesh>(null);
  const infillRef = useRef<THREE.InstancedMesh>(null);
  const panelRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    for (const [ref, bars] of [[frameRef, frame], [infillRef, infill], [panelRef, panels]] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      bars.forEach((b, i) => setBoxInstance(mesh, i, b.cx, b.cy, b.cz, b.len, b.h, b.w, b.yaw));
      mesh.count = bars.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    invalidate();
  }, [frame, infill, panels, invalidate]);

  if (type === 'None' || segments.length === 0) return null;

  return (
    <group>
      <instancedMesh castShadow receiveShadow key={`f${frame.length}`} ref={frameRef} args={[undefined, undefined, Math.max(1, frame.length)]}
        material={useWood ? woodMaterial : undefined}>
        <boxGeometry args={[1, 1, 1]} />
        {!useWood && <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.4} />}
      </instancedMesh>
      {infill.length > 0 && (
        <instancedMesh castShadow receiveShadow key={`i${infill.length}`} ref={infillRef} args={[undefined, undefined, infill.length]}
          material={useWood ? woodMaterial : undefined}>
          <boxGeometry args={[1, 1, 1]} />
          {!useWood && <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.25} />}
        </instancedMesh>
      )}
      {panels.length > 0 && (
        <instancedMesh castShadow receiveShadow key={`p${panels.length}`} ref={panelRef} args={[undefined, undefined, panels.length]}>
          <boxGeometry args={[1, 1, 1]} />
          {/* Simple alpha reads as glass at this scale — no transmission pass
              (too costly for mid phones, per the perf gate). */}
          <meshPhysicalMaterial transparent opacity={0.22} roughness={0.05} metalness={0} color="#bae6fd" />
        </instancedMesh>
      )}
    </group>
  );
});
