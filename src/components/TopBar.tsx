import React from 'react';
import {
  Castle,
  Coins,
  FastForward,
  History,
  Pause,
  Play,
  Shield,
  Skull,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { formatCountdownHMS } from '../game/utils/format';

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
  bossCountdownMs: number;
  speedMultiplier: 1 | 2;
  isPaused: boolean;
  isMuted: boolean;
  onSummonBoss: () => void;
  onDevSpeedup: () => void;
  onTestOffline: () => void;
  onToggleSpeed: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

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
  bossCountdownMs,
  speedMultiplier,
  isPaused,
  isMuted,
  onSummonBoss,
  onDevSpeedup,
  onTestOffline,
  onToggleSpeed,
  onTogglePause,
  onToggleMute,
}) => {
  const goldFloor = Math.floor(gold);
  const aetherFloor = Math.floor(aether);
  const goldPct = Math.min(100, (goldFloor / maxGold) * 100);
  const aetherPct = Math.min(100, (aetherFloor / maxAether) * 100);
  const isGoldFull = goldFloor >= maxGold;
  const isAetherFull = aetherFloor >= maxAether;

  return (
    <header className="pointer-events-none z-20 flex flex-wrap items-center justify-between gap-2">
      {/* Left: Title + Resources */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
        <div className="parchment-panel flex items-center gap-2 rounded-xl px-2.5 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2b2623] bg-[#c86446] text-[#fcf8ef] shadow-xs">
            <Castle className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display text-xs font-extrabold tracking-wide text-[#2b2623] leading-none">
              BASTION VALE
            </h1>
            <p className="text-[10px] font-semibold text-[#6b5a44] leading-tight">
              Isometric Stronghold
            </p>
          </div>
        </div>

        {/* Gold / Timber Storage Gauge */}
        <div className="parchment-panel flex min-w-[144px] flex-col gap-1 rounded-xl px-2.5 py-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1 font-bold text-[#2b2623]">
              <Coins className="h-3.5 w-3.5 text-[#c78b2a]" />
              <span className="font-mono">
                {goldFloor}/{maxGold}
              </span>
            </span>
            {isGoldFull ? (
              <span className="rounded bg-[#c86446] px-1.5 py-0.5 text-[9px] font-bold text-white">
                FULL
              </span>
            ) : (
              <span className="font-mono text-[10px] font-semibold text-[#6b5a44]">
                +{goldPerSec.toFixed(1)}/s
              </span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-[#2b2623]/40 bg-[#dfd2ba]">
            <div
              className="h-full rounded-full bg-[#d9a441] transition-all duration-150"
              style={{ width: `${goldPct}%` }}
            />
          </div>
        </div>

        {/* Aether / Mana Storage Gauge */}
        <div className="parchment-panel flex min-w-[138px] flex-col gap-1 rounded-xl px-2.5 py-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1 font-bold text-[#2b2623]">
              <Sparkles className="h-3.5 w-3.5 text-[#438e9e]" />
              <span className="font-mono">
                {aetherFloor}/{maxAether}
              </span>
            </span>
            {isAetherFull ? (
              <span className="rounded bg-[#c86446] px-1.5 py-0.5 text-[9px] font-bold text-white">
                FULL
              </span>
            ) : (
              <span className="font-mono text-[10px] font-semibold text-[#6b5a44]">
                +{aetherPerSec.toFixed(1)}/s
              </span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-[#2b2623]/40 bg-[#dfd2ba]">
            <div
              className="h-full rounded-full bg-[#5ba4b5] transition-all duration-150"
              style={{ width: `${aetherPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Center: Wave, Keep HP, Eclipse Boss Countdown */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <div className="parchment-panel flex items-center gap-3 rounded-xl px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold">
            <Shield className="h-3.5 w-3.5 text-[#c86446]" />
            <span>Wave {wave}</span>
          </div>
          <div className="h-4 w-px bg-[#8c6d46]/40" />
          <div className="flex items-center gap-1.5 font-mono font-bold text-[#2b2623]">
            <span>Keep</span>
            <span className="text-[#c86446]">
              {keepHp}/{keepMaxHp}
            </span>
          </div>
        </div>

        <div className="parchment-panel flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs">
          <Skull className="h-3.5 w-3.5 text-[#9a4730]" />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6b5a44]">
              Eclipse Siege Boss
            </div>
            <div className="font-mono text-xs font-bold text-[#2b2623]">
              {formatCountdownHMS(bossCountdownMs)}
            </div>
          </div>
          <button
            type="button"
            onClick={onSummonBoss}
            className="ink-button ml-1 cursor-pointer rounded-lg bg-[#c86446] px-2 py-1 text-[11px] font-bold text-[#fcf8ef] hover:bg-[#b55639]"
            title="Summon the Eclipse Siege Boss immediately for extra rewards"
          >
            Summon
          </button>
        </div>
      </div>

      {/* Right: Dev Speedup, Offline Demo, Sim Speed, Mute */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDevSpeedup}
          className="ink-button flex cursor-pointer items-center gap-1 rounded-xl bg-[#f4c76b] px-2.5 py-2 text-xs font-bold text-[#2b2623] hover:bg-[#ebc05c]"
          title="Advance all upgrade timers and mine production by +1 minute"
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Dev +1m Speedup</span>
        </button>

        <button
          type="button"
          onClick={onTestOffline}
          className="ink-button flex cursor-pointer items-center gap-1 rounded-xl bg-[#fcf8ef] px-2.5 py-2 text-xs font-bold text-[#2b2623] hover:bg-[#efe3cd]"
          title="Simulate returning after 30 minutes offline to preview the Steward's Report"
        >
          <History className="h-3.5 w-3.5 text-[#8c6d46]" />
          <span className="hidden md:inline">30m Offline</span>
        </button>

        <button
          type="button"
          onClick={onToggleSpeed}
          className={`ink-button flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-mono font-bold ${
            speedMultiplier === 2
              ? 'bg-[#7c9a6e] text-white'
              : 'bg-[#fcf8ef] text-[#2b2623]'
          }`}
          title="Toggle simulation speed (1x / 2x)"
        >
          <FastForward className="h-3.5 w-3.5" />
          <span>{speedMultiplier}x</span>
        </button>

        <button
          type="button"
          onClick={onTogglePause}
          className="ink-button flex cursor-pointer items-center justify-center rounded-xl bg-[#fcf8ef] p-2 text-[#2b2623] hover:bg-[#efe3cd]"
          title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          className="ink-button flex cursor-pointer items-center justify-center rounded-xl bg-[#fcf8ef] p-2 text-[#2b2623] hover:bg-[#efe3cd]"
          title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-[#c86446]" />
          ) : (
            <Volume2 className="h-4 w-4 text-[#5a626a]" />
          )}
        </button>
      </div>
    </header>
  );
};
