import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Sparkles, useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { CELL_SIZE, getBuildableConfig, isTowerId } from '../game/config';
import { GameEngine } from '../game/engine/GameEngine';
import { BuildableId, EnemyId } from '../types/game';
import { ToonMesh, ToonRoundedBox } from './ToonMaterial';

function dampAngleShortest(current: number, target: number, lambda: number, delta: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((((target - current) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI;
  return current + diff * (1 - Math.exp(-lambda * delta));
}

interface GlbModelProps {
  modelPath: string;
  scale?: number;
  tintColor?: string;
  targetHeight?: number;
  maxFootprint?: number;
  motion?: 'tower' | 'crystal' | 'cannon' | 'economy' | 'keep' | 'enemy';
  phaseOffset?: number;
  engine?: GameEngine;
  entityId?: string;
}

const GlbModel: React.FC<GlbModelProps> = ({
  modelPath,
  scale = 1,
  tintColor,
  targetHeight = 1.3,
  maxFootprint = 1.25,
  motion = 'tower',
  phaseOffset = 0,
  engine,
  entityId,
}) => {
  const { scene, animations } = useGLTF(modelPath);
  const rootRef = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const baseColors = new Map<THREE.Material, THREE.Color>();

    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = motion !== 'enemy';
      obj.receiveShadow = motion !== 'enemy';
      const isolateMaterial = (material: THREE.Material): THREE.Material => {
        const isolated = material.clone();
        if (isolated instanceof THREE.MeshStandardMaterial) {
          baseColors.set(isolated, isolated.color.clone());
        }
        return isolated;
      };
      obj.material = Array.isArray(obj.material)
        ? obj.material.map(isolateMaterial)
        : isolateMaterial(obj.material);
    });

    clone.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z, 0.001);
    const modelScale = Math.min(
      targetHeight / Math.max(size.y, 0.001),
      maxFootprint / footprint,
    );
    const center = bounds.getCenter(new THREE.Vector3());

    return {
      scene: clone,
      scale: modelScale * scale,
      baseColors,
      position: [
        -center.x,
        -bounds.min.y,
        -center.z,
      ] as [number, number, number],
    };
  }, [scene, targetHeight, maxFootprint, scale, motion]);

  useEffect(() => {
    const tint = tintColor ? new THREE.Color(tintColor) : null;
    model.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        const original = model.baseColors.get(material);
        if (original) material.color.copy(tint ?? original);
      }
    });
  }, [model, tintColor]);

  const { actions, names } = useAnimations(animations, rootRef);
  const animationName = useMemo(() => {
    const priorities =
      motion === 'enemy'
        ? ['walk', 'run', 'flying', 'fly', 'idle']
        : ['idle', 'fly', 'flying', 'walk'];
    const lowerNames = names.map((name) => name.toLowerCase());
    for (const word of priorities) {
      const index = lowerNames.findIndex((name) => name.includes(word));
      if (index >= 0) return names[index];
    }
    return names[0];
  }, [motion, names]);

  useEffect(() => {
    if (!animationName) return;
    const action = actions[animationName];
    if (!action) return;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.reset().setEffectiveTimeScale(1).fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.15);
    };
  }, [actions, animationName]);

  const baseScale = model.scale;
  useFrame(({ clock }, delta) => {
    const root = rootRef.current;
    if (!root) return;

    const time = clock.elapsedTime + phaseOffset;
    const targetAngle =
      motion === 'cannon' && entityId
        ? -(engine?.getVisualState().towerAngleMap[entityId] ?? 0)
        : 0;

    if (motion === 'crystal') {
      root.rotation.y += delta * 0.55;
      root.position.y = Math.sin(time * 2.8) * 0.05;
      root.scale.setScalar(baseScale * (1 + Math.sin(time * 2.8) * 0.012));
    } else if (motion === 'cannon') {
      root.rotation.y = dampAngleShortest(root.rotation.y, targetAngle, 14, delta);
      root.position.y = Math.sin(time * 2.1) * 0.012;
      root.scale.setScalar(baseScale);
    } else if (motion === 'enemy') {
      root.position.y = 0;
      root.rotation.y = Math.sin(time * 0.8) * 0.02;
      root.scale.setScalar(baseScale);
    } else {
      root.rotation.y = Math.sin(time * 0.7) * (motion === 'keep' ? 0.008 : 0.018);
      root.position.y = Math.sin(time * 1.8) * 0.012;
      root.scale.setScalar(baseScale * (1 + Math.sin(time * 1.8) * 0.006));
    }
  });

  return (
    <group ref={rootRef}>
      <primitive
        object={model.scene}
        position={model.position}
        scale={model.scale}
      />
    </group>
  );
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
      <GlbModel
        modelPath={modelPath}
        targetHeight={2.1}
        maxFootprint={2.55}
        motion="keep"
      />
      <Sparkles
        count={22}
        position={[0, 0.85, 0]}
        scale={[1.8, 1.7, 1.8]}
        size={2.2}
        speed={0.28}
        color="#f4c76b"
        opacity={0.75}
      />
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
  const motion =
    props.configId === 'frost_obelisk' || props.configId === 'aether_conduit'
      ? 'crystal'
      : props.configId === 'cannon_bastion'
        ? 'cannon'
        : props.configId === 'archer_spire'
          ? 'tower'
          : 'economy';
  const footprint = getBuildableConfig(props.configId).footprint;
  const maxFootprint = Math.max(footprint.width, footprint.height) * CELL_SIZE * 0.88;
  const targetHeight = isTowerId(props.configId)
    ? 1.55
    : Math.min(1.7, 0.75 + Math.max(footprint.width, footprint.height) * 0.2);
  return (
    <Suspense fallback={fallback}>
      <GlbModel
        modelPath={modelPath}
        scale={1 + (props.level - 1) * 0.05}
          targetHeight={targetHeight}
          maxFootprint={maxFootprint}
        motion={motion}
        phaseOffset={props.phaseOffset}
        engine={props.engine}
        entityId={props.entityId}
      />
      {(props.configId === 'frost_obelisk' ||
        props.configId === 'aether_conduit') && (
        <Sparkles
          count={18}
          position={[0, 0.42, 0]}
          scale={[0.8, 1.05, 0.8]}
          size={2.8}
          speed={0.45}
          color={props.configId === 'frost_obelisk' ? '#7ed3e6' : '#f4c76b'}
          opacity={0.85}
        />
      )}
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

class EnemyModelErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback: React.ReactNode; modelPath: string }>,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error(
      `Unable to load enemy model "${this.props.modelPath}"; showing the procedural model instead.`,
      error,
    );
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
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
    <EnemyModelErrorBoundary fallback={fallback} modelPath={modelPath}>
      <Suspense fallback={fallback}>
        <GlbModel
          modelPath={modelPath}
          scale={props.scale}
          targetHeight={0.82}
          maxFootprint={1.05}
          motion="enemy"
          phaseOffset={props.scale}
          tintColor={
            props.isFlashing ? '#ffffff' : props.isChilled ? '#7ed3e6' : undefined
          }
        />
      </Suspense>
    </EnemyModelErrorBoundary>
  );
};
