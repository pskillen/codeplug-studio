import { DISTANCE_FILTER_MARKS_KM } from '../lib/channels.ts';
import { DATATABLE_CALLSIGN_SORT_KEY } from '../lib/dataTable/sort.ts';
import {
  loadChannelVisibleColumns as loadChannelVisibleColumnsFromStorage,
  loadChannelCardVisibleColumns as loadChannelCardVisibleColumnsFromStorage,
} from '@integrations/listPrefs/index.ts';

export {
  channelListColumnsKey,
  channelListColumnsSchemaKey,
  channelListCardColumnsKey,
  channelListCardColumnsSchemaKey,
} from '@integrations/listPrefs/index.ts';
export type { ChannelSortMode } from '@integrations/listPrefs/index.ts';

export const CHANNEL_LIST_COLUMNS_SCHEMA_VERSION = 3;
export const CHANNEL_LIST_CARD_COLUMNS_SCHEMA_VERSION = 1;

export const CHANNEL_TABLE_CALLSIGN_COLUMN = {
  key: DATATABLE_CALLSIGN_SORT_KEY,
  header: 'Callsign',
  defaultVisible: true,
} as const;

export const CHANNEL_OPTIONAL_COLUMNS = [
  { key: 'zones', header: 'Zones', defaultVisible: true },
  { key: 'abbreviation', header: 'Abbrev', defaultVisible: true },
  { key: 'band', header: 'Band', defaultVisible: true },
  { key: 'mode', header: 'Mode', defaultVisible: true },
  { key: 'rxTx', header: 'RX/TX', defaultVisible: true },
  { key: 'contact', header: 'Contact', defaultVisible: true },
  { key: 'rgl', header: 'RX group list', defaultVisible: true },
  { key: 'scanList', header: 'Scan list', defaultVisible: false },
  { key: 'aprs', header: 'APRS config', defaultVisible: false },
  { key: 'loc', header: 'Locator', defaultVisible: false },
  { key: 'distance', header: 'Distance from me', defaultVisible: true },
  { key: 'power', header: 'Power', defaultVisible: false },
  { key: 'comment', header: 'Comment', defaultVisible: false },
] as const;

export function defaultChannelVisibleColumns(): string[] {
  return CHANNEL_OPTIONAL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
}

export function defaultChannelTableVisibleColumns(): string[] {
  return [CHANNEL_TABLE_CALLSIGN_COLUMN.key, ...defaultChannelVisibleColumns()];
}

export function channelTableHideableColumns(): { key: string; defaultVisible: boolean }[] {
  return [
    {
      key: CHANNEL_TABLE_CALLSIGN_COLUMN.key,
      defaultVisible: CHANNEL_TABLE_CALLSIGN_COLUMN.defaultVisible,
    },
    ...CHANNEL_OPTIONAL_COLUMNS.map((col) => ({
      key: col.key,
      defaultVisible: col.defaultVisible,
    })),
  ];
}

export function loadChannelVisibleColumns(projectId: string): string[] {
  const validKeys = new Set(channelTableHideableColumns().map((col) => col.key));
  return loadChannelVisibleColumnsFromStorage(
    projectId,
    validKeys,
    defaultChannelTableVisibleColumns(),
    CHANNEL_LIST_COLUMNS_SCHEMA_VERSION,
  );
}

export function loadChannelCardVisibleColumns(projectId: string): string[] {
  const validKeys = new Set(CHANNEL_OPTIONAL_COLUMNS.map((c) => c.key));
  return loadChannelCardVisibleColumnsFromStorage(
    projectId,
    validKeys,
    defaultChannelVisibleColumns(),
    CHANNEL_LIST_CARD_COLUMNS_SCHEMA_VERSION,
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
