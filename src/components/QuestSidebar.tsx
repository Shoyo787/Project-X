import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ScrollText, Swords } from 'lucide-react';
import { DailyQuest } from '../types/game';

interface QuestSidebarProps {
  quests: DailyQuest[];
  totalDps: number;
  totalKills: number;
  entityCount: number;
  onClaimQuest: (questId: string) => void;
}

export const QuestSidebar: React.FC<QuestSidebarProps> = ({
  quests,
  totalDps,
  totalKills,
  entityCount,
  onClaimQuest,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className="pointer-events-auto z-10 max-h-full w-60 shrink-0 self-start overflow-y-auto sm:w-64">
      <div className="parchment-panel rounded-xl p-3">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between text-left"
        >
          <span className="flex items-center gap-1.5 font-display text-xs font-bold tracking-wider text-[#2b2623]">
            <ScrollText className="h-3.5 w-3.5 text-[#c86446]" />
            DAILY STEWARD DEEDS
          </span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-[#6b5a44]" />
          ) : (
            <ChevronUp className="h-4 w-4 text-[#6b5a44]" />
          )}
        </button>

        {!collapsed && (
          <>
            <div className="mt-2.5 flex flex-col gap-2">
              {quests.map((quest) => {
                const pct = Math.min(100, (quest.progress / quest.target) * 100);
                const ready = quest.progress >= quest.target && !quest.claimed;

                return (
                  <div
                    key={quest.id}
                    className={`parchment-card rounded-lg p-2 ${
                      quest.claimed ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#2b2623]">{quest.title}</span>
                      <span className="font-mono text-[10px] font-bold text-[#6b5a44]">
                        {Math.min(quest.progress, quest.target)}/{quest.target}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#6b5a44]">
                      {quest.description}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#dfd2ba]">
                      <div
                        className="h-full rounded-full bg-[#7c9a6e] transition-all duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold text-[#8c6d46]">
                        +{quest.rewardGold}g • +{quest.rewardAether}a
                      </span>
                      {quest.claimed ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#5d7a4f]">
                          <CheckCircle2 className="h-3 w-3" /> Claimed
                        </span>
                      ) : ready ? (
                        <button
                          type="button"
                          onClick={() => onClaimQuest(quest.id)}
                          className="ink-button cursor-pointer rounded bg-[#7c9a6e] px-2 py-0.5 text-[10px] font-bold text-white hover:bg-[#6a875d]"
                        >
                          Claim
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-[#8c6d46]/30 pt-2 text-center">
              <div>
                <div className="text-[9px] font-semibold uppercase text-[#6b5a44]">Defense</div>
                <div className="flex items-center justify-center gap-0.5 font-mono text-xs font-bold text-[#2b2623]">
                  <Swords className="h-3 w-3 text-[#c86446]" />
                  {Math.round(totalDps)}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase text-[#6b5a44]">Raiders</div>
                <div className="font-mono text-xs font-bold text-[#2b2623]">{totalKills}</div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase text-[#6b5a44]">Builds</div>
                <div className="font-mono text-xs font-bold text-[#2b2623]">{entityCount}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
