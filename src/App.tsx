import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BuildDock } from './components/BuildDock';
import { EntityInspector } from './components/EntityInspector';
import { QuestSidebar } from './components/QuestSidebar';
import { StewardReportModal } from './components/StewardReportModal';
import { TopBar } from './components/TopBar';
import { BUILDING_LIST, TOWER_LIST, isValidGridCoord } from './game/config';
import { GameEngine } from './game/engine/GameEngine';
import { IsoRenderer, RenderInteractionState } from './game/renderer/IsoRenderer';
import { BuildableId, DailyQuest, GridCoord, OfflineReport, PlacedEntity } from './types/game';

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

  const rendererRef = useRef<IsoRenderer | null>(null);
  if (!rendererRef.current) {
    rendererRef.current = new IsoRenderer();
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => createHudSnapshot(engineRef.current!));
  const [selectedBuildId, setSelectedBuildId] = useState<BuildableId | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<GridCoord | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const interactionRef = useRef<RenderInteractionState>({
    hoveredTile: null,
    selectedEntityId: null,
    selectedBuildId: null,
  });
  interactionRef.current = {
    hoveredTile,
    selectedEntityId,
    selectedBuildId,
  };

  const syncHud = useCallback(() => {
    if (engineRef.current) {
      setHud(createHudSnapshot(engineRef.current));
    }
  }, []);

  const showFeedback = useCallback((msg: string) => {
    setFeedbackMessage(msg);
  }, []);

  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = window.setTimeout(() => setFeedbackMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [feedbackMessage]);

  // 60 FPS simulation & Isometric Canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !engine || !renderer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;
    let lastFrameMs = performance.now();
    let lastHudSyncMs = 0;

    const frame = (nowPerf: number) => {
      const dtSec = Math.max(0.001, (nowPerf - lastFrameMs) / 1000);
      lastFrameMs = nowPerf;

      engine.tick(dtSec);
      renderer.render(ctx, width, height, engine, interactionRef.current, nowPerf / 1000);

      if (nowPerf - lastHudSyncMs >= 100) {
        lastHudSyncMs = nowPerf;
        setHud(createHudSnapshot(engine));
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Keyboard shortcuts (1-6 build hotkeys, Esc cancel, Space pause)
  useEffect(() => {
    const buildItems = [...TOWER_LIST, ...BUILDING_LIST];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBuildId(null);
        setSelectedEntityId(null);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        engineRef.current?.togglePause();
        syncHud();
        return;
      }
      const num = Number(e.key);
      if (num >= 1 && num <= buildItems.length) {
        const target = buildItems[num - 1];
        if (target) {
          setSelectedEntityId(null);
          setSelectedBuildId((prev) => (prev === target.id ? null : target.id));
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [syncHud]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const picked = renderer.pickGridTile(x, y);

    if (isValidGridCoord(picked.col, picked.row)) {
      setHoveredTile(picked);
    } else {
      setHoveredTile(null);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const engine = engineRef.current;
    if (!canvas || !renderer || !engine) return;

    engine.sound.unlock();

    const rect = canvas.getBoundingClientRect();
    const picked = renderer.pickGridTile(e.clientX - rect.left, e.clientY - rect.top);

    if (!isValidGridCoord(picked.col, picked.row)) {
      setSelectedEntityId(null);
      return;
    }

    if (selectedBuildId) {
      const result = engine.placeEntity(selectedBuildId, picked.col, picked.row);
      if (result.ok && result.entity) {
        if (!e.shiftKey) {
          setSelectedBuildId(null);
        }
        setSelectedEntityId(result.entity.id);
        setFeedbackMessage(null);
      } else if (result.error) {
        showFeedback(result.error);
      }
      syncHud();
      return;
    }

    const existing = engine.getEntityAt(picked.col, picked.row);
    setSelectedEntityId(existing ? existing.id : null);
  };

  const selectedEntity =
    selectedEntityId !== null
      ? hud.entities.find((entity) => entity.id === selectedEntityId) ?? null
      : null;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredTile(null)}
        onClick={handleCanvasClick}
        className={`block h-full w-full ${
          selectedBuildId ? 'cursor-crosshair' : 'cursor-pointer'
        }`}
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
          bossCountdownMs={hud.bossCountdownMs}
          speedMultiplier={hud.speedMultiplier}
          isPaused={hud.isPaused}
          isMuted={hud.isMuted}
          onSummonBoss={() => {
            engineRef.current?.summonEclipseBoss();
            syncHud();
          }}
          onDevSpeedup={() => {
            engineRef.current?.devSpeedupOneMinute();
            syncHud();
          }}
          onTestOffline={() => {
            engineRef.current?.triggerOfflineDemo(30);
            syncHud();
          }}
          onToggleSpeed={() => {
            const next = hud.speedMultiplier === 1 ? 2 : 1;
            engineRef.current?.setSpeedMultiplier(next);
            syncHud();
          }}
          onTogglePause={() => {
            engineRef.current?.togglePause();
            syncHud();
          }}
          onToggleMute={() => {
            engineRef.current?.sound.toggleMute();
            syncHud();
          }}
        />

        <div className="pointer-events-none flex min-h-0 flex-1 items-start justify-between gap-3">
          <QuestSidebar
            quests={hud.dailyQuests}
            totalDps={hud.totalDps}
            totalKills={hud.totalKills}
            entityCount={hud.entities.length}
            onClaimQuest={(questId) => {
              engineRef.current?.claimQuest(questId);
              syncHud();
            }}
          />

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
                syncHud();
              }}
              onCycleTargeting={(entityId) => {
                engineRef.current?.cycleTargetingMode(entityId);
                syncHud();
              }}
              onDemolish={(entityId) => {
                engineRef.current?.demolishEntity(entityId);
                setSelectedEntityId(null);
                syncHud();
              }}
              onDevSpeedup={() => {
                engineRef.current?.devSpeedupOneMinute();
                syncHud();
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
            syncHud();
          }}
        />
      )}
    </main>
  );
}

export default App;
