import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameEngine } from '../game/engine/GameEngine';
import { BuildableId } from '../types/game';
import { ToonMesh, ToonRoundedBox } from './ToonMaterial';

export interface StructureModelProps {
  configId: BuildableId;
  level: number;
  modelPath?: string;
  engine?: GameEngine;
  entityId?: string;
  phaseOffset?: number;
}

function dampAngleShortest(current: number, target: number, lambda: number, delta: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((((target - current) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI;
  return current + diff * (1 - Math.exp(-lambda * delta));
}

export const ProceduralStructure: React.FC<Omit<StructureModelProps, 'modelPath'>> = ({
  configId,
  level,
  engine,
  entityId,
  phaseOffset = 0,
}) => {
  const spireRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Group>(null);
  const turretRef = useRef<THREE.Group>(null);
  const barrelRef = useRef<THREE.Group>(null);
  const craneRef = useRef<THREE.Group>(null);

  const smoothRecoil = useRef(0);
  const smoothYaw = useRef(0);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + phaseOffset;
    const visual = engine?.getVisualState();
    const targetRecoil = entityId && visual ? (visual.towerRecoilMap[entityId] ?? 0) : 0;
    const targetAngle = entityId && visual ? (visual.towerAngleMap[entityId] ?? 0) : 0;

    smoothRecoil.current = THREE.MathUtils.damp(smoothRecoil.current, targetRecoil, 18, delta);
    smoothYaw.current = dampAngleShortest(smoothYaw.current, -targetAngle, 14, delta);

    if (spireRef.current) {
      spireRef.current.position.y = -smoothRecoil.current * 0.08 + Math.sin(t * 2.2) * 0.015;
    }
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 1.25;
      crystalRef.current.position.y =
        0.88 + level * 0.05 + Math.sin(t * 3.1) * 0.065 + smoothRecoil.current * 0.08;
    }
    if (turretRef.current) turretRef.current.rotation.y = smoothYaw.current;
    if (barrelRef.current) barrelRef.current.position.x = -smoothRecoil.current * 0.14;
    if (craneRef.current) craneRef.current.rotation.y = Math.sin(t * 1.4) * 0.18;
  });

  const tierBoost = (level - 1) * 0.06;

  switch (configId) {
    case 'archer_spire': {
      const shaftH = 0.58 + tierBoost;
      return (
        <group ref={spireRef}>
          <ToonRoundedBox args={[0.7, 0.24, 0.7]} radius={0.018} smoothness={1} color="#b5a68e" position={[0, 0.12, 0]} />
          <ToonRoundedBox args={[0.42, shaftH, 0.42]} radius={0.015} smoothness={1} color="#b87d3e" position={[0, 0.24 + shaftH * 0.5, 0]} />
          <ToonRoundedBox args={[0.56, 0.1, 0.56]} radius={0.015} smoothness={1} color="#8c5a2b" position={[0, 0.24 + shaftH + 0.05, 0]} />
          {[[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]].map(([x, z], idx) => (
            <ToonRoundedBox
              key={idx}
              args={[0.12, 0.09, 0.12]}
              radius={0.01}
              smoothness={1}
              color="#7a4e24"
              position={[x, 0.24 + shaftH + 0.145, z]}
              outlineThickness={0.016}
            />
          ))}
          <ToonMesh color="#c94a38" position={[0, 0.24 + shaftH + 0.34, 0]} flatShading>
            <coneGeometry args={[0.4, 0.48, 6]} />
          </ToonMesh>
        </group>
      );
    }

    case 'frost_obelisk': {
      const colH = 0.48 + tierBoost;
      return (
        <group>
          <ToonMesh color="#4a525a" position={[0, 0.1, 0]} flatShading>
            <cylinderGeometry args={[0.38, 0.44, 0.2, 6]} />
          </ToonMesh>
          <ToonMesh color="#363c42" position={[0, 0.2 + colH * 0.5, 0]} rotation={[0, Math.PI * 0.25, 0]} flatShading>
            <cylinderGeometry args={[0.13, 0.23, colH, 4]} />
          </ToonMesh>
          {[[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].map(([x, z], idx) => (
            <ToonRoundedBox
              key={idx}
              args={[0.1, 0.26, 0.1]}
              radius={0.01}
              smoothness={1}
              color="#59636d"
              position={[x, 0.33, z]}
              outlineThickness={0.016}
            />
          ))}
          <group ref={crystalRef} position={[0, 0.88 + tierBoost, 0]}>
            <ToonMesh color="#38b6d4" emissive="#258ca6" emissiveIntensity={0.35} scale={[0.85, 1.35, 0.85]} flatShading>
              <octahedronGeometry args={[0.2, 0]} />
            </ToonMesh>
          </group>
        </group>
      );
    }

    case 'cannon_bastion': {
      const baseH = 0.42 + tierBoost;
      return (
        <group>
          <ToonMesh color="#363c42" position={[0, baseH * 0.5, 0]} flatShading>
            <cylinderGeometry args={[0.42, 0.48, baseH, 8]} />
          </ToonMesh>
          <ToonMesh color="#5b636b" position={[0, baseH + 0.06, 0]} flatShading>
            <cylinderGeometry args={[0.36, 0.38, 0.12, 8]} />
          </ToonMesh>
          {[
            [-0.24, -0.24, Math.PI * 0.25],
            [0.24, -0.24, -Math.PI * 0.25],
            [-0.24, 0.24, -Math.PI * 0.25],
            [0.24, 0.24, Math.PI * 0.25],
          ].map(([x, z, rotY], idx) => (
            <ToonRoundedBox
              key={idx}
              args={[0.14, 0.09, 0.12]}
              radius={0.01}
              smoothness={1}
              color="#6a737d"
              position={[x, baseH + 0.155, z]}
              rotation={[0, rotY, 0]}
              outlineThickness={0.016}
            />
          ))}
          <group ref={turretRef} position={[0, baseH + 0.2, 0]}>
            <ToonRoundedBox args={[0.24, 0.12, 0.24]} radius={0.015} smoothness={1} color="#5e4026" position={[0, -0.02, 0]} outlineThickness={0.016} />
            <group ref={barrelRef}>
              <ToonMesh color="#262b30" position={[0.16, 0.04, 0]} rotation={[0, 0, -Math.PI * 0.42]} metalness={0.22} roughness={0.55} flatShading>
                <cylinderGeometry args={[0.095, 0.125, 0.52, 8]} />
              </ToonMesh>
              <ToonMesh color="#e5a93c" position={[0.4, 0.1, 0]} rotation={[0, 0, -Math.PI * 0.42]} outlineThickness={0.016} metalness={0.35} roughness={0.4} flatShading>
                <cylinderGeometry args={[0.112, 0.112, 0.07, 8]} />
              </ToonMesh>
            </group>
          </group>
        </group>
      );
    }

    case 'quarry_mine':
      return (
        <group>
          <ToonRoundedBox args={[0.5, 0.44, 0.54]} radius={0.018} smoothness={1} color="#d4a96a" position={[-0.08, 0.22, 0]} />
          <ToonMesh color="#a86428" position={[-0.08, 0.59, 0]} rotation={[0, Math.PI * 0.25, 0]} flatShading>
            <coneGeometry args={[0.41, 0.3, 4]} />
          </ToonMesh>
          <ToonMesh color="#6f7780" position={[0.26, 0.11, -0.22]} rotation={[0.3, 0.6, 0.2]} flatShading outlineThickness={0.016}>
            <dodecahedronGeometry args={[0.13, 0]} />
          </ToonMesh>
          <group ref={craneRef} position={[0.2, 0.1, 0.12]}>
            <ToonRoundedBox args={[0.07, 0.56, 0.07]} radius={0.012} smoothness={1} color="#6e4720" position={[0, 0.28, 0]} outlineThickness={0.016} />
            <ToonRoundedBox args={[0.32, 0.06, 0.06]} radius={0.012} smoothness={1} color="#6e4720" position={[0.12, 0.52, 0]} rotation={[0, 0, -0.3]} outlineThickness={0.016} />
            <ToonRoundedBox args={[0.16, 0.14, 0.16]} radius={0.015} smoothness={1} color="#ebae34" position={[0.22, 0.32, 0]} outlineThickness={0.016} />
          </group>
        </group>
      );

    case 'aether_conduit':
      return (
        <group>
          <ToonMesh color="#4a525a" position={[0, 0.14, 0]} flatShading>
            <cylinderGeometry args={[0.42, 0.46, 0.28, 6]} />
          </ToonMesh>
          {[[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].map(([x, z], idx) => (
            <ToonRoundedBox key={idx} args={[0.1, 0.32, 0.1]} radius={0.012} smoothness={1} color="#66707a" position={[x, 0.24, z]} outlineThickness={0.015} />
          ))}
          <ToonMesh color="#38b6d4" emissive="#2d99b5" emissiveIntensity={0.35} position={[0, 0.29, 0]} flatShading showOutline={false}>
            <cylinderGeometry args={[0.31, 0.31, 0.03, 6]} />
          </ToonMesh>
          <group ref={crystalRef} position={[0, 0.72, 0]}>
            <ToonMesh color="#5cd3ec" emissive="#2d99b5" emissiveIntensity={0.38}>
              <sphereGeometry args={[0.16, 24, 18]} />
            </ToonMesh>
          </group>
        </group>
      );

    case 'storage_vault': {
      const h = 0.44 + tierBoost;
      return (
        <group>
          <ToonRoundedBox args={[0.68, h, 0.62]} radius={0.018} smoothness={1} color="#d6c7ae" position={[0, h * 0.5, 0]} />
          <ToonRoundedBox args={[0.71, 0.07, 0.65]} radius={0.01} smoothness={1} color="#4a525a" position={[0, h * 0.62, 0]} outlineThickness={0.015} />
          <ToonMesh color="#c94a38" position={[0, h + 0.18, 0]} rotation={[0, Math.PI * 0.25, 0]} flatShading>
            <coneGeometry args={[0.48, 0.36, 4]} />
          </ToonMesh>
          <ToonRoundedBox args={[0.18, 0.22, 0.06]} radius={0.012} smoothness={1} color="#ebae34" position={[0, 0.15, 0.33]} outlineThickness={0.015} />
        </group>
      );
    }
  }
};
