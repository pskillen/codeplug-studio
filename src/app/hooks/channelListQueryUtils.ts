import { DISTANCE_FILTER_MARKS_KM } from '../lib/channels.ts';
import { loadChannelVisibleColumns as loadChannelVisibleColumnsFromStorage } from '@integrations/listPrefs/index.ts';

export {
  channelListColumnsKey,
  channelListColumnsSchemaKey,
} from '@integrations/listPrefs/index.ts';
export type { ChannelSortMode } from '@integrations/listPrefs/index.ts';

export const CHANNEL_LIST_COLUMNS_SCHEMA_VERSION = 1;

export const CHANNEL_OPTIONAL_COLUMNS = [
  { key: 'abbreviation', header: 'Abbrev', defaultVisible: true },
  { key: 'band', header: 'Band', defaultVisible: true },
  { key: 'mode', header: 'Mode', defaultVisible: true },
  { key: 'rxTx', header: 'RX/TX', defaultVisible: true },
  { key: 'contact', header: 'Contact', defaultVisible: true },
  { key: 'rgl', header: 'RX group list', defaultVisible: true },
  { key: 'loc', header: 'Locator', defaultVisible: false },
  { key: 'distance', header: 'Distance from me', defaultVisible: true },
  { key: 'power', header: 'Power', defaultVisible: false },
  { key: 'comment', header: 'Comment', defaultVisible: false },
] as const;

export function defaultChannelVisibleColumns(): string[] {
  return CHANNEL_OPTIONAL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
}

export function loadChannelVisibleColumns(projectId: string): string[] {
  const validKeys = new Set(CHANNEL_OPTIONAL_COLUMNS.map((c) => c.key));
  return loadChannelVisibleColumnsFromStorage(
    projectId,
    validKeys,
    defaultChannelVisibleColumns(),
    CHANNEL_LIST_COLUMNS_SCHEMA_VERSION,
  );
}

export function defaultMaxDistanceKm(): number {
  return DISTANCE_FILTER_MARKS_KM[2];
}

export function parseMaxDistanceKm(raw: string | null): number {
  if (!raw) return defaultMaxDistanceKm();
  const n = Number.parseInt(raw, 10);
  return (DISTANCE_FILTER_MARKS_KM as readonly number[]).includes(n) ? n : defaultMaxDistanceKm();
}

export function parseCsvParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean);
}

export function serializeCsvParam(values: string[]): string | null {
  return values.length > 0 ? values.join(',') : null;
}
