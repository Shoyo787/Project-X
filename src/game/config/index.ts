import { BUILDING_CONFIGS } from './buildings';
import { TOWER_CONFIGS } from './towers';
import {
  BuildableId,
  BuildingConfig,
  BuildingId,
  TowerConfig,
  TowerId,
} from '../../types/game';

export * from './mapConfig';
export { TOWER_CONFIGS, TOWER_LIST } from './towers';
export { BUILDING_CONFIGS, BUILDING_LIST } from './buildings';
export { ENEMY_CONFIGS } from './enemies';

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
