import {
  BuildingConfig,
  BuildingLevelStats,
  EnemyConfig,
  EnemyId,
  TowerConfig,
  TowerLevelStats,
} from '../../types/game';

export const BALANCE_CONFIG = {
  saveVersion: 1,
  storageKey: 'bastion_vale_save_v1',
  baseStorageGold: 600,
  baseStorageAether: 300,
  baseKeepGoldPerSec: 1.5,
  baseKeepAetherPerSec: 0.6,
  initialResources: {
    gold: 340,
    aether: 140,
  },
  initialKeepHp: 20,
  demolishRefundRatio: 0.65,
  bossIntervalMs: 6 * 60 * 60 * 1000,
  keepDamageNormal: 1,
  keepDamageBoss: 5,
  waveBaseEnemyCount: 5,
  waveEnemyCountPerWave: 2.2,
  waveEnemyHpScalePerWave: 0.22,
  waveSpawnIntervalBaseSec: 1.05,
  waveSpawnIntervalDecayPerWave: 0.03,
  waveSpawnIntervalMinSec: 0.45,
  waveInitialDelaySec: 0.4,
  waveInterDelaySec: 2.6,
  rallyInterDelaySec: 3.0,
  upgradeCostGrowthFactor: 1.55,
  upgradeDurationGrowthFactor: 2.2,
  projectile: {
    arrow: { durationSec: 0.28, arcHeight: 0.95 },
    cannonball: { durationSec: 0.46, arcHeight: 1.55 },
  },
  splashDirectRadius: 0.45,
  splashEdgeMultiplier: 0.78,
  defaultSlowFactor: 0.4,
  defaultSlowDurationMs: 2400,
  dpsSynergy: {
    splashMultiplier: 1.45,
    frostGlobalMultiplier: 1.18,
  },
  offline: {
    minElapsedSeconds: 5,
    baseEnemyHp: 75,
    enemyHpPerWave: 18,
    goldPerRaider: 12,
    aetherPerRaider: 4,
  },
  hitFlashDurationMs: 110,
  screenShake: {
    bossSummon: 7,
    bossImpact: 8,
    normalImpact: 4,
    splashImpact: 4.2,
    decayPerSec: 22,
  },
  towerRecoilDecayPerSec: 4.5,
  autoSaveIntervalMs: 1500,
  hudSyncIntervalSec: 0.1,
  camera: {
    minZoom: 28,
    maxZoom: 85,
    panLimitX: 5.5,
    panLimitZ: 4.5,
    dampingFactor: 0.08,
    minPolarAngle: Math.PI * 0.16,
    maxPolarAngle: Math.PI * 0.44,
  },
} as const;

export function getUpgradeCost(
  baseCost: { costGold: number; costAether: number },
  level: number,
): { costGold: number; costAether: number } {
  const exponent = Math.max(0, level - 1);
  const scale = Math.pow(BALANCE_CONFIG.upgradeCostGrowthFactor, exponent);
  return {
    costGold: Math.round(baseCost.costGold * scale),
    costAether: Math.round(baseCost.costAether * scale),
  };
}

export function getUpgradeDuration(baseTimeSeconds: number, level: number): number {
  if (level <= 1 || baseTimeSeconds <= 0) return 0;
  const exponent = Math.max(0, level - 2);
  return Math.round(
    baseTimeSeconds * Math.pow(BALANCE_CONFIG.upgradeDurationGrowthFactor, exponent),
  );
}

export function getMaxLevel(config: TowerConfig | BuildingConfig): number {
  return config.levels.length;
}

export function getTowerStatsAtLevel(config: TowerConfig, level: number): TowerLevelStats {
  const idx = Math.max(0, Math.min(level - 1, config.levels.length - 1));
  return config.levels[idx];
}

export function getBuildingStatsAtLevel(
  config: BuildingConfig,
  level: number,
): BuildingLevelStats {
  const idx = Math.max(0, Math.min(level - 1, config.levels.length - 1));
  return config.levels[idx];
}

export function getBuildableStatsAtLevel(
  config: TowerConfig | BuildingConfig,
  level: number,
): TowerLevelStats | BuildingLevelStats {
  const idx = Math.max(0, Math.min(level - 1, config.levels.length - 1));
  return config.levels[idx];
}

export function getDemolishRefund(
  config: TowerConfig | BuildingConfig,
  currentLevel: number,
): { refundGold: number; refundAether: number } {
  let investedGold = 0;
  let investedAether = 0;
  const clampedLevel = Math.min(currentLevel, config.levels.length);

  for (let lvl = 1; lvl <= clampedLevel; lvl++) {
    const stats = getBuildableStatsAtLevel(config, lvl);
    investedGold += stats.costGold;
    investedAether += stats.costAether;
  }

  return {
    refundGold: Math.round(investedGold * BALANCE_CONFIG.demolishRefundRatio),
    refundAether: Math.round(investedAether * BALANCE_CONFIG.demolishRefundRatio),
  };
}

export function getEnemyMaxHpAtWave(enemyConfig: EnemyConfig, wave: number): number {
  const waveScale = 1 + Math.max(0, wave - 1) * BALANCE_CONFIG.waveEnemyHpScalePerWave;
  return Math.round(enemyConfig.baseHp * waveScale);
}

export function getWaveSpawnInterval(wave: number): number {
  return Math.max(
    BALANCE_CONFIG.waveSpawnIntervalMinSec,
    BALANCE_CONFIG.waveSpawnIntervalBaseSec -
      wave * BALANCE_CONFIG.waveSpawnIntervalDecayPerWave,
  );
}

export function buildWaveEnemyQueue(
  wave: number,
  enemies: readonly EnemyConfig[],
): EnemyId[] {
  const totalCount =
    BALANCE_CONFIG.waveBaseEnemyCount +
    Math.floor(wave * BALANCE_CONFIG.waveEnemyCountPerWave);

  const regularPool = enemies
    .filter((e) => !e.isBoss && wave >= e.minWave)
    .sort((a, b) => b.spawnCadence - a.spawnCadence);

  const fallbackEnemy =
    regularPool.find((e) => e.spawnCadence <= 1) ?? regularPool[regularPool.length - 1];

  const queue: EnemyId[] = [];
  if (fallbackEnemy) {
    for (let i = 0; i < totalCount; i++) {
      const specialist = regularPool.find(
        (e) => e.spawnCadence > 1 && i % e.spawnCadence === e.spawnCadence - 1,
      );
      queue.push((specialist ?? fallbackEnemy).id);
    }
  }

  const bossPool = enemies.filter(
    (e) => e.isBoss && wave >= e.minWave && wave % e.spawnCadence === 0,
  );
  for (const boss of bossPool) {
    queue.push(boss.id);
  }

  return queue;
}
