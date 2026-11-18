import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ENEMY_CONFIGS } from '../game/config';
import { GameEngine } from '../game/engine/GameEngine';
import { EnemyInstance, ProjectileInstance } from '../types/game';
import { EnemyModelWrapper } from './ModelWrapper';
import { dampCoords } from './SceneEffects3D';
import { NOOP_RAYCAST, gridToWorld } from './ToonMaterial';

export { DriftingClouds3D, FloatingTextSprite3D, ParticleNode3D } from './SceneEffects3D';

export const EnemyNode3D: React.FC<{ engine: GameEngine; enemySnapshot: EnemyInstance }> = ({
  engine,
  enemySnapshot,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const hpBarGroupRef = useRef<THREE.Group>(null);
  const hpFillRef = useRef<THREE.Mesh>(null);
  const prevPosRef = useRef<{ x: number; z: number } | null>(null);
  const smoothPosRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const smoothYawRef = useRef(0);

  const [statusState, setStatusState] = useState({
    chilled: false,
    flashing: false,
    showHp: enemySnapshot.hp < enemySnapshot.maxHp,
  });
  const cfg = ENEMY_CONFIGS[enemySnapshot.configId];

  useFrame(({ camera, clock }, delta) => {
    const live = engine.getEnemies().find((e) => e.id === enemySnapshot.id);
    if (!live || !groupRef.current) return;

    const nowMs = Date.now();
    const hop = Math.abs(Math.sin(live.totalDistanceTraveled * 5.2)) * 0.13;
    const [tx, , tz] = gridToWorld(live.col, live.row, 0);
    const ty = -0.04 + hop;

    if (!smoothPosRef.current) {
      smoothPosRef.current = { x: tx, y: ty, z: tz };
    } else {
      dampCoords(smoothPosRef.current, tx, ty, tz, 18, delta);
    }

    groupRef.current.position.set(smoothPosRef.current.x, smoothPosRef.current.y, smoothPosRef.current.z);

    if (prevPosRef.current && bodyRef.current) {
      const dx = tx - prevPosRef.current.x;
      const dz = tz - prevPosRef.current.z;
      if (dx * dx + dz * dz > 0.00001) {
        const targetYaw = Math.atan2(dx, dz);
        const twoPi = Math.PI * 2;
        const diff = ((((targetYaw - smoothYawRef.current) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI;
        smoothYawRef.current += diff * (1 - Math.exp(-12 * delta));
        bodyRef.current.rotation.y = smoothYawRef.current;
      }
      const breath = 1 + Math.sin(clock.elapsedTime * 5 + live.totalDistanceTraveled) * 0.035;
      bodyRef.current.scale.set(1, breath, 1);
      bodyRef.current.rotation.z = Math.sin(live.totalDistanceTraveled * 6) * 0.06;
    }
    prevPosRef.current = { x: tx, z: tz };

    const chilled = live.slowUntilMs > nowMs;
    const flashing = live.hitFlashUntilMs > nowMs;
    const showHp = live.hp < live.maxHp || Boolean(cfg.isBoss);

    if (hpBarGroupRef.current) hpBarGroupRef.current.quaternion.copy(camera.quaternion);
    if (hpFillRef.current) {
      const ratio = Math.max(0.001, Math.min(1, live.hp / live.maxHp));
      const barWidth = cfg.isBoss ? 0.85 : 0.46;
      hpFillRef.current.scale.set(ratio, 1, 1);
      hpFillRef.current.position.x = -barWidth * 0.5 * (1 - ratio);
    }

    if (chilled !== statusState.chilled || flashing !== statusState.flashing || showHp !== statusState.showHp) {
      setStatusState({ chilled, flashing, showHp });
    }
  });

  const initPos = gridToWorld(enemySnapshot.col, enemySnapshot.row, -0.04);
  const barWidth = cfg.isBoss ? 0.85 : 0.46;

  return (
    <group ref={groupRef} position={initPos}>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
        <circleGeometry args={[0.24 * cfg.scale, 24]} />
        <meshBasicMaterial color={statusState.chilled ? '#5ba4b5' : '#2b2623'} transparent opacity={0.26} />
      </mesh>
      <group ref={bodyRef}>
        <EnemyModelWrapper
          configId={cfg.id}
          modelPath={cfg.modelPath}
          scale={cfg.scale}
          primaryColor={cfg.primaryColor}
          secondaryColor={cfg.secondaryColor}
          isBoss={cfg.isBoss}
          isChilled={statusState.chilled}
          isFlashing={statusState.flashing}
        />
      </group>
      {statusState.showHp && (
        <group ref={hpBarGroupRef} position={[0, 0.84 * cfg.scale, 0]}>
          <mesh position={[0, 0, -0.005]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[barWidth + 0.06, 0.12]} />
            <meshBasicMaterial color="#2b2623" />
          </mesh>
          <mesh position={[0, 0, 0]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[barWidth, 0.08]} />
            <meshBasicMaterial color="#e7dcc8" />
          </mesh>
          <mesh ref={hpFillRef} position={[0, 0, 0.005]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[barWidth, 0.08]} />
            <meshBasicMaterial color={cfg.isBoss ? '#d4743b' : '#c86446'} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export const ProjectileNode3D: React.FC<{ engine: GameEngine; projSnapshot: ProjectileInstance }> = ({
  engine,
  projSnapshot,
}) => {
  const airRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const smoothPosRef = useRef<THREE.Vector3 | null>(null);
  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dirVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const live = engine.getProjectiles().find((p) => p.id === projSnapshot.id);
    if (!live || !airRef.current || !shadowRef.current) return;

    const t = Math.min(1, Math.max(0, live.progress));
    const curCol = live.startCol + (live.targetCol - live.startCol) * t;
    const curRow = live.startRow + (live.targetRow - live.startRow) * t;
    const ty = 0.72 * (1 - t) + Math.sin(t * Math.PI) * live.arcHeight;
    const [tx, , tz] = gridToWorld(curCol, curRow, 0);

    if (!smoothPosRef.current) {
      smoothPosRef.current = new THREE.Vector3(tx, ty, tz);
    } else {
      dampCoords(smoothPosRef.current, tx, ty, tz, 28, delta);
    }

    airRef.current.position.copy(smoothPosRef.current);
    shadowRef.current.position.set(smoothPosRef.current.x, 0.02, smoothPosRef.current.z);

    if (live.type === 'arrow') {
      const t2 = Math.min(1, t + 0.04);
      const y2 = 0.72 * (1 - t2) + Math.sin(t2 * Math.PI) * live.arcHeight;
      const [wx2, , wz2] = gridToWorld(
        live.startCol + (live.targetCol - live.startCol) * t2,
        live.startRow + (live.targetRow - live.startRow) * t2,
        0,
      );
      dirVec.set(wx2 - tx, y2 - ty, wz2 - tz);
      if (dirVec.lengthSq() > 0.00001) {
        dirVec.normalize();
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(upVec, dirVec);
        airRef.current.quaternion.slerp(targetQuat, 1 - Math.exp(-24 * delta));
      }
    }
  });

  const initPos = gridToWorld(projSnapshot.startCol, projSnapshot.startRow, 0.72);
  const isCannon = projSnapshot.type === 'cannonball';

  return (
    <group>
      <mesh ref={shadowRef} position={[initPos[0], 0.02, initPos[2]]} rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
        <circleGeometry args={[isCannon ? 0.16 : 0.09, 24]} />
        <meshBasicMaterial color="#2b2623" transparent opacity={0.25} />
      </mesh>
      <mesh ref={airRef} position={initPos} castShadow raycast={NOOP_RAYCAST}>
        {isCannon ? <sphereGeometry args={[0.14, 24, 18]} /> : <coneGeometry args={[0.045, 0.34, 24]} />}
        <meshStandardMaterial color={isCannon ? '#3d4349' : '#f4e4c1'} roughness={0.45} metalness={isCannon ? 0.3 : 0.05} />
      </mesh>
    </group>
  );
};
