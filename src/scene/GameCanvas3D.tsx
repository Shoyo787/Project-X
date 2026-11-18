import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ContactShadows, Html, MapControls } from '@react-three/drei';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BALANCE_CONFIG, KEEP_COORD } from '../game/config';
import { GameEngine } from '../game/engine/GameEngine';
import { BuildableId, GridCoord, PlacedEntity } from '../types/game';
import { IslandGrid3D } from './IslandGrid3D';
import { KeepModel3D } from './ModelWrapper';
import { PlacedStructureNode3D } from './PlacedStructureNode3D';
import {
  DriftingClouds3D,
  EnemyNode3D,
  FloatingTextSprite3D,
  ParticleNode3D,
  ProjectileNode3D,
} from './SceneActors3D';
import { gridToWorld } from './ToonMaterial';

interface GameCanvas3DProps {
  engine: GameEngine;
  entities: PlacedEntity[];
  keepHp: number;
  keepMaxHp: number;
  selectedBuildId: BuildableId | null;
  selectedEntityId: string | null;
  onTileClick: (col: number, row: number) => void;
  onClearSelection: () => void;
}

const CameraRig3D: React.FC = () => {
  const controlsRef = useRef<React.ComponentRef<typeof MapControls>>(null);
  const { camera } = useThree();

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { panLimitX, panLimitZ } = BALANCE_CONFIG.camera;
    const clampedX = THREE.MathUtils.clamp(controls.target.x, -panLimitX, panLimitX);
    const clampedZ = THREE.MathUtils.clamp(controls.target.z, -panLimitZ, panLimitZ);
    const dx = clampedX - controls.target.x;
    const dz = clampedZ - controls.target.z;
    if (dx !== 0 || dz !== 0) {
      controls.target.x = clampedX;
      controls.target.z = clampedZ;
      camera.position.x += dx;
      camera.position.z += dz;
    }
  });

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={BALANCE_CONFIG.camera.dampingFactor}
      minZoom={BALANCE_CONFIG.camera.minZoom}
      maxZoom={BALANCE_CONFIG.camera.maxZoom}
      minPolarAngle={BALANCE_CONFIG.camera.minPolarAngle}
      maxPolarAngle={BALANCE_CONFIG.camera.maxPolarAngle}
    />
  );
};

interface SimulationSceneProps extends Omit<GameCanvas3DProps, 'onClearSelection'> {
  htmlPortalRef: React.RefObject<HTMLDivElement>;
}

