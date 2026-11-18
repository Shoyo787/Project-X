import {
  BALANCE_CONFIG,
  ENEMY_CONFIGS,
  ENEMY_LIST,
  PATH_WAYPOINTS,
  TOWER_CONFIGS,
  buildWaveEnemyQueue,
  getEnemyMaxHpAtWave,
  getTowerStatsAtLevel,
  getWaveSpawnInterval,
  isTowerId,
} from '../config';
import { EnemyId, EnemyInstance, GameState, PlacedEntity, ProjectileInstance, TowerLevelStats } from '../../types/game';

export interface CombatHooks {
  getState: () => GameState;
  nextId: (prefix: string) => string;
  getEntityById: (id: string) => PlacedEntity | undefined;
  setTowerAim: (entityId: string, angle: number) => void;
  onTowerFired: (entity: PlacedEntity, projectileType: 'arrow' | 'frost_nova' | 'cannonball') => void;
  onEnemyDamaged: (col: number, row: number, damage: number, isSplash: boolean) => void;
  onEnemyDefeated: (enemy: EnemyInstance, sourceEntity: PlacedEntity | undefined) => void;
  onKeepDamaged: (col: number, row: number, damage: number, isBoss: boolean) => void;
  onWaveCleared: (clearedWave: number, nextWave: number) => void;
}

export class CombatSimulator {
  private enemies: EnemyInstance[] = [];
  private projectiles: ProjectileInstance[] = [];
  private towerCooldowns = new Map<string, number>();
  private queue: EnemyId[] = [];
  private totalInWave = 0;
  private spawnTimerSec = 0;
  private interWaveDelaySec = 0;

  constructor(private readonly hooks: CombatHooks) {}

  public enqueueWave(wave: number): void {
    this.queue = buildWaveEnemyQueue(wave, ENEMY_LIST);
    this.totalInWave = this.queue.length;
    this.spawnTimerSec = BALANCE_CONFIG.waveInitialDelaySec;
    this.interWaveDelaySec = 0;
    this.syncWaveProgress();
  }

  public spawnEnemy(configId: EnemyId): void {
    const cfg = ENEMY_CONFIGS[configId];
    const start = PATH_WAYPOINTS[0];
    const maxHp = getEnemyMaxHpAtWave(cfg, this.hooks.getState().wave);
    this.enemies.push({
      id: this.hooks.nextId(configId),
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
    this.syncWaveProgress();
  }

  public tick(dt: number, nowMs: number): void {
    this.updateWaveSpawner(dt);
    this.updateEnemies(dt, nowMs);
    this.updateTowers(dt, nowMs);
    this.updateProjectiles(dt, nowMs);
    this.syncWaveProgress();
  }

  public clearTowerCooldown(entityId: string): void {
    this.towerCooldowns.delete(entityId);
  }

  public clearWaveEnemies(interWaveDelaySec: number): void {
    this.enemies = [];
    this.queue = [];
    this.interWaveDelaySec = interWaveDelaySec;
    this.syncWaveProgress();
  }

  public reset(wave: number): void {
    this.enemies = [];
    this.projectiles = [];
    this.towerCooldowns.clear();
    this.enqueueWave(wave);
  }

  public getEnemies(): readonly EnemyInstance[] { return this.enemies; }
  public getProjectiles(): readonly ProjectileInstance[] { return this.projectiles; }

  private syncWaveProgress(): void {
    this.hooks.getState().waveProgress = {
      enemiesRemainingInQueue: this.queue.length,
      activeEnemies: this.enemies.length,
      totalEnemiesInWave: this.totalInWave,
      interWaveDelaySec: this.interWaveDelaySec,
    };
  }

  private updateWaveSpawner(dt: number): void {
    const state = this.hooks.getState();
    if (this.queue.length > 0) {
      this.spawnTimerSec -= dt;
      if (this.spawnTimerSec <= 0) {
        const nextEnemyId = this.queue.shift();
        if (nextEnemyId) {
          this.spawnEnemy(nextEnemyId);
          this.spawnTimerSec = getWaveSpawnInterval(state.wave);
        }
      }
      return;
    }

    if (this.enemies.length === 0) {
      if (this.interWaveDelaySec <= 0) {
        this.interWaveDelaySec = BALANCE_CONFIG.waveInterDelaySec;
      } else {
        this.interWaveDelaySec -= dt;
        if (this.interWaveDelaySec <= 0) {
          const clearedWave = state.wave;
          state.wave += 1;
          this.enqueueWave(state.wave);
          this.hooks.onWaveCleared(clearedWave, state.wave);
        }
      }
    }
  }

  private updateEnemies(dt: number, nowMs: number): void {
    const survivors: EnemyInstance[] = [];
    for (const enemy of this.enemies) {
      const cfg = ENEMY_CONFIGS[enemy.configId];
      const slowMultiplier = enemy.slowUntilMs > nowMs ? 1 - enemy.slowFactor : 1;
      const stepDist = cfg.speedTilesPerSec * slowMultiplier * dt;
      enemy.progressOnSegment += stepDist;
      enemy.totalDistanceTraveled += stepDist;

      while (enemy.progressOnSegment >= 1 && enemy.waypointIndex < PATH_WAYPOINTS.length - 2) {
        enemy.progressOnSegment -= 1;
        enemy.waypointIndex += 1;
      }

      const currentWp = PATH_WAYPOINTS[enemy.waypointIndex];
      const nextWp = PATH_WAYPOINTS[enemy.waypointIndex + 1];
      if (!currentWp || !nextWp || (enemy.waypointIndex >= PATH_WAYPOINTS.length - 2 && enemy.progressOnSegment >= 1)) {
        const keepPt = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
        const dmg = cfg.isBoss ? BALANCE_CONFIG.keepDamageBoss : BALANCE_CONFIG.keepDamageNormal;
        this.hooks.onKeepDamaged(keepPt.col, keepPt.row, dmg, Boolean(cfg.isBoss));
        continue;
      }

      enemy.col = currentWp.col + (nextWp.col - currentWp.col) * enemy.progressOnSegment;
      enemy.row = currentWp.row + (nextWp.row - currentWp.row) * enemy.progressOnSegment;
      survivors.push(enemy);
    }
    this.enemies = survivors;
  }

  private updateTowers(dt: number, nowMs: number): void {
    for (const entity of this.hooks.getState().entities) {
      if (entity.category !== 'tower' || !isTowerId(entity.configId) || entity.upgradeFinishTimestamp !== null) continue;

      const cfg = TOWER_CONFIGS[entity.configId];
      const stats = getTowerStatsAtLevel(cfg, entity.level);
      const nextCooldown = Math.max(0, (this.towerCooldowns.get(entity.id) ?? 0) - dt);
      this.towerCooldowns.set(entity.id, nextCooldown);
      if (nextCooldown > 0) continue;

      const target = this.selectTarget(entity, stats.range);
      if (!target) continue;

      this.towerCooldowns.set(entity.id, 1 / stats.fireRate);
      this.hooks.setTowerAim(entity.id, Math.atan2(target.row - entity.row, target.col - entity.col));
      this.hooks.onTowerFired(entity, cfg.projectileType);

      if (cfg.projectileType === 'frost_nova') {
        this.fireFrostNova(entity, stats, nowMs);
      } else {
        this.fireProjectile(entity, cfg.projectileType, stats, target);
      }
    }
  }

  private selectTarget(entity: PlacedEntity, range: number): EnemyInstance | null {
    const inRange: { enemy: EnemyInstance; dist: number }[] = [];
    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.col - entity.col, enemy.row - entity.row);
      if (dist <= range) inRange.push({ enemy, dist });
    }
    if (inRange.length === 0) return null;

    inRange.sort((a, b) => {
      if (entity.targetingMode === 'strongest') return b.enemy.hp - a.enemy.hp;
      if (entity.targetingMode === 'closest') return a.dist - b.dist;
      return b.enemy.totalDistanceTraveled - a.enemy.totalDistanceTraveled;
    });
    return inRange[0]?.enemy ?? null;
  }

