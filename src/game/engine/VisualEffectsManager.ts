import { BALANCE_CONFIG, TOWER_CONFIGS, getTowerStatsAtLevel, isTowerId } from '../config';
import { CloudInstance, FloatingTextInstance, ParticleInstance, TransientVisualState } from '../../types/game';
import { GameEventEmitter } from './GameEventEmitter';
import { SoundEngine } from './SoundEngine';

export class VisualEffectsManager {
  private particles: ParticleInstance[] = [];
  private floatingTexts: FloatingTextInstance[] = [];
  private clouds: CloudInstance[] = [];
  private visualState: TransientVisualState = {
    towerRecoilMap: {},
    towerAngleMap: {},
    screenShake: 0,
  };
  private idCounter = 1;
  private unsubscribers: (() => void)[] = [];

  constructor(
    emitter: GameEventEmitter,
    private readonly sound: SoundEngine,
  ) {
    this.initClouds();
    this.bindEvents(emitter);
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

  private bindEvents(emitter: GameEventEmitter): void {
    this.unsubscribers.push(
      emitter.on('buildingPlaced', ({ entity, name }) => {
        this.sound.playStoneClack();
        this.spawnDustBurst(entity.col, entity.row, 7, '#d8c8a8');
        this.addFloatingText(`Built ${name}`, entity.col, entity.row, 1.0, '#f4e4c1');
      }),
      emitter.on('upgradeStarted', ({ entity, nextLevel }) => {
        this.sound.playStoneClack();
        this.spawnDustBurst(entity.col, entity.row, 5, '#c7a474');
        this.addFloatingText(`Upgrading Lv.${nextLevel}`, entity.col, entity.row, 1.1, '#fff5d6');
      }),
      emitter.on('upgradeCompleted', ({ entity, name, newLevel }) => {
        this.sound.playUpgradeChime();
        this.spawnUpgradeBurst(entity.col, entity.row);
        this.addFloatingText(`${name} Lv.${newLevel}!`, entity.col, entity.row, 1.2, '#ffe680');
      }),
      emitter.on('buildingDemolished', ({ col, row, refundGold }) => {
        this.sound.playStoneClack();
        this.spawnDustBurst(col, row, 9, '#b8a88e');
        this.addFloatingText(`+${refundGold}g Salvaged`, col, row, 0.8, '#f4e4c1');
      }),
      emitter.on('waveCleared', ({ nextWave }) => {
        this.addFloatingText(`Wave ${nextWave}`, 2, 2, 1.1, '#f4e4c1');
      }),
      emitter.on('storageFull', ({ resource }) => {
        const label = resource === 'gold' ? 'Gold' : 'Aether';
        this.addFloatingText(`${label} Storage Full!`, 5.5, 4.5, 1.2, '#f4c76b');
      }),
      emitter.on('bossSummoned', ({ col, row }) => {
        this.sound.playBossHorn();
        this.visualState.screenShake = Math.max(this.visualState.screenShake, BALANCE_CONFIG.screenShake.bossSummon);
        this.addFloatingText('Eclipse Siege Boss Arrives!', col, row, 1.3, '#ff8e6e');
      }),
      emitter.on('questClaimed', ({ rewardGold, rewardAether }) => {
        this.sound.playCoinChink();
        this.addFloatingText(`Quest Claimed! +${rewardGold}g +${rewardAether}a`, 5.5, 4.5, 1.3, '#ffe89c');
      }),
      emitter.on('towerFired', ({ entity, projectileType }) => {
        if (projectileType === 'arrow') {
          this.sound.playBowTwang();
        } else if (projectileType === 'cannonball') {
          this.sound.playCannonThud();
          this.spawnDustBurst(entity.col, entity.row, 4, '#ded7ca');
        } else if (projectileType === 'frost_nova' && isTowerId(entity.configId)) {
          this.sound.playFrostPulse();
          const stats = getTowerStatsAtLevel(TOWER_CONFIGS[entity.configId], entity.level);
          this.particles.push({
            id: this.nextId('frost_ring'),
            kind: 'frost_ring',
            col: entity.col,
            row: entity.row,
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
        }
      }),
      emitter.on('enemyDamaged', ({ col, row, damage, isSplash }) => {
        if (isSplash) {
          this.visualState.screenShake = Math.max(this.visualState.screenShake, BALANCE_CONFIG.screenShake.splashImpact);
          this.spawnDustBurst(col, row, 10, '#d8c8a8');
        } else {
          this.spawnDustBurst(col, row, 3, '#f2eadb');
        }
        if (damage > 0) this.addFloatingText(`-${damage}`, col, row, 0.75, '#fff6df');
      }),
      emitter.on('enemyDefeated', ({ col, row, rewardGold, primaryColor, isBoss }) => {
        this.spawnDustBurst(col, row, isBoss ? 16 : 6, primaryColor);
        this.addFloatingText(`+${rewardGold}g`, col, row, 1.0, '#f4c76b');
      }),
      emitter.on('keepDamaged', ({ col, row, damage, isBoss, rallied }) => {
        const shake = isBoss ? BALANCE_CONFIG.screenShake.bossImpact : BALANCE_CONFIG.screenShake.normalImpact;
        this.visualState.screenShake = Math.max(this.visualState.screenShake, shake);
        this.spawnDustBurst(col, row, 8, '#c86446');
        this.addFloatingText(`-${damage} Keep HP`, col, row, 1.3, '#e0533c');
        if (rallied) this.addFloatingText('Keep Rallied! Gates Fortified', col - 1, row, 1.7, '#ffe094');
      }),
    );
  }

  public setTowerAim(entityId: string, angle: number): void {
    this.visualState.towerRecoilMap[entityId] = 1;
    this.visualState.towerAngleMap[entityId] = angle;
  }

  public clearTowerVisual(entityId: string): void {
    delete this.visualState.towerRecoilMap[entityId];
    delete this.visualState.towerAngleMap[entityId];
  }

  public addFloatingText(text: string, col: number, row: number, z: number, color: string): void {
    if (this.floatingTexts.length > 42) this.floatingTexts.shift();
    this.floatingTexts.push({ id: this.nextId('ft'), text, col, row, z, color, ageSec: 0, lifetimeSec: 0.95 });
  }

  public spawnDustBurst(col: number, row: number, count: number, color: string): void {
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

  public tickAmbient(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x > 1.18) cloud.x = -0.18;
    }
    if (this.visualState.screenShake > 0) {
      this.visualState.screenShake = Math.max(0, this.visualState.screenShake - dt * BALANCE_CONFIG.screenShake.decayPerSec);
    }
  }

  public tickSimulationEffects(dt: number): void {
    for (const id of Object.keys(this.visualState.towerRecoilMap)) {
      const val = this.visualState.towerRecoilMap[id] ?? 0;
      if (val > 0) this.visualState.towerRecoilMap[id] = Math.max(0, val - dt * BALANCE_CONFIG.towerRecoilDecayPerSec);
    }

    const aliveParticles: ParticleInstance[] = [];
    for (const p of this.particles) {
      p.ageSec += dt;
      if (p.ageSec >= p.lifetimeSec) continue;
      if (p.kind === 'frost_ring' && p.maxRadius !== undefined) {
        p.radius = 0.25 + (p.maxRadius - 0.25) * (p.ageSec / p.lifetimeSec);
      } else {
        p.col += p.vx * dt;
        p.row += p.vy * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        p.vz -= 2.4 * dt;
      }
      aliveParticles.push(p);
    }
    this.particles = aliveParticles;

    const aliveTexts: FloatingTextInstance[] = [];
    for (const ft of this.floatingTexts) {
      ft.ageSec += dt;
      if (ft.ageSec >= ft.lifetimeSec) continue;
      ft.z += dt * 0.75;
      aliveTexts.push(ft);
    }
    this.floatingTexts = aliveTexts;
  }

  public reset(): void {
    this.particles = [];
    this.floatingTexts = [];
    this.visualState = { towerRecoilMap: {}, towerAngleMap: {}, screenShake: 0 };
  }

  public destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  public getParticles(): readonly ParticleInstance[] { return this.particles; }
  public getFloatingTexts(): readonly FloatingTextInstance[] { return this.floatingTexts; }
  public getClouds(): readonly CloudInstance[] { return this.clouds; }
  public getVisualState(): TransientVisualState { return this.visualState; }
}
