import {
  BALANCE_CONFIG,
  BUILDING_CONFIGS,
  TOWER_CONFIGS,
  getBuildableConfig,
  getBuildingStatsAtLevel,
  getMaxLevel,
  getTowerStatsAtLevel,
  isBuildingId,
  isTowerId,
  syncGridWithEntities,
} from '../config';
import {
  GameState,
  OfflineReport,
  PlacedEntity,
  ProductionRates,
  StorageCaps,
} from '../../types/game';

export type { ProductionRates, StorageCaps };

export function computeStorageCaps(entities: readonly PlacedEntity[]): StorageCaps {
  let maxGold = BALANCE_CONFIG.baseStorageGold;
  let maxAether = BALANCE_CONFIG.baseStorageAether;

  for (const entity of entities) {
    if (!isBuildingId(entity.configId)) continue;
    const stats = getBuildingStatsAtLevel(
      BUILDING_CONFIGS[entity.configId],
      entity.level,
    );
    maxGold += stats.goldCapBonus;
    maxAether += stats.aetherCapBonus;
  }

  return { maxGold, maxAether };
}

export function computeProductionRates(
  entities: readonly PlacedEntity[],
): ProductionRates {
  let goldPerSec = BALANCE_CONFIG.baseKeepGoldPerSec;
  let aetherPerSec = BALANCE_CONFIG.baseKeepAetherPerSec;

  for (const entity of entities) {
    if (entity.upgradeFinishTimestamp !== null) continue;
    if (!isBuildingId(entity.configId)) continue;
    const stats = getBuildingStatsAtLevel(
      BUILDING_CONFIGS[entity.configId],
      entity.level,
    );
    goldPerSec += stats.goldPerSecond;
    aetherPerSec += stats.aetherPerSecond;
  }

  return { goldPerSec, aetherPerSec };
}

export function computeTotalDefenseDps(entities: readonly PlacedEntity[]): number {
  let dps = 0;
  let hasFrost = false;

  for (const entity of entities) {
    if (entity.upgradeFinishTimestamp !== null) continue;
    if (!isTowerId(entity.configId)) continue;
    const stats = getTowerStatsAtLevel(TOWER_CONFIGS[entity.configId], entity.level);

    let towerDps = stats.damage * stats.fireRate;
    if (stats.splashRadius && stats.splashRadius > 0) {
      towerDps *= BALANCE_CONFIG.dpsSynergy.splashMultiplier;
    }
    if (stats.slowFactor && stats.slowFactor > 0) {
      hasFrost = true;
    }
    dps += towerDps;
  }

  return hasFrost ? dps * BALANCE_CONFIG.dpsSynergy.frostGlobalMultiplier : dps;
}

export function calculateOfflineProgress(
  state: GameState,
  nowMs: number,
  minElapsedSeconds: number = BALANCE_CONFIG.offline.minElapsedSeconds,
): { updatedState: GameState; report: OfflineReport | null } {
  const elapsedSeconds = Math.max(0, (nowMs - state.lastActiveTimestamp) / 1000);
  if (elapsedSeconds < minElapsedSeconds) {
    return {
      updatedState: {
        ...state,
        storageCaps: computeStorageCaps(state.entities),
        grid: syncGridWithEntities(state.grid, state.entities),
        lastActiveTimestamp: nowMs,
      },
      report: null,
    };
  }

  const completedUpgrades: { entityName: string; newLevel: number }[] = [];
  const updatedEntities: PlacedEntity[] = state.entities.map((entity) => {
    if (entity.upgradeFinishTimestamp !== null && entity.upgradeFinishTimestamp <= nowMs) {
      const cfg = getBuildableConfig(entity.configId);
      const newLevel = Math.min(getMaxLevel(cfg), entity.level + 1);
      completedUpgrades.push({
        entityName: cfg.name,
        newLevel,
      });
      return {
        ...entity,
        level: newLevel,
        upgradeStartTimestamp: null,
        upgradeFinishTimestamp: null,
      };
    }
    return { ...entity };
  });

  const caps = computeStorageCaps(updatedEntities);
  const rates = computeProductionRates(updatedEntities);
  const totalDps = computeTotalDefenseDps(updatedEntities);

  const avgEnemyHp =
    BALANCE_CONFIG.offline.baseEnemyHp +
    state.wave * BALANCE_CONFIG.offline.enemyHpPerWave;
  const raidersDefeated =
    totalDps > 0 ? Math.floor((totalDps * elapsedSeconds) / avgEnemyHp) : 0;

  const rawGoldGain = Math.floor(
    rates.goldPerSec * elapsedSeconds +
      raidersDefeated * BALANCE_CONFIG.offline.goldPerRaider,
  );
  const rawAetherGain = Math.floor(
    rates.aetherPerSec * elapsedSeconds +
      raidersDefeated * BALANCE_CONFIG.offline.aetherPerRaider,
  );

  const prevGold = Math.floor(state.resources.gold);
  const prevAether = Math.floor(state.resources.aether);

  const nextGold = Math.min(caps.maxGold, prevGold + rawGoldGain);
  const nextAether = Math.min(caps.maxAether, prevAether + rawAetherGain);

  const goldEarned = Math.max(0, nextGold - prevGold);
  const aetherEarned = Math.max(0, nextAether - prevAether);

  const wasGoldCapped = prevGold + rawGoldGain > caps.maxGold;
  const wasAetherCapped = prevAether + rawAetherGain > caps.maxAether;

  const updatedQuests = state.dailyQuests.map((quest) => {
    if (quest.claimed) return { ...quest };
    let nextProgress = quest.progress;
    if (quest.type === 'defeat_raiders') {
      nextProgress = Math.min(quest.target, quest.progress + raidersDefeated);
    } else if (quest.type === 'collect_resources') {
      nextProgress = Math.min(quest.target, quest.progress + goldEarned);
    }
    return {
      ...quest,
      progress: nextProgress,
    };
  });

  const updatedState: GameState = {
    ...state,
    resources: {
      gold: nextGold,
      aether: nextAether,
    },
    storageCaps: caps,
    grid: syncGridWithEntities(state.grid, updatedEntities),
    totalKills: state.totalKills + raidersDefeated,
    entities: updatedEntities,
    dailyQuests: updatedQuests,
    lastActiveTimestamp: nowMs,
  };

  return {
    updatedState,
    report: {
      elapsedSeconds,
      completedUpgrades,
      raidersDefeated,
      goldEarned,
      aetherEarned,
      wasGoldCapped,
      wasAetherCapped,
    },
  };
}
