import type { Library } from '../models/library.ts';
import { bandLabelForFrequencyHz } from './bandPlan.ts';
import { findDanglingReferences, type DanglingReference } from './references.ts';

export interface LibrarySummary {
  counts: {
    channels: number;
    talkGroups: number;
    digitalContacts: number;
    analogContacts: number;
    rxGroupLists: number;
    zones: number;
  };
  channelsByMode: { mode: string; count: number }[];
  channelsByBand: { band: string; count: number }[];
  channelsWithLocation: number;
  danglingReferences: DanglingReference[];
}

function tally(values: string[]): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Read-only projection over a library for the reports view. Pure. */
export function summariseLibrary(library: Library): LibrarySummary {
  const byMode = tally(
    library.channels.map((c) => (c.modeProfiles[0]?.mode ?? 'unknown').toUpperCase()),
  ).map(({ key, count }) => ({ mode: key, count }));

  const byBand = tally(library.channels.map((c) => bandLabelForFrequencyHz(c.rxFrequency))).map(
    ({ key, count }) => ({ band: key, count }),
  );

  return {
    counts: {
      channels: library.channels.length,
      talkGroups: library.talkGroups.length,
      digitalContacts: library.digitalContacts.length,
      analogContacts: library.analogContacts.length,
      rxGroupLists: library.rxGroupLists.length,
      zones: library.zones.length,
    },
    channelsByMode: byMode,
    channelsByBand: byBand,
    channelsWithLocation: library.channels.filter((c) => c.useLocation && c.location !== null)
      .length,
    danglingReferences: findDanglingReferences(library),
  };
}
