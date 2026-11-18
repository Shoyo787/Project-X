import {
  BUILDING_CONFIGS,
  CELL_SIZE,
  ENEMY_CONFIGS,
  getBuildableFootprint,
  getFootprintCenter,
  PATH_WAYPOINTS,
  TOWER_CONFIGS,
  createDefaultDailyQuests,
  createInitialGameState,
  getBuildableConfig,
  getTileType,
  isTowerId,
  isValidGridCoord,
} from '../config';
import {
  BuildableId,
  CloudInstance,
  EnemyId,
  EnemyInstance,
  FloatingTextInstance,
  GameState,
  OfflineReport,
  ParticleInstance,
  PlacedEntity,
  ProjectileInstance,
  TargetingMode,
  TransientVisualState,
} from '../../types/game';
import {
  ProductionRates,
  StorageCaps,
  calculateOfflineProgress,
  computeProductionRates,
  computeStorageCaps,
  computeTotalDefenseDps,
} from './OfflineCalculator';
import { SoundEngine } from './SoundEngine';

const STORAGE_KEY = 'bastion_vale_save_v1';

interface WaveSpawnQueue {
  queue: EnemyId[];
  spawnTimerSec: number;
  interWaveDelaySec: number;
}

export class GameEngine {
  public readonly sound = new SoundEngine();

  private state: GameState;
  private pendingOfflineReport: OfflineReport | null = null;
  private enemies: EnemyInstance[] = [];
  private projectiles: ProjectileInstance[] = [];
  private particles: ParticleInstance[] = [];
  private floatingTexts: FloatingTextInstance[] = [];
  private clouds: CloudInstance[] = [];
  private towerCooldowns = new Map<string, number>();
  private visualState: TransientVisualState = {
    towerRecoilMap: {},
    towerAngleMap: {},
    screenShake: 0,
  };

  private waveQueue: WaveSpawnQueue = {
    queue: [],
    spawnTimerSec: 0,
    interWaveDelaySec: 1.5,
  };

  private speedMultiplier: 1 | 2 = 1;
  private paused = false;
  private idCounter = 1;
  private lastSaveTimeMs = 0;

