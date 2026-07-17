import type { EntityListEntity } from './types.ts';

const APP_PREFIX = 'mm9pdy-codeplug-studio.list.';

export function channelListPrefsKey(projectId: string): string {
  return `${APP_PREFIX}channels.${projectId}`;
}

export function entityListPrefsKey(entity: EntityListEntity, projectId: string): string {
  return `${APP_PREFIX}${entity}.${projectId}`;
}

export function entityListColumnsKey(entity: EntityListEntity, projectId: string): string {
  return `${APP_PREFIX}${entity}.${projectId}.columns`;
}

export function channelListColumnsKey(projectId: string): string {
  return `${APP_PREFIX}channels.${projectId}.columns`;
}

export function channelListColumnsSchemaKey(projectId: string): string {
  return `${APP_PREFIX}channels.${projectId}.columns-schema`;
}

export const LIST_PREFS_STORAGE_PREFIX = APP_PREFIX;
