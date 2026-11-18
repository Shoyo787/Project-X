import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameEngine } from '../game/engine/GameEngine';
import { ParticleInstance } from '../types/game';
import { NOOP_RAYCAST, gridToWorld } from './ToonMaterial';

export function dampCoords(
  cur: { x: number; y: number; z: number },
  tx: number,
  ty: number,
  tz: number,
  lambda: number,
  delta: number,
): void {
  cur.x = THREE.MathUtils.damp(cur.x, tx, lambda, delta);
  cur.y = THREE.MathUtils.damp(cur.y, ty, lambda, delta);
  cur.z = THREE.MathUtils.damp(cur.z, tz, lambda, delta);
}

const CLOUD_LOBES: {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: [number, number, number];
  radius: number;
  color: string;
}[] = [
  { pos: [0, 0, 0], rot: [0.2, 0.4, 0.1], scale: [1.15, 0.85, 0.95], radius: 0.92, color: '#fcf8ef' },
  { pos: [-0.76, -0.14, 0.12], rot: [-0.3, 0.8, 0.2], scale: [1.0, 0.82, 0.9], radius: 0.68, color: '#f3ead8' },
  { pos: [0.78, -0.16, -0.1], rot: [0.4, -0.5, 0.3], scale: [1.05, 0.84, 0.92], radius: 0.72, color: '#e9dec8' },
];

export const DriftingClouds3D: React.FC<{ engine: GameEngine }> = ({ engine }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const clouds = engine.getClouds();
    groupRef.current.children.forEach((child, i) => {
      const c = clouds[i];
      if (!c) return;
      child.position.set((c.x - 0.5) * 28, 3.2 + (i % 2) * 1.4, (c.y - 0.5) * 18 - 6);
      child.scale.setScalar(c.scale);
    });
  });

  return (
    <group ref={groupRef}>
      {engine.getClouds().map((c, idx) => (
        <group key={idx} position={[(c.x - 0.5) * 28, 3.2 + (idx % 2) * 1.4, (c.y - 0.5) * 18 - 6]}>
          {CLOUD_LOBES.map((lobe, lobeIdx) => (
            <mesh key={lobeIdx} position={lobe.pos} rotation={lobe.rot} scale={lobe.scale} raycast={NOOP_RAYCAST}>
              <dodecahedronGeometry args={[lobe.radius, 0]} />
              <meshStandardMaterial color={lobe.color} roughness={0.9} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

export const ParticleNode3D: React.FC<{ engine: GameEngine; particleSnapshot: ParticleInstance }> = ({
  engine,
  particleSnapshot,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const live = engine.getParticles().find((p) => p.id === particleSnapshot.id);
    if (!live || !meshRef.current) return;
    const lifeRatio = Math.max(0.05, 1 - live.ageSec / live.lifetimeSec);
    const [wx, , wz] = gridToWorld(live.col, live.row, 0);

    if (live.kind === 'frost_ring') {
      meshRef.current.position.set(wx, 0.04, wz);
      meshRef.current.scale.setScalar(live.radius);
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = lifeRatio * 0.75;
    } else {
      meshRef.current.position.set(wx, live.z * 0.8 + 0.08, wz);
      meshRef.current.scale.setScalar(lifeRatio * (live.radius * 0.024));
    }
  });

  const initPos = gridToWorld(
    particleSnapshot.col,
    particleSnapshot.row,
    particleSnapshot.kind === 'frost_ring' ? 0.04 : particleSnapshot.z * 0.8 + 0.08,
  );

  if (particleSnapshot.kind === 'frost_ring') {
    return (
      <mesh ref={meshRef} position={initPos} rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
        <ringGeometry args={[0.88, 1.0, 48]} />
        <meshBasicMaterial color="#7ed3e6" transparent opacity={0.75} />
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} position={initPos} raycast={NOOP_RAYCAST}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={particleSnapshot.color} />
    </mesh>
  );
};

function createFloatingTextTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2b2623';
    ctx.lineWidth = 7;
    ctx.strokeText(text, 128, 32);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const FloatingTextSprite3D: React.FC<{
  engine: GameEngine;
  id: string;
  text: string;
  color: string;
  initCol: number;
  initRow: number;
  initZ: number;
}> = ({ engine, id, text, color, initCol, initRow, initZ }) => {
  const spriteRef = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => createFloatingTextTexture(text, color), [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    const live = engine.getFloatingTexts().find((ft) => ft.id === id);
    if (!live || !spriteRef.current) return;
    const lifeRatio = Math.max(0, 1 - live.ageSec / live.lifetimeSec);
    const [wx, , wz] = gridToWorld(live.col, live.row, 0);
    dampCoords(spriteRef.current.position, wx, live.z * 0.75 + 0.55, wz, 16, delta);
    (spriteRef.current.material as THREE.SpriteMaterial).opacity = Math.min(1, lifeRatio * 1.4);
  });

  const initPos = gridToWorld(initCol, initRow, initZ * 0.75 + 0.55);
  return (
    <sprite ref={spriteRef} position={initPos} scale={[1.8, 0.45, 1]} raycast={NOOP_RAYCAST}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
};
