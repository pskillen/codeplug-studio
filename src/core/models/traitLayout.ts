/** Export-time zone ordering; library `Zone` rows are the source of truth for membership. */

export interface ZoneGroupingZoneEntry {
  id: string;
  name: string;
  channelIds: string[];
  /** DM32 build export: emit scratch channel rows when enabled. */
  exportScratchChannel?: boolean;
  /** DM32 build export: synthesise scan list + carrier when enabled. */
  exportScanList?: boolean;
  scanCarrierFrequencyHz?: number | null;
  /**
   * Per-member include/skip for this exported zone's derived scan list.
   * Keys are library channel UUIDs and/or expansion projection keys (same string
   * space as `channelOverrides`). Build-scoped; does not mutate library membership.
   */
  scanMemberInclusion?: Record<string, 'include' | 'skip'>;
}

export interface ZoneGroupingLayout {
  kind: 'zoneGrouping';
  zones: ZoneGroupingZoneEntry[];
}

/** Dedicated scan lists for formats with first-class ScanList CPS files. */
export interface ScanListEntry {
  id: string;
  name: string;
  channelIds: string[];
}

export interface ScanListsLayout {
  kind: 'scanLists';
  scanLists: ScanListEntry[];
}

/** Flat memory list ordering for analogue-style radios. */
export interface FlatMemoryLayout {
  kind: 'flatMemory';
  channelIds: string[];
  scanFlags: Record<string, boolean>;
}

export type TraitLayoutSection = ZoneGroupingLayout | ScanListsLayout | FlatMemoryLayout;

export interface TraitLayout {
  sections: TraitLayoutSection[];
}

export function emptyTraitLayout(): TraitLayout {
  return { sections: [] };
}