  private fireFrostNova(entity: PlacedEntity, stats: TowerLevelStats, nowMs: number): void {
    const slowFactor = stats.slowFactor ?? BALANCE_CONFIG.defaultSlowFactor;
    const slowDurationMs = stats.slowDurationMs ?? BALANCE_CONFIG.defaultSlowDurationMs;
    for (const enemy of [...this.enemies]) {
      if (Math.hypot(enemy.col - entity.col, enemy.row - entity.row) <= stats.range) {
        enemy.slowFactor = Math.max(enemy.slowFactor, slowFactor);
        enemy.slowUntilMs = Math.max(enemy.slowUntilMs, nowMs + slowDurationMs);
        this.applyDamageToEnemy(enemy, stats.damage, entity, nowMs);
      }
    }
  }

  private fireProjectile(entity: PlacedEntity, type: 'arrow' | 'cannonball', stats: TowerLevelStats, target: EnemyInstance): void {
    const flight = BALANCE_CONFIG.projectile[type];
    this.projectiles.push({
      id: this.hooks.nextId(type),
      sourceEntityId: entity.id,
      type,
      startCol: entity.col,
      startRow: entity.row,
      targetCol: target.col,
      targetRow: target.row,
      targetEnemyId: target.id,
      progress: 0,
      durationSec: flight.durationSec,
      arcHeight: flight.arcHeight,
      damage: stats.damage,
      splashRadius: stats.splashRadius ?? 0,
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
      if (proj.progress >= 1) this.resolveProjectileImpact(proj, nowMs);
      else active.push(proj);
    }
    this.projectiles = active;
  }

  private resolveProjectileImpact(proj: ProjectileInstance, nowMs: number): void {
    const sourceEntity = this.hooks.getEntityById(proj.sourceEntityId);
    if (proj.splashRadius > 0) {
      this.hooks.onEnemyDamaged(proj.targetCol, proj.targetRow, 0, true);
      for (const enemy of [...this.enemies]) {
        const dist = Math.hypot(enemy.col - proj.targetCol, enemy.row - proj.targetRow);
        if (dist <= proj.splashRadius) {
          const mult = dist < BALANCE_CONFIG.splashDirectRadius ? 1 : BALANCE_CONFIG.splashEdgeMultiplier;
          this.applyDamageToEnemy(enemy, Math.round(proj.damage * mult), sourceEntity, nowMs);
        }
      }
      return;
    }

    const target = proj.targetEnemyId ? this.enemies.find((e) => e.id === proj.targetEnemyId) : undefined;
    if (target) this.applyDamageToEnemy(target, proj.damage, sourceEntity, nowMs);
  }

  private applyDamageToEnemy(enemy: EnemyInstance, damage: number, sourceEntity: PlacedEntity | undefined, nowMs: number): void {
    if (enemy.hp <= 0) return;
    enemy.hp -= damage;
    enemy.hitFlashUntilMs = nowMs + BALANCE_CONFIG.hitFlashDurationMs;
    if (sourceEntity) sourceEntity.totalDamage += damage;
    this.hooks.onEnemyDamaged(enemy.col, enemy.row, damage, false);

    if (enemy.hp <= 0) {
      this.enemies = this.enemies.filter((e) => e.id !== enemy.id);
      this.hooks.onEnemyDefeated(enemy, sourceEntity);
    }
  }
}
