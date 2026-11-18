import React, { useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import {
  GRID_COLS,
  GRID_ROWS,
  PATH_WAYPOINTS,
  TOWER_CONFIGS,
  getTileType,
  isTowerId,
} from '../game/config';
import { GameEngine } from '../game/engine/GameEngine';
import { BuildableId, GridCoord, PlacedEntity } from '../types/game';
import { ToonMesh, ToonRoundedBox, gridToWorld } from './ToonMaterial';

interface IslandGrid3DProps {
  engine: GameEngine;
  hoveredTile: GridCoord | null;
  selectedBuildId: BuildableId | null;
  selectedEntity: PlacedEntity | null;
  onHoverTile: (coord: GridCoord | null) => void;
  onTileClick: (col: number, row: number) => void;
}

const GRASS_PALETTE = ['#4d7c3f', '#467339', '#538444', '#49763b', '#508041'];

export const IslandGrid3D: React.FC<IslandGrid3DProps> = ({
  engine,
  hoveredTile,
  selectedBuildId,
  selectedEntity,
  onHoverTile,
  onTileClick,
}) => {
  const tiles = useMemo(() => {
    const list: {
      col: number;
      row: number;
      type: 'grass' | 'path' | 'keep';
      seed: number;
    }[] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        list.push({
          col,
          row,
          type: getTileType(col, row),
          seed: (col * 31 + row * 17) % 5,
        });
      }
    }
    return list;
  }, []);

  const rangePreview = useMemo(() => {
    if (selectedBuildId && isTowerId(selectedBuildId) && hoveredTile) {
      if (engine.canPlaceAt(hoveredTile.col, hoveredTile.row)) {
        const cfg = TOWER_CONFIGS[selectedBuildId];
        return {
          col: hoveredTile.col,
          row: hoveredTile.row,
          range: cfg.levels[0].range,
          color: '#2b2623',
          fillOpacity: 0.16,
        };
      }
    }
    if (selectedEntity && isTowerId(selectedEntity.configId)) {
      const cfg = TOWER_CONFIGS[selectedEntity.configId];
      const stats =
        cfg.levels[Math.min(selectedEntity.level - 1, cfg.levels.length - 1)];
      return {
        col: selectedEntity.col,
        row: selectedEntity.row,
        range: stats.range,
        color: cfg.accentColor,
        fillOpacity: 0.18,
      };
    }
    return null;
  }, [engine, hoveredTile, selectedBuildId, selectedEntity]);

  const startWp = PATH_WAYPOINTS[0];
  const startPos = gridToWorld(startWp.col, startWp.row, 0);

  const handleTileOver =
    (col: number, row: number) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHoverTile({ col, row });
    };

  const handleTileClick =
    (col: number, row: number) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onTileClick(col, row);
    };

  return (
    <group onPointerLeave={() => onHoverTile(null)}>
      {/* Floating Slate Cliff Monolith Base */}
      <group>
        {/* Upper rocky collar flush with the 12x10 tiles */}
        <ToonRoundedBox
          args={[GRID_COLS + 0.04, 0.56, GRID_ROWS + 0.04]}
          radius={0.14}
          smoothness={4}
          color="#363c42"
          position={[0, -0.5, 0]}
          outlineThickness={0.025}
        />

        {/* Mid tapered cliff stratum (flush 12.0 x 10.0 top) */}
        <group scale={[1.095, 1, 0.912]}>
          <ToonMesh
            color="#2a2f35"
            position={[0, -1.42, 0]}
            rotation={[0, Math.PI * 0.25, 0]}
            outlineThickness={0.025}
          >
            <cylinderGeometry args={[7.72, 5.4, 1.35, 4]} />
          </ToonMesh>

          {/* Tapered deep slate keel */}
          <ToonMesh
            color="#1f2328"
            position={[0, -2.9, 0]}
            rotation={[0, Math.PI * 0.25, 0]}
            outlineThickness={0.025}
          >
            <cylinderGeometry args={[5.4, 1.35, 1.65, 4]} />
          </ToonMesh>
        </group>

        {/* Soft ambient shadow disc beneath the floating island */}
        <mesh position={[0, -4.15, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
          <circleGeometry args={[5.8, 36]} />
          <meshBasicMaterial color="#1e1916" transparent opacity={0.15} />
        </mesh>
      </group>

      {/* 12x10 Interactive Rounded Grid Tiles */}
      {tiles.map((tile) => {
        const isHovered =
          hoveredTile?.col === tile.col && hoveredTile?.row === tile.row;

        if (tile.type === 'path') {
          const [wx, , wz] = gridToWorld(tile.col, tile.row, 0);
          return (
            <group key={`${tile.col}-${tile.row}`} position={[wx, 0, wz]}>
              <ToonRoundedBox
                args={[0.96, 0.18, 0.96]}
                radius={0.07}
                smoothness={4}
                color={tile.seed % 2 === 0 ? '#d4a96a' : '#c89c5d'}
                position={[0, -0.14, 0]}
                outlineThickness={0.018}
                onPointerOver={handleTileOver(tile.col, tile.row)}
                onClick={handleTileClick(tile.col, tile.row)}
              />
              {isHovered && (
                <mesh position={[0, -0.04, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
                  <ringGeometry args={[0.34, 0.44, 24]} />
                  <meshBasicMaterial
                    color={selectedBuildId ? '#c94a38' : '#fff7dc'}
                    transparent
                    opacity={0.75}
                  />
                </mesh>
              )}
            </group>
          );
        }

        if (tile.type === 'keep') {
          const [wx, , wz] = gridToWorld(tile.col, tile.row, 0);
          return (
            <group key={`${tile.col}-${tile.row}`} position={[wx, 0, wz]}>
              <ToonRoundedBox
                args={[0.97, 0.24, 0.97]}
                radius={0.08}
                smoothness={4}
                color="#b8a586"
                position={[0, -0.11, 0]}
                outlineThickness={0.02}
                onPointerOver={handleTileOver(tile.col, tile.row)}
                onClick={handleTileClick(tile.col, tile.row)}
              />
            </group>
          );
        }

        // Rounded mossy sage grass tile
        const [wx, , wz] = gridToWorld(tile.col, tile.row, 0);
        const hasEntity = Boolean(engine.getEntityAt(tile.col, tile.row));
        const canPlaceHere = selectedBuildId
          ? engine.canPlaceAt(tile.col, tile.row)
          : true;

        return (
          <group key={`${tile.col}-${tile.row}`} position={[wx, 0, wz]}>
            <ToonRoundedBox
              args={[0.96, 0.24, 0.96]}
              radius={0.08}
              smoothness={4}
              color={GRASS_PALETTE[tile.seed]}
              position={[0, -0.11, 0]}
              outlineThickness={0.018}
              onPointerOver={handleTileOver(tile.col, tile.row)}
              onClick={handleTileClick(tile.col, tile.row)}
            />

            {/* Smooth decorative low-poly tufts & river stones on empty grass tiles */}
            {!hasEntity && tile.seed === 1 && (
              <ToonMesh
                color="#335928"
                position={[-0.22, 0.06, 0.18]}
                outlineThickness={0.014}
              >
                <coneGeometry args={[0.07, 0.13, 24]} />
              </ToonMesh>
            )}
            {!hasEntity && tile.seed === 4 && (
              <ToonMesh
                color="#6a727a"
                position={[0.24, 0.04, -0.18]}
                scale={[1.2, 0.72, 1]}
                outlineThickness={0.014}
              >
                <sphereGeometry args={[0.07, 24, 18]} />
              </ToonMesh>
            )}

            {/* Hover tile feedback */}
            {isHovered && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
                <planeGeometry args={[0.82, 0.82]} />
                <meshBasicMaterial
                  color={
                    selectedBuildId
                      ? canPlaceHere
                        ? '#f4e4c1'
                        : '#c94a38'
                      : '#fff8de'
                  }
                  transparent
                  opacity={0.42}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Raider Entry Gate Pillars */}
      <group position={[startPos[0], -0.05, startPos[2]]}>
        <ToonRoundedBox
          args={[0.18, 0.48, 0.18]}
          radius={0.05}
          color="#4e565e"
          position={[-0.38, 0.24, -0.36]}
          outlineThickness={0.02}
        />
        <ToonRoundedBox
          args={[0.18, 0.48, 0.18]}
          radius={0.05}
          color="#4e565e"
          position={[-0.38, 0.24, 0.36]}
          outlineThickness={0.02}
        />
      </group>

      {/* Tower Range Ring Preview */}
      {rangePreview && (
        <group position={gridToWorld(rangePreview.col, rangePreview.row, 0.035)}>
          <mesh rotation={[-Math.PI * 0.5, 0, 0]}>
            <circleGeometry args={[rangePreview.range, 64]} />
            <meshBasicMaterial
              color="#f4e4c1"
              transparent
              opacity={rangePreview.fillOpacity}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI * 0.5, 0, 0]}>
            <ringGeometry args={[rangePreview.range - 0.055, rangePreview.range, 64]} />
            <meshBasicMaterial
              color={rangePreview.color}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};
