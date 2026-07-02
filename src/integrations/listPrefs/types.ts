export type EntityListEntity =
  | 'zones'
  | 'talk-groups'
  | 'digital-contacts'
  | 'analog-contacts'
  | 'rx-group-lists';

export type ChannelSortMode = 'name' | 'distance';

export type DataTableSortDirection = 'asc' | 'desc';

export interface DataTableSortState {
  columnKey: string;
  direction: DataTableSortDirection;
}

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
