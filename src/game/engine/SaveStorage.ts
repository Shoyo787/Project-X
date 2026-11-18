import {
  BALANCE_CONFIG,
  createDefaultDailyQuests,
  createInitialGameState,
  getBuildableConfig,
  getBuildableStatsAtLevel,
  getDemolishRefund,
  getMaxLevel,
  isValidGridCoord,
  syncGridWithEntities,
} from '../config';
import { BuildableId, GameState, PlacedEntity } from '../../types/game';
import { computeStorageCaps } from './OfflineCalculator';

export function loadGameStateFromStorage(): GameState | null {
  try {
    const raw = globalThis.localStorage?.getItem(BALANCE_CONFIG.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (!parsed || typeof parsed.version !== 'number' || !Array.isArray(parsed.entities)) {
      return null;
    }

    const fallback = createInitialGameState(Date.now());
    const entities = parsed.entities;
    return {
      ...fallback,
      ...parsed,
      resources: {
        gold: typeof parsed.resources?.gold === 'number' ? parsed.resources.gold : fallback.resources.gold,
        aether: typeof parsed.resources?.aether === 'number' ? parsed.resources.aether : fallback.resources.aether,
      },
      storageCaps: computeStorageCaps(entities),
      grid: syncGridWithEntities(parsed.grid ?? [], entities),
      dailyQuests:
        Array.isArray(parsed.dailyQuests) && parsed.dailyQuests.length === 3
          ? parsed.dailyQuests
          : createDefaultDailyQuests(),
    };
  } catch {
    return null;
  }
}

export function saveGameStateToStorage(state: GameState, nowMs = Date.now()): void {
  try {
    state.lastActiveTimestamp = nowMs;
    globalThis.localStorage?.setItem(BALANCE_CONFIG.storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function syncStateDerivedFields(state: GameState): void {
  state.storageCaps = computeStorageCaps(state.entities);
  state.grid = syncGridWithEntities(state.grid, state.entities);
}

export function canPlaceOnGrid(state: GameState, col: number, row: number): boolean {
  if (!isValidGridCoord(col, row)) return false;
  const tile = state.grid.find((t) => t.x === col && t.z === row);
  return Boolean(tile && tile.type === 'grass' && tile.entityId === null);
}

export function incrementDailyQuestProgress(
  state: GameState,
  type: 'defeat_raiders' | 'start_upgrades' | 'collect_resources',
  amount: number,
): void {
  for (const quest of state.dailyQuests) {
    if (quest.type === type && !quest.claimed && quest.progress < quest.target) {
      quest.progress = Math.min(quest.target, quest.progress + amount);
    }
  }
}

export function spendStateResources(state: GameState, costGold: number, costAether: number): string | null {
  if (state.resources.gold < costGold) return `Need ${costGold} Timber/Gold.`;
  if (state.resources.aether < costAether) return `Need ${costAether} Aether.`;
  state.resources.gold -= costGold;
  state.resources.aether -= costAether;
  return null;
}

export function grantStateResources(
  state: GameState,
  goldDelta: number,
  aetherDelta: number,
  trackQuest = false,
): number {
  const { maxGold, maxAether } = state.storageCaps;
  const prevWholeGold = Math.floor(state.resources.gold);
  state.resources.gold = Math.min(maxGold, state.resources.gold + goldDelta);
  state.resources.aether = Math.min(maxAether, state.resources.aether + aetherDelta);
  const wholeAdded = Math.max(0, Math.floor(state.resources.gold) - prevWholeGold);
  if (trackQuest && wholeAdded > 0) incrementDailyQuestProgress(state, 'collect_resources', wholeAdded);
  return wholeAdded;
}

export function applyPlaceEntity(
  state: GameState,
  id: string,
  configId: BuildableId,
  col: number,
  row: number,
): { ok: boolean; error?: string; entity?: PlacedEntity; name?: string } {
  if (!canPlaceOnGrid(state, col, row)) return { ok: false, error: 'Must build on an empty grass tile.' };
  const cfg = getBuildableConfig(configId);
  const level1 = getBuildableStatsAtLevel(cfg, 1);
  const error = spendStateResources(state, level1.costGold, level1.costAether);
  if (error) return { ok: false, error };

  const entity: PlacedEntity = {
    id, configId, category: cfg.category, col, row, level: 1,
    upgradeStartTimestamp: null, upgradeFinishTimestamp: null, targetingMode: 'first', kills: 0, totalDamage: 0,
  };
  state.entities.push(entity);
  syncStateDerivedFields(state);
  return { ok: true, entity, name: cfg.name };
}

export function applyStartUpgrade(
  state: GameState,
  entityId: string,
  nowMs: number,
): { ok: boolean; error?: string; entity?: PlacedEntity } {
  const entity = state.entities.find((e) => e.id === entityId);
  if (!entity) return { ok: false, error: 'Structure not found.' };
  if (entity.upgradeFinishTimestamp !== null) return { ok: false, error: 'Upgrade already in progress.' };
  const cfg = getBuildableConfig(entity.configId);
  if (entity.level >= getMaxLevel(cfg)) return { ok: false, error: 'Already at maximum level.' };

  const nextStats = getBuildableStatsAtLevel(cfg, entity.level + 1);
  const error = spendStateResources(state, nextStats.costGold, nextStats.costAether);
  if (error) return { ok: false, error };

  entity.upgradeStartTimestamp = nowMs;
  entity.upgradeFinishTimestamp = nowMs + nextStats.upgradeTimeSeconds * 1000;
  incrementDailyQuestProgress(state, 'start_upgrades', 1);
  return { ok: true, entity };
}

export function applyDemolishEntity(
  state: GameState,
  entityId: string,
): { ok: boolean; entity?: PlacedEntity; refundGold: number; refundAether: number } {
  const idx = state.entities.findIndex((e) => e.id === entityId);
  if (idx === -1) return { ok: false, refundGold: 0, refundAether: 0 };
  const entity = state.entities[idx];
  const { refundGold, refundAether } = getDemolishRefund(getBuildableConfig(entity.configId), entity.level);
  state.entities.splice(idx, 1);
  syncStateDerivedFields(state);
  grantStateResources(state, refundGold, refundAether);
  return { ok: true, entity, refundGold, refundAether };
}

export function evaluateCompletedUpgrades(
  state: GameState,
  nowMs: number,
): { entity: PlacedEntity; name: string; newLevel: number }[] {
  const completed: { entity: PlacedEntity; name: string; newLevel: number }[] = [];
  for (const entity of state.entities) {
    if (entity.upgradeFinishTimestamp !== null && entity.upgradeFinishTimestamp <= nowMs) {
      const cfg = getBuildableConfig(entity.configId);
      entity.level = Math.min(getMaxLevel(cfg), entity.level + 1);
      entity.upgradeStartTimestamp = null;
      entity.upgradeFinishTimestamp = null;
      completed.push({ entity, name: cfg.name, newLevel: entity.level });
    }
  }
  if (completed.length > 0) syncStateDerivedFields(state);
  return completed;
}
