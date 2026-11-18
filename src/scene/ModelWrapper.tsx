import React, { Suspense, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EnemyId } from '../types/game';
import { ProceduralStructure, StructureModelProps } from './ProceduralModels3D';
import { INK_OUTLINE_COLOR, NOOP_RAYCAST, ToonMesh, ToonRoundedBox } from './ToonMaterial';

interface GlbModelProps {
  modelPath: string;
  scale?: number;
  tintColor?: string;
  disableRaycast?: boolean;
}

const GlbModel: React.FC<GlbModelProps> = ({
  modelPath,
  scale = 1,
  tintColor,
  disableRaycast = false,
}) => {
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
      if (disableRaycast) {
        obj.raycast = NOOP_RAYCAST;
      }

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
        if (disableRaycast) outline.raycast = NOOP_RAYCAST;
        outline.userData.hasInkOutline = true;
        obj.add(outline);
        obj.userData.hasInkOutline = true;
      }
    });

    return clone;
  }, [scene, tintColor, disableRaycast]);

  return <primitive object={styledScene} scale={scale} />;
};

export const KeepModel3D: React.FC<{ modelPath?: string }> = ({ modelPath }) => {
  const flagRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (flagRef.current) {
      flagRef.current.rotation.y = Math.sin(clock.elapsedTime * 4.2) * 0.22;
    }
  });

  const fallback = (
    <group>
      <ToonRoundedBox args={[0.86, 0.44, 0.86]} radius={0.018} smoothness={1} color="#b5a68e" position={[0, 0.22, 0]} />
      {[[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]].map(([x, z], idx) => (
        <ToonRoundedBox key={idx} args={[0.16, 0.11, 0.16]} radius={0.01} smoothness={1} color="#c5b69e" position={[x, 0.495, z]} outlineThickness={0.018} />
      ))}
      <ToonRoundedBox args={[0.56, 0.56, 0.56]} radius={0.016} smoothness={1} color="#d6c7ae" position={[0, 0.66, 0]} />
      <ToonRoundedBox args={[0.24, 0.34, 0.08]} radius={0.01} smoothness={1} color="#5e4026" position={[0, 0.22, 0.42]} />
      <ToonMesh color="#c94a38" position={[0, 1.21, 0]} flatShading>
        <coneGeometry args={[0.45, 0.56, 6]} />
      </ToonMesh>
      <ToonMesh color="#4a392a" position={[0, 1.56, 0]} flatShading outlineThickness={0.015}>
        <cylinderGeometry args={[0.022, 0.022, 0.44, 6]} />
      </ToonMesh>
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

export const ModelWrapper: React.FC<StructureModelProps> = ({ modelPath, ...props }) => {
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
      <ToonMesh color={bodyColor} position={[0, 0.22, 0]} scale={[0.92, 1.15, 0.88]} disableRaycast>
        <sphereGeometry args={[0.18, 24, 18]} />
      </ToonMesh>

      {isBoss ? (
        <>
          <ToonMesh color={trimColor} position={[0, 0.49, 0]} disableRaycast>
            <sphereGeometry args={[0.14, 24, 18]} />
          </ToonMesh>
          <ToonMesh color={trimColor} position={[0, 0.62, 0]} disableRaycast>
            <coneGeometry args={[0.15, 0.22, 24]} />
          </ToonMesh>
          <ToonMesh color={trimColor} position={[-0.2, 0.31, 0]} scale={[1, 1.25, 1]} disableRaycast>
            <sphereGeometry args={[0.1, 20, 16]} />
          </ToonMesh>
          <ToonMesh color={trimColor} position={[0.2, 0.31, 0]} scale={[1, 1.25, 1]} disableRaycast>
            <sphereGeometry args={[0.1, 20, 16]} />
          </ToonMesh>
        </>
      ) : configId === 'aether_wisp' ? (
        <ToonMesh color={trimColor} emissive="#5ec2d4" emissiveIntensity={0.38} position={[0, 0.52, 0]} disableRaycast>
          <sphereGeometry args={[0.15, 24, 18]} />
        </ToonMesh>
      ) : (
        <ToonMesh color={trimColor} position={[0, 0.49, 0]} disableRaycast>
          <sphereGeometry args={[0.13, 24, 18]} />
        </ToonMesh>
      )}

      {configId === 'shield_brigand' && (
        <ToonMesh color="#b59264" position={[0.2, 0.22, 0.08]} rotation={[0, 0, Math.PI * 0.5]} outlineThickness={0.016} disableRaycast>
          <cylinderGeometry args={[0.15, 0.15, 0.05, 24]} />
        </ToonMesh>
      )}
    </group>
  );
};

export const EnemyModelWrapper: React.FC<EnemyModelProps> = ({ modelPath, ...props }) => {
  const fallback = <ProceduralEnemy {...props} />;
  if (!modelPath) return fallback;
  return (
    <Suspense fallback={fallback}>
      <GlbModel
        modelPath={modelPath}
        scale={props.scale}
        tintColor={props.isFlashing ? '#ffffff' : props.isChilled ? '#7ed3e6' : undefined}
        disableRaycast
      />
    </Suspense>
  );
};
