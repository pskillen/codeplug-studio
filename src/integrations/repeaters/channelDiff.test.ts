import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { diffChannelFromListing } from './channelDiff.ts';
import type { RepeaterListing } from './types.ts';

const baseListing: RepeaterListing = {
  source: 'ukrepeater',
  remoteId: '1',
  callsign: 'GB3DA',
  name: 'Danbury',
  rxFrequencyHz: 145_725_000,
  txFrequencyHz: 145_125_000,
  toneHz: null,
  modes: ['fm'],
  primaryMode: 'fm',
  colourCode: null,
  locator: 'IO91',
  location: null,
  band: '2M',
  status: 'OPERATIONAL',
};

function baseChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'ch-1',
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Danbury',
    callsign: 'GB3DA',
    rxFrequency: 145_725_000,
    txFrequency: 145_125_000,
    comment: 'My note',
    power: null,
    scanSkip: false,
    useLocation: true,
    location: { lat: 51.123456, lon: -1.234567 },
    maidenheadLocator: 'IO91WM',
    modeProfiles: [
      { mode: 'fm', rxTone: 'none', txTone: 'none', squelch: null, bandwidthKHz: null },
    ],
    ...overrides,
  };
}

describe('diffChannelFromListing', () => {
  it('omits comment row for BrandMeister listings', () => {
    const listing: RepeaterListing = {
      ...baseListing,
      source: 'brandmeister',
      locator: null,
      location: { lat: 51.5, lon: -0.1 },
    };
    const rows = diffChannelFromListing(baseChannel(), listing);
    expect(rows.some((r) => r.field === 'comment')).toBe(false);
  });

  it('includes comment row for ukrepeater listings', () => {
    const rows = diffChannelFromListing(baseChannel(), baseListing);
    expect(rows.some((r) => r.field === 'comment')).toBe(true);
  });

  it('does not select maidenheadLocator by default when remote is less precise', () => {
    const rows = diffChannelFromListing(baseChannel(), baseListing);
    const locatorRow = rows.find((r) => r.field === 'maidenheadLocator');
    expect(locatorRow?.changed).toBe(true);
    expect(locatorRow?.selectByDefault).toBe(false);
  });

  it('does not select location by default when remote coords are less precise', () => {
    const listing: RepeaterListing = {
      ...baseListing,
      locator: null,
      location: { lat: 51.12, lon: -1.23 },
    };
    const rows = diffChannelFromListing(baseChannel(), listing);
    const locationRow = rows.find((r) => r.field === 'location');
    expect(locationRow?.changed).toBe(true);
    expect(locationRow?.selectByDefault).toBe(false);
  });

  it('selects frequency changes by default', () => {
    const listing: RepeaterListing = {
      ...baseListing,
      rxFrequencyHz: 145_800_000,
    };
    const rows = diffChannelFromListing(baseChannel(), listing);
    const rxRow = rows.find((r) => r.field === 'rxFrequency');
    expect(rxRow?.selectByDefault).toBe(true);
  });
});
