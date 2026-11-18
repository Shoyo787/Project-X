import React from 'react';
import { Outlines, RoundedBox } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CELL_SIZE, GRID_COLS, GRID_ROWS } from '../game/config';

export const INK_OUTLINE_COLOR = '#1e1916';

let cachedGradientMap: THREE.DataTexture | null = null;

export function getToonGradientMap(): THREE.DataTexture {
  if (cachedGradientMap) return cachedGradientMap;

  const data = new Uint8Array([
    108, 108, 108, 255,
    162, 162, 162, 255,
    218, 218, 218, 255,
    255, 255, 255, 255,
  ]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedGradientMap = texture;
  return texture;
}

export function gridToWorld(
  col: number,
  row: number,
  y = 0,
): [number, number, number] {
  return [
    (col - (GRID_COLS - 1) * 0.5) * CELL_SIZE,
    y,
    (row - (GRID_ROWS - 1) * 0.5) * CELL_SIZE,
  ];
}

export interface ToonMeshProps {
  children: React.ReactNode;
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  outlineThickness?: number;
  outlineAngle?: number;
  showOutline?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  transparent?: boolean;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

export const ToonMesh: React.FC<ToonMeshProps> = ({
  children,
  color,
  position,
  rotation,
  scale,
  outlineThickness = 0.025,
  outlineAngle = 25,
  showOutline = true,
  castShadow = true,
  receiveShadow = true,
  transparent = false,
  opacity = 1,
  roughness = 0.85,
  metalness = 0.02,
  emissive = '#000000',
  emissiveIntensity = 0,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {children}
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        flatShading={false}
        transparent={transparent}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
      {showOutline && (
        <Outlines
          screenspace
          thickness={outlineThickness}
          color={INK_OUTLINE_COLOR}
          angle={outlineAngle}
        />
      )}
    </mesh>
  );
};

export interface ToonRoundedBoxProps {
  args: [number, number, number];
  radius?: number;
  smoothness?: number;
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  outlineThickness?: number;
  outlineAngle?: number;
  showOutline?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  transparent?: boolean;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

export const ToonRoundedBox: React.FC<ToonRoundedBoxProps> = ({
  args,
  radius = 0.08,
  smoothness = 4,
  color,
  position,
  rotation,
  scale,
  outlineThickness = 0.025,
  outlineAngle = 25,
  showOutline = true,
  castShadow = true,
  receiveShadow = true,
  transparent = false,
  opacity = 1,
  roughness = 0.85,
  metalness = 0.02,
  emissive = '#000000',
  emissiveIntensity = 0,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const maxSafeRadius = Math.min(args[0], args[1], args[2]) * 0.42;
  const effectiveRadius = Math.min(radius, maxSafeRadius);

  return (
    <RoundedBox
      args={args}
      radius={effectiveRadius}
      smoothness={smoothness}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        flatShading={false}
        transparent={transparent}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
      {showOutline && (
        <Outlines
          screenspace
          thickness={outlineThickness}
          color={INK_OUTLINE_COLOR}
          angle={outlineAngle}
        />
      )}
    </RoundedBox>
  );
};
