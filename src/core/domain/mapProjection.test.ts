import { describe, expect, it } from 'vitest';
import { newChannel, newZone } from './factories.ts';
import { defaultModeProfile } from './modeProfiles.ts';
import {
  applyFilters,
  dominantMode,
  groupByCoords,
  groupIsDimmed,
  markerDotSizePx,
  markerLabel,
  zoneGeolocatedPoints,
} from './mapProjection.ts';
import { buildChannelById } from './mapProjection.ts';
import type { ChannelModeProfileDMR } from '../models/library.ts';

const projectId = 'p1';

function locatedChannel(
  name: string,
  lat: number,
  lon: number,
  useLocation = true,
): ReturnType<typeof newChannel> {
  return {
    ...newChannel(projectId, name, 'GB3AA'),
    useLocation,
    location: { lat, lon },
  };
}

describe('applyFilters', () => {
  it('skips channels without coordinates or useLocation', () => {
    const withCoords = locatedChannel('A', 56.5, -4.0);
    const noCoords = newChannel(projectId, 'B');
    const noUse = { ...locatedChannel('C', 57.0, -3.5), useLocation: false };
    const zero = locatedChannel('D', 0, 0);

    const { plotted, skipped } = applyFilters([withCoords, noCoords, noUse, zero], {
      requireUseLocation: true,
      skipZero: true,
    });

    expect(plotted).toHaveLength(1);
    expect(plotted[0].name).toBe('A');
    expect(skipped).toHaveLength(3);
    expect(skipped.map((s) => s.reason)).toContain('missing coordinates');
    expect(skipped.map((s) => s.reason)).toContain('Use Location = No');
    expect(skipped.map((s) => s.reason)).toContain('0,0 coordinates');
  });

  it('skips channels hidden from the internal map', () => {
    const visible = locatedChannel('Visible', 56.5, -4.0);
    const hidden = { ...locatedChannel('Hidden', 57.0, -3.5), hideFromInternalMap: true };

    const { plotted, skipped } = applyFilters([visible, hidden], {
      requireUseLocation: true,
      skipZero: true,
    });

    expect(plotted).toHaveLength(1);
    expect(plotted[0].name).toBe('Visible');
    expect(skipped).toEqual([{ name: 'Hidden', reason: 'hidden from map' }]);
  });
});

describe('groupByCoords', () => {
  it('merges co-located channels', () => {
    const a = locatedChannel('A', 56.5, -4.0);
    const b = locatedChannel('B', 56.5, -4.0);
    const c = locatedChannel('C', 57.0, -3.5);

    const groups = groupByCoords([a, b, c], true);
    expect(groups).toHaveLength(2);
    expect(
      groups
        .find((g) => g.length === 2)
        ?.map((ch) => ch.name)
        .sort(),
    ).toEqual(['A', 'B']);
  });
});

describe('markerLabel', () => {
  it('shows merged count for co-located channels', () => {
    const a = locatedChannel('A', 56.5, -4.0);
    const b = locatedChannel('B', 56.5, -4.0);
    expect(markerLabel([a, b], false)).toBe('GB3AA +1');
  });
});

describe('markerDotSizePx', () => {
  it('scales dot diameter with stack count', () => {
    expect(markerDotSizePx(1)).toBe(18);
    expect(markerDotSizePx(2)).toBe(22);
    expect(markerDotSizePx(3)).toBe(26);
    expect(markerDotSizePx(5)).toBe(34);
    expect(markerDotSizePx(10)).toBe(34);
  });
});

describe('dominantMode', () => {
  it('picks the most common primary mode in a merged group', () => {
    const fm = {
      ...locatedChannel('FM', 56.5, -4.0),
      modeProfiles: [defaultModeProfile('fm')],
    };
    const dmrProfile: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 1,
      dmrId: null,
      contactRef: null,
      rxGroupListId: null,
    };
    const dmr1 = {
      ...locatedChannel('D1', 56.5, -4.0),
      modeProfiles: [dmrProfile],
    };
    const dmr2 = {
      ...locatedChannel('D2', 56.5, -4.0),
      modeProfiles: [dmrProfile],
    };

    expect(dominantMode([fm, dmr1, dmr2])).toBe('dmr');
  });
});

describe('groupIsDimmed', () => {
  it('is true when every channel in the group is dimmed', () => {
    const a = { ...locatedChannel('A', 56.5, -4.0), id: 'a' };
    const b = { ...locatedChannel('B', 56.5, -4.0), id: 'b' };
    expect(groupIsDimmed([a, b], new Set(['a', 'b']))).toBe(true);
  });

  it('is false for mixed in/out stacks', () => {
    const a = { ...locatedChannel('A', 56.5, -4.0), id: 'a' };
    const b = { ...locatedChannel('B', 56.5, -4.0), id: 'b' };
    expect(groupIsDimmed([a, b], new Set(['b']))).toBe(false);
  });

  it('is false when no channels are dimmed', () => {
    const a = { ...locatedChannel('A', 56.5, -4.0), id: 'a' };
    expect(groupIsDimmed([a], new Set())).toBe(false);
  });

  it('is false for an empty group', () => {
    expect(groupIsDimmed([], new Set(['a']))).toBe(false);
  });
});

describe('zoneGeolocatedPoints', () => {
  it('resolves zone members via EntityRef and reports missing', () => {
    const ch1 = locatedChannel('One', 56.5, -4.0);
    const ch2 = locatedChannel('Two', 57.0, -3.5);
    const noLoc = newChannel(projectId, 'Three');
    const all = [ch1, ch2, noLoc];
    const plotted = [ch1, ch2];
    const plottedById = buildChannelById(plotted);

    const zone = {
      ...newZone(projectId, 'Test zone'),
      members: [
        { kind: 'channel' as const, channelId: ch1.id },
        { kind: 'channel' as const, channelId: ch2.id },
        { kind: 'channel' as const, channelId: noLoc.id },
        { kind: 'channel' as const, channelId: 'ghost-id' },
      ],
    };

    const { points, missing } = zoneGeolocatedPoints(zone, [zone], plottedById, all, {
      requireUseLocation: true,
      skipZero: true,
    });

    expect(points).toHaveLength(2);
    expect(missing.some((m) => m.name === 'Three')).toBe(true);
    expect(missing.some((m) => m.reason === 'unresolved member')).toBe(true);
  });

  it('returns a single point for one geolocated member', () => {
    const ch = locatedChannel('Solo', 56.5, -4.0);
    const zone = {
      ...newZone(projectId, 'Solo zone'),
      members: [{ kind: 'channel' as const, channelId: ch.id }],
    };
    const plottedById = buildChannelById([ch]);

    const { points } = zoneGeolocatedPoints(zone, [zone], plottedById, [ch], {
      requireUseLocation: true,
      skipZero: true,
    });

    expect(points).toEqual([[56.5, -4.0]]);
  });

  it('reports hidden-from-map reason for filtered members', () => {
    const hidden = { ...locatedChannel('Hidden', 56.5, -4.0), hideFromInternalMap: true };
    const zone = {
      ...newZone(projectId, 'Hidden member zone'),
      members: [{ kind: 'channel' as const, channelId: hidden.id }],
    };
    const plottedById = buildChannelById([]);

    const { points, missing } = zoneGeolocatedPoints(zone, [zone], plottedById, [hidden], {
      requireUseLocation: true,
      skipZero: true,
    });

    expect(points).toHaveLength(0);
    expect(missing).toEqual([{ name: 'Hidden', reason: 'hidden from map' }]);
  });
});
