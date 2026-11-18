import {
  BASE_KEEP_AETHER_PER_SEC,
  BASE_KEEP_GOLD_PER_SEC,
  BASE_STORAGE_AETHER,
  BASE_STORAGE_GOLD,
  BUILDING_CONFIGS,
  TOWER_CONFIGS,
  getBuildableConfig,
  isBuildingId,
  isTowerId,
} from '../config';
import { GameState, OfflineReport, PlacedEntity } from '../../types/game';

export interface StorageCaps {
  maxGold: number;
  maxAether: number;
}

export interface ProductionRates {
  goldPerSec: number;
  aetherPerSec: number;
}

export function computeStorageCaps(entities: readonly PlacedEntity[]): StorageCaps {
  let maxGold = BASE_STORAGE_GOLD;
  let maxAether = BASE_STORAGE_AETHER;

  for (const entity of entities) {
    if (!isBuildingId(entity.configId)) continue;
    const cfg = BUILDING_CONFIGS[entity.configId];
    const stats = cfg.levels[Math.min(entity.level - 1, cfg.levels.length - 1)];
    if (!stats) continue;
    maxGold += stats.goldCapBonus;
    maxAether += stats.aetherCapBonus;
  }

  return { maxGold, maxAether };
}

export function computeProductionRates(entities: readonly PlacedEntity[]): ProductionRates {
  let goldPerSec = BASE_KEEP_GOLD_PER_SEC;
  let aetherPerSec = BASE_KEEP_AETHER_PER_SEC;

  for (const entity of entities) {
    if (entity.upgradeFinishTimestamp !== null) continue;
    if (!isBuildingId(entity.configId)) continue;
    const cfg = BUILDING_CONFIGS[entity.configId];
    const stats = cfg.levels[Math.min(entity.level - 1, cfg.levels.length - 1)];
    if (!stats) continue;
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
    const cfg = TOWER_CONFIGS[entity.configId];
    const stats = cfg.levels[Math.min(entity.level - 1, cfg.levels.length - 1)];
    if (!stats) continue;

    let towerDps = stats.damage * stats.fireRate;
    if (stats.splashRadius && stats.splashRadius > 0) {
      towerDps *= 1.45;
    }
    if (stats.slowFactor && stats.slowFactor > 0) {
      hasFrost = true;
    }
    dps += towerDps;
  }

  return hasFrost ? dps * 1.18 : dps;
}

export function calculateOfflineProgress(
  state: GameState,
  nowMs: number,
  minElapsedSeconds = 5,
): { updatedState: GameState; report: OfflineReport | null } {
  const elapsedSeconds = Math.max(0, (nowMs - state.lastActiveTimestamp) / 1000);
  if (elapsedSeconds < minElapsedSeconds) {
    return {
      updatedState: {
        ...state,
        lastActiveTimestamp: nowMs,
      },
      report: null,
    };
  }

  const completedUpgrades: { entityName: string; newLevel: number }[] = [];
  const updatedEntities: PlacedEntity[] = state.entities.map((entity) => {
    if (entity.upgradeFinishTimestamp !== null && entity.upgradeFinishTimestamp <= nowMs) {
      const cfg = getBuildableConfig(entity.configId);
      const maxLevel = cfg.levels.length;
      const newLevel = Math.min(maxLevel, entity.level + 1);
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

  const avgEnemyHp = 75 + state.wave * 18;
  const raidersDefeated =
    totalDps > 0 ? Math.floor((totalDps * elapsedSeconds) / avgEnemyHp) : 0;

  const rawGoldGain = Math.floor(rates.goldPerSec * elapsedSeconds + raidersDefeated * 12);
  const rawAetherGain = Math.floor(rates.aetherPerSec * elapsedSeconds + raidersDefeated * 4);

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
