import React, { Suspense, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameEngine } from '../game/engine/GameEngine';
import { BuildableId, EnemyId } from '../types/game';
import { INK_OUTLINE_COLOR, ToonMesh, ToonRoundedBox } from './ToonMaterial';

function dampAngleShortest(current: number, target: number, lambda: number, delta: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((((target - current) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI;
  return current + diff * (1 - Math.exp(-lambda * delta));
}

interface GlbModelProps {
  modelPath: string;
  scale?: number;
  tintColor?: string;
}

const GlbModel: React.FC<GlbModelProps> = ({ modelPath, scale = 1, tintColor }) => {
  const { scene } = useGLTF(modelPath);

  const styledScene = useMemo(() => {
    const clone = scene.clone(true);
    const outlineMat = new THREE.MeshBasicMaterial({
      color: INK_OUTLINE_COLOR,
      side: THREE.BackSide,
    });

    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;

      const srcMat = obj.material as THREE.MeshStandardMaterial | undefined;
      const baseColor = tintColor
        ? new THREE.Color(tintColor)
        : srcMat?.color
          ? srcMat.color.clone()
          : new THREE.Color('#d8c8a8');

      obj.material = new THREE.MeshStandardMaterial({
        color: baseColor,
        map: srcMat?.map ?? null,
        roughness: 0.62,
        metalness: 0.04,
        flatShading: false,
      });

      if (!obj.userData.hasInkOutline && obj.geometry) {
        const outline = new THREE.Mesh(obj.geometry, outlineMat);
        outline.scale.setScalar(1.035);
        outline.castShadow = false;
        outline.receiveShadow = false;
        outline.userData.hasInkOutline = true;
        obj.add(outline);
        obj.userData.hasInkOutline = true;
      }
    });

    return clone;
  }, [scene, tintColor]);

  return <primitive object={styledScene} scale={scale} />;
};

interface KeepModel3DProps {
  modelPath?: string;
}

export const KeepModel3D: React.FC<KeepModel3DProps> = ({ modelPath }) => {
  const flagRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (flagRef.current) {
      flagRef.current.rotation.y = Math.sin(clock.elapsedTime * 4.2) * 0.22;
    }
  });

  const fallback = (
    <group>
      {/* Stone citadel foundation */}
      <ToonRoundedBox args={[0.84, 0.44, 0.84]} radius={0.08} color="#b5a68e" position={[0, 0.22, 0]} />
      {/* Mid keep wall */}
      <ToonRoundedBox args={[0.56, 0.56, 0.56]} radius={0.07} color="#d6c7ae" position={[0, 0.66, 0]} />
      {/* Front arched gate accent */}
      <ToonRoundedBox args={[0.24, 0.34, 0.08]} radius={0.03} color="#5e4026" position={[0, 0.22, 0.41]} />
      {/* Smooth terracotta spire roof */}
      <ToonMesh color="#c94a38" position={[0, 1.18, 0]}>
        <coneGeometry args={[0.42, 0.54, 24]} />
      </ToonMesh>
      {/* Flagpole */}
      <ToonMesh color="#4a392a" position={[0, 1.56, 0]} outlineThickness={0.015}>
        <cylinderGeometry args={[0.022, 0.022, 0.44, 16]} />
      </ToonMesh>
      {/* Waving royal pennant */}
      <mesh ref={flagRef} position={[0.13, 1.71, 0]} castShadow>
        <boxGeometry args={[0.24, 0.12, 0.03]} />
        <meshStandardMaterial color="#ebae34" roughness={0.7} />
      </mesh>
    </group>
  );

  if (!modelPath) return fallback;
  return (
    <Suspense fallback={fallback}>
      <GlbModel modelPath={modelPath} />
    </Suspense>
  );
};

interface StructureModelProps {
  configId: BuildableId;
  level: number;
  modelPath?: string;
  engine?: GameEngine;
  entityId?: string;
  phaseOffset?: number;
}

