export type ResourceType = 'gold' | 'aether';

export type EntityCategory = 'tower' | 'building';

export type TowerId = 'archer_spire' | 'frost_obelisk' | 'cannon_bastion';

export type BuildingId = 'quarry_mine' | 'aether_conduit' | 'storage_vault';

export type BuildableId = TowerId | BuildingId;

export type TargetingMode = 'first' | 'strongest' | 'closest';

export type TileType = 'grass' | 'path' | 'keep';

export interface GridCoord {
  col: number;
  row: number;
}

export interface TowerLevelStats {
  level: number;
  costGold: number;
  costAether: number;
  upgradeTimeSeconds: number;
  damage: number;
  range: number;
  fireRate: number;
  splashRadius?: number;
  slowFactor?: number;
  slowDurationMs?: number;
}

export interface TowerConfig {
  id: TowerId;
  name: string;
  subtitle: string;
  description: string;
  category: 'tower';
  projectileType: 'arrow' | 'frost_nova' | 'cannonball';
  accentColor: string;
  roofColor: string;
  modelPath?: string;
  levels: TowerLevelStats[];
}

export interface BuildingLevelStats {
  level: number;
  costGold: number;
  costAether: number;
  upgradeTimeSeconds: number;
  goldPerSecond: number;
  aetherPerSecond: number;
  goldCapBonus: number;
  aetherCapBonus: number;
}

export interface BuildingConfig {
  id: BuildingId;
  name: string;
  subtitle: string;
  description: string;
  category: 'building';
  accentColor: string;
  roofColor: string;
  modelPath?: string;
  levels: BuildingLevelStats[];
}

export type EnemyId =
  | 'goblin_raider'
  | 'shield_brigand'
  | 'iron_golem'
  | 'aether_wisp'
  | 'eclipse_boss';

export interface EnemyConfig {
  id: EnemyId;
  name: string;
  baseHp: number;
  speedTilesPerSec: number;
  rewardGold: number;
  rewardAether: number;
  scale: number;
  primaryColor: string;
  secondaryColor: string;
  modelPath?: string;
  isBoss?: boolean;
}

export interface PlacedEntity {
  id: string;
  configId: BuildableId;
  category: EntityCategory;
  col: number;
  row: number;
  level: number;
  upgradeStartTimestamp: number | null;
  upgradeFinishTimestamp: number | null;
  targetingMode: TargetingMode;
  kills: number;
  totalDamage: number;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  type: 'defeat_raiders' | 'start_upgrades' | 'collect_resources';
  target: number;
  progress: number;
  rewardGold: number;
  rewardAether: number;
  claimed: boolean;
}

export interface GameState {
  version: number;
  resources: {
    gold: number;
    aether: number;
  };
  keepHp: number;
  keepMaxHp: number;
  wave: number;
  totalKills: number;
  entities: PlacedEntity[];
  dailyQuests: DailyQuest[];
  eclipseBossNextTimestamp: number;
  lastActiveTimestamp: number;
}

export interface OfflineReport {
  elapsedSeconds: number;
  completedUpgrades: { entityName: string; newLevel: number }[];
  raidersDefeated: number;
  goldEarned: number;
  aetherEarned: number;
  wasGoldCapped: boolean;
  wasAetherCapped: boolean;
}

export interface EnemyInstance {
  id: string;
  configId: EnemyId;
  hp: number;
  maxHp: number;
  waypointIndex: number;
  progressOnSegment: number;
  col: number;
  row: number;
  totalDistanceTraveled: number;
  slowUntilMs: number;
  slowFactor: number;
  hitFlashUntilMs: number;
}

export interface ProjectileInstance {
  id: string;
  sourceEntityId: string;
  type: 'arrow' | 'frost_nova' | 'cannonball';
  startCol: number;
  startRow: number;
  targetCol: number;
  targetRow: number;
  targetEnemyId: string | null;
  progress: number;
  durationSec: number;
  arcHeight: number;
  damage: number;
  splashRadius: number;
  slowFactor: number;
  slowDurationMs: number;
}

export interface ParticleInstance {
  id: string;
  kind: 'dust' | 'spark' | 'frost_ring' | 'upgrade_burst';
  col: number;
  row: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  maxRadius?: number;
  color: string;
  ageSec: number;
  lifetimeSec: number;
}

export interface FloatingTextInstance {
  id: string;
  text: string;
  col: number;
  row: number;
  z: number;
  color: string;
  ageSec: number;
  lifetimeSec: number;
}

export interface CloudInstance {
  x: number;
  y: number;
  scale: number;
  speed: number;
  opacity: number;
}

export interface TransientVisualState {
  towerRecoilMap: Record<string, number>;
  towerAngleMap: Record<string, number>;
  screenShake: number;
}
