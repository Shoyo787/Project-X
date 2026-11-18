import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILDING_CONFIGS, TOWER_CONFIGS, isTowerId } from '../game/config';
import { GameEngine } from '../game/engine/GameEngine';
import { formatDurationShort } from '../game/utils/format';
import { GridCoord, PlacedEntity } from '../types/game';
import { ModelWrapper } from './ModelWrapper';
import { NOOP_RAYCAST, ToonRoundedBox, gridToWorld } from './ToonMaterial';

const WoodenScaffolding3D: React.FC = () => {
  return (
    <group>
      {[
        [-0.36, -0.36],
        [0.36, -0.36],
        [-0.36, 0.36],
        [0.36, 0.36],
      ].map(([x, z], idx) => (
        <ToonRoundedBox
          key={idx}
          args={[0.06, 1.0, 0.06]}
          radius={0.01}
          smoothness={1}
          color="#9c6d3b"
          position={[x, 0.5, z]}
          outlineThickness={0.015}
          disableRaycast
        />
      ))}
      {[0.32, 0.72].map((y, idx) => (
        <group key={idx} position={[0, y, 0]}>
          <ToonRoundedBox args={[0.76, 0.05, 0.05]} radius={0.01} smoothness={1} color="#7a5832" position={[0, 0, 0.36]} outlineThickness={0.012} disableRaycast />
          <ToonRoundedBox args={[0.76, 0.05, 0.05]} radius={0.01} smoothness={1} color="#7a5832" position={[0, 0, -0.36]} outlineThickness={0.012} disableRaycast />
          <ToonRoundedBox args={[0.05, 0.05, 0.76]} radius={0.01} smoothness={1} color="#7a5832" position={[-0.36, 0, 0]} outlineThickness={0.012} disableRaycast />
          <ToonRoundedBox args={[0.05, 0.05, 0.76]} radius={0.01} smoothness={1} color="#7a5832" position={[0.36, 0, 0]} outlineThickness={0.012} disableRaycast />
        </group>
      ))}
    </group>
  );
};

interface EntityStatusHtmlProps {
  entity: PlacedEntity;
  nowMs: number;
  portal: React.RefObject<HTMLDivElement>;
}

const EntityStatusHtml: React.FC<EntityStatusHtmlProps> = ({ entity, nowMs, portal }) => {
  const isUpgrading =
    entity.upgradeFinishTimestamp !== null && entity.upgradeStartTimestamp !== null;

  if (
    isUpgrading &&
    entity.upgradeStartTimestamp !== null &&
    entity.upgradeFinishTimestamp !== null
  ) {
    const total = Math.max(1000, entity.upgradeFinishTimestamp - entity.upgradeStartTimestamp);
    const remaining = Math.max(0, entity.upgradeFinishTimestamp - nowMs);
    const pct = Math.min(1, Math.max(0, 1 - remaining / total));
    const remSec = Math.ceil(remaining / 1000);
    const label = formatDurationShort(remSec);
    const r = 13;
    const circ = 2 * Math.PI * r;

    return (
      <Html
        center
        portal={portal}
        position={[0, 1.55, 0]}
        zIndexRange={[5, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#2b2623] bg-[#fcf8ef] shadow-md">
          <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r={r} fill="none" stroke="#e5d7be" strokeWidth="3.5" />
            <circle
              cx="16"
              cy="16"
              r={r}
              fill="none"
              stroke="#c86446"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
            />
          </svg>
          <span className="absolute font-mono text-[8.5px] font-bold text-[#2b2623]">
            {label}
          </span>
        </div>
      </Html>
    );
  }

  return (
    <Html
      center
      portal={portal}
      position={[0.32, 0.14, 0.32]}
      zIndexRange={[5, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div className="flex h-4 w-4 items-center justify-center rounded-full border border-[#2b2623] bg-[#f6efe2] font-mono text-[8.5px] font-bold text-[#2b2623] shadow-xs">
        {entity.level}
      </div>
    </Html>
  );
};

interface PlacedStructureNode3DProps {
  entity: PlacedEntity;
  engine: GameEngine;
  isSelected: boolean;
  nowMs: number;
  htmlPortalRef: React.RefObject<HTMLDivElement>;
  onSelect: (col: number, row: number) => void;
  onHover: (coord: GridCoord) => void;
}

export const PlacedStructureNode3D: React.FC<PlacedStructureNode3DProps> = ({
  entity,
  engine,
  isSelected,
  nowMs,
  htmlPortalRef,
  onSelect,
  onHover,
}) => {
  const springGroupRef = useRef<THREE.Group>(null);
  const springScaleRef = useRef(0.25);
  const springVelRef = useRef(0);
  const prevStateKeyRef = useRef(`${entity.level}|${entity.upgradeFinishTimestamp !== null}`);

  const isUpgrading =
    entity.upgradeFinishTimestamp !== null && entity.upgradeStartTimestamp !== null;
  const currentKey = `${entity.level}|${isUpgrading}`;

  if (prevStateKeyRef.current !== currentKey) {
    prevStateKeyRef.current = currentKey;
    springScaleRef.current = 0.82;
    springVelRef.current = 4.6;
  }

  useFrame((_, delta) => {
    if (!springGroupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const force = (1 - springScaleRef.current) * 190;
    springVelRef.current = (springVelRef.current + force * dt) * Math.exp(-13 * dt);
    springScaleRef.current = Math.max(0.1, springScaleRef.current + springVelRef.current * dt);
    springGroupRef.current.scale.setScalar(springScaleRef.current);
  });

  const pos = gridToWorld(entity.col, entity.row, 0.01);
  const modelPath = isTowerId(entity.configId)
    ? TOWER_CONFIGS[entity.configId].modelPath
    : BUILDING_CONFIGS[entity.configId].modelPath;

  return (
    <group
      position={pos}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(entity.col, entity.row);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover({ col: entity.col, row: entity.row });
      }}
    >
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
          <ringGeometry args={[0.45, 0.55, 32]} />
          <meshBasicMaterial color="#f4c76b" />
        </mesh>
      )}

      <group ref={springGroupRef}>
        <ModelWrapper
          configId={entity.configId}
          level={entity.level}
          modelPath={modelPath}
          engine={engine}
          entityId={entity.id}
          phaseOffset={entity.col + entity.row}
        />
        {isUpgrading && <WoodenScaffolding3D />}
      </group>

      <EntityStatusHtml entity={entity} nowMs={nowMs} portal={htmlPortalRef} />
    </group>
  );
};
