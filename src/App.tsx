import { useCallback, useEffect, useRef, useState } from 'react';
import { BuildDock } from './components/BuildDock';
import { EntityInspector } from './components/EntityInspector';
import { StewardReportModal } from './components/StewardReportModal';
import { TopBar } from './components/TopBar';
import { ALL_BUILDABLES, isValidGridCoord } from './game/config';
import { GameEngine } from './game/engine/GameEngine';
import { GameCanvas3D } from './scene/GameCanvas3D';
import { BuildableId, DailyQuest, OfflineReport, PlacedEntity } from './types/game';

interface HudSnapshot {
  gold: number;
  maxGold: number;
  goldPerSec: number;
  aether: number;
  maxAether: number;
  aetherPerSec: number;
  wave: number;
  keepHp: number;
  keepMaxHp: number;
  totalKills: number;
  totalDps: number;
  bossCountdownMs: number;
  entities: PlacedEntity[];
  dailyQuests: DailyQuest[];
  offlineReport: OfflineReport | null;
  speedMultiplier: 1 | 2;
  isPaused: boolean;
  isMuted: boolean;
  nowMs: number;
}

function createHudSnapshot(engine: GameEngine): HudSnapshot {
  const state = engine.getState();
  const caps = engine.getStorageCaps();
  const rates = engine.getProductionRates();
  const nowMs = Date.now();

  return {
    gold: state.resources.gold,
    maxGold: caps.maxGold,
    goldPerSec: rates.goldPerSec,
    aether: state.resources.aether,
    maxAether: caps.maxAether,
    aetherPerSec: rates.aetherPerSec,
    wave: state.wave,
    keepHp: state.keepHp,
    keepMaxHp: state.keepMaxHp,
    totalKills: state.totalKills,
    totalDps: engine.getTotalDefenseDps(),
    bossCountdownMs: engine.getNextBossCountdownMs(nowMs),
    entities: state.entities.map((e) => ({ ...e })),
    dailyQuests: state.dailyQuests.map((q) => ({ ...q })),
    offlineReport: engine.getPendingOfflineReport(),
    speedMultiplier: engine.getSpeedMultiplier(),
    isPaused: engine.isPaused(),
    isMuted: engine.sound.isMuted(),
    nowMs,
  };
}

export function App() {
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new GameEngine();
  }

  const [hud, setHud] = useState<HudSnapshot>(() => createHudSnapshot(engineRef.current!));
  const [selectedBuildId, setSelectedBuildId] = useState<BuildableId | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const syncHud = useCallback(() => {
    if (engineRef.current) {
      setHud(createHudSnapshot(engineRef.current));
    }
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    return engine.on('stateChanged', syncHud);
  }, [syncHud]);

  const showFeedback = useCallback((msg: string) => {
    setFeedbackMessage(msg);
  }, []);

  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = window.setTimeout(() => setFeedbackMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [feedbackMessage]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBuildId(null);
        setSelectedEntityId(null);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        engineRef.current?.togglePause();
        return;
      }
      const num = Number(e.key);
      if (num >= 1 && num <= ALL_BUILDABLES.length) {
        const target = ALL_BUILDABLES[num - 1];
        if (target) {
          setSelectedEntityId(null);
          setSelectedBuildId((prev) => (prev === target.id ? null : target.id));
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleTileClick = useCallback(
    (col: number, row: number) => {
      const engine = engineRef.current;
      if (!engine) return;

      engine.sound.unlock();

      if (!isValidGridCoord(col, row)) {
        setSelectedEntityId(null);
        return;
      }

      if (selectedBuildId) {
        const result = engine.placeEntity(selectedBuildId, col, row);
        if (result.ok && result.entity) {
          setSelectedBuildId(null);
          setSelectedEntityId(result.entity.id);
          setFeedbackMessage(null);
        } else if (result.error) {
          showFeedback(result.error);
        }
        return;
      }

      const existing = engine.getEntityAt(col, row);
      setSelectedEntityId(existing ? existing.id : null);
    },
    [selectedBuildId, showFeedback],
  );

  const selectedEntity =
    selectedEntityId !== null
      ? hud.entities.find((entity) => entity.id === selectedEntityId) ?? null
      : null;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <GameCanvas3D
        engine={engineRef.current}
        entities={hud.entities}
        keepHp={hud.keepHp}
        keepMaxHp={hud.keepMaxHp}
        selectedBuildId={selectedBuildId}
        selectedEntityId={selectedEntityId}
        onTileClick={handleTileClick}
        onClearSelection={() => setSelectedEntityId(null)}
      />

      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between gap-2 p-2.5 sm:p-4">
        <TopBar
          gold={hud.gold}
          maxGold={hud.maxGold}
          goldPerSec={hud.goldPerSec}
          aether={hud.aether}
          maxAether={hud.maxAether}
          aetherPerSec={hud.aetherPerSec}
          wave={hud.wave}
          keepHp={hud.keepHp}
          keepMaxHp={hud.keepMaxHp}
          totalDps={hud.totalDps}
          totalKills={hud.totalKills}
          entityCount={hud.entities.length}
          bossCountdownMs={hud.bossCountdownMs}
          quests={hud.dailyQuests}
          speedMultiplier={hud.speedMultiplier}
          isPaused={hud.isPaused}
          isMuted={hud.isMuted}
          onClaimQuest={(questId) => {
            engineRef.current?.claimQuest(questId);
          }}
          onSummonBoss={() => {
            engineRef.current?.summonEclipseBoss();
          }}
          onDevSpeedup={() => {
            engineRef.current?.devSpeedupOneMinute();
          }}
          onTestOffline={() => {
            engineRef.current?.triggerOfflineDemo(30);
          }}
          onToggleSpeed={() => {
            const next = hud.speedMultiplier === 1 ? 2 : 1;
            engineRef.current?.setSpeedMultiplier(next);
          }}
          onTogglePause={() => {
            engineRef.current?.togglePause();
          }}
          onToggleMute={() => {
            engineRef.current?.toggleMute();
          }}
        />

        <div className="pointer-events-none flex min-h-0 flex-1 items-start justify-end">
          {selectedEntity && (
            <EntityInspector
              entity={selectedEntity}
              gold={hud.gold}
              aether={hud.aether}
              nowMs={hud.nowMs}
              onUpgrade={(entityId) => {
                const res = engineRef.current?.startUpgrade(entityId);
                if (res && !res.ok && res.error) {
                  showFeedback(res.error);
                }
              }}
              onCycleTargeting={(entityId) => {
                engineRef.current?.cycleTargetingMode(entityId);
              }}
              onDemolish={(entityId) => {
                engineRef.current?.demolishEntity(entityId);
                setSelectedEntityId(null);
              }}
              onDevSpeedup={() => {
                engineRef.current?.devSpeedupOneMinute();
              }}
              onClose={() => setSelectedEntityId(null)}
            />
          )}
        </div>

        <BuildDock
          selectedBuildId={selectedBuildId}
          gold={hud.gold}
          aether={hud.aether}
          feedbackMessage={feedbackMessage}
          onSelectBuild={(id) => {
            engineRef.current?.sound.unlock();
            if (id) setSelectedEntityId(null);
            setSelectedBuildId(id);
          }}
        />
      </div>

      {hud.offlineReport && (
        <StewardReportModal
          report={hud.offlineReport}
          onDismiss={() => {
            engineRef.current?.dismissOfflineReport();
          }}
        />
      )}
    </main>
  );
}

export default App;
