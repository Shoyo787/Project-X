import React from 'react';
import {
  Crosshair,
  Flame,
  Hammer,
  Pickaxe,
  Snowflake,
  Sparkles,
  Warehouse,
  X,
} from 'lucide-react';
import { BUILDING_LIST, TOWER_LIST } from '../game/config';
import { BuildableId } from '../types/game';

interface BuildDockProps {
  selectedBuildId: BuildableId | null;
  gold: number;
  aether: number;
  feedbackMessage: string | null;
  onSelectBuild: (id: BuildableId | null) => void;
}

const SHORT_LABEL_MAP: Record<BuildableId, string> = {
  archer_spire: 'Archer',
  frost_obelisk: 'Frost',
  cannon_bastion: 'Cannon',
  quarry_mine: 'Quarry',
  aether_conduit: 'Wellspring',
  storage_vault: 'Vault',
};

const ICON_MAP: Record<BuildableId, React.ReactNode> = {
  archer_spire: <Crosshair className="h-4 w-4 text-[#c86446]" />,
  frost_obelisk: <Snowflake className="h-4 w-4 text-[#4c8899]" />,
  cannon_bastion: <Flame className="h-4 w-4 text-[#4a5158]" />,
  quarry_mine: <Pickaxe className="h-4 w-4 text-[#b57b3b]" />,
  aether_conduit: <Sparkles className="h-4 w-4 text-[#3f7c8c]" />,
  storage_vault: <Warehouse className="h-4 w-4 text-[#a34e35]" />,
};

export const BuildDock: React.FC<BuildDockProps> = ({
  selectedBuildId,
  gold,
  aether,
  feedbackMessage,
  onSelectBuild,
}) => {
  const allItems = [...TOWER_LIST, ...BUILDING_LIST];

  return (
    <div className="pointer-events-none z-20 flex flex-col items-center gap-2">
      {(selectedBuildId || feedbackMessage) && (
        <div className="pointer-events-auto parchment-panel flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-bold text-[#2b2623]">
          {feedbackMessage ? (
            <span className="text-[#b0432b]">{feedbackMessage}</span>
          ) : (
            <>
              <Hammer className="h-3.5 w-3.5 text-[#c86446]" />
              <span>
                Choose the top-left grass tile for this{' '}
                <strong className="text-[#a64430]">
                  {allItems.find((i) => i.id === selectedBuildId)?.name}
                </strong>
                . The preview turns green when the full footprint fits.
              </span>
              <button
                type="button"
                onClick={() => onSelectBuild(null)}
                className="ml-1 flex cursor-pointer items-center gap-0.5 rounded-full bg-[#2b2623] px-2 py-0.5 text-[10px] text-[#fcf8ef]"
              >
                <X className="h-3 w-3" /> Esc
              </button>
            </>
          )}
        </div>
      )}

      <div className="pointer-events-auto parchment-panel flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl px-3 py-2">
        {allItems.map((item, idx) => {
          const lvl1 = item.levels[0];
          const canAfford = gold >= lvl1.costGold && aether >= lvl1.costAether;
          const isSelected = selectedBuildId === item.id;
          const isDivider = idx === TOWER_LIST.length;

          return (
            <React.Fragment key={item.id}>
              {isDivider && (
                <div className="mx-1 h-10 w-px shrink-0 bg-[#8c6d46]/45" />
              )}
              <button
                type="button"
                onClick={() => onSelectBuild(isSelected ? null : item.id)}
                className={`ink-button relative flex min-w-[126px] shrink-0 cursor-pointer flex-col items-start rounded-xl px-2.5 py-1.5 text-left ${
                  isSelected
                    ? 'bg-[#f4c76b]'
                    : canAfford
                      ? 'bg-[#fcf8ef] hover:bg-[#f2e6d0]'
                      : 'bg-[#e6dac3] opacity-75'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#2b2623]">
                    {ICON_MAP[item.id]}
                    <span className="truncate">{SHORT_LABEL_MAP[item.id]}</span>
                  </span>
                  <span className="rounded border border-[#2b2623]/25 bg-[#eadcc4] px-1 font-mono text-[9px] font-bold text-[#6b5a44]">
                    {idx + 1}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] font-medium text-[#6b5a44] truncate max-w-full">
                  {item.category === 'tower' ? 'Defense' : 'Economy'} ·{' '}
                  {item.footprint.width}x{item.footprint.height} cells
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[11px] font-bold">
                  <span className={gold >= lvl1.costGold ? 'text-[#8c5e14]' : 'text-[#b0432b]'}>
                    {lvl1.costGold}g
                  </span>
                  {lvl1.costAether > 0 && (
                    <span
                      className={
                        aether >= lvl1.costAether ? 'text-[#317180]' : 'text-[#b0432b]'
                      }
                    >
                      {lvl1.costAether}a
                    </span>
                  )}
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
