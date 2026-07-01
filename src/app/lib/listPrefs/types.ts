import type { DataTableSortState } from '../dataTable/sort.ts';
import type { ChannelSortMode } from '../../hooks/channelListQueryUtils.ts';

export type EntityListEntity = 'zones' | 'talk-groups' | 'contacts' | 'rx-group-lists';

export interface ChannelListPrefs {
  q?: string;
  sortMode?: ChannelSortMode;
  band?: string[];
  mode?: string[];
  duplex?: 'simplex' | 'split' | null;
  distanceFilterEnabled?: boolean;
  maxDistanceKm?: number;
  columnSort?: DataTableSortState | null;
}

export interface EntityListPrefs {
  q?: string;
  columnSort?: DataTableSortState;
}
