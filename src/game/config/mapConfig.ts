import {
  DailyQuest,
  GameState,
  GridCoord,
  GridTile,
  PlacedEntity,
  StorageCaps,
  TileType,
} from '../../types/game';
import { BALANCE_CONFIG, getBuildingStatsAtLevel } from './balancing';
import { BUILDING_CONFIGS } from './buildings';

export const GRID_COLS = 12;
export const GRID_ROWS = 10;

export const KEEP_COORD: GridCoord = { col: 10, row: 5 };

export const PATH_WAYPOINTS: GridCoord[] = [
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

export const SPAWN_COORD: GridCoord = PATH_WAYPOINTS[0];

const PATH_KEY_SET = new Set(PATH_WAYPOINTS.map((pt) => `${pt.col},${pt.row}`));
export const LOCKED_TILE_COORDS = new Set<string>();

export function getTileType(col: number, row: number): TileType {
  if (col === SPAWN_COORD.col && row === SPAWN_COORD.row) {
    return 'spawn';
  }
  if (col === KEEP_COORD.col && row === KEEP_COORD.row) {
    return 'core';
  }
  if (PATH_KEY_SET.has(`${col},${row}`)) {
    return 'path';
  }
  if (LOCKED_TILE_COORDS.has(`${col},${row}`)) {
    return 'locked';
  }
  return 'grass';
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
      col: 4,
      row: 4,
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
      row: 5,
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
      row: 7,
      level: 1,
      upgradeStartTimestamp: null,
      upgradeFinishTimestamp: null,
      targetingMode: 'first',
      kills: 0,
      totalDamage: 0,
    },
  ];
}

export function createInitialGridTiles(entities: readonly PlacedEntity[]): GridTile[] {
  const entityMap = new Map<string, string>();
  for (const entity of entities) {
    entityMap.set(`${entity.col},${entity.row}`, entity.id);
  }

  const grid: GridTile[] = [];
  for (let x = 0; x < GRID_COLS; x++) {
    for (let z = 0; z < GRID_ROWS; z++) {
      grid.push({
        x,
        z,
        type: getTileType(x, z),
        entityId: entityMap.get(`${x},${z}`) ?? null,
      });
    }
  }
  return grid;
}

export function syncGridWithEntities(
  grid: readonly GridTile[],
  entities: readonly PlacedEntity[],
): GridTile[] {
  if (grid.length !== GRID_COLS * GRID_ROWS) {
    return createInitialGridTiles(entities);
  }

  const entityMap = new Map<string, string>();
  for (const entity of entities) {
    entityMap.set(`${entity.col},${entity.row}`, entity.id);
  }

  return grid.map((tile) => ({
    x: tile.x,
    z: tile.z,
    type: tile.type === 'locked' ? 'locked' : getTileType(tile.x, tile.z),
    entityId: entityMap.get(`${tile.x},${tile.z}`) ?? null,
  }));
}

function computeInitialStorageCaps(entities: readonly PlacedEntity[]): StorageCaps {
  let maxGold = BALANCE_CONFIG.baseStorageGold;
  let maxAether = BALANCE_CONFIG.baseStorageAether;

  for (const entity of entities) {
    if (entity.configId in BUILDING_CONFIGS) {
      const cfg = BUILDING_CONFIGS[entity.configId as keyof typeof BUILDING_CONFIGS];
      const stats = getBuildingStatsAtLevel(cfg, entity.level);
      maxGold += stats.goldCapBonus;
      maxAether += stats.aetherCapBonus;
    }
  }

  return { maxGold, maxAether };
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
  const entities = createStarterEntities();
  return {
    version: BALANCE_CONFIG.saveVersion,
    resources: {
      gold: BALANCE_CONFIG.initialResources.gold,
      aether: BALANCE_CONFIG.initialResources.aether,
    },
    storageCaps: computeInitialStorageCaps(entities),
    grid: createInitialGridTiles(entities),
    keepHp: BALANCE_CONFIG.initialKeepHp,
    keepMaxHp: BALANCE_CONFIG.initialKeepHp,
    wave: 1,
    waveProgress: {
      enemiesRemainingInQueue: 0,
      activeEnemies: 0,
      totalEnemiesInWave: 0,
      interWaveDelaySec: 0,
    },
    totalKills: 0,
    entities,
    dailyQuests: createDefaultDailyQuests(),
    eclipseBossNextTimestamp: nowMs + BALANCE_CONFIG.bossIntervalMs,
    lastActiveTimestamp: nowMs,
  };
}
