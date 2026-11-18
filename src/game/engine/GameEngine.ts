import { BALANCE_CONFIG, ENEMY_CONFIGS, PATH_WAYPOINTS, createInitialGameState } from '../config';
import {
  BuildableId, CloudInstance, EnemyInstance, FloatingTextInstance, GameState,
  GridTile, OfflineReport, ParticleInstance, PlacedEntity, ProductionRates,
  ProjectileInstance, StorageCaps, TargetingMode, TransientVisualState,
} from '../../types/game';
import { CombatSimulator } from './CombatSimulator';
import { GameEventEmitter } from './GameEventEmitter';
import { calculateOfflineProgress, computeProductionRates, computeTotalDefenseDps } from './OfflineCalculator';
import {
  applyDemolishEntity, applyPlaceEntity, applyStartUpgrade, canPlaceOnGrid,
  evaluateCompletedUpgrades, grantStateResources, incrementDailyQuestProgress,
  loadGameStateFromStorage, saveGameStateToStorage, syncStateDerivedFields,
} from './SaveStorage';
import { SoundEngine } from './SoundEngine';
import { VisualEffectsManager } from './VisualEffectsManager';

export class GameEngine extends GameEventEmitter {
  public readonly sound = new SoundEngine();

  private state: GameState;
  private pendingOfflineReport: OfflineReport | null = null;
  private readonly vfx: VisualEffectsManager;
  private readonly combat: CombatSimulator;
  private speedMultiplier: 1 | 2 = 1;
  private paused = false;
  private idCounter = 1;
  private lastSaveTimeMs = 0;
  private hudEmitAccumSec = 0;
  private goldWasFull = false;
  private aetherWasFull = false;

