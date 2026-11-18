import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ContactShadows, Html, MapControls } from '@react-three/drei';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BUILDING_CONFIGS,
  ENEMY_CONFIGS,
  KEEP_COORD,
  TOWER_CONFIGS,
  isTowerId,
} from '../game/config';
import { GameEngine } from '../game/engine/GameEngine';
import { formatDurationShort } from '../game/utils/format';
import {
  BuildableId,
  EnemyInstance,
  GridCoord,
  ParticleInstance,
  PlacedEntity,
  ProjectileInstance,
} from '../types/game';
import { IslandGrid3D } from './IslandGrid3D';
import { EnemyModelWrapper, KeepModel3D, ModelWrapper } from './ModelWrapper';
import { ToonRoundedBox, gridToWorld } from './ToonMaterial';

interface GameCanvas3DProps {
  engine: GameEngine;
  entities: PlacedEntity[];
  keepHp: number;
  keepMaxHp: number;
  selectedBuildId: BuildableId | null;
  selectedEntityId: string | null;
  onTileClick: (col: number, row: number) => void;
  onClearSelection: () => void;
  onHudSync: () => void;
}

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
          radius={0.018}
          color="#9c6d3b"
          position={[x, 0.5, z]}
          outlineThickness={0.015}
        />
      ))}
      {[0.32, 0.72].map((y, idx) => (
        <group key={idx} position={[0, y, 0]}>
          <ToonRoundedBox
            args={[0.76, 0.05, 0.05]}
            radius={0.015}
            color="#7a5832"
            position={[0, 0, 0.36]}
            outlineThickness={0.012}
          />
          <ToonRoundedBox
            args={[0.76, 0.05, 0.05]}
            radius={0.015}
            color="#7a5832"
            position={[0, 0, -0.36]}
            outlineThickness={0.012}
          />
          <ToonRoundedBox
            args={[0.05, 0.05, 0.76]}
            radius={0.015}
            color="#7a5832"
            position={[-0.36, 0, 0]}
            outlineThickness={0.012}
          />
          <ToonRoundedBox
            args={[0.05, 0.05, 0.76]}
            radius={0.015}
            color="#7a5832"
            position={[0.36, 0, 0]}
            outlineThickness={0.012}
          />
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

const EntityStatusHtml: React.FC<EntityStatusHtmlProps> = ({
  entity,
  nowMs,
  portal,
}) => {
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
            <circle
              cx="16"
              cy="16"
              r={r}
              fill="none"
              stroke="#e5d7be"
              strokeWidth="3.5"
            />
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

const PlacedStructureNode3D: React.FC<PlacedStructureNode3DProps> = ({
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
    const stiffness = 190;
    const damping = 13;
    const force = (1 - springScaleRef.current) * stiffness;
    springVelRef.current = (springVelRef.current + force * dt) * Math.exp(-damping * dt);
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
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
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

const DriftingClouds3D: React.FC<{ engine: GameEngine }> = ({ engine }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const clouds = engine.getClouds();
    groupRef.current.children.forEach((child, i) => {
      const c = clouds[i];
      if (!c) return;
      child.position.set(
        (c.x - 0.5) * 28,
        3.2 + (i % 2) * 1.4,
        (c.y - 0.5) * 18 - 6,
      );
      child.scale.setScalar(c.scale);
    });
  });

  const clouds = engine.getClouds();
  return (
    <group ref={groupRef}>
      {clouds.map((c, idx) => (
        <group
          key={idx}
          position={[
            (c.x - 0.5) * 28,
            3.2 + (idx % 2) * 1.4,
            (c.y - 0.5) * 18 - 6,
          ]}
        >
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.92, 24, 18]} />
            <meshStandardMaterial
              color="#fcf8ef"
              roughness={0.85}
              transparent
              opacity={0.78}
            />
          </mesh>
          <mesh position={[-0.75, -0.15, 0.1]}>
            <sphereGeometry args={[0.66, 24, 18]} />
            <meshStandardMaterial
              color="#f3ecdc"
              roughness={0.85}
              transparent
              opacity={0.76}
            />
          </mesh>
          <mesh position={[0.75, -0.18, -0.1]}>
            <sphereGeometry args={[0.7, 24, 18]} />
            <meshStandardMaterial
              color="#f3ecdc"
              roughness={0.85}
              transparent
              opacity={0.76}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const EnemyNode3D: React.FC<{ engine: GameEngine; enemySnapshot: EnemyInstance }> = ({
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
      smoothPosRef.current.x = THREE.MathUtils.damp(smoothPosRef.current.x, tx, 18, delta);
      smoothPosRef.current.y = THREE.MathUtils.damp(smoothPosRef.current.y, ty, 20, delta);
      smoothPosRef.current.z = THREE.MathUtils.damp(smoothPosRef.current.z, tz, 18, delta);
    }

    groupRef.current.position.set(
      smoothPosRef.current.x,
      smoothPosRef.current.y,
      smoothPosRef.current.z,
    );

    if (prevPosRef.current && bodyRef.current) {
      const dx = tx - prevPosRef.current.x;
      const dz = tz - prevPosRef.current.z;
      if (dx * dx + dz * dz > 0.00001) {
        const targetYaw = Math.atan2(dx, dz);
        const twoPi = Math.PI * 2;
        const diff =
          ((((targetYaw - smoothYawRef.current) % twoPi) + twoPi + Math.PI) % twoPi) -
          Math.PI;
        smoothYawRef.current += diff * (1 - Math.exp(-12 * delta));
        bodyRef.current.rotation.y = smoothYawRef.current;
      }
      // Subtle breathing & walk sway
      const breath = 1 + Math.sin(clock.elapsedTime * 5 + live.totalDistanceTraveled) * 0.035;
      bodyRef.current.scale.set(1, breath, 1);
      bodyRef.current.rotation.z = Math.sin(live.totalDistanceTraveled * 6) * 0.06;
    }
    prevPosRef.current = { x: tx, z: tz };

    const chilled = live.slowUntilMs > nowMs;
    const flashing = live.hitFlashUntilMs > nowMs;
    const showHp = live.hp < live.maxHp || Boolean(cfg.isBoss);

    if (hpBarGroupRef.current) {
      hpBarGroupRef.current.quaternion.copy(camera.quaternion);
    }
    if (hpFillRef.current) {
      const ratio = Math.max(0.001, Math.min(1, live.hp / live.maxHp));
      const barWidth = cfg.isBoss ? 0.85 : 0.46;
      hpFillRef.current.scale.set(ratio, 1, 1);
      hpFillRef.current.position.x = -barWidth * 0.5 * (1 - ratio);
    }

    if (
      chilled !== statusState.chilled ||
      flashing !== statusState.flashing ||
      showHp !== statusState.showHp
    ) {
      setStatusState({ chilled, flashing, showHp });
    }
  });

  const initPos = gridToWorld(enemySnapshot.col, enemySnapshot.row, -0.04);
  const barWidth = cfg.isBoss ? 0.85 : 0.46;

  return (
    <group ref={groupRef} position={initPos}>
      {/* Ground shadow disc */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <circleGeometry args={[0.24 * cfg.scale, 24]} />
        <meshBasicMaterial
          color={statusState.chilled ? '#5ba4b5' : '#2b2623'}
          transparent
          opacity={0.26}
        />
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
          <mesh position={[0, 0, -0.005]}>
            <planeGeometry args={[barWidth + 0.06, 0.12]} />
            <meshBasicMaterial color="#2b2623" />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[barWidth, 0.08]} />
            <meshBasicMaterial color="#e7dcc8" />
          </mesh>
          <mesh ref={hpFillRef} position={[0, 0, 0.005]}>
            <planeGeometry args={[barWidth, 0.08]} />
            <meshBasicMaterial color={cfg.isBoss ? '#d4743b' : '#c86446'} />
          </mesh>
        </group>
      )}
    </group>
  );
};

const ProjectileNode3D: React.FC<{
  engine: GameEngine;
  projSnapshot: ProjectileInstance;
}> = ({ engine, projSnapshot }) => {
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
      smoothPosRef.current.x = THREE.MathUtils.damp(smoothPosRef.current.x, tx, 28, delta);
      smoothPosRef.current.y = THREE.MathUtils.damp(smoothPosRef.current.y, ty, 28, delta);
      smoothPosRef.current.z = THREE.MathUtils.damp(smoothPosRef.current.z, tz, 28, delta);
    }

    airRef.current.position.copy(smoothPosRef.current);
    shadowRef.current.position.set(smoothPosRef.current.x, 0.02, smoothPosRef.current.z);

    if (live.type === 'arrow') {
      const t2 = Math.min(1, t + 0.04);
      const col2 = live.startCol + (live.targetCol - live.startCol) * t2;
      const row2 = live.startRow + (live.targetRow - live.startRow) * t2;
      const y2 = 0.72 * (1 - t2) + Math.sin(t2 * Math.PI) * live.arcHeight;
      const [wx2, , wz2] = gridToWorld(col2, row2, 0);
      dirVec.set(wx2 - tx, y2 - ty, wz2 - tz);
      if (dirVec.lengthSq() > 0.00001) {
        dirVec.normalize();
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(upVec, dirVec);
        airRef.current.quaternion.slerp(targetQuat, 1 - Math.exp(-24 * delta));
      }
    }
  });

  const initPos = gridToWorld(projSnapshot.startCol, projSnapshot.startRow, 0.72);

  return (
    <group>
      <mesh
        ref={shadowRef}
        position={[initPos[0], 0.02, initPos[2]]}
        rotation={[-Math.PI * 0.5, 0, 0]}
      >
        <circleGeometry
          args={[projSnapshot.type === 'cannonball' ? 0.16 : 0.09, 24]}
        />
        <meshBasicMaterial color="#2b2623" transparent opacity={0.25} />
      </mesh>
      <mesh ref={airRef} position={initPos} castShadow>
        {projSnapshot.type === 'cannonball' ? (
          <sphereGeometry args={[0.14, 24, 18]} />
        ) : (
          <coneGeometry args={[0.045, 0.34, 24]} />
        )}
        <meshStandardMaterial
          color={projSnapshot.type === 'cannonball' ? '#3d4349' : '#f4e4c1'}
          roughness={0.45}
          metalness={projSnapshot.type === 'cannonball' ? 0.3 : 0.05}
        />
      </mesh>
    </group>
  );
};

