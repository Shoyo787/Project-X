import React, { useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import {
  GRID_COLS,
  GRID_ROWS,
  PATH_WAYPOINTS,
  TOWER_CONFIGS,
  getTowerStatsAtLevel,
  isTowerId,
} from '../game/config';
import { GameEngine } from '../game/engine/GameEngine';
import { BuildableId, GridCoord, PlacedEntity } from '../types/game';
import { NOOP_RAYCAST, ToonMesh, ToonRoundedBox, gridToWorld } from './ToonMaterial';

interface IslandGrid3DProps {
  engine: GameEngine;
  hoveredTile: GridCoord | null;
  selectedBuildId: BuildableId | null;
  selectedEntity: PlacedEntity | null;
  onHoverTile: (coord: GridCoord | null) => void;
  onTileClick: (col: number, row: number) => void;
}

const GRASS_PALETTE = ['#4d7c3f', '#467339', '#538444', '#49763b', '#508041'];

const CLIFF_BUTTRESSES: {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: [number, number, number];
  color: string;
}[] = [
  { pos: [-5.0, -1.35, -3.1], rot: [0.3, 0.5, 0.2], scale: [1.15, 1.05, 0.95], color: '#2e343a' },
  { pos: [5.0, -1.4, -3.0], rot: [-0.2, 1.1, 0.3], scale: [1.1, 1.0, 1.05], color: '#282d33' },
  { pos: [-5.1, -1.42, 2.5], rot: [0.4, -0.6, -0.2], scale: [1.05, 1.05, 1.1], color: '#2a2f35' },
  { pos: [5.1, -1.32, 2.8], rot: [-0.3, 0.8, -0.2], scale: [1.15, 0.98, 1.0], color: '#31373d' },
  { pos: [-1.9, -1.5, 4.1], rot: [0.2, 0.3, 0.4], scale: [1.2, 1.02, 0.95], color: '#262b30' },
  { pos: [2.1, -1.48, -4.0], rot: [-0.2, -0.4, 0.3], scale: [1.15, 1.04, 0.95], color: '#2b3036' },
];

export const IslandGrid3D: React.FC<IslandGrid3DProps> = ({
  engine,
  hoveredTile,
  selectedBuildId,
  selectedEntity,
  onHoverTile,
  onTileClick,
}) => {
  const gridTiles = engine.getState().grid;

  const rangePreview = useMemo(() => {
    if (selectedBuildId && isTowerId(selectedBuildId) && hoveredTile) {
      if (engine.canPlaceAt(hoveredTile.col, hoveredTile.row)) {
        const cfg = TOWER_CONFIGS[selectedBuildId];
        return {
          col: hoveredTile.col,
          row: hoveredTile.row,
          range: getTowerStatsAtLevel(cfg, 1).range,
          color: '#2b2623',
          fillOpacity: 0.16,
        };
      }
    }
    if (selectedEntity && isTowerId(selectedEntity.configId)) {
      const cfg = TOWER_CONFIGS[selectedEntity.configId];
      return {
        col: selectedEntity.col,
        row: selectedEntity.row,
        range: getTowerStatsAtLevel(cfg, selectedEntity.level).range,
        color: cfg.accentColor,
        fillOpacity: 0.18,
      };
    }
    return null;
  }, [engine, hoveredTile, selectedBuildId, selectedEntity]);

  const startWp = PATH_WAYPOINTS[0];
  const startPos = gridToWorld(startWp.col, startWp.row, 0);

  const handleTileOver = (col: number, row: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHoverTile({ col, row });
  };

  const handleTileClick = (col: number, row: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onTileClick(col, row);
  };

  return (
    <group onPointerLeave={() => onHoverTile(null)}>
      {/* Floating Slate Cliff Monolith Base (non-interactive) */}
      <group>
        <ToonRoundedBox args={[GRID_COLS + 0.04, 0.56, GRID_ROWS + 0.04]} radius={0.02} smoothness={1} color="#363c42" position={[0, -0.5, 0]} outlineThickness={0.025} disableRaycast />
        <group scale={[0.84, 1, 0.7]}>
          <ToonMesh color="#2a2f35" position={[0, -1.42, 0]} rotation={[0, Math.PI * 0.125, 0]} flatShading outlineThickness={0.025} disableRaycast>
            <cylinderGeometry args={[7.72, 5.4, 1.35, 8]} />
          </ToonMesh>
          <ToonMesh color="#1f2328" position={[0, -2.9, 0]} scale={[0.92, 1, 0.92]} flatShading outlineThickness={0.025} disableRaycast>
            <cylinderGeometry args={[5.4, 1.35, 1.65, 6]} />
          </ToonMesh>
        </group>
        {CLIFF_BUTTRESSES.map((rock, idx) => (
          <ToonMesh key={idx} color={rock.color} position={rock.pos} rotation={rock.rot} scale={rock.scale} flatShading outlineThickness={0.024} disableRaycast>
            <dodecahedronGeometry args={[0.95, 0]} />
          </ToonMesh>
        ))}
        <mesh position={[0, -4.15, 0]} rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
          <circleGeometry args={[5.8, 36]} />
          <meshBasicMaterial color="#1e1916" transparent opacity={0.15} />
        </mesh>
      </group>

      {/* Interactive Grid Tiles Driven by GameState.grid */}
      {gridTiles.map((tile) => {
        const seed = (tile.x * 31 + tile.z * 17) % 5;
        const [wx, , wz] = gridToWorld(tile.x, tile.z, 0);
        const isHovered = hoveredTile?.col === tile.x && hoveredTile?.row === tile.z;

        if (tile.type === 'path' || tile.type === 'spawn') {
          return (
            <group key={`${tile.x}-${tile.z}`} position={[wx, 0, wz]}>
              <ToonRoundedBox args={[0.96, 0.18, 0.96]} radius={0.015} smoothness={1} color={seed % 2 === 0 ? '#d4a96a' : '#c89c5d'} position={[0, -0.14, 0]} outlineThickness={0.018} onPointerOver={handleTileOver(tile.x, tile.z)} onClick={handleTileClick(tile.x, tile.z)} />
              <ToonRoundedBox args={[0.84, 0.03, 0.84]} radius={0.008} smoothness={1} color={seed % 2 === 0 ? '#dfc08a' : '#cfa86b'} position={[0, -0.045, 0]} outlineThickness={0.014} disableRaycast />
              {isHovered && (
                <mesh position={[0, -0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
                  <ringGeometry args={[0.34, 0.44, 24]} />
                  <meshBasicMaterial color={selectedBuildId ? '#c94a38' : '#fff7dc'} transparent opacity={0.75} />
                </mesh>
              )}
            </group>
          );
        }

        if (tile.type === 'core' || tile.type === 'locked') {
          const isCore = tile.type === 'core';
          return (
            <group key={`${tile.x}-${tile.z}`} position={[wx, 0, wz]}>
              <ToonRoundedBox
                args={[isCore ? 0.97 : 0.96, isCore ? 0.24 : 0.2, isCore ? 0.97 : 0.96]}
                radius={isCore ? 0.018 : 0.015}
                smoothness={1}
                color={isCore ? '#b8a586' : '#444b52'}
                position={[0, isCore ? -0.11 : -0.13, 0]}
                outlineThickness={isCore ? 0.02 : 0.018}
                onPointerOver={handleTileOver(tile.x, tile.z)}
                onClick={handleTileClick(tile.x, tile.z)}
              />
            </group>
          );
        }

        const hasEntity = tile.entityId !== null;
        const canPlaceHere = selectedBuildId ? engine.canPlaceAt(tile.x, tile.z) : true;

        return (
          <group key={`${tile.x}-${tile.z}`} position={[wx, 0, wz]}>
            <ToonRoundedBox args={[0.96, 0.24, 0.96]} radius={0.02} smoothness={1} color={GRASS_PALETTE[seed]} position={[0, -0.11, 0]} outlineThickness={0.018} onPointerOver={handleTileOver(tile.x, tile.z)} onClick={handleTileClick(tile.x, tile.z)} />

            {!hasEntity && seed === 1 && (
              <group>
                <ToonMesh color="#335928" position={[-0.22, 0.08, 0.18]} outlineThickness={0.013} disableRaycast>
                  <sphereGeometry args={[0.075, 20, 16]} />
                </ToonMesh>
                <ToonMesh color="#3f6b32" position={[-0.28, 0.05, 0.23]} outlineThickness={0.012} disableRaycast>
                  <sphereGeometry args={[0.058, 20, 16]} />
                </ToonMesh>
                <ToonMesh color="#3f6b32" position={[-0.16, 0.055, 0.14]} outlineThickness={0.012} disableRaycast>
                  <sphereGeometry args={[0.062, 20, 16]} />
                </ToonMesh>
              </group>
            )}
            {!hasEntity && seed === 4 && (
              <group>
                <ToonMesh color="#6a727a" position={[0.24, 0.05, -0.18]} rotation={[0.4, 0.8, 0.2]} scale={[1.15, 0.8, 1]} flatShading outlineThickness={0.014} disableRaycast>
                  <dodecahedronGeometry args={[0.085, 0]} />
                </ToonMesh>
                <ToonMesh color="#555c63" position={[0.14, 0.035, -0.24]} rotation={[0.2, 0.5, 0.3]} flatShading outlineThickness={0.012} disableRaycast>
                  <octahedronGeometry args={[0.05, 0]} />
                </ToonMesh>
              </group>
            )}

            {isHovered && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.82, 0.82]} />
                <meshBasicMaterial color={selectedBuildId ? (canPlaceHere ? '#f4e4c1' : '#c94a38') : '#fff8de'} transparent opacity={0.42} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Raider Entry Gate Pillars (non-interactive) */}
      <group position={[startPos[0], -0.05, startPos[2]]}>
        <ToonRoundedBox args={[0.18, 0.48, 0.18]} radius={0.015} smoothness={1} color="#4e565e" position={[-0.38, 0.24, -0.36]} outlineThickness={0.02} disableRaycast />
        <ToonRoundedBox args={[0.24, 0.07, 0.24]} radius={0.01} smoothness={1} color="#67717b" position={[-0.38, 0.515, -0.36]} outlineThickness={0.018} disableRaycast />
        <ToonRoundedBox args={[0.18, 0.48, 0.18]} radius={0.015} smoothness={1} color="#4e565e" position={[-0.38, 0.24, 0.36]} outlineThickness={0.02} disableRaycast />
        <ToonRoundedBox args={[0.24, 0.07, 0.24]} radius={0.01} smoothness={1} color="#67717b" position={[-0.38, 0.515, 0.36]} outlineThickness={0.018} disableRaycast />
      </group>

      {/* Tower Range Ring Preview (non-interactive) */}
      {rangePreview && (
        <group position={gridToWorld(rangePreview.col, rangePreview.row, 0.035)}>
          <mesh rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[rangePreview.range, 64]} />
            <meshBasicMaterial color="#f4e4c1" transparent opacity={rangePreview.fillOpacity} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI * 0.5, 0, 0]} raycast={NOOP_RAYCAST}>
            <ringGeometry args={[rangePreview.range - 0.055, rangePreview.range, 64]} />
            <meshBasicMaterial color={rangePreview.color} transparent opacity={0.85} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
};
