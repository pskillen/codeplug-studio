export type EntityListEntity =
  | 'zones'
  | 'talk-groups'
  | 'digital-contacts'
  | 'analog-contacts'
  | 'rx-group-lists'
  | 'scan-lists'
  | 'aprs-configurations'
  | 'satellite-keps';

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
  zone?: string[];
  distanceFilterEnabled?: boolean;
  maxDistanceKm?: number;
  columnSort?: DataTableSortState | null;
}

export type ChannelListLayoutMode = 'table' | 'cards';

export type ChannelListCardGroupMode = 'none' | 'zone' | 'band' | 'duplex';

export interface ChannelListLayoutPrefs {
  layout?: ChannelListLayoutMode;
  cardGroup?: ChannelListCardGroupMode;
}

/** Nearby repeaters filter chips. Source ids stay plain strings: integrations never import app unions. */
export interface NearbyPrefs {
  radiusKm?: number;
  /** [] persists "no sources" (URL `s=none`). */
  sources?: string[];
  bands?: string[];
  modes?: string[];
  operationalOnly?: boolean;
}

export interface EntityListPrefs {
  q?: string;
  columnSort?: DataTableSortState;
}

export interface TrackingDashboardPrefs {
  windowHours?: number;
  drawBehindMin?: number;
  drawAheadMin?: number;
  globeLookBehindMin?: number;
  globeLookAheadMin?: number;
  minElevation?: string;
  onlyWithFrequencies?: boolean;
  selectedSatelliteIds?: string[];
}
