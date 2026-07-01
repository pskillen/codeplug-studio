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
  formatBuild: 'formatBuilds',
};

export const STORE_NAMES = Object.values(STORES);
