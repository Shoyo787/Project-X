import React from 'react';
import {
  CheckCircle2,
  FastForward,
  History,
  Pause,
  Play,
  ScrollText,
  Skull,
  SlidersHorizontal,
  Swords,
  X,
  Zap,
} from 'lucide-react';
import { formatCountdownHMS } from '../game/utils/format';
import { DailyQuest } from '../types/game';

interface QuestsPopoverProps {
  quests: DailyQuest[];
  onClaimQuest: (questId: string) => void;
  onClose: () => void;
}

export const QuestsPopover: React.FC<QuestsPopoverProps> = ({
  quests,
  onClaimQuest,
  onClose,
}) => (
  <div className="parchment-panel absolute top-full mt-2 w-72 rounded-2xl bg-[#faf5ea]/95 p-3 backdrop-blur-md sm:w-80">
    <div className="flex items-center justify-between border-b border-[#8c6d46]/30 pb-2">
      <span className="flex items-center gap-1.5 font-display text-xs font-bold tracking-wider text-[#2b2623]">
        <ScrollText className="h-3.5 w-3.5 text-[#c86446]" />
        DAILY STEWARD DEEDS
      </span>
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer rounded-md p-0.5 text-[#6b5a44] hover:bg-[#eadcc4] hover:text-[#2b2623]"
        aria-label="Close quests"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>

    <div className="mt-2.5 flex max-h-72 flex-col gap-2 overflow-y-auto">
      {quests.map((quest) => {
        const pct = Math.min(100, (quest.progress / quest.target) * 100);
        const ready = quest.progress >= quest.target && !quest.claimed;

        return (
          <div
            key={quest.id}
            className={`parchment-card rounded-lg p-2 ${quest.claimed ? 'opacity-60' : ''}`}
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
  </div>
);

interface StatsControlsPopoverProps {
  keepHp: number;
  keepMaxHp: number;
  totalDps: number;
  totalKills: number;
  goldPerSec: number;
  aetherPerSec: number;
  entityCount: number;
  bossCountdownMs: number;
  speedMultiplier: 1 | 2;
  isPaused: boolean;
  onSummonBoss: () => void;
  onToggleSpeed: () => void;
  onTogglePause: () => void;
  onDevSpeedup: () => void;
  onTestOffline: () => void;
  onClose: () => void;
}

export const StatsControlsPopover: React.FC<StatsControlsPopoverProps> = ({
  keepHp,
  keepMaxHp,
  totalDps,
  totalKills,
  goldPerSec,
  aetherPerSec,
  entityCount,
  bossCountdownMs,
  speedMultiplier,
  isPaused,
  onSummonBoss,
  onToggleSpeed,
  onTogglePause,
  onDevSpeedup,
  onTestOffline,
  onClose,
}) => (
  <div className="parchment-panel absolute top-full mt-2 w-72 rounded-2xl bg-[#faf5ea]/95 p-3 backdrop-blur-md sm:w-80">
    <div className="flex items-center justify-between border-b border-[#8c6d46]/30 pb-2">
      <span className="flex items-center gap-1.5 font-display text-xs font-bold tracking-wider text-[#2b2623]">
        <SlidersHorizontal className="h-3.5 w-3.5 text-[#8c6d46]" />
        BASTION STATS &amp; CONTROLS
      </span>
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer rounded-md p-0.5 text-[#6b5a44] hover:bg-[#eadcc4] hover:text-[#2b2623]"
        aria-label="Close controls"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>

    <div className="parchment-card mt-2.5 grid grid-cols-3 gap-2 rounded-lg p-2 text-center">
      <div>
        <div className="text-[9px] font-semibold uppercase text-[#6b5a44]">Keep HP</div>
        <div className="font-mono text-xs font-bold text-[#c86446]">
          {keepHp}/{keepMaxHp}
        </div>
      </div>
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
        <div className="text-[9px] font-semibold uppercase text-[#6b5a44]">Gold / s</div>
        <div className="font-mono text-[11px] font-bold text-[#8c5e14]">
          +{goldPerSec.toFixed(1)}
        </div>
      </div>
      <div>
        <div className="text-[9px] font-semibold uppercase text-[#6b5a44]">Aether / s</div>
        <div className="font-mono text-[11px] font-bold text-[#317180]">
          +{aetherPerSec.toFixed(1)}
        </div>
      </div>
      <div>
        <div className="text-[9px] font-semibold uppercase text-[#6b5a44]">Builds</div>
        <div className="font-mono text-[11px] font-bold text-[#2b2623]">{entityCount}</div>
      </div>
    </div>

    <div className="parchment-card mt-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs">
      <div className="flex items-center gap-1.5">
        <Skull className="h-3.5 w-3.5 text-[#9a4730]" />
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-[#6b5a44]">
            Eclipse Siege Boss
          </div>
          <div className="font-mono text-xs font-bold text-[#2b2623]">
            {formatCountdownHMS(bossCountdownMs)}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onSummonBoss}
        className="ink-button cursor-pointer rounded-lg bg-[#c86446] px-2.5 py-1 text-[11px] font-bold text-[#fcf8ef] hover:bg-[#b55639]"
      >
        Summon
      </button>
    </div>

    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
      <button
        type="button"
        onClick={onToggleSpeed}
        className={`ink-button flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-mono font-bold ${
          speedMultiplier === 2
            ? 'bg-[#7c9a6e] text-white'
            : 'bg-[#fcf8ef] text-[#2b2623]'
        }`}
      >
        <FastForward className="h-3.5 w-3.5" />
        <span>Speed {speedMultiplier}x</span>
      </button>

      <button
        type="button"
        onClick={onTogglePause}
        className="ink-button flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#fcf8ef] px-2 py-1.5 text-xs font-bold text-[#2b2623] hover:bg-[#efe3cd]"
      >
        {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        <span>{isPaused ? 'Resume' : 'Pause'}</span>
      </button>

      <button
        type="button"
        onClick={onDevSpeedup}
        className="ink-button flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#f4c76b] px-2 py-1.5 text-[11px] font-bold text-[#2b2623] hover:bg-[#ebc05c]"
      >
        <Zap className="h-3.5 w-3.5" />
        <span>+1m Speedup</span>
      </button>

      <button
        type="button"
        onClick={onTestOffline}
        className="ink-button flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#fcf8ef] px-2 py-1.5 text-[11px] font-bold text-[#2b2623] hover:bg-[#efe3cd]"
      >
        <History className="h-3.5 w-3.5 text-[#8c6d46]" />
        <span>30m Offline</span>
      </button>
    </div>
  </div>
);