  constructor() {
    const now = Date.now();
    const loaded = this.loadFromStorage();
    if (loaded) {
      const { updatedState, report } = calculateOfflineProgress(loaded, now, 5);
      this.state = updatedState;
      this.pendingOfflineReport = report;
      this.saveToStorage(now);
    } else {
      this.state = createInitialGameState(now);
      this.saveToStorage(now);
    }

    this.initClouds();
    this.enqueueWave(this.state.wave);
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}_${this.idCounter}`;
  }

  private initClouds(): void {
    this.clouds = [
      { x: 0.12, y: 0.14, scale: 1.1, speed: 0.008, opacity: 0.72 },
      { x: 0.48, y: 0.09, scale: 0.85, speed: 0.006, opacity: 0.6 },
      { x: 0.78, y: 0.19, scale: 1.25, speed: 0.01, opacity: 0.65 },
      { x: 0.25, y: 0.78, scale: 0.95, speed: 0.007, opacity: 0.45 },
      { x: 0.86, y: 0.74, scale: 1.05, speed: 0.009, opacity: 0.42 },
    ];
  }

  private loadFromStorage(): GameState | null {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<GameState>;
      if (!parsed || typeof parsed.version !== 'number' || !Array.isArray(parsed.entities)) {
        return null;
      }
      const fallback = createInitialGameState(Date.now());
      const isLegacyLayout = (parsed.version ?? 1) < 2;
      const entities = parsed.entities.map((entity) => {
        if (!isLegacyLayout) return entity;
        const footprint = getBuildableFootprint(entity.configId);
        return {
          ...entity,
          col: entity.col * 2 - (footprint.width % 2),
          row: entity.row * 2 - (footprint.height % 2),
        };
      });

      return {
        ...fallback,
        ...parsed,
        version: 2,
        entities,
        resources: {
          gold: typeof parsed.resources?.gold === 'number' ? parsed.resources.gold : fallback.resources.gold,
          aether:
            typeof parsed.resources?.aether === 'number' ? parsed.resources.aether : fallback.resources.aether,
        },
        dailyQuests:
          Array.isArray(parsed.dailyQuests) && parsed.dailyQuests.length === 3
            ? parsed.dailyQuests
            : createDefaultDailyQuests(),
      };
    } catch {
      return null;
    }
  }

  private saveToStorage(nowMs = Date.now()): void {
    try {
      this.state.lastActiveTimestamp = nowMs;
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.lastSaveTimeMs = nowMs;
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }

  public getState(): GameState {
    return this.state;
  }

  public getPendingOfflineReport(): OfflineReport | null {
    return this.pendingOfflineReport;
  }

  public dismissOfflineReport(): void {
    this.pendingOfflineReport = null;
  }

  public getStorageCaps(): StorageCaps {
    return computeStorageCaps(this.state.entities);
  }

  public getProductionRates(): ProductionRates {
    return computeProductionRates(this.state.entities);
  }

  public getTotalDefenseDps(): number {
    return computeTotalDefenseDps(this.state.entities);
  }

  public getSpeedMultiplier(): 1 | 2 {
    return this.speedMultiplier;
  }

  public setSpeedMultiplier(mult: 1 | 2): void {
    this.speedMultiplier = mult;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public togglePause(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  public getNextBossCountdownMs(nowMs = Date.now()): number {
    return Math.max(0, this.state.eclipseBossNextTimestamp - nowMs);
  }

  public getEnemies(): readonly EnemyInstance[] {
    return this.enemies;
  }

  public getProjectiles(): readonly ProjectileInstance[] {
    return this.projectiles;
  }

  public getParticles(): readonly ParticleInstance[] {
    return this.particles;
  }

  public getFloatingTexts(): readonly FloatingTextInstance[] {
    return this.floatingTexts;
  }

  public getClouds(): readonly CloudInstance[] {
    return this.clouds;
  }

  public getVisualState(): TransientVisualState {
    return this.visualState;
  }

  public getEntityAt(col: number, row: number): PlacedEntity | undefined {
    return this.state.entities.find((entity) => {
      const footprint = getBuildableFootprint(entity.configId);
      return (
        col >= entity.col &&
        col < entity.col + footprint.width &&
        row >= entity.row &&
        row < entity.row + footprint.height
      );
    });
  }

  public getEntityById(id: string): PlacedEntity | undefined {
    return this.state.entities.find((e) => e.id === id);
  }

  public canPlaceAt(col: number, row: number, configId: BuildableId): boolean {
    const footprint = getBuildableFootprint(configId);
    for (let x = 0; x < footprint.width; x += 1) {
      for (let y = 0; y < footprint.height; y += 1) {
        const cellCol = col + x;
        const cellRow = row + y;
        if (
          !isValidGridCoord(cellCol, cellRow) ||
          getTileType(cellCol, cellRow) !== 'grass' ||
          this.getEntityAt(cellCol, cellRow)
        ) {
          return false;
        }
      }
    }
    return true;
  }

  public placeEntity(
    configId: BuildableId,
    col: number,
    row: number,
  ): { ok: boolean; error?: string; entity?: PlacedEntity } {
    this.sound.unlock();
    if (!this.canPlaceAt(col, row, configId)) {
      return { ok: false, error: 'The full footprint must fit on empty ground.' };
    }

    const cfg = getBuildableConfig(configId);
    const level1 = cfg.levels[0];
    if (!level1) {
      return { ok: false, error: 'Missing level 1 configuration.' };
    }

    if (this.state.resources.gold < level1.costGold) {
      return { ok: false, error: `Need ${level1.costGold} Timber/Gold.` };
    }
    if (this.state.resources.aether < level1.costAether) {
      return { ok: false, error: `Need ${level1.costAether} Aether.` };
    }

    this.state.resources.gold -= level1.costGold;
    this.state.resources.aether -= level1.costAether;

    const entity: PlacedEntity = {
      id: this.nextId(configId),
      configId,
      category: cfg.category,
      col,
      row,
      level: 1,
      upgradeStartTimestamp: null,
      upgradeFinishTimestamp: null,
      targetingMode: 'first',
      kills: 0,
      totalDamage: 0,
    };

    this.state.entities.push(entity);
    this.sound.playStoneClack();
    const center = getFootprintCenter(col, row, cfg.footprint);
    this.spawnDustBurst(center.col, center.row, 7, '#d8c8a8');
    this.addFloatingText(`Built ${cfg.name}`, center.col, center.row, 1.0, '#f4e4c1');
    this.saveToStorage();

    return { ok: true, entity };
  }

  public startUpgrade(entityId: string): { ok: boolean; error?: string } {
    this.sound.unlock();
    const entity = this.getEntityById(entityId);
    if (!entity) return { ok: false, error: 'Structure not found.' };
    if (entity.upgradeFinishTimestamp !== null) {
      return { ok: false, error: 'Upgrade already in progress.' };
    }

    const cfg = getBuildableConfig(entity.configId);
    if (entity.level >= cfg.levels.length) {
      return { ok: false, error: 'Already at maximum level.' };
    }

    const nextStats = cfg.levels[entity.level];
    if (!nextStats) return { ok: false, error: 'Next level unavailable.' };

    if (this.state.resources.gold < nextStats.costGold) {
      return { ok: false, error: `Need ${nextStats.costGold} Timber/Gold.` };
    }
    if (this.state.resources.aether < nextStats.costAether) {
      return { ok: false, error: `Need ${nextStats.costAether} Aether.` };
    }

    this.state.resources.gold -= nextStats.costGold;
    this.state.resources.aether -= nextStats.costAether;

    const now = Date.now();
    entity.upgradeStartTimestamp = now;
    entity.upgradeFinishTimestamp = now + nextStats.upgradeTimeSeconds * 1000;

    this.incrementQuestProgress('start_upgrades', 1);
    this.sound.playStoneClack();
    this.spawnDustBurst(entity.col, entity.row, 5, '#c7a474');
    this.addFloatingText(
      `Upgrading Lv.${entity.level + 1}`,
      entity.col,
      entity.row,
      1.1,
      '#fff5d6',
    );
    this.saveToStorage(now);

    return { ok: true };
  }

  public cycleTargetingMode(entityId: string): void {
    const entity = this.getEntityById(entityId);
    if (!entity || entity.category !== 'tower') return;

    const order: TargetingMode[] = ['first', 'strongest', 'closest'];
    const nextIdx = (order.indexOf(entity.targetingMode) + 1) % order.length;
    entity.targetingMode = order[nextIdx] ?? 'first';
    this.saveToStorage();
  }

  public demolishEntity(entityId: string): {
    ok: boolean;
    refundGold: number;
    refundAether: number;
  } {
    this.sound.unlock();
    const idx = this.state.entities.findIndex((e) => e.id === entityId);
    if (idx === -1) return { ok: false, refundGold: 0, refundAether: 0 };

    const entity = this.state.entities[idx];
    const cfg = getBuildableConfig(entity.configId);

    let investedGold = 0;
    let investedAether = 0;
    for (let i = 0; i < entity.level; i++) {
      const lvl = cfg.levels[i];
      if (lvl) {
        investedGold += lvl.costGold;
        investedAether += lvl.costAether;
      }
    }

    const refundGold = Math.round(investedGold * 0.65);
    const refundAether = Math.round(investedAether * 0.65);

    this.state.entities.splice(idx, 1);
    this.towerCooldowns.delete(entity.id);

    const caps = this.getStorageCaps();
    this.state.resources.gold = Math.min(caps.maxGold, this.state.resources.gold + refundGold);
    this.state.resources.aether = Math.min(
      caps.maxAether,
      this.state.resources.aether + refundAether,
    );

    this.sound.playStoneClack();
    this.spawnDustBurst(entity.col, entity.row, 9, '#b8a88e');
    this.addFloatingText(`+${refundGold}g Salvaged`, entity.col, entity.row, 0.8, '#f4e4c1');
    this.saveToStorage();

    return { ok: true, refundGold, refundAether };
  }

  public claimQuest(questId: string): boolean {
    this.sound.unlock();
    const quest = this.state.dailyQuests.find((q) => q.id === questId);
    if (!quest || quest.claimed || quest.progress < quest.target) {
      return false;
    }

    quest.claimed = true;
    const caps = this.getStorageCaps();
    this.state.resources.gold = Math.min(
      caps.maxGold,
      this.state.resources.gold + quest.rewardGold,
    );
    this.state.resources.aether = Math.min(
      caps.maxAether,
      this.state.resources.aether + quest.rewardAether,
    );

    this.sound.playCoinChink();
    this.addFloatingText(
      `Quest Claimed! +${quest.rewardGold}g +${quest.rewardAether}a`,
      5.5,
      4.5,
      1.3,
      '#ffe89c',
    );
    this.saveToStorage();
    return true;
  }

  public summonEclipseBoss(): boolean {
    this.sound.unlock();
    const now = Date.now();
    this.spawnEnemy('eclipse_boss');
    this.state.eclipseBossNextTimestamp = now + 6 * 60 * 60 * 1000;
    this.sound.playBossHorn();
    this.visualState.screenShake = Math.max(this.visualState.screenShake, 7);
    this.addFloatingText('Eclipse Siege Boss Arrives!', 1.5, 2, 1.3, '#ff8e6e');
    this.saveToStorage(now);
    return true;
  }

  public devSpeedupOneMinute(): number {
    this.sound.unlock();
    const now = Date.now();
    const shiftMs = 60_000;

    for (const entity of this.state.entities) {
      if (entity.upgradeStartTimestamp !== null) {
        entity.upgradeStartTimestamp -= shiftMs;
      }
      if (entity.upgradeFinishTimestamp !== null) {
        entity.upgradeFinishTimestamp -= shiftMs;
      }
    }

    const completedCount = this.processCompletedUpgrades(now);

    const caps = this.getStorageCaps();
    const rates = this.getProductionRates();
    const gainedGold = Math.floor(rates.goldPerSec * 60);
    const gainedAether = Math.floor(rates.aetherPerSec * 60);

    const prevGold = this.state.resources.gold;
    const prevAether = this.state.resources.aether;
    this.state.resources.gold = Math.min(caps.maxGold, prevGold + gainedGold);
    this.state.resources.aether = Math.min(caps.maxAether, prevAether + gainedAether);

    const actualGold = Math.max(0, Math.floor(this.state.resources.gold - prevGold));
    if (actualGold > 0) {
      this.incrementQuestProgress('collect_resources', actualGold);
    }

    this.state.eclipseBossNextTimestamp = Math.max(
      now,
      this.state.eclipseBossNextTimestamp - shiftMs,
    );

    if (completedCount === 0) {
      this.sound.playCoinChink();
    }
    this.addFloatingText(
      `+1m Fast-Forward (+${actualGold}g)`,
      5.5,
      4.5,
      1.2,
      '#fff0b8',
    );
    this.saveToStorage(now);
    return completedCount;
  }

  public triggerOfflineDemo(minutes: number): OfflineReport | null {
    this.sound.unlock();
    const now = Date.now();
    const simulatedLastActive = now - minutes * 60 * 1000;
    const simulatedState: GameState = {
      ...this.state,
      lastActiveTimestamp: simulatedLastActive,
    };
    const { updatedState, report } = calculateOfflineProgress(simulatedState, now, 1);
    this.state = updatedState;
    this.pendingOfflineReport = report;
    if (report && report.completedUpgrades.length > 0) {
      this.sound.playUpgradeChime();
    } else {
      this.sound.playCoinChink();
    }
    this.saveToStorage(now);
    return report;
  }

  public resetSave(): void {
    const now = Date.now();
    this.state = createInitialGameState(now);
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.towerCooldowns.clear();
    this.pendingOfflineReport = null;
    this.enqueueWave(1);
    this.saveToStorage(now);
  }

  public tick(rawDtSeconds: number): void {
    const clampedDt = Math.min(rawDtSeconds, 0.1);
    const nowMs = Date.now();

    // Clouds always drift calmly even if simulation is paused
    this.updateClouds(clampedDt);

    // Decay screen shake
    if (this.visualState.screenShake > 0) {
      this.visualState.screenShake = Math.max(0, this.visualState.screenShake - clampedDt * 22);
    }

    // Always evaluate real-time timestamp upgrades so timers remain wall-clock accurate
    this.processCompletedUpgrades(nowMs);

    if (this.paused) return;

    const dt = clampedDt * this.speedMultiplier;

    // Auto-summon Eclipse Siege Boss if countdown hits zero
    if (nowMs >= this.state.eclipseBossNextTimestamp) {
      this.summonEclipseBoss();
    }

    // Passive resource income capped strictly by Storage Limits
    this.updatePassiveIncome(dt);

    // Wave spawning & progression
    this.updateWaveSpawner(dt);

    // Move enemies along carved sandstone path
    this.updateEnemies(dt, nowMs);

    // Fire active towers
    this.updateTowers(dt, nowMs);

    // Advance projectiles and resolve impacts
    this.updateProjectiles(dt, nowMs);

    // Particles & floating texts
    this.updateParticles(dt);
    this.updateFloatingTexts(dt);

    // Periodic auto-save every 1.5s
    if (nowMs - this.lastSaveTimeMs >= 1500) {
      this.saveToStorage(nowMs);
    }
  }

  private processCompletedUpgrades(nowMs: number): number {
    let completed = 0;
    for (const entity of this.state.entities) {
      if (entity.upgradeFinishTimestamp !== null && entity.upgradeFinishTimestamp <= nowMs) {
        const cfg = getBuildableConfig(entity.configId);
        entity.level = Math.min(cfg.levels.length, entity.level + 1);
        entity.upgradeStartTimestamp = null;
        entity.upgradeFinishTimestamp = null;
        completed += 1;

        this.sound.playUpgradeChime();
        this.spawnUpgradeBurst(entity.col, entity.row);
        this.addFloatingText(
          `${cfg.name} Lv.${entity.level}!`,
          entity.col,
          entity.row,
          1.2,
          '#ffe680',
        );
      }
    }
    if (completed > 0) {
      this.saveToStorage(nowMs);
    }
    return completed;
  }

  private updatePassiveIncome(dt: number): void {
    const caps = this.getStorageCaps();
    const rates = this.getProductionRates();

    const prevWholeGold = Math.floor(this.state.resources.gold);
    this.state.resources.gold = Math.min(
      caps.maxGold,
      this.state.resources.gold + rates.goldPerSec * dt,
    );
    this.state.resources.aether = Math.min(
      caps.maxAether,
      this.state.resources.aether + rates.aetherPerSec * dt,
    );

    const newWholeGold = Math.floor(this.state.resources.gold);
    if (newWholeGold > prevWholeGold) {
      this.incrementQuestProgress('collect_resources', newWholeGold - prevWholeGold);
    }
  }

  private enqueueWave(wave: number): void {
    const queue: EnemyId[] = [];
    const totalCount = 5 + Math.floor(wave * 2.2);

    for (let i = 0; i < totalCount; i++) {
      if (wave >= 4 && i % 6 === 5) {
        queue.push('iron_golem');
      } else if (wave >= 3 && i % 4 === 3) {
        queue.push('aether_wisp');
      } else if (wave >= 2 && i % 3 === 2) {
        queue.push('shield_brigand');
      } else {
        queue.push('goblin_raider');
      }
    }

    if (wave % 5 === 0) {
      queue.push('eclipse_boss');
    }

    this.waveQueue = {
      queue,
      spawnTimerSec: 0.4,
      interWaveDelaySec: 0,
    };
  }

  private updateWaveSpawner(dt: number): void {
    if (this.waveQueue.queue.length > 0) {
      this.waveQueue.spawnTimerSec -= dt;
      if (this.waveQueue.spawnTimerSec <= 0) {
        const nextEnemyId = this.waveQueue.queue.shift();
        if (nextEnemyId) {
          this.spawnEnemy(nextEnemyId);
          const interval = Math.max(0.45, 1.05 - this.state.wave * 0.03);
          this.waveQueue.spawnTimerSec = interval;
        }
      }
      return;
    }

    if (this.enemies.length === 0) {
      if (this.waveQueue.interWaveDelaySec <= 0) {
        this.waveQueue.interWaveDelaySec = 2.6;
      } else {
        this.waveQueue.interWaveDelaySec -= dt;
        if (this.waveQueue.interWaveDelaySec <= 0) {
          this.state.wave += 1;
          this.addFloatingText(`Wave ${this.state.wave}`, 2, 2, 1.1, '#f4e4c1');
          this.enqueueWave(this.state.wave);
          this.saveToStorage();
        }
      }
    }
  }

  private spawnEnemy(configId: EnemyId): void {
    const cfg = ENEMY_CONFIGS[configId];
    const start = PATH_WAYPOINTS[0];
    const waveScale = 1 + (this.state.wave - 1) * 0.22;
    const maxHp = Math.round(cfg.baseHp * waveScale);

    this.enemies.push({
      id: this.nextId(configId),
      configId,
      hp: maxHp,
      maxHp,
      waypointIndex: 0,
      progressOnSegment: 0,
      col: start.col,
      row: start.row,
      totalDistanceTraveled: 0,
      slowUntilMs: 0,
      slowFactor: 0,
      hitFlashUntilMs: 0,
    });
  }

  private updateEnemies(dt: number, nowMs: number): void {
    const survivors: EnemyInstance[] = [];

    for (const enemy of this.enemies) {
      const cfg = ENEMY_CONFIGS[enemy.configId];
      const slowMultiplier = enemy.slowUntilMs > nowMs ? 1 - enemy.slowFactor : 1;
      const stepDist = (cfg.speedTilesPerSec * slowMultiplier * dt) / CELL_SIZE;

      enemy.progressOnSegment += stepDist;
      enemy.totalDistanceTraveled += stepDist;

      while (
        enemy.progressOnSegment >= 1 &&
        enemy.waypointIndex < PATH_WAYPOINTS.length - 2
      ) {
        enemy.progressOnSegment -= 1;
        enemy.waypointIndex += 1;
      }

      const currentWp = PATH_WAYPOINTS[enemy.waypointIndex];
      const nextWp = PATH_WAYPOINTS[enemy.waypointIndex + 1];

      if (!currentWp || !nextWp) {
        this.handleEnemyReachedKeep(enemy);
        continue;
      }

      if (
        enemy.waypointIndex >= PATH_WAYPOINTS.length - 2 &&
        enemy.progressOnSegment >= 1
      ) {
        this.handleEnemyReachedKeep(enemy);
        continue;
      }

      enemy.col = currentWp.col + (nextWp.col - currentWp.col) * enemy.progressOnSegment;
      enemy.row = currentWp.row + (nextWp.row - currentWp.row) * enemy.progressOnSegment;
      survivors.push(enemy);
    }

    this.enemies = survivors;
  }

  private handleEnemyReachedKeep(enemy: EnemyInstance): void {
    const cfg = ENEMY_CONFIGS[enemy.configId];
    const keepDamage = cfg.isBoss ? 5 : 1;
    this.state.keepHp = Math.max(0, this.state.keepHp - keepDamage);
    this.visualState.screenShake = Math.max(this.visualState.screenShake, cfg.isBoss ? 8 : 4);

    const keepPt = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    this.spawnDustBurst(keepPt.col, keepPt.row, 8, '#c86446');
    this.addFloatingText(`-${keepDamage} Keep HP`, keepPt.col, keepPt.row, 1.3, '#e0533c');

    if (this.state.keepHp <= 0) {
      // Bastion rallies so the player's kingdom persists smoothly
      this.state.keepHp = this.state.keepMaxHp;
      this.state.wave = Math.max(1, this.state.wave - 1);
      this.enemies = [];
      this.waveQueue.queue = [];
      this.waveQueue.interWaveDelaySec = 3.0;
      this.addFloatingText('Keep Rallied! Gates Fortified', keepPt.col - 1, keepPt.row, 1.7, '#ffe094');
      this.saveToStorage();
    }
  }

  private updateTowers(dt: number, nowMs: number): void {
    for (const entity of this.state.entities) {
      if (entity.category !== 'tower' || !isTowerId(entity.configId)) continue;

      // Decay recoil smoothly
      const currentRecoil = this.visualState.towerRecoilMap[entity.id] ?? 0;
      if (currentRecoil > 0) {
        this.visualState.towerRecoilMap[entity.id] = Math.max(0, currentRecoil - dt * 4.5);
      }

      if (entity.upgradeFinishTimestamp !== null) continue;

      const cfg = TOWER_CONFIGS[entity.configId];
      const stats = cfg.levels[Math.min(entity.level - 1, cfg.levels.length - 1)];
      if (!stats) continue;

      const prevCooldown = this.towerCooldowns.get(entity.id) ?? 0;
      const nextCooldown = Math.max(0, prevCooldown - dt);
      this.towerCooldowns.set(entity.id, nextCooldown);

      if (nextCooldown > 0) continue;

      const target = this.selectTarget(entity, stats.range / CELL_SIZE);
      if (!target) continue;

      this.towerCooldowns.set(entity.id, 1 / stats.fireRate);
      this.visualState.towerRecoilMap[entity.id] = 1;
      const center = getFootprintCenter(entity.col, entity.row, cfg.footprint);
      this.visualState.towerAngleMap[entity.id] = Math.atan2(
        target.row - center.row,
        target.col - center.col,
      );

      if (cfg.projectileType === 'frost_nova') {
        this.fireFrostNova(entity, stats, nowMs);
      } else {
        this.fireProjectile(entity, cfg.projectileType, stats, target);
      }
    }
  }

  private selectTarget(entity: PlacedEntity, range: number): EnemyInstance | null {
    const inRange: { enemy: EnemyInstance; dist: number }[] = [];
    const cfg = getBuildableConfig(entity.configId);
    const center = getFootprintCenter(entity.col, entity.row, cfg.footprint);
    for (const enemy of this.enemies) {
      const dx = enemy.col - center.col;
      const dy = enemy.row - center.row;
      const dist = Math.hypot(dx, dy);
      if (dist <= range) {
        inRange.push({ enemy, dist });
      }
    }

    if (inRange.length === 0) return null;

    inRange.sort((a, b) => {
      if (entity.targetingMode === 'strongest') {
        return b.enemy.hp - a.enemy.hp;
      }
      if (entity.targetingMode === 'closest') {
        return a.dist - b.dist;
      }
      return b.enemy.totalDistanceTraveled - a.enemy.totalDistanceTraveled;
    });

    return inRange[0]?.enemy ?? null;
  }

  private fireFrostNova(
    entity: PlacedEntity,
    stats: {
      damage: number;
      range: number;
      slowFactor?: number;
      slowDurationMs?: number;
    },
    nowMs: number,
  ): void {
    this.sound.playFrostPulse();
    const center = getFootprintCenter(
      entity.col,
      entity.row,
      TOWER_CONFIGS.frost_obelisk.footprint,
    );
    this.particles.push({
      id: this.nextId('frost_ring'),
      kind: 'frost_ring',
      col: center.col,
      row: center.row,
      z: 0.08,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 0.25,
      maxRadius: stats.range,
      color: '#7ed3e6',
      ageSec: 0,
      lifetimeSec: 0.42,
    });

    const slowFactor = stats.slowFactor ?? 0.4;
    const slowDurationMs = stats.slowDurationMs ?? 2400;

    for (const enemy of [...this.enemies]) {
      const dist = Math.hypot(enemy.col - center.col, enemy.row - center.row);
      if (dist <= stats.range / CELL_SIZE) {
        enemy.slowFactor = Math.max(enemy.slowFactor, slowFactor);
        enemy.slowUntilMs = Math.max(enemy.slowUntilMs, nowMs + slowDurationMs);
        this.applyDamageToEnemy(enemy, stats.damage, entity, nowMs);
      }
    }
  }

  private fireProjectile(
    entity: PlacedEntity,
    type: 'arrow' | 'cannonball',
    stats: {
      damage: number;
      splashRadius?: number;
    },
    target: EnemyInstance,
  ): void {
    const center = getFootprintCenter(
      entity.col,
      entity.row,
      getBuildableConfig(entity.configId).footprint,
    );
    if (type === 'arrow') {
      this.sound.playBowTwang();
    } else {
      this.sound.playCannonThud();
      this.spawnDustBurst(center.col, center.row, 4, '#ded7ca');
    }

    this.projectiles.push({
      id: this.nextId(type),
      sourceEntityId: entity.id,
      type,
      startCol: center.col,
      startRow: center.row,
      targetCol: target.col,
      targetRow: target.row,
      targetEnemyId: target.id,
      progress: 0,
      durationSec: type === 'arrow' ? 0.28 : 0.46,
      arcHeight: type === 'arrow' ? 0.95 : 1.55,
      damage: stats.damage,
      splashRadius: (stats.splashRadius ?? 0) / CELL_SIZE,
      slowFactor: 0,
      slowDurationMs: 0,
    });
  }

  private updateProjectiles(dt: number, nowMs: number): void {
    const active: ProjectileInstance[] = [];

    for (const proj of this.projectiles) {
      if (proj.targetEnemyId) {
        const tracked = this.enemies.find((e) => e.id === proj.targetEnemyId);
        if (tracked) {
          proj.targetCol = tracked.col;
          proj.targetRow = tracked.row;
        }
      }

      proj.progress += dt / proj.durationSec;
      if (proj.progress >= 1) {
        this.resolveProjectileImpact(proj, nowMs);
      } else {
        active.push(proj);
      }
    }

    this.projectiles = active;
  }

  private resolveProjectileImpact(proj: ProjectileInstance, nowMs: number): void {
    const sourceEntity = this.getEntityById(proj.sourceEntityId);

    if (proj.splashRadius > 0) {
      this.visualState.screenShake = Math.max(this.visualState.screenShake, 4.2);
      this.spawnDustBurst(proj.targetCol, proj.targetRow, 10, '#d8c8a8');

      for (const enemy of [...this.enemies]) {
        const dist = Math.hypot(enemy.col - proj.targetCol, enemy.row - proj.targetRow);
        if (dist <= proj.splashRadius) {
          const falloff = dist < 0.45 / CELL_SIZE ? 1 : 0.78;
          this.applyDamageToEnemy(
            enemy,
            Math.round(proj.damage * falloff),
            sourceEntity,
            nowMs,
          );
        }
      }
    } else {
      const target = proj.targetEnemyId
        ? this.enemies.find((e) => e.id === proj.targetEnemyId)
        : undefined;
      if (target) {
        this.spawnDustBurst(target.col, target.row, 3, '#f2eadb');
        this.applyDamageToEnemy(target, proj.damage, sourceEntity, nowMs);
      }
    }
  }

  private applyDamageToEnemy(
    enemy: EnemyInstance,
    damage: number,
    sourceEntity: PlacedEntity | undefined,
    nowMs: number,
  ): void {
    if (enemy.hp <= 0) return;

    enemy.hp -= damage;
    enemy.hitFlashUntilMs = nowMs + 110;

    if (sourceEntity) {
      sourceEntity.totalDamage += damage;
    }

    this.addFloatingText(`-${damage}`, enemy.col, enemy.row, 0.75, '#fff6df');

    if (enemy.hp <= 0) {
      this.enemies = this.enemies.filter((e) => e.id !== enemy.id);
      const cfg = ENEMY_CONFIGS[enemy.configId];
      const caps = this.getStorageCaps();

      const prevGold = this.state.resources.gold;
      this.state.resources.gold = Math.min(caps.maxGold, prevGold + cfg.rewardGold);
      this.state.resources.aether = Math.min(
        caps.maxAether,
        this.state.resources.aether + cfg.rewardAether,
      );

      const goldAdded = Math.max(0, Math.floor(this.state.resources.gold - prevGold));
      if (goldAdded > 0) {
        this.incrementQuestProgress('collect_resources', goldAdded);
      }

      this.state.totalKills += 1;
      if (sourceEntity) {
        sourceEntity.kills += 1;
      }

      this.incrementQuestProgress('defeat_raiders', 1);
      this.spawnDustBurst(enemy.col, enemy.row, cfg.isBoss ? 16 : 6, cfg.primaryColor);
      this.addFloatingText(
        `+${cfg.rewardGold}g`,
        enemy.col,
        enemy.row,
        1.0,
        '#f4c76b',
      );
    }
  }

  private incrementQuestProgress(
    type: 'defeat_raiders' | 'start_upgrades' | 'collect_resources',
    amount: number,
  ): void {
    for (const quest of this.state.dailyQuests) {
      if (quest.type === type && !quest.claimed && quest.progress < quest.target) {
        quest.progress = Math.min(quest.target, quest.progress + amount);
      }
    }
  }

  private spawnDustBurst(col: number, row: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 0.5 + Math.random() * 1.1;
      this.particles.push({
        id: this.nextId('dust'),
        kind: 'dust',
        col,
        row,
        z: 0.15 + Math.random() * 0.15,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 0.6 + Math.random() * 0.9,
        radius: 3 + Math.random() * 4,
        color,
        ageSec: 0,
        lifetimeSec: 0.38 + Math.random() * 0.24,
      });
    }
  }

  private spawnUpgradeBurst(col: number, row: number): void {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      this.particles.push({
        id: this.nextId('spark'),
        kind: 'upgrade_burst',
        col,
        row,
        z: 0.4,
        vx: Math.cos(angle) * 1.1,
        vy: Math.sin(angle) * 1.1,
        vz: 1.3 + Math.random() * 0.8,
        radius: 3.5,
        color: i % 2 === 0 ? '#f4c76b' : '#ffffff',
        ageSec: 0,
        lifetimeSec: 0.65,
      });
    }
  }

  private addFloatingText(
    text: string,
    col: number,
    row: number,
    z: number,
    color: string,
  ): void {
    if (this.floatingTexts.length > 42) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({
      id: this.nextId('ft'),
      text,
      col,
      row,
      z,
      color,
      ageSec: 0,
      lifetimeSec: 0.95,
    });
  }

  private updateParticles(dt: number): void {
    const alive: ParticleInstance[] = [];
    for (const p of this.particles) {
      p.ageSec += dt;
      if (p.ageSec >= p.lifetimeSec) continue;

      if (p.kind === 'frost_ring' && p.maxRadius !== undefined) {
        const t = p.ageSec / p.lifetimeSec;
        p.radius = 0.25 + (p.maxRadius - 0.25) * t;
      } else {
        p.col += p.vx * dt;
        p.row += p.vy * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        p.vz -= 2.4 * dt;
      }
      alive.push(p);
    }
    this.particles = alive;
  }

  private updateFloatingTexts(dt: number): void {
    const alive: FloatingTextInstance[] = [];
    for (const ft of this.floatingTexts) {
      ft.ageSec += dt;
      if (ft.ageSec >= ft.lifetimeSec) continue;
      ft.z += dt * 0.75;
      alive.push(ft);
    }
    this.floatingTexts = alive;
  }

  private updateClouds(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x > 1.18) {
        cloud.x = -0.18;
      }
    }
  }
}

export function getEntityConfigSummary(entity: PlacedEntity): {
  name: string;
  subtitle: string;
  maxLevel: number;
} {
  if (isTowerId(entity.configId)) {
    const cfg = TOWER_CONFIGS[entity.configId];
    return { name: cfg.name, subtitle: cfg.subtitle, maxLevel: cfg.levels.length };
  }
  const cfg = BUILDING_CONFIGS[entity.configId];
  return { name: cfg.name, subtitle: cfg.subtitle, maxLevel: cfg.levels.length };
}
