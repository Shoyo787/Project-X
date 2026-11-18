import {
  BuildableId,
  DailyQuest,
  GameState,
  GridCoord,
  PlacedEntity,
  TileType,
} from '../../types/game';
import { BUILDING_CONFIGS } from './buildings';
import { TOWER_CONFIGS } from './towers';

export const GRID_COLS = 24;
export const GRID_ROWS = 20;
export const CELL_SIZE = 0.5;
export const PATH_WIDTH = 1;
export const KEEP_FOOTPRINT = { width: 6, height: 6 };

export const BASE_STORAGE_GOLD = 600;
export const BASE_STORAGE_AETHER = 300;

export const BASE_KEEP_GOLD_PER_SEC = 1.5;
export const BASE_KEEP_AETHER_PER_SEC = 0.6;

export const KEEP_COORD: GridCoord = { col: 18, row: 8 };

const ORIGINAL_PATH_WAYPOINTS: GridCoord[] = [
  { col: 0, row: 2 },
  { col: 1, row: 2 },
  { col: 2, row: 2 },
  { col: 3, row: 2 },
  { col: 3, row: 3 },
  { col: 3, row: 4 },
  { col: 3, row: 5 },
  { col: 3, row: 6 },
  { col: 3, row: 7 },
  { col: 4, row: 7 },
  { col: 5, row: 7 },
  { col: 6, row: 7 },
  { col: 6, row: 6 },
  { col: 6, row: 5 },
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 },
  { col: 7, row: 2 },
  { col: 8, row: 2 },
  { col: 9, row: 2 },
  { col: 9, row: 3 },
  { col: 9, row: 4 },
  { col: 9, row: 5 },
  { col: 10, row: 5 },
];

export const PATH_WAYPOINTS: GridCoord[] = ORIGINAL_PATH_WAYPOINTS.flatMap(
  (point, index) => {
    const scaled = { col: point.col * 2 + 0.5, row: point.row * 2 + 0.5 };
    const nextPoint = ORIGINAL_PATH_WAYPOINTS[index + 1];
    if (!nextPoint) return [scaled];

    return [
      scaled,
      {
        col: point.col + nextPoint.col + 0.5,
        row: point.row + nextPoint.row + 0.5,
      },
    ];
  },
);

export function getBuildableFootprint(configId: BuildableId) {
  if (
    configId === 'archer_spire' ||
    configId === 'frost_obelisk' ||
    configId === 'cannon_bastion'
  ) {
    return TOWER_CONFIGS[configId].footprint;
  }
  return BUILDING_CONFIGS[configId].footprint;
}

export function getFootprintCenter(
  col: number,
  row: number,
  footprint: { width: number; height: number },
): GridCoord {
  return {
    col: col + (footprint.width - 1) * 0.5,
    row: row + (footprint.height - 1) * 0.5,
  };
}

function isOnPath(col: number, row: number): boolean {
  const x = (col - (GRID_COLS - 1) * 0.5) * CELL_SIZE;
  const z = (row - (GRID_ROWS - 1) * 0.5) * CELL_SIZE;
  const halfWidth = PATH_WIDTH * 0.5;

  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i += 1) {
    const start = PATH_WAYPOINTS[i];
    const end = PATH_WAYPOINTS[i + 1];
    if (!start || !end) continue;

    const ax = (start.col - (GRID_COLS - 1) * 0.5) * CELL_SIZE;
    const az = (start.row - (GRID_ROWS - 1) * 0.5) * CELL_SIZE;
    const bx = (end.col - (GRID_COLS - 1) * 0.5) * CELL_SIZE;
    const bz = (end.row - (GRID_ROWS - 1) * 0.5) * CELL_SIZE;
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq
      ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSq))
      : 0;
    const nearestX = ax + dx * t;
    const nearestZ = az + dz * t;
    if (Math.hypot(x - nearestX, z - nearestZ) <= halfWidth) return true;
  }

  return false;
}

export function getTileType(col: number, row: number): TileType {
  if (
    col >= KEEP_COORD.col &&
    col < KEEP_COORD.col + KEEP_FOOTPRINT.width &&
    row >= KEEP_COORD.row &&
    row < KEEP_COORD.row + KEEP_FOOTPRINT.height
  ) {
    return 'keep';
  }
  return isOnPath(col, row) ? 'path' : 'grass';
}

export function isValidGridCoord(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

export function createStarterEntities(): PlacedEntity[] {
  return [
    {
      id: 'starter_archer_1',
      configId: 'archer_spire',
      category: 'tower',
      col: 8,
      row: 8,
      level: 1,
      upgradeStartTimestamp: null,
      upgradeFinishTimestamp: null,
      targetingMode: 'first',
      kills: 0,
      totalDamage: 0,
    },
    {
      id: 'starter_quarry_1',
      configId: 'quarry_mine',
      category: 'building',
      col: 1,
      row: 9,
      level: 1,
      upgradeStartTimestamp: null,
      upgradeFinishTimestamp: null,
      targetingMode: 'first',
      kills: 0,
      totalDamage: 0,
    },
    {
      id: 'starter_vault_1',
      configId: 'storage_vault',
      category: 'building',
      col: 1,
      row: 13,
      level: 1,
      upgradeStartTimestamp: null,
      upgradeFinishTimestamp: null,
      targetingMode: 'first',
      kills: 0,
      totalDamage: 0,
    },
  ];
}

export function createDefaultDailyQuests(): DailyQuest[] {
  return [
    {
      id: 'quest_raiders',
      title: 'Gatehouse Watch',
      description: 'Defeat 100 raiders assaulting the valley road.',
      type: 'defeat_raiders',
      target: 100,
      progress: 0,
      rewardGold: 220,
      rewardAether: 90,
      claimed: false,
    },
    {
      id: 'quest_upgrades',
      title: 'Royal Architect',
      description: 'Commission 2 tower or keep building upgrades.',
      type: 'start_upgrades',
      target: 2,
      progress: 0,
      rewardGold: 180,
      rewardAether: 110,
      claimed: false,
    },
    {
      id: 'quest_resources',
      title: 'Full Granaries',
      description: 'Harvest 450 Timber & Gold from raids and quarries.',
      type: 'collect_resources',
      target: 450,
      progress: 0,
      rewardGold: 260,
      rewardAether: 120,
      claimed: false,
    },
  ];
}

export function createInitialGameState(nowMs: number = Date.now()): GameState {
  // Schedule the daily Eclipse Siege Boss countdown 6 hours ahead by default
  const sixHoursMs = 6 * 60 * 60 * 1000;
  return {
    version: 2,
    resources: {
      gold: 340,
      aether: 140,
    },
    keepHp: 20,
    keepMaxHp: 20,
    wave: 1,
    totalKills: 0,
    entities: createStarterEntities(),
    dailyQuests: createDefaultDailyQuests(),
    eclipseBossNextTimestamp: nowMs + sixHoursMs,
    lastActiveTimestamp: nowMs,
  };
}