const SimulationScene: React.FC<SimulationSceneProps> = ({
  engine,
  entities,
  keepHp,
  keepMaxHp,
  selectedBuildId,
  selectedEntityId,
  htmlPortalRef,
  onTileClick,
}) => {
  const [hoveredTile, setHoveredTile] = useState<GridCoord | null>(null);
  const [, setSimVersion] = useState(0);
  const shakeGroupRef = useRef<THREE.Group>(null);
  const lastSignatureRef = useRef('');

  useFrame((_, delta) => {
    engine.tick(delta);
    if (shakeGroupRef.current) {
      const shake = engine.getVisualState().screenShake;
      shakeGroupRef.current.position.set(
        shake > 0 ? (Math.random() - 0.5) * shake * 0.032 : 0,
        0,
        shake > 0 ? (Math.random() - 0.5) * shake * 0.032 : 0,
      );
    }

    const sig = `${engine.getEnemies().map((e) => e.id).join(',')}|${engine.getProjectiles().map((p) => p.id).join(',')}|${engine.getParticles().map((p) => p.id).join(',')}|${engine.getFloatingTexts().map((f) => f.id).join(',')}`;
    if (sig !== lastSignatureRef.current) {
      lastSignatureRef.current = sig;
      setSimVersion((v) => v + 1);
    }
  });

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) ?? null,
    [entities, selectedEntityId],
  );
  const nowMs = Date.now();
  const keepPos = gridToWorld(KEEP_COORD.col, KEEP_COORD.row, 0.01);

  return (
    <group ref={shakeGroupRef}>
      <DriftingClouds3D engine={engine} />
      <IslandGrid3D
        engine={engine}
        hoveredTile={hoveredTile}
        selectedBuildId={selectedBuildId}
        selectedEntity={selectedEntity}
        onHoverTile={setHoveredTile}
        onTileClick={onTileClick}
      />
      <ContactShadows position={[0, 0.015, 0]} opacity={0.45} color="#1e1916" scale={20} blur={2} far={3} resolution={512} />

      <group
        position={keepPos}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onTileClick(KEEP_COORD.col, KEEP_COORD.row);
        }}
      >
        <KeepModel3D />
        <Html center portal={htmlPortalRef} position={[0, 2.2, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="rounded border border-[#2b2623] bg-[#fcf8ef]/95 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#c86446] shadow-xs whitespace-nowrap">
            {keepHp}/{keepMaxHp}
          </div>
        </Html>
      </group>

      {entities.map((entity) => (
        <PlacedStructureNode3D
          key={entity.id}
          entity={entity}
          engine={engine}
          isSelected={selectedEntityId === entity.id}
          nowMs={nowMs}
          htmlPortalRef={htmlPortalRef}
          onSelect={onTileClick}
          onHover={setHoveredTile}
        />
      ))}

      {engine.getEnemies().map((enemy) => (
        <EnemyNode3D key={enemy.id} engine={engine} enemySnapshot={enemy} />
      ))}
      {engine.getProjectiles().map((proj) => (
        <ProjectileNode3D key={proj.id} engine={engine} projSnapshot={proj} />
      ))}
      {engine.getParticles().map((p) => (
        <ParticleNode3D key={p.id} engine={engine} particleSnapshot={p} />
      ))}
      {engine.getFloatingTexts().map((ft) => (
        <FloatingTextSprite3D
          key={ft.id}
          engine={engine}
          id={ft.id}
          text={ft.text}
          color={ft.color}
          initCol={ft.col}
          initRow={ft.row}
          initZ={ft.z}
        />
      ))}
    </group>
  );
};

export const GameCanvas3D: React.FC<GameCanvas3DProps> = ({
  engine,
  entities,
  keepHp,
  keepMaxHp,
  selectedBuildId,
  selectedEntityId,
  onTileClick,
  onClearSelection,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [htmlPortalEl] = useState<HTMLDivElement>(() => {
    const el = document.createElement('div');
    el.className = 'pointer-events-none fixed inset-0 z-[5] overflow-hidden';
    return el;
  });
  const htmlPortalRef = useRef<HTMLDivElement>(htmlPortalEl);

  useLayoutEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;
    parent.appendChild(htmlPortalEl);
    return () => {
      if (parent.contains(htmlPortalEl)) parent.removeChild(htmlPortalEl);
    };
  }, [htmlPortalEl]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        shadows
        orthographic
        gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.05 }}
        camera={{ position: [15, 14, 15], zoom: 48, near: -60, far: 200 }}
        onPointerMissed={() => onClearSelection()}
        className={selectedBuildId ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}
      >
        <color attach="background" args={['#cfe1e6']} />
        <fog attach="fog" args={['#e5dfcc', 38, 95]} />
        <hemisphereLight args={['#fff8e7', '#3a4f34', 0.35]} />
        <directionalLight
          position={[12, 20, 9]}
          intensity={1.8}
          color="#fff2d6"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-11}
          shadow-camera-right={11}
          shadow-camera-top={11}
          shadow-camera-bottom={-11}
          shadow-camera-near={1}
          shadow-camera-far={55}
          shadow-normalBias={0.02}
          shadow-bias={-0.0003}
        />
        <CameraRig3D />
        <SimulationScene
          engine={engine}
          entities={entities}
          keepHp={keepHp}
          keepMaxHp={keepMaxHp}
          selectedBuildId={selectedBuildId}
          selectedEntityId={selectedEntityId}
          htmlPortalRef={htmlPortalRef}
          onTileClick={onTileClick}
        />
      </Canvas>
    </div>
  );
};
