import React, { useEffect, useRef, useState } from 'react';
import {
  Coins,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DailyQuest } from '../types/game';
import { QuestsPopover, StatsControlsPopover } from './TopBarPopovers';

interface TopBarProps {
  gold: number;
  maxGold: number;
  goldPerSec: number;
  aether: number;
  maxAether: number;
  aetherPerSec: number;
  wave: number;
  keepHp: number;
  keepMaxHp: number;
  totalDps: number;
  totalKills: number;
  entityCount: number;
  bossCountdownMs: number;
  quests: DailyQuest[];
  speedMultiplier: 1 | 2;
  isPaused: boolean;
  isMuted: boolean;
  onClaimQuest: (questId: string) => void;
  onSummonBoss: () => void;
  onDevSpeedup: () => void;
  onTestOffline: () => void;
  onToggleSpeed: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

type ActivePopover = 'quests' | 'controls' | null;

export const TopBar: React.FC<TopBarProps> = ({
  gold,
  maxGold,
  goldPerSec,
  aether,
  maxAether,
  aetherPerSec,
  wave,
  keepHp,
  keepMaxHp,
  totalDps,
  totalKills,
  entityCount,
  bossCountdownMs,
  quests,
  speedMultiplier,
  isPaused,
  isMuted,
  onClaimQuest,
  onSummonBoss,
  onDevSpeedup,
  onTestOffline,
  onToggleSpeed,
  onTogglePause,
  onToggleMute,
}) => {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePopover) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [activePopover]);

  const goldFloor = Math.floor(gold);
  const aetherFloor = Math.floor(aether);
  const hasClaimableQuest = quests.some((q) => q.progress >= q.target && !q.claimed);

  const togglePopover = (target: Exclude<ActivePopover, null>) => {
    setActivePopover((prev) => (prev === target ? null : target));
  };

  return (
    <header className="pointer-events-none z-20 flex justify-center">
      <div ref={containerRef} className="pointer-events-auto relative flex flex-col items-center">
        <div className="flex items-center gap-2 rounded-full border-2 border-[#2b2623] bg-[#faf5ea]/85 px-3.5 py-1.5 text-xs shadow-md backdrop-blur-md sm:gap-3">
          <div
            className="flex items-center gap-1.5 font-mono font-bold text-[#2b2623]"
            title={`Gold: ${goldFloor}/${maxGold} (+${goldPerSec.toFixed(1)}/s)`}
          >
            <Coins className="h-3.5 w-3.5 text-[#c78b2a]" />
            <span>
              {goldFloor}
              <span className="text-[#6b5a44]">/{maxGold}</span>
            </span>
          </div>

          <div className="h-3.5 w-px bg-[#8c6d46]/35" />

          <div
            className="flex items-center gap-1.5 font-mono font-bold text-[#2b2623]"
            title={`Aether: ${aetherFloor}/${maxAether} (+${aetherPerSec.toFixed(1)}/s)`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#438e9e]" />
            <span>
              {aetherFloor}
              <span className="text-[#6b5a44]">/{maxAether}</span>
            </span>
          </div>

          <div className="h-3.5 w-px bg-[#8c6d46]/35" />

          <div className="flex items-center gap-1 font-bold text-[#2b2623]">
            <Shield className="h-3.5 w-3.5 text-[#c86446]" />
            <span>Wave {wave}</span>
          </div>

          <div className="h-3.5 w-px bg-[#8c6d46]/35" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleMute}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#2b2623]/25 bg-[#f6efe2]/90 text-[#2b2623] transition-colors hover:bg-[#eadcc4]"
              title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
              aria-label={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5 text-[#c86446]" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-[#5a626a]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => togglePopover('quests')}
              className={`relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#2b2623]/25 transition-colors ${
                activePopover === 'quests'
                  ? 'bg-[#f4c76b] text-[#2b2623]'
                  : 'bg-[#f6efe2]/90 text-[#2b2623] hover:bg-[#eadcc4]'
              }`}
              title="Daily Quests"
              aria-label="Daily Quests"
            >
              <ScrollText className="h-3.5 w-3.5 text-[#c86446]" />
              {hasClaimableQuest && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#2b2623] bg-[#7c9a6e]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => togglePopover('controls')}
              className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#2b2623]/25 transition-colors ${
                activePopover === 'controls'
                  ? 'bg-[#f4c76b] text-[#2b2623]'
                  : 'bg-[#f6efe2]/90 text-[#2b2623] hover:bg-[#eadcc4]'
              }`}
              title="Bastion Stats & Controls"
              aria-label="Bastion Stats & Controls"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#5a626a]" />
            </button>
          </div>
        </div>

        {activePopover === 'quests' && (
          <QuestsPopover
            quests={quests}
            onClaimQuest={onClaimQuest}
            onClose={() => setActivePopover(null)}
          />
        )}

        {activePopover === 'controls' && (
          <StatsControlsPopover
            keepHp={keepHp}
            keepMaxHp={keepMaxHp}
            totalDps={totalDps}
            totalKills={totalKills}
            goldPerSec={goldPerSec}
            aetherPerSec={aetherPerSec}
            entityCount={entityCount}
            bossCountdownMs={bossCountdownMs}
            speedMultiplier={speedMultiplier}
            isPaused={isPaused}
            onSummonBoss={onSummonBoss}
            onToggleSpeed={onToggleSpeed}
            onTogglePause={onTogglePause}
            onDevSpeedup={onDevSpeedup}
            onTestOffline={onTestOffline}
            onClose={() => setActivePopover(null)}
          />
        )}
      </div>
    </header>
  );
};
