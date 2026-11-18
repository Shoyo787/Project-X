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
import { BUILDING_CONFIGS, TOWER_CONFIGS, isTowerId } from '../game/config';
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
  const cfg = isTower
    ? TOWER_CONFIGS[entity.configId as TowerId]
    : BUILDING_CONFIGS[entity.configId as BuildingId];
  const maxLevel = cfg.levels.length;
  const currentIdx = Math.min(entity.level - 1, maxLevel - 1);
  const nextStats = entity.level < maxLevel ? cfg.levels[entity.level] : null;

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
    nextStats !== null &&
    gold >= nextStats.costGold &&
    aether >= nextStats.costAether;

  return (
    <aside className="pointer-events-auto z-10 ml-auto max-h-full w-68 shrink-0 self-start overflow-y-auto sm:w-72">
      <div className="parchment-panel rounded-xl p-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-sm font-bold text-[#2b2623]">
                {cfg.name}
              </h2>
              <span className="rounded-md border border-[#2b2623] bg-[#f4c76b] px-1.5 py-0.5 font-mono text-[10px] font-bold">
                Lv.{entity.level}/{maxLevel}
              </span>
            </div>
            <p className="text-[11px] font-medium text-[#6b5a44]">{cfg.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-[#6b5a44] hover:bg-[#e5d6bc] hover:text-[#2b2623]"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[#4f4335]">{cfg.description}</p>

        {/* Active Construction Progress */}
        {isUpgrading && (
          <div className="parchment-card mt-3 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#c86446]">
              <span className="flex items-center gap-1">
                <Hammer className="h-3.5 w-3.5" />
                Upgrading to Lv.{entity.level + 1}
              </span>
              <span className="font-mono">
                {formatDurationShort(remainingMs / 1000)}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-[#2b2623]/40 bg-[#dfd2ba]">
              <div
                className="h-full rounded-full bg-[#c86446] transition-all duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={onDevSpeedup}
              className="ink-button mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-[#f4c76b] py-1 text-[11px] font-bold text-[#2b2623]"
            >
              <Zap className="h-3 w-3" /> Fast-Forward +1m
            </button>
          </div>
        )}

        {/* Current Stats */}
        <div className="parchment-card mt-3 grid grid-cols-2 gap-2 rounded-lg p-2.5 text-xs">
          {isTower ? (
            <>
              <div>
                <div className="text-[10px] font-semibold text-[#6b5a44]">Damage</div>
                <div className="font-mono font-bold">
                  {TOWER_CONFIGS[entity.configId as keyof typeof TOWER_CONFIGS].levels[currentIdx].damage}
                  {nextStats && 'damage' in nextStats ? (
                    <span className="ml-1 text-[10px] text-[#5d7a4f]">
                      → {nextStats.damage}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#6b5a44]">Range</div>
                <div className="font-mono font-bold">
                  {TOWER_CONFIGS[entity.configId as keyof typeof TOWER_CONFIGS].levels[currentIdx].range.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#6b5a44]">Fire Rate</div>
                <div className="font-mono font-bold">
                  {TOWER_CONFIGS[entity.configId as keyof typeof TOWER_CONFIGS].levels[currentIdx].fireRate.toFixed(2)}/s
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#6b5a44]">Raiders Slain</div>
                <div className="font-mono font-bold">{entity.kills}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-[10px] font-semibold text-[#6b5a44]">Gold / Sec</div>
                <div className="font-mono font-bold">
                  +{BUILDING_CONFIGS[entity.configId as keyof typeof BUILDING_CONFIGS].levels[currentIdx].goldPerSecond.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#6b5a44]">Aether / Sec</div>
                <div className="font-mono font-bold">
                  +{BUILDING_CONFIGS[entity.configId as keyof typeof BUILDING_CONFIGS].levels[currentIdx].aetherPerSecond.toFixed(1)}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] font-semibold text-[#6b5a44]">Storage Cap Bonus</div>
                <div className="font-mono font-bold">
                  +{BUILDING_CONFIGS[entity.configId as keyof typeof BUILDING_CONFIGS].levels[currentIdx].goldCapBonus}g / +
                  {BUILDING_CONFIGS[entity.configId as keyof typeof BUILDING_CONFIGS].levels[currentIdx].aetherCapBonus}a
                </div>
              </div>
            </>
          )}
        </div>

        {/* Targeting Priority for Towers */}
        {isTower && (
          <button
            type="button"
            onClick={() => onCycleTargeting(entity.id)}
            className="ink-button mt-2.5 flex w-full cursor-pointer items-center justify-between rounded-lg bg-[#fcf8ef] px-2.5 py-1.5 text-xs font-bold text-[#2b2623] hover:bg-[#efe3cd]"
          >
            <span className="flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5 text-[#8c6d46]" />
              Target Priority
            </span>
            <span className="rounded bg-[#eadcc4] px-2 py-0.5 font-mono text-[11px] uppercase">
              {entity.targetingMode}
            </span>
          </button>
        )}

        {/* Upgrade & Demolish Controls */}
        <div className="mt-3 flex flex-col gap-2">
          {!isUpgrading && nextStats && (
            <button
              type="button"
              disabled={!canAffordNext}
              onClick={() => onUpgrade(entity.id)}
              className="ink-button flex w-full cursor-pointer items-center justify-between rounded-lg bg-[#7c9a6e] px-3 py-2 text-xs font-bold text-white hover:bg-[#6a875d]"
            >
              <span className="flex items-center gap-1.5">
                <ArrowUpCircle className="h-4 w-4" />
                Upgrade Lv.{entity.level + 1}
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px]">
                <span>
                  {nextStats.costGold}g
                  {nextStats.costAether > 0 ? ` · ${nextStats.costAether}a` : ''}
                </span>
                <span className="flex items-center gap-0.5 rounded bg-black/20 px-1.5 py-0.5">
                  <Clock className="h-3 w-3" />
                  {formatDurationShort(nextStats.upgradeTimeSeconds)}
                </span>
              </span>
            </button>
          )}

          {!nextStats && !isUpgrading && (
            <div className="rounded-lg border border-[#2b2623]/30 bg-[#eadcc4] py-1.5 text-center text-xs font-bold text-[#6b5a44]">
              Max Tier Masterwork
            </div>
          )}

          <button
            type="button"
            onClick={() => onDemolish(entity.id)}
            className="ink-button flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#f6efe2] py-1.5 text-xs font-bold text-[#a64430] hover:bg-[#f2dcd6]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Salvage Structure (+65%)
          </button>
        </div>
      </div>
    </aside>
  );
};