const ParticleNode3D: React.FC<{
  engine: GameEngine;
  particleSnapshot: ParticleInstance;
}> = ({ engine, particleSnapshot }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const live = engine.getParticles().find((p) => p.id === particleSnapshot.id);
    if (!live || !meshRef.current) return;

    const lifeRatio = Math.max(0.05, 1 - live.ageSec / live.lifetimeSec);
    const [wx, , wz] = gridToWorld(live.col, live.row, 0);

    if (live.kind === 'frost_ring') {
      meshRef.current.position.set(wx, 0.04, wz);
      meshRef.current.scale.setScalar(live.radius);
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = lifeRatio * 0.75;
    } else {
      meshRef.current.position.set(wx, live.z * 0.8 + 0.08, wz);
      meshRef.current.scale.setScalar(lifeRatio * (live.radius * 0.024));
    }
  });

  const initPos = gridToWorld(
    particleSnapshot.col,
    particleSnapshot.row,
    particleSnapshot.kind === 'frost_ring'
      ? 0.04
      : particleSnapshot.z * 0.8 + 0.08,
  );

  if (particleSnapshot.kind === 'frost_ring') {
    return (
      <mesh ref={meshRef} position={initPos} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.88, 1.0, 48]} />
        <meshBasicMaterial color="#7ed3e6" transparent opacity={0.75} />
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} position={initPos}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={particleSnapshot.color} />
    </mesh>
  );
};

