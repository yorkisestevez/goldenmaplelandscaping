// Support structure under an elevated deck: 6x6 posts inset from the
// perimeter (spacing <= 6 ft), with per-foundation-type footings at grade —
// concrete pier, helical pile cap, or deck block. Two instanced meshes total.

import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { FootprintPlan } from '../../lib/deckGeometry';
import { DeckData } from '../../types';
import { setBoxInstance } from './instancing';
import { SLAB_THICKNESS } from './Platform';

const POST = 5.5; // 6x6 nominal
const INSET = 12;

export const Foundation = React.memo(function Foundation({ data, footprint, topY }: {
  data: DeckData;
  footprint: FootprintPlan;
  topY: number;
}) {
  const invalidate = useThree(s => s.invalidate);
  const postTop = topY - 1 - SLAB_THICKNESS;

  const points = useMemo(() => {
    if (postTop < 8) return []; // low/floating deck — blocks sit under the rim, skip posts
    // Corner points inset toward the centroid + intermediates on long edges
    const pts: { x: number; z: number }[] = [];
    const o = footprint.outline;
    let cx = 0, cy = 0;
    o.forEach(p => { cx += p.x; cy += p.y; });
    cx /= o.length; cy /= o.length;
    const push = (x: number, z: number) => {
      if (!pts.some(p => Math.hypot(p.x - x, p.z - z) < 24)) pts.push({ x, z });
    };
    for (let i = 0; i < o.length; i++) {
      const a = o[i];
      const b = o[(i + 1) % o.length];
      const da = Math.hypot(cx - a.x, cy - a.y) || 1;
      push(a.x + ((cx - a.x) / da) * INSET, a.y + ((cy - a.y) / da) * INSET);
      const elen = Math.hypot(b.x - a.x, b.y - a.y);
      const mids = Math.floor(elen / 72);
      for (let m = 1; m <= mids; m++) {
        const t = m / (mids + 1);
        const mxp = a.x + (b.x - a.x) * t;
        const myp = a.y + (b.y - a.y) * t;
        const dm = Math.hypot(cx - mxp, cy - myp) || 1;
        push(mxp + ((cx - mxp) / dm) * INSET, myp + ((cy - myp) / dm) * INSET);
      }
    }
    return pts;
  }, [footprint, postTop]);

  const postRef = useRef<THREE.InstancedMesh>(null);
  const footRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const posts = postRef.current;
    const feet = footRef.current;
    if (posts) {
      points.forEach((p, i) => setBoxInstance(posts, i, p.x, postTop / 2, p.z, POST, Math.max(postTop, 1), POST));
      posts.count = points.length;
      posts.instanceMatrix.needsUpdate = true;
      posts.computeBoundingSphere();
    }
    if (feet) {
      const h = data.foundation === 'Concrete Piers' ? 6 : data.foundation === 'Deck Blocks' ? 8 : 2;
      points.forEach((p, i) => setBoxInstance(feet, i, p.x, h / 2, p.z,
        data.foundation === 'Helical Piles' ? 8 : 10, h, data.foundation === 'Helical Piles' ? 8 : 10));
      feet.count = points.length;
      feet.instanceMatrix.needsUpdate = true;
      feet.computeBoundingSphere();
    }
    invalidate();
  }, [points, postTop, data.foundation, invalidate]);

  if (points.length === 0) return null;
  const footingColor = data.foundation === 'Helical Piles' ? '#334155' : '#9aa3ab';

  return (
    <group>
      <instancedMesh castShadow receiveShadow key={`po${points.length}`} ref={postRef} args={[undefined, undefined, points.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6b5b45" roughness={0.9} />
      </instancedMesh>
      <instancedMesh castShadow receiveShadow key={`ft${points.length}`} ref={footRef} args={[undefined, undefined, points.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={footingColor} roughness={0.85} />
      </instancedMesh>
    </group>
  );
});
