import type { EntityKind } from './types.ts';

export const DEFAULT_DB_NAME = 'codeplug-studio';

/** Object store names, one per persistable entity kind. */
export const STORES: Record<EntityKind, string> = {
  project: 'projects',
  channel: 'channels',
  zone: 'zones',
  talkGroup: 'talkGroups',
  digitalContact: 'digitalContacts',
  analogContact: 'analogContacts',
  rxGroupList: 'rxGroupLists',
  scanList: 'scanLists',
  aprsConfiguration: 'aprsConfigurations',
  satellite: 'satellites',
  trackingSettings: 'trackingSettings',
  radioBuild: 'radioBuilds',
  egressPath: 'egressPaths',
};

export const STORE_NAMES = Object.values(STORES);

/**
 * Object stores outside {@link STORES} / project seed — keyed by natural IDs, not UUID rows.
 * Excluded from `loadProjectSeed`, `replaceProject`, and `seedProject`.
 */
export const DIRECTORY_STORES = {
  digitalIdDirectory: 'digitalIdDirectory',
} as const;

export const DIRECTORY_STORE_NAMES = Object.values(DIRECTORY_STORES);