  constructor() {
    super();
    const now = Date.now();
    const loaded = loadGameStateFromStorage();
    if (loaded) {
      const { updatedState, report } = calculateOfflineProgress(loaded, now);
      this.state = updatedState;
      this.pendingOfflineReport = report;
    } else {
      this.state = createInitialGameState(now);
    }
    this.save(now);

    this.vfx = new VisualEffectsManager(this, this.sound);
    this.combat = new CombatSimulator({
      getState: () => this.state,
      nextId: (prefix) => this.nextId(prefix),
      getEntityById: (id) => this.getEntityById(id),
      setTowerAim: (id, angle) => this.vfx.setTowerAim(id, angle),
      onTowerFired: (entity, projectileType) => this.emit('towerFired', { entity, projectileType }),
      onEnemyDamaged: (col, row, damage, isSplash) => this.emit('enemyDamaged', { col, row, damage, isSplash }),
      onEnemyDefeated: (enemy, sourceEntity) => this.handleEnemyDefeated(enemy, sourceEntity),
      onKeepDamaged: (col, row, damage, isBoss) => this.handleKeepDamaged(col, row, damage, isBoss),
      onWaveCleared: (clearedWave, nextWave) => {
        this.emit('waveCleared', { clearedWave, nextWave });
        this.save();
        this.emit('stateChanged');
      },
    });

    this.syncDerivedState();
    this.combat.enqueueWave(this.state.wave);
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}_${this.idCounter}`;
  }

  private save(nowMs = Date.now()): void {
    saveGameStateToStorage(this.state, nowMs);
    this.lastSaveTimeMs = nowMs;
  }

  private syncDerivedState(): void {
    syncStateDerivedFields(this.state);
    this.checkStorageCaps();
  }

  private checkStorageCaps(): void {
    const { gold, aether } = this.state.resources;
    const { maxGold, maxAether } = this.state.storageCaps;
    const goldFull = gold >= maxGold;
    if (goldFull && !this.goldWasFull) this.emit('storageFull', { resource: 'gold', cap: maxGold });
    this.goldWasFull = goldFull;

    const aetherFull = aether >= maxAether;
    if (aetherFull && !this.aetherWasFull) this.emit('storageFull', { resource: 'aether', cap: maxAether });
    this.aetherWasFull = aetherFull;
  }

  public getState(): GameState { return this.state; }
  public getPendingOfflineReport(): OfflineReport | null { return this.pendingOfflineReport; }
  public dismissOfflineReport(): void { this.pendingOfflineReport = null; this.emit('stateChanged'); }
  public getStorageCaps(): StorageCaps { return this.state.storageCaps; }
  public getProductionRates(): ProductionRates { return computeProductionRates(this.state.entities); }
  public getTotalDefenseDps(): number { return computeTotalDefenseDps(this.state.entities); }
  public getSpeedMultiplier(): 1 | 2 { return this.speedMultiplier; }
  public setSpeedMultiplier(mult: 1 | 2): void { this.speedMultiplier = mult; this.emit('stateChanged'); }
  public isPaused(): boolean { return this.paused; }
  public togglePause(): boolean { this.paused = !this.paused; this.emit('stateChanged'); return this.paused; }
  public toggleMute(): boolean { const m = this.sound.toggleMute(); this.emit('stateChanged'); return m; }
  public getNextBossCountdownMs(nowMs = Date.now()): number { return Math.max(0, this.state.eclipseBossNextTimestamp - nowMs); }
  public getEnemies(): readonly EnemyInstance[] { return this.combat.getEnemies(); }
  public getProjectiles(): readonly ProjectileInstance[] { return this.combat.getProjectiles(); }
  public getParticles(): readonly ParticleInstance[] { return this.vfx.getParticles(); }
  public getFloatingTexts(): readonly FloatingTextInstance[] { return this.vfx.getFloatingTexts(); }
  public getClouds(): readonly CloudInstance[] { return this.vfx.getClouds(); }
  public getVisualState(): TransientVisualState { return this.vfx.getVisualState(); }
  public getTileAt(col: number, row: number): GridTile | undefined { return this.state.grid.find((t) => t.x === col && t.z === row); }
  public getEntityAt(col: number, row: number): PlacedEntity | undefined { return this.state.entities.find((e) => e.col === col && e.row === row); }
  public getEntityById(id: string): PlacedEntity | undefined { return this.state.entities.find((e) => e.id === id); }
  public canPlaceAt(col: number, row: number): boolean { return canPlaceOnGrid(this.state, col, row); }

  public placeEntity(configId: BuildableId, col: number, row: number): { ok: boolean; error?: string; entity?: PlacedEntity } {
    this.sound.unlock();
    const res = applyPlaceEntity(this.state, this.nextId(configId), configId, col, row);
    if (!res.ok || !res.entity || !res.name) return { ok: false, error: res.error };
    this.checkStorageCaps();
    this.emit('buildingPlaced', { entity: res.entity, name: res.name });
    this.save();
    this.emit('stateChanged');
    return { ok: true, entity: res.entity };
  }

  public startUpgrade(entityId: string): { ok: boolean; error?: string } {
    this.sound.unlock();
    const now = Date.now();
    const res = applyStartUpgrade(this.state, entityId, now);
    if (!res.ok || !res.entity) return { ok: false, error: res.error };
    this.checkStorageCaps();
    this.emit('upgradeStarted', { entity: res.entity, nextLevel: res.entity.level + 1 });
    this.save(now);
    this.emit('stateChanged');
    return { ok: true };
  }

  public cycleTargetingMode(entityId: string): void {
    const entity = this.getEntityById(entityId);
    if (!entity || entity.category !== 'tower') return;
    const order: TargetingMode[] = ['first', 'strongest', 'closest'];
    entity.targetingMode = order[(order.indexOf(entity.targetingMode) + 1) % order.length] ?? 'first';
    this.save();
    this.emit('stateChanged');
  }

  public demolishEntity(entityId: string): { ok: boolean; refundGold: number; refundAether: number } {
    this.sound.unlock();
    const res = applyDemolishEntity(this.state, entityId);
    if (!res.ok || !res.entity) return { ok: false, refundGold: 0, refundAether: 0 };
    this.combat.clearTowerCooldown(res.entity.id);
    this.vfx.clearTowerVisual(res.entity.id);
    this.checkStorageCaps();
    this.emit('buildingDemolished', { col: res.entity.col, row: res.entity.row, refundGold: res.refundGold, refundAether: res.refundAether });
    this.save();
    this.emit('stateChanged');
    return { ok: true, refundGold: res.refundGold, refundAether: res.refundAether };
  }

  public claimQuest(questId: string): boolean {
    this.sound.unlock();
    const quest = this.state.dailyQuests.find((q) => q.id === questId);
    if (!quest || quest.claimed || quest.progress < quest.target) return false;
    quest.claimed = true;
    grantStateResources(this.state, quest.rewardGold, quest.rewardAether);
    this.checkStorageCaps();
    this.emit('questClaimed', { questId, rewardGold: quest.rewardGold, rewardAether: quest.rewardAether });
    this.save();
    this.emit('stateChanged');
    return true;
  }

  public summonEclipseBoss(): boolean {
    this.sound.unlock();
    const now = Date.now();
    this.combat.spawnEnemy('eclipse_boss');
    this.state.eclipseBossNextTimestamp = now + BALANCE_CONFIG.bossIntervalMs;
    this.emit('bossSummoned', { col: PATH_WAYPOINTS[0].col + 1.5, row: PATH_WAYPOINTS[0].row });
    this.save(now);
    this.emit('stateChanged');
    return true;
  }

  public devSpeedupOneMinute(): number {
    this.sound.unlock();
    const now = Date.now();
    const shiftMs = 60_000;
    for (const entity of this.state.entities) {
      if (entity.upgradeStartTimestamp !== null) entity.upgradeStartTimestamp -= shiftMs;
      if (entity.upgradeFinishTimestamp !== null) entity.upgradeFinishTimestamp -= shiftMs;
    }
    const completedCount = this.processCompletedUpgrades(now);
    const rates = this.getProductionRates();
    const actualGold = grantStateResources(this.state, Math.floor(rates.goldPerSec * 60), Math.floor(rates.aetherPerSec * 60), true);
    this.checkStorageCaps();
    this.state.eclipseBossNextTimestamp = Math.max(now, this.state.eclipseBossNextTimestamp - shiftMs);
    if (completedCount === 0) this.sound.playCoinChink();
    this.vfx.addFloatingText(`+1m Fast-Forward (+${actualGold}g)`, 5.5, 4.5, 1.2, '#fff0b8');
    this.save(now);
    this.emit('stateChanged');
    return completedCount;
  }

  public triggerOfflineDemo(minutes: number): OfflineReport | null {
    this.sound.unlock();
    const now = Date.now();
    const { updatedState, report } = calculateOfflineProgress({ ...this.state, lastActiveTimestamp: now - minutes * 60 * 1000 }, now, 1);
    this.state = updatedState;
    this.pendingOfflineReport = report;
    this.syncDerivedState();
    if (report && report.completedUpgrades.length > 0) this.sound.playUpgradeChime();
    else this.sound.playCoinChink();
    this.save(now);
    this.emit('stateChanged');
    return report;
  }

  public resetSave(): void {
    const now = Date.now();
    this.state = createInitialGameState(now);
    this.pendingOfflineReport = null;
    this.vfx.reset();
    this.combat.reset(1);
    this.syncDerivedState();
    this.save(now);
    this.emit('stateChanged');
  }

  public tick(rawDtSeconds: number): void {
    const clampedDt = Math.min(rawDtSeconds, 0.1);
    const nowMs = Date.now();
    this.vfx.tickAmbient(clampedDt);
    if (this.processCompletedUpgrades(nowMs) > 0) this.emit('stateChanged');
    if (this.paused) return;

    const dt = clampedDt * this.speedMultiplier;
    if (nowMs >= this.state.eclipseBossNextTimestamp) this.summonEclipseBoss();
    const rates = this.getProductionRates();
    grantStateResources(this.state, rates.goldPerSec * dt, rates.aetherPerSec * dt, true);
    this.checkStorageCaps();
    this.combat.tick(dt, nowMs);
    this.vfx.tickSimulationEffects(dt);
    if (nowMs - this.lastSaveTimeMs >= BALANCE_CONFIG.autoSaveIntervalMs) this.save(nowMs);

    this.hudEmitAccumSec += clampedDt;
    if (this.hudEmitAccumSec >= BALANCE_CONFIG.hudSyncIntervalSec) {
      this.hudEmitAccumSec = 0;
      this.emit('stateChanged');
    }
  }

  private processCompletedUpgrades(nowMs: number): number {
    const completed = evaluateCompletedUpgrades(this.state, nowMs);
    for (const item of completed) this.emit('upgradeCompleted', item);
    if (completed.length > 0) {
      this.checkStorageCaps();
      this.save(nowMs);
    }
    return completed.length;
  }

  private handleEnemyDefeated(enemy: EnemyInstance, sourceEntity: PlacedEntity | undefined): void {
    const cfg = ENEMY_CONFIGS[enemy.configId];
    grantStateResources(this.state, cfg.rewardGold, cfg.rewardAether, true);
    this.checkStorageCaps();
    this.state.totalKills += 1;
    if (sourceEntity) sourceEntity.kills += 1;
    incrementDailyQuestProgress(this.state, 'defeat_raiders', 1);
    this.emit('enemyDefeated', {
      col: enemy.col, row: enemy.row, rewardGold: cfg.rewardGold,
      primaryColor: cfg.primaryColor, isBoss: Boolean(cfg.isBoss),
    });
  }

  private handleKeepDamaged(col: number, row: number, damage: number, isBoss: boolean): void {
    this.state.keepHp = Math.max(0, this.state.keepHp - damage);
    const rallied = this.state.keepHp <= 0;
    if (rallied) {
      this.state.keepHp = this.state.keepMaxHp;
      this.state.wave = Math.max(1, this.state.wave - 1);
      this.combat.clearWaveEnemies(BALANCE_CONFIG.rallyInterDelaySec);
      this.save();
    }
    this.emit('keepDamaged', { col, row, damage, isBoss, rallied });
    this.emit('stateChanged');
  }
}