const ProceduralStructure: React.FC<Omit<StructureModelProps, 'modelPath'>> = ({
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
      const idleBreath = Math.sin(t * 2.2) * 0.015;
      spireRef.current.position.y = -smoothRecoil.current * 0.08 + idleBreath;
    }

    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 1.25;
      crystalRef.current.position.y =
        0.88 + level * 0.05 + Math.sin(t * 3.1) * 0.065 + smoothRecoil.current * 0.08;
    }

    if (turretRef.current) {
      turretRef.current.rotation.y = smoothYaw.current;
    }
    if (barrelRef.current) {
      barrelRef.current.position.x = -smoothRecoil.current * 0.14;
    }

    if (craneRef.current) {
      craneRef.current.rotation.y = Math.sin(t * 1.4) * 0.18;
    }
  });

  const tierBoost = (level - 1) * 0.06;

  switch (configId) {
    case 'archer_spire': {
      const shaftH = 0.58 + tierBoost;
      return (
        <group ref={spireRef}>
          {/* Stone plinth */}
          <ToonRoundedBox args={[0.68, 0.24, 0.68]} radius={0.07} color="#b5a68e" position={[0, 0.12, 0]} />
          {/* Timber watchtower shaft */}
          <ToonRoundedBox
            args={[0.42, shaftH, 0.42]}
            radius={0.06}
            color="#b87d3e"
            position={[0, 0.24 + shaftH * 0.5, 0]}
          />
          {/* Battlement collar */}
          <ToonRoundedBox
            args={[0.52, 0.11, 0.52]}
            radius={0.04}
            color="#8c5a2b"
            position={[0, 0.24 + shaftH + 0.04, 0]}
          />
          {/* Smooth conical terracotta roof */}
          <ToonMesh color="#c94a38" position={[0, 0.24 + shaftH + 0.3, 0]}>
            <coneGeometry args={[0.37, 0.46, 28]} />
          </ToonMesh>
        </group>
      );
    }

    case 'frost_obelisk': {
      const colH = 0.48 + tierBoost;
      return (
        <group>
          {/* Carved smooth slate dais */}
          <ToonMesh color="#4a525a" position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.36, 0.42, 0.2, 28]} />
          </ToonMesh>
          {/* Tapered smooth obelisk column */}
          <ToonMesh color="#363c42" position={[0, 0.2 + colH * 0.5, 0]}>
            <cylinderGeometry args={[0.14, 0.23, colH, 24]} />
          </ToonMesh>
          {/* Floating sculpted Aether crystal */}
          <group ref={crystalRef} position={[0, 0.88 + tierBoost, 0]}>
            <ToonMesh
              color="#38b6d4"
              emissive="#258ca6"
              emissiveIntensity={0.35}
              scale={[0.9, 1.35, 0.9]}
            >
              <sphereGeometry args={[0.19, 24, 18]} />
            </ToonMesh>
          </group>
        </group>
      );
    }

    case 'cannon_bastion': {
      const baseH = 0.42 + tierBoost;
      return (
        <group>
          {/* Heavy smooth slate bastion */}
          <ToonMesh color="#363c42" position={[0, baseH * 0.5, 0]}>
            <cylinderGeometry args={[0.4, 0.46, baseH, 28]} />
          </ToonMesh>
          {/* Top gun deck */}
          <ToonMesh color="#5b636b" position={[0, baseH + 0.06, 0]}>
            <cylinderGeometry args={[0.34, 0.36, 0.12, 28]} />
          </ToonMesh>
          {/* Smoothly damped rotating iron cannon assembly */}
          <group ref={turretRef} position={[0, baseH + 0.2, 0]}>
            <group ref={barrelRef}>
              <ToonMesh
                color="#262b30"
                position={[0.16, 0.04, 0]}
                rotation={[0, 0, -Math.PI * 0.42]}
                metalness={0.22}
                roughness={0.55}
              >
                <cylinderGeometry args={[0.09, 0.12, 0.5, 24]} />
              </ToonMesh>
              {/* Brass muzzle band */}
              <ToonMesh
                color="#e5a93c"
                position={[0.39, 0.1, 0]}
                rotation={[0, 0, -Math.PI * 0.42]}
                outlineThickness={0.016}
                metalness={0.35}
                roughness={0.4}
              >
                <cylinderGeometry args={[0.105, 0.105, 0.07, 24]} />
              </ToonMesh>
            </group>
          </group>
        </group>
      );
    }

    case 'quarry_mine': {
      return (
        <group>
          <ToonRoundedBox args={[0.5, 0.44, 0.54]} radius={0.07} color="#d4a96a" position={[-0.08, 0.22, 0]} />
          <ToonMesh color="#a86428" position={[-0.08, 0.58, 0]}>
            <coneGeometry args={[0.37, 0.3, 24]} />
          </ToonMesh>
          <group ref={craneRef} position={[0.2, 0.1, 0.12]}>
            <ToonRoundedBox args={[0.07, 0.56, 0.07]} radius={0.02} color="#6e4720" position={[0, 0.28, 0]} outlineThickness={0.016} />
            <ToonRoundedBox
              args={[0.32, 0.06, 0.06]}
              radius={0.02}
              color="#6e4720"
              position={[0.12, 0.52, 0]}
              rotation={[0, 0, -0.3]}
              outlineThickness={0.016}
            />
            <ToonRoundedBox args={[0.16, 0.14, 0.16]} radius={0.04} color="#ebae34" position={[0.22, 0.32, 0]} outlineThickness={0.016} />
          </group>
        </group>
      );
    }

    case 'aether_conduit': {
      return (
        <group>
          <ToonMesh color="#4a525a" position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.4, 0.44, 0.28, 28]} />
          </ToonMesh>
          <ToonMesh
            color="#38b6d4"
            emissive="#2d99b5"
            emissiveIntensity={0.35}
            position={[0, 0.29, 0]}
            showOutline={false}
          >
            <cylinderGeometry args={[0.3, 0.3, 0.03, 28]} />
          </ToonMesh>
          <group ref={crystalRef} position={[0, 0.72, 0]}>
            <ToonMesh
              color="#5cd3ec"
              emissive="#2d99b5"
              emissiveIntensity={0.38}
              scale={[0.85, 1.5, 0.85]}
            >
              <sphereGeometry args={[0.16, 24, 18]} />
            </ToonMesh>
          </group>
        </group>
      );
    }

    case 'storage_vault': {
      const h = 0.44 + tierBoost;
      return (
        <group>
          <ToonRoundedBox args={[0.66, h, 0.62]} radius={0.08} color="#d6c7ae" position={[0, h * 0.5, 0]} />
          <ToonMesh color="#c94a38" position={[0, h + 0.18, 0]}>
            <coneGeometry args={[0.45, 0.38, 24]} />
          </ToonMesh>
          <ToonRoundedBox args={[0.16, 0.18, 0.06]} radius={0.02} color="#ebae34" position={[0, 0.22, 0.32]} outlineThickness={0.015} />
        </group>
      );
    }
  }
};

