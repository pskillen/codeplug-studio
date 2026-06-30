/** Export-time zone ordering; library `Zone` rows are the source of truth for membership. */
export interface ZoneGroupingLayout {
  kind: 'zoneGrouping';
  zones: Array<{
    id: string;
    name: string;
    channelIds: string[];
  }>;
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
