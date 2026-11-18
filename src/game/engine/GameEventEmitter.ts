import { PlacedEntity, ResourceType } from '../../types/game';

export interface GameEventMap {
  stateChanged: undefined;
  buildingPlaced: { entity: PlacedEntity; name: string };
  upgradeStarted: { entity: PlacedEntity; nextLevel: number };
  upgradeCompleted: { entity: PlacedEntity; name: string; newLevel: number };
  buildingDemolished: {
    col: number;
    row: number;
    refundGold: number;
    refundAether: number;
  };
  waveCleared: { clearedWave: number; nextWave: number };
  storageFull: { resource: ResourceType; cap: number };
  bossSummoned: { col: number; row: number };
  questClaimed: { questId: string; rewardGold: number; rewardAether: number };
  towerFired: {
    entity: PlacedEntity;
    projectileType: 'arrow' | 'frost_nova' | 'cannonball';
  };
  enemyDamaged: {
    col: number;
    row: number;
    damage: number;
    isSplash: boolean;
  };
  enemyDefeated: {
    col: number;
    row: number;
    rewardGold: number;
    primaryColor: string;
    isBoss: boolean;
  };
  keepDamaged: {
    col: number;
    row: number;
    damage: number;
    isBoss: boolean;
    rallied: boolean;
  };
}

export type GameEventListener<K extends keyof GameEventMap> = (
  payload: GameEventMap[K],
) => void;

export class GameEventEmitter {
  private listeners = new Map<
    keyof GameEventMap,
    Set<(payload: never) => void>
  >();

  public on<K extends keyof GameEventMap>(
    event: K,
    listener: GameEventListener<K>,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = listener as (payload: never) => void;
    set.add(wrapped);
    return () => this.off(event, listener);
  }

  public off<K extends keyof GameEventMap>(
    event: K,
    listener: GameEventListener<K>,
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as (payload: never) => void);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  protected emit<K extends keyof GameEventMap>(
    event: K,
    ...args: GameEventMap[K] extends undefined ? [] : [payload: GameEventMap[K]]
  ): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    const payload = args[0] as never;
    for (const listener of [...set]) {
      listener(payload);
    }
  }

  public removeAllListeners(): void {
    this.listeners.clear();
  }
}
