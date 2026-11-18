import React, { useEffect, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  PATH_WAYPOINTS,
  PATH_WIDTH,
  TOWER_CONFIGS,
  getBuildableFootprint,
  getFootprintCenter,
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

const BOARD_WIDTH = GRID_COLS * CELL_SIZE;
const BOARD_DEPTH = GRID_ROWS * CELL_SIZE;

function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  if (context) {
    context.fillStyle = '#6d8b4e';
    context.fillRect(0, 0, canvas.width, canvas.height);

    let seed = 39217;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < 2600; i += 1) {
      const shade = random() > 0.53 ? '#a7bd79' : '#405d34';
      context.globalAlpha = 0.08 + random() * 0.15;
      context.fillStyle = shade;
      context.beginPath();
      context.ellipse(
        random() * canvas.width,
        random() * canvas.height,
        1 + random() * 3,
        1 + random() * 2,
        random() * Math.PI,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    context.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  return texture;
}

function createRibbonGeometry(
  points: THREE.Vector3[],
  width: number,
  elevation: number,
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)]!;
    const next = points[Math.min(points.length - 1, index + 1)]!;
    const tangent = new THREE.Vector3().subVectors(next, previous).normalize();
    const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x);

    if (index > 0 && index < points.length - 1) {
      const incoming = new THREE.Vector3().subVectors(point, previous).normalize();
      const outgoing = new THREE.Vector3().subVectors(next, point).normalize();
      const incomingNormal = new THREE.Vector3(-incoming.z, 0, incoming.x);
      const outgoingNormal = new THREE.Vector3(-outgoing.z, 0, outgoing.x);
      perpendicular.copy(incomingNormal.add(outgoingNormal).normalize());
      const scale = Math.min(
        2,
        (width * 0.5) / Math.max(0.35, perpendicular.dot(outgoingNormal)),
      );
      perpendicular.multiplyScalar(scale);
    } else {
      perpendicular.multiplyScalar(width * 0.5);
    }

    vertices.push(
      point.x + perpendicular.x,
      elevation,
      point.z + perpendicular.z,
      point.x - perpendicular.x,
      elevation,
      point.z - perpendicular.z,
    );
    normals.push(0, 1, 0, 0, 1, 0);
    const v = index / Math.max(1, points.length - 1);
    uvs.push(0, v, 1, v);

    if (index < points.length - 1) {
      const start = index * 2;
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function createPlacementGrid(): THREE.BufferGeometry {
  const vertices: number[] = [];
  for (let col = 0; col <= GRID_COLS; col += 1) {
    const x = -BOARD_WIDTH * 0.5 + col * CELL_SIZE;
    vertices.push(x, 0.022, -BOARD_DEPTH * 0.5, x, 0.022, BOARD_DEPTH * 0.5);
  }
  for (let row = 0; row <= GRID_ROWS; row += 1) {
    const z = -BOARD_DEPTH * 0.5 + row * CELL_SIZE;
    vertices.push(-BOARD_WIDTH * 0.5, 0.022, z, BOARD_WIDTH * 0.5, 0.022, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

export const IslandGrid3D: React.FC<IslandGrid3DProps> = ({
  engine,
  hoveredTile,
  selectedBuildId,
  selectedEntity,
  onHoverTile,
  onTileClick,
}) => {
  const grassTexture = useMemo(createGroundTexture, []);
  const placementGrid = useMemo(createPlacementGrid, []);
  const roadPoints = useMemo(
    () => PATH_WAYPOINTS.map(({ col, row }) => new THREE.Vector3(...gridToWorld(col, row, 0))),
    [],
  );
  const roadEdge = useMemo(
    () => createRibbonGeometry(roadPoints, PATH_WIDTH + 0.16, 0.014),
    [roadPoints],
  );
  const roadSurface = useMemo(
    () => createRibbonGeometry(roadPoints, PATH_WIDTH, 0.03),
    [roadPoints],
  );

  useEffect(
    () => () => {
      grassTexture.dispose();
      placementGrid.dispose();
      roadEdge.dispose();
      roadSurface.dispose();
    },
    [grassTexture, placementGrid, roadEdge, roadSurface],
  );

  const rangePreview = useMemo(() => {
    if (
      selectedBuildId &&
      isTowerId(selectedBuildId) &&
      hoveredTile &&
      engine.canPlaceAt(hoveredTile.col, hoveredTile.row, selectedBuildId)
    ) {
      const cfg = TOWER_CONFIGS[selectedBuildId];
      const center = getFootprintCenter(
        hoveredTile.col,
        hoveredTile.row,
        cfg.footprint,
      );
      return {
        ...center,
        range: cfg.levels[0].range,
        color: '#2b2623',
        fillOpacity: 0.16,
      };
    }

    if (selectedEntity && isTowerId(selectedEntity.configId)) {
      const cfg = TOWER_CONFIGS[selectedEntity.configId];
      const stats =
        cfg.levels[Math.min(selectedEntity.level - 1, cfg.levels.length - 1)];
      const center = getFootprintCenter(
        selectedEntity.col,
        selectedEntity.row,
        cfg.footprint,
      );
      return {
        ...center,
        range: stats.range,
        color: cfg.accentColor,
        fillOpacity: 0.18,
      };
    }

    return null;
  }, [engine, hoveredTile, selectedBuildId, selectedEntity]);

  const cellFromPoint = (point: THREE.Vector3): GridCoord => ({
    col: Math.floor((point.x + BOARD_WIDTH * 0.5) / CELL_SIZE),
    row: Math.floor((point.z + BOARD_DEPTH * 0.5) / CELL_SIZE),
  });

  const handleSurfaceOver = (event: ThreeEvent<PointerEvent>) => {
    const coord = cellFromPoint(event.point);
    if (coord.col >= 0 && coord.col < GRID_COLS && coord.row >= 0 && coord.row < GRID_ROWS) {
      onHoverTile(coord);
    } else {
      onHoverTile(null);
    }
  };

  const handleSurfaceClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const coord = cellFromPoint(event.point);
    onTileClick(coord.col, coord.row);
  };

  const start = PATH_WAYPOINTS[0]!;
  const startPosition = gridToWorld(start.col, start.row, 0);
  const selectedFootprint = selectedBuildId
    ? getBuildableFootprint(selectedBuildId)
    : null;
  const canPlaceHovered =
    Boolean(selectedBuildId && hoveredTile) &&
    engine.canPlaceAt(hoveredTile!.col, hoveredTile!.row, selectedBuildId!);

  return (
    <group onPointerLeave={() => onHoverTile(null)}>
      <ToonRoundedBox
        args={[BOARD_WIDTH + 0.04, 0.56, BOARD_DEPTH + 0.04]}
        radius={0.14}
        smoothness={4}
        color="#363c42"
        position={[0, -0.31, 0]}
        outlineThickness={0.025}
        castShadow={false}
      />

      <group scale={[1.095, 1, 0.912]}>
        <ToonMesh
          color="#2a2f35"
          position={[0, -1.2, 0]}
          rotation={[0, Math.PI * 0.25, 0]}
          outlineThickness={0.025}
        >
          <cylinderGeometry args={[7.72, 5.4, 1.35, 4]} />
        </ToonMesh>
        <ToonMesh
          color="#1f2328"
          position={[0, -2.68, 0]}
          rotation={[0, Math.PI * 0.25, 0]}
          outlineThickness={0.025}
        >
          <cylinderGeometry args={[5.4, 1.35, 1.65, 4]} />
        </ToonMesh>
      </group>

      <mesh position={[0, -3.93, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <circleGeometry args={[5.8, 36]} />
        <meshBasicMaterial color="#1e1916" transparent opacity={0.15} />
      </mesh>

      <mesh
        position={[0, -0.12, 0]}
        receiveShadow
        onPointerMove={handleSurfaceOver}
        onClick={handleSurfaceClick}
      >
        <boxGeometry args={[BOARD_WIDTH, 0.24, BOARD_DEPTH]} />
        <meshStandardMaterial map={grassTexture} roughness={0.95} />
      </mesh>

      <mesh geometry={roadEdge}>
        <meshStandardMaterial color="#96764e" roughness={1} />
      </mesh>
      <mesh geometry={roadSurface} receiveShadow>
        <meshStandardMaterial color="#c6a06a" roughness={1} />
      </mesh>

      {selectedBuildId && (
        <lineSegments geometry={placementGrid} renderOrder={2}>
          <lineBasicMaterial
            color="#fff4d8"
            transparent
            opacity={0.24}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {selectedBuildId && hoveredTile && selectedFootprint && (
        <mesh
          position={gridToWorld(
            hoveredTile.col + (selectedFootprint.width - 1) * 0.5,
            hoveredTile.row + (selectedFootprint.height - 1) * 0.5,
            0.035,
          )}
          rotation={[-Math.PI * 0.5, 0, 0]}
          renderOrder={3}
        >
          <planeGeometry
            args={[
              selectedFootprint.width * CELL_SIZE,
              selectedFootprint.height * CELL_SIZE,
            ]}
          />
          <meshBasicMaterial
            color={canPlaceHovered ? '#b9e39c' : '#e66b57'}
            transparent
            opacity={0.34}
            depthWrite={false}
          />
        </mesh>
      )}

      <group position={[startPosition[0], -0.05, startPosition[2]]}>
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
