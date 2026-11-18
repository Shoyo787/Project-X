import { DailyQuest, GameState, GridCoord, PlacedEntity, TileType } from '../../types/game';

export const GRID_COLS = 12;
export const GRID_ROWS = 10;

export const BASE_STORAGE_GOLD = 600;
export const BASE_STORAGE_AETHER = 300;

export const BASE_KEEP_GOLD_PER_SEC = 1.5;
export const BASE_KEEP_AETHER_PER_SEC = 0.6;

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

const PATH_KEY_SET = new Set(PATH_WAYPOINTS.map((pt) => `${pt.col},${pt.row}`));

export function getTileType(col: number, row: number): TileType {
  if (col === KEEP_COORD.col && row === KEEP_COORD.row) {
    return 'keep';
  }
  if (PATH_KEY_SET.has(`${col},${row}`)) {
    return 'path';
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
    version: 1,
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
