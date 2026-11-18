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
import { ALL_BUILDABLES, TOWER_LIST, getBuildableStatsAtLevel } from '../game/config';
import { BuildableIconKey, BuildableId } from '../types/game';

interface BuildDockProps {
  selectedBuildId: BuildableId | null;
  gold: number;
  aether: number;
  feedbackMessage: string | null;
  onSelectBuild: (id: BuildableId | null) => void;
}

function renderBuildableIcon(iconKey: BuildableIconKey, color: string): React.ReactNode {
  const props = { className: 'h-4 w-4', style: { color } };
  switch (iconKey) {
    case 'crosshair':
      return <Crosshair {...props} />;
    case 'snowflake':
      return <Snowflake {...props} />;
    case 'flame':
      return <Flame {...props} />;
    case 'pickaxe':
      return <Pickaxe {...props} />;
    case 'sparkles':
      return <Sparkles {...props} />;
    case 'warehouse':
      return <Warehouse {...props} />;
  }
}

export const BuildDock: React.FC<BuildDockProps> = ({
  selectedBuildId,
  gold,
  aether,
  feedbackMessage,
  onSelectBuild,
}) => {
  return (
    <div className="pointer-events-none z-20 flex flex-col items-center gap-1.5">
      {(selectedBuildId || feedbackMessage) && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-[#2b2623] bg-[#faf5ea]/90 px-3.5 py-1 text-xs font-bold text-[#2b2623] shadow-sm backdrop-blur-md">
          {feedbackMessage ? (
            <span className="text-[#b0432b]">{feedbackMessage}</span>
          ) : (
            <>
              <Hammer className="h-3.5 w-3.5 text-[#c86446]" />
              <span>
                Place{' '}
                <strong className="text-[#a64430]">
                  {ALL_BUILDABLES.find((i) => i.id === selectedBuildId)?.name}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onSelectBuild(null)}
                className="ml-0.5 flex cursor-pointer items-center gap-0.5 rounded-full bg-[#2b2623] px-1.5 py-0.5 text-[10px] text-[#fcf8ef]"
                aria-label="Cancel placement"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}

      <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border-2 border-[#2b2623] bg-[#faf5ea]/88 px-2.5 py-1.5 shadow-md backdrop-blur-md">
        {ALL_BUILDABLES.map((item, idx) => {
          const lvl1 = getBuildableStatsAtLevel(item, 1);
          const canAfford = gold >= lvl1.costGold && aether >= lvl1.costAether;
          const isSelected = selectedBuildId === item.id;
          const isDivider = idx === TOWER_LIST.length;

          return (
            <React.Fragment key={item.id}>
              {isDivider && <div className="mx-0.5 h-8 w-px shrink-0 bg-[#8c6d46]/35" />}
              <button
                type="button"
                onClick={() => onSelectBuild(isSelected ? null : item.id)}
                className={`ink-button flex min-w-[72px] shrink-0 cursor-pointer flex-col items-center rounded-xl px-2.5 py-1.5 text-center ${
                  isSelected
                    ? 'bg-[#f4c76b]'
                    : canAfford
                      ? 'bg-[#fcf8ef]/95 hover:bg-[#f2e6d0]'
                      : 'bg-[#e6dac3]/90 opacity-70'
                }`}
              >
                <div>{renderBuildableIcon(item.iconKey, item.roofColor)}</div>
                <span className="mt-0.5 text-[11px] font-bold leading-tight text-[#2b2623]">
                  {item.shortName}
                </span>
                <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] font-bold leading-none">
                  <span className={gold >= lvl1.costGold ? 'text-[#8c5e14]' : 'text-[#b0432b]'}>
                    {lvl1.costGold}g
                  </span>
                  {lvl1.costAether > 0 && (
                    <span className={aether >= lvl1.costAether ? 'text-[#317180]' : 'text-[#b0432b]'}>
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
