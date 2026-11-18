import { BUILDING_CONFIGS, BUILDING_LIST } from './buildings';
import { TOWER_CONFIGS, TOWER_LIST } from './towers';
import {
  BuildableId,
  BuildingConfig,
  BuildingId,
  TowerConfig,
  TowerId,
} from '../../types/game';

export * from './balancing';
export * from './mapConfig';
export { TOWER_CONFIGS, TOWER_LIST } from './towers';
export { BUILDING_CONFIGS, BUILDING_LIST } from './buildings';
export { ENEMY_CONFIGS, ENEMY_LIST } from './enemies';

export const ALL_BUILDABLES: (TowerConfig | BuildingConfig)[] = [
  ...TOWER_LIST,
  ...BUILDING_LIST,
];

export function isTowerId(id: BuildableId): id is TowerId {
  return id in TOWER_CONFIGS;
}

export function isBuildingId(id: BuildableId): id is BuildingId {
  return id in BUILDING_CONFIGS;
}

export function getBuildableConfig(id: BuildableId): TowerConfig | BuildingConfig {
  if (isTowerId(id)) {
    return TOWER_CONFIGS[id];
  }
  return BUILDING_CONFIGS[id];
}