function createFloatingTextTexture(
  text: string,
  color: string,
): THREE.CanvasTexture {
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

const FloatingTextSprite3D: React.FC<{
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
    const ty = live.z * 0.75 + 0.55;
    spriteRef.current.position.x = THREE.MathUtils.damp(
      spriteRef.current.position.x,
      wx,
      16,
      delta,
    );
    spriteRef.current.position.y = THREE.MathUtils.damp(
      spriteRef.current.position.y,
      ty,
      16,
      delta,
    );
    spriteRef.current.position.z = THREE.MathUtils.damp(
      spriteRef.current.position.z,
      wz,
      16,
      delta,
    );
    const mat = spriteRef.current.material as THREE.SpriteMaterial;
    mat.opacity = Math.min(1, lifeRatio * 1.4);
  });

  const initPos = gridToWorld(initCol, initRow, initZ * 0.75 + 0.55);

  return (
    <sprite ref={spriteRef} position={initPos} scale={[1.8, 0.45, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
};

interface SimulationSceneProps {
  engine: GameEngine;
  entities: PlacedEntity[];
  keepHp: number;
  keepMaxHp: number;
  selectedBuildId: BuildableId | null;
  selectedEntityId: string | null;
  htmlPortalRef: React.RefObject<HTMLDivElement>;
  onTileClick: (col: number, row: number) => void;
  onHudSync: () => void;
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
  onHudSync,
}) => {
  const [hoveredTile, setHoveredTile] = useState<GridCoord | null>(null);
  const [, setSimVersion] = useState(0);
  const shakeGroupRef = useRef<THREE.Group>(null);
  const lastHudSyncRef = useRef(0);
  const lastSignatureRef = useRef('');

  useFrame(({ clock }, delta) => {
    engine.tick(delta);

    if (shakeGroupRef.current) {
      const shake = engine.getVisualState().screenShake;
      if (shake > 0) {
        shakeGroupRef.current.position.set(
          (Math.random() - 0.5) * shake * 0.032,
          0,
          (Math.random() - 0.5) * shake * 0.032,
        );
      } else {
        shakeGroupRef.current.position.set(0, 0, 0);
      }
    }

    const enemies = engine.getEnemies();
    const projs = engine.getProjectiles();
    const parts = engine.getParticles();
    const texts = engine.getFloatingTexts();
    const sig = `${enemies.map((e) => e.id).join(',')}|${projs.map((p) => p.id).join(',')}|${parts.map((p) => p.id).join(',')}|${texts.map((f) => f.id).join(',')}`;

    if (sig !== lastSignatureRef.current) {
      lastSignatureRef.current = sig;
      setSimVersion((v) => v + 1);
    }

    if (clock.elapsedTime - lastHudSyncRef.current >= 0.1) {
      lastHudSyncRef.current = clock.elapsedTime;
      queueMicrotask(onHudSync);
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

      {/* ContactShadows grounding towers, keep, and raiders cleanly onto island tiles */}
      <ContactShadows
        position={[0, 0.015, 0]}
        opacity={0.45}
        color="#1e1916"
        scale={20}
        blur={2}
        far={3}
        resolution={512}
      />

      {/* Bastion Keep */}
      <group
        position={keepPos}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onTileClick(KEEP_COORD.col, KEEP_COORD.row);
        }}
      >
        <KeepModel3D />
        <Html
          center
          portal={htmlPortalRef}
          position={[0, 2.2, 0]}
          zIndexRange={[5, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="rounded border border-[#2b2623] bg-[#fcf8ef]/95 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#c86446] shadow-xs whitespace-nowrap">
            {keepHp}/{keepMaxHp}
          </div>
        </Html>
      </group>

      {/* Placed Towers & Resource Buildings */}
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

      {/* 3D Enemies */}
      {engine.getEnemies().map((enemy) => (
        <EnemyNode3D key={enemy.id} engine={engine} enemySnapshot={enemy} />
      ))}

      {/* 3D Projectiles */}
      {engine.getProjectiles().map((proj) => (
        <ProjectileNode3D key={proj.id} engine={engine} projSnapshot={proj} />
      ))}

      {/* 3D Particles & Frost Nova Rings */}
      {engine.getParticles().map((p) => (
        <ParticleNode3D key={p.id} engine={engine} particleSnapshot={p} />
      ))}

      {/* Floating Damage & Loot Numbers */}
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
  onHudSync,
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
      if (parent.contains(htmlPortalEl)) {
        parent.removeChild(htmlPortalEl);
      }
    };
  }, [htmlPortalEl]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        shadows
        orthographic
        gl={{
          antialias: true,
          toneMapping: THREE.AgXToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{
          position: [15, 14, 15],
          zoom: 48,
          near: -60,
          far: 200,
        }}
        onPointerMissed={() => onClearSelection()}
        className={
          selectedBuildId ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }
      >
        <color attach="background" args={['#cfe1e6']} />
        <fog attach="fog" args={['#e5dfcc', 38, 95]} />

        {/* Crisp High-Contrast Sunlight & Grounded Shadows */}
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

        <MapControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minZoom={24}
          maxZoom={92}
          maxPolarAngle={Math.PI * 0.44}
          minPolarAngle={Math.PI * 0.16}
        />

        <SimulationScene
          engine={engine}
          entities={entities}
          keepHp={keepHp}
          keepMaxHp={keepMaxHp}
          selectedBuildId={selectedBuildId}
          selectedEntityId={selectedEntityId}
          htmlPortalRef={htmlPortalRef}
          onTileClick={onTileClick}
          onHudSync={onHudSync}
        />
      </Canvas>
    </div>
  );
};
