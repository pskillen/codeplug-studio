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
}

export interface ZoneGroupingLayout {
  kind: 'zoneGrouping';
  zones: ZoneGroupingZoneEntry[];
}

/** Flat memory list ordering for analogue-style radios. */
export interface FlatMemoryLayout {
  kind: 'flatMemory';
  channelIds: string[];
  scanFlags: Record<string, boolean>;
}

export type TraitLayoutSection = ZoneGroupingLayout | FlatMemoryLayout;

export interface TraitLayout {
  sections: TraitLayoutSection[];
}

export function emptyTraitLayout(): TraitLayout {
  return { sections: [] };
}
