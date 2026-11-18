import React from 'react';
import { Outlines, RoundedBox } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { GRID_COLS, GRID_ROWS } from '../game/config';

export const INK_OUTLINE_COLOR = '#1e1916';

export const NOOP_RAYCAST = (): void => {};

export function gridToWorld(
  col: number,
  row: number,
  y = 0,
): [number, number, number] {
  return [col - (GRID_COLS - 1) * 0.5, y, row - (GRID_ROWS - 1) * 0.5];
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
  disableRaycast?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  transparent?: boolean;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  flatShading?: boolean;
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
  disableRaycast = false,
  castShadow = true,
  receiveShadow = true,
  transparent = false,
  opacity = 1,
  roughness = 0.85,
  metalness = 0.02,
  flatShading = false,
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
      raycast={disableRaycast ? NOOP_RAYCAST : undefined}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {children}
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        flatShading={flatShading}
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
  disableRaycast?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  transparent?: boolean;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  flatShading?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

export const ToonRoundedBox: React.FC<ToonRoundedBoxProps> = ({
  args,
  radius = 0.02,
  smoothness = 1,
  color,
  position,
  rotation,
  scale,
  outlineThickness = 0.025,
  outlineAngle = 25,
  showOutline = true,
  disableRaycast = false,
  castShadow = true,
  receiveShadow = true,
  transparent = false,
  opacity = 1,
  roughness = 0.85,
  metalness = 0.02,
  flatShading = false,
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
      raycast={disableRaycast ? NOOP_RAYCAST : undefined}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        flatShading={flatShading}
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
