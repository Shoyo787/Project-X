import React from 'react';
import {
  ArrowUpCircle,
  Clock,
  Crosshair,
  Hammer,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  BALANCE_CONFIG,
  BUILDING_CONFIGS,
  TOWER_CONFIGS,
  getBuildableConfig,
  getBuildableStatsAtLevel,
  getBuildingStatsAtLevel,
  getMaxLevel,
  getTowerStatsAtLevel,
  isTowerId,
} from '../game/config';
import { formatDurationShort } from '../game/utils/format';
import { BuildingId, PlacedEntity, TowerId } from '../types/game';

interface EntityInspectorProps {
  entity: PlacedEntity;
  gold: number;
  aether: number;
  nowMs: number;
  onUpgrade: (entityId: string) => void;
  onCycleTargeting: (entityId: string) => void;
  onDemolish: (entityId: string) => void;
  onDevSpeedup: () => void;
  onClose: () => void;
}

export const EntityInspector: React.FC<EntityInspectorProps> = ({
  entity,
  gold,
  aether,
  nowMs,
  onUpgrade,
  onCycleTargeting,
  onDemolish,
  onDevSpeedup,
  onClose,
}) => {
  const isTower = isTowerId(entity.configId);
  const cfg = getBuildableConfig(entity.configId);
  const maxLevel = getMaxLevel(cfg);
  const nextStats =
    entity.level < maxLevel ? getBuildableStatsAtLevel(cfg, entity.level + 1) : null;

  const towerStats = isTower
    ? getTowerStatsAtLevel(TOWER_CONFIGS[entity.configId as TowerId], entity.level)
    : null;
  const nextTowerStats =
    isTower && entity.level < maxLevel
      ? getTowerStatsAtLevel(TOWER_CONFIGS[entity.configId as TowerId], entity.level + 1)
      : null;
  const buildingStats = !isTower
    ? getBuildingStatsAtLevel(BUILDING_CONFIGS[entity.configId as BuildingId], entity.level)
    : null;

  const isUpgrading =
    entity.upgradeFinishTimestamp !== null && entity.upgradeStartTimestamp !== null;
  const totalMs = isUpgrading
    ? Math.max(1000, entity.upgradeFinishTimestamp! - entity.upgradeStartTimestamp!)
    : 0;
  const remainingMs = isUpgrading
    ? Math.max(0, entity.upgradeFinishTimestamp! - nowMs)
    : 0;
  const pct = isUpgrading ? Math.min(100, ((totalMs - remainingMs) / totalMs) * 100) : 0;

  const canAffordNext =
    nextStats !== null && gold >= nextStats.costGold && aether >= nextStats.costAether;
  const refundPct = Math.round(BALANCE_CONFIG.demolishRefundRatio * 100);

  return (
    <aside className="pointer-events-auto z-10 ml-auto max-h-full w-60 shrink-0 self-start overflow-y-auto sm:w-64">
      <div className="parchment-panel rounded-2xl bg-[#faf5ea]/90 p-3 backdrop-blur-md">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-xs font-bold text-[#2b2623]">{cfg.name}</h2>
              <span className="rounded border border-[#2b2623] bg-[#f4c76b] px-1.5 py-0.5 font-mono text-[9.5px] font-bold">
                Lv.{entity.level}/{maxLevel}
              </span>
            </div>
            <p className="text-[10px] font-medium text-[#6b5a44]">{cfg.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-0.5 text-[#6b5a44] hover:bg-[#e5d6bc] hover:text-[#2b2623]"
            aria-label="Close inspector"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {isUpgrading && (
          <div className="parchment-card mt-2 rounded-lg p-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#c86446]">
              <span className="flex items-center gap-1">
                <Hammer className="h-3 w-3" />
                Lv.{entity.level + 1}
              </span>
              <span className="font-mono">{formatDurationShort(remainingMs / 1000)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-[#2b2623]/40 bg-[#dfd2ba]">
              <div
                className="h-full rounded-full bg-[#c86446] transition-all duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={onDevSpeedup}
              className="ink-button mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-[#f4c76b] py-1 text-[10px] font-bold text-[#2b2623]"
            >
              <Zap className="h-3 w-3" /> +1m Speedup
            </button>
          </div>
        )}

        <div className="parchment-card mt-2 grid grid-cols-2 gap-1.5 rounded-lg p-2 text-[11px]">
          {towerStats ? (
            <>
              <div>
                <div className="text-[9.5px] font-semibold text-[#6b5a44]">Damage</div>
                <div className="font-mono font-bold">
                  {towerStats.damage}
                  {nextTowerStats ? (
                    <span className="ml-1 text-[10px] text-[#5d7a4f]">
                      → {nextTowerStats.damage}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-[9.5px] font-semibold text-[#6b5a44]">Range</div>
                <div className="font-mono font-bold">{towerStats.range.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-[9.5px] font-semibold text-[#6b5a44]">Fire Rate</div>
                <div className="font-mono font-bold">{towerStats.fireRate.toFixed(2)}/s</div>
              </div>
              <div>
                <div className="text-[9.5px] font-semibold text-[#6b5a44]">Kills</div>
                <div className="font-mono font-bold">{entity.kills}</div>
              </div>
            </>
          ) : buildingStats ? (
            <>
              <div>
                <div className="text-[9.5px] font-semibold text-[#6b5a44]">Gold / s</div>
                <div className="font-mono font-bold">
                  +{buildingStats.goldPerSecond.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[9.5px] font-semibold text-[#6b5a44]">Aether / s</div>
                <div className="font-mono font-bold">
                  +{buildingStats.aetherPerSecond.toFixed(1)}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[9.5px] font-semibold text-[#6b5a44]">Cap Bonus</div>
                <div className="font-mono font-bold">
                  +{buildingStats.goldCapBonus}g / +{buildingStats.aetherCapBonus}a
                </div>
              </div>
            </>
          ) : null}
        </div>

        {isTower && (
          <button
            type="button"
            onClick={() => onCycleTargeting(entity.id)}
            className="ink-button mt-2 flex w-full cursor-pointer items-center justify-between rounded-lg bg-[#fcf8ef] px-2.5 py-1 text-[11px] font-bold text-[#2b2623] hover:bg-[#efe3cd]"
          >
            <span className="flex items-center gap-1">
              <Crosshair className="h-3 w-3 text-[#8c6d46]" />
              Target
            </span>
            <span className="rounded bg-[#eadcc4] px-1.5 py-0.5 font-mono text-[10px] uppercase">
              {entity.targetingMode}
            </span>
          </button>
        )}

        <div className="mt-2 flex flex-col gap-1.5">
          {!isUpgrading && nextStats && (
            <button
              type="button"
              disabled={!canAffordNext}
              onClick={() => onUpgrade(entity.id)}
              className="ink-button flex w-full cursor-pointer items-center justify-between rounded-lg bg-[#7c9a6e] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#6a875d]"
            >
              <span className="flex items-center gap-1">
                <ArrowUpCircle className="h-3.5 w-3.5" />
                Lv.{entity.level + 1}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[10px]">
                <span>
                  {nextStats.costGold}g
                  {nextStats.costAether > 0 ? ` · ${nextStats.costAether}a` : ''}
                </span>
                <span className="flex items-center gap-0.5 rounded bg-black/20 px-1 py-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDurationShort(nextStats.upgradeTimeSeconds)}
                </span>
              </span>
            </button>
          )}

          {!nextStats && !isUpgrading && (
            <div className="rounded-lg border border-[#2b2623]/30 bg-[#eadcc4] py-1 text-center text-[11px] font-bold text-[#6b5a44]">
              Max Tier
            </div>
          )}

          <button
            type="button"
            onClick={() => onDemolish(entity.id)}
            className="ink-button flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#f6efe2] py-1 text-[11px] font-bold text-[#a64430] hover:bg-[#f2dcd6]"
          >
            <Trash2 className="h-3 w-3" />
            Sell (+{refundPct}%)
          </button>
        </div>
      </div>
    </aside>
  );
};
