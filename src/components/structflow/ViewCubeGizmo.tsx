'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useGizmoContext } from '@react-three/drei';
import * as THREE from 'three';

const FACE_SIZE = 1;
const HALF = FACE_SIZE / 2;

const FACES: {
  pos: [number, number, number];
  rot: [number, number, number];
  label: string;
  dir: [number, number, number];
}[] = [
  { pos: [0, 0, HALF], rot: [0, 0, 0], label: 'Ön', dir: [0, 0, 1] },
  { pos: [0, 0, -HALF], rot: [0, Math.PI, 0], label: 'Arka', dir: [0, 0, -1] },
  {
    pos: [0, HALF, 0],
    rot: [-Math.PI / 2, 0, 0],
    label: 'Üst',
    dir: [0, 1, 0],
  },
  {
    pos: [0, -HALF, 0],
    rot: [Math.PI / 2, 0, 0],
    label: 'Alt',
    dir: [0, -1, 0],
  },
  { pos: [HALF, 0, 0], rot: [0, Math.PI / 2, 0], label: 'Sağ', dir: [1, 0, 0] },
  {
    pos: [-HALF, 0, 0],
    rot: [0, -Math.PI / 2, 0],
    label: 'Sol',
    dir: [-1, 0, 0],
  },
];

function createFaceTexture(label: string, hovered: boolean): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = hovered ? '#1e293b' : '#0c1220';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = hovered ? '#e2e8f0' : '#94a3b8';
  ctx.font = `bold ${label.length > 3 ? 22 : 28}px -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export default function ViewCubeGizmo() {
  const [hovered, setHovered] = useState<string | null>(null);
  const { tweenCamera } = useGizmoContext();

  return (
    <group scale={[60, 60, 60]}>
      {FACES.map(({ pos, rot, label, dir }) => {
        const isHovered = hovered === label;
        return <CubeFace key={label} pos={pos} rot={rot} label={label} dir={dir} hovered={isHovered} setHovered={setHovered} tweenCamera={tweenCamera} />;
      })}
      <mesh>
        <boxGeometry args={[FACE_SIZE, FACE_SIZE, FACE_SIZE]} />
        <meshBasicMaterial color="#334155" wireframe transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CubeFace({
  pos,
  rot,
  label,
  dir,
  hovered,
  setHovered,
  tweenCamera,
}: {
  pos: [number, number, number];
  rot: [number, number, number];
  label: string;
  dir: [number, number, number];
  hovered: boolean;
  setHovered: (label: string | null) => void;
  tweenCamera: (direction: THREE.Vector3) => void;
}) {
  const texture = useMemo(() => createFaceTexture(label, hovered), [label, hovered]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={pos} rotation={rot}>
      <mesh
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(label);
        }}
        onPointerLeave={() => setHovered(null)}
        onClick={(e) => {
          e.stopPropagation();
          tweenCamera(new THREE.Vector3(...dir));
        }}
      >
        <planeGeometry args={[FACE_SIZE, FACE_SIZE]} />
        <meshBasicMaterial map={texture} transparent opacity={hovered ? 0.95 : 0.8} side={THREE.FrontSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
