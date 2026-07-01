import { DISTANCE_FILTER_MARKS_KM } from '../lib/channels.ts';
import {
  channelListColumnsKey,
  channelListColumnsSchemaKey,
} from '../lib/listPrefs/keys.ts';

export { channelListColumnsKey, channelListColumnsSchemaKey } from '../lib/listPrefs/keys.ts';

export const CHANNEL_LIST_COLUMNS_SCHEMA_VERSION = 1;

export type ChannelSortMode = 'name' | 'distance';

export const CHANNEL_OPTIONAL_COLUMNS = [
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
  const storageKey = channelListColumnsKey(projectId);
  const schemaKey = channelListColumnsSchemaKey(projectId);
  const validKeys = new Set(CHANNEL_OPTIONAL_COLUMNS.map((c) => c.key));

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      let cols = (JSON.parse(raw) as string[]).filter((k) =>
        validKeys.has(k as (typeof CHANNEL_OPTIONAL_COLUMNS)[number]['key']),
      );

      const schema = Number.parseInt(localStorage.getItem(schemaKey) ?? '0', 10);
      if (schema < CHANNEL_LIST_COLUMNS_SCHEMA_VERSION) {
        localStorage.setItem(storageKey, JSON.stringify(cols));
        localStorage.setItem(schemaKey, String(CHANNEL_LIST_COLUMNS_SCHEMA_VERSION));
      }

      return cols;
    }
  } catch {
    /* ignore */
  }
  return defaultChannelVisibleColumns();
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