export const ModelWrapper: React.FC<StructureModelProps> = ({
  modelPath,
  ...props
}) => {
  const fallback = <ProceduralStructure {...props} />;
  if (!modelPath) return fallback;
  return (
    <Suspense fallback={fallback}>
      <GlbModel modelPath={modelPath} scale={1 + (props.level - 1) * 0.05} />
    </Suspense>
  );
};

interface EnemyModelProps {
  configId: EnemyId;
  modelPath?: string;
  scale: number;
  primaryColor: string;
  secondaryColor: string;
  isBoss?: boolean;
  isChilled: boolean;
  isFlashing: boolean;
}

const ProceduralEnemy: React.FC<Omit<EnemyModelProps, 'modelPath'>> = ({
  configId,
  scale,
  primaryColor,
  secondaryColor,
  isBoss,
  isChilled,
  isFlashing,
}) => {
  const bodyColor = isFlashing ? '#ffffff' : isChilled ? '#7ed3e6' : primaryColor;
  const trimColor = isFlashing ? '#ffffff' : isChilled ? '#c7f1f8' : secondaryColor;

  return (
    <group scale={scale}>
      {/* Smooth rounded torso */}
      <ToonRoundedBox args={[0.32, 0.38, 0.28]} radius={0.08} color={bodyColor} position={[0, 0.22, 0]} />

      {/* Head / Crown / Hood */}
      {isBoss ? (
        <>
          <ToonMesh color={trimColor} position={[0, 0.54, 0]}>
            <coneGeometry args={[0.18, 0.28, 24]} />
          </ToonMesh>
          <ToonRoundedBox args={[0.12, 0.22, 0.22]} radius={0.04} color={trimColor} position={[-0.22, 0.32, 0]} />
          <ToonRoundedBox args={[0.12, 0.22, 0.22]} radius={0.04} color={trimColor} position={[0.22, 0.32, 0]} />
        </>
      ) : configId === 'aether_wisp' ? (
        <ToonMesh
          color={trimColor}
          emissive="#5ec2d4"
          emissiveIntensity={0.38}
          position={[0, 0.54, 0]}
        >
          <sphereGeometry args={[0.15, 24, 18]} />
        </ToonMesh>
      ) : (
        <ToonMesh color={trimColor} position={[0, 0.49, 0]}>
          <sphereGeometry args={[0.13, 24, 18]} />
        </ToonMesh>
      )}

      {/* Rounded oak shield for Oakshield Brigand */}
      {configId === 'shield_brigand' && (
        <ToonRoundedBox args={[0.08, 0.3, 0.24]} radius={0.03} color="#b59264" position={[0.2, 0.22, 0.08]} />
      )}
    </group>
  );
};

export const EnemyModelWrapper: React.FC<EnemyModelProps> = ({
  modelPath,
  ...props
}) => {
  const fallback = <ProceduralEnemy {...props} />;
  if (!modelPath) return fallback;
  return (
    <Suspense fallback={fallback}>
      <GlbModel
        modelPath={modelPath}
        scale={props.scale}
        tintColor={
          props.isFlashing ? '#ffffff' : props.isChilled ? '#7ed3e6' : undefined
        }
      />
    </Suspense>
  );
};
