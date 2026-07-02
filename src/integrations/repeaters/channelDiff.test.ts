import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { locatorToCoords } from '@core/domain/maidenhead.ts';
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
  location: locatorToCoords('IO91'),
  band: '2M',
  status: 'OPERATIONAL',
};

function baseChannel(overrides: Partial<Channel> = {}): Channel {
  const io91wm = locatorToCoords('IO91WM')!;
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
    location: io91wm,
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

  it('does not offer maidenheadLocator override when coords stay within the local locator', () => {
    const rows = diffChannelFromListing(baseChannel(), baseListing);
    const locatorRow = rows.find((r) => r.field === 'maidenheadLocator');
    expect(locatorRow?.changed).toBe(false);
    expect(locatorRow?.selectByDefault).toBe(false);
  });

  it('offers maidenheadLocator override when coords fall outside the local locator', () => {
    const rows = diffChannelFromListing(
      baseChannel({
        location: { lat: 57.0, lon: -3.5 },
        maidenheadLocator: 'IO91WM',
      }),
      baseListing,
    );
    const locatorRow = rows.find((r) => r.field === 'maidenheadLocator');
    expect(locatorRow?.changed).toBe(true);
    expect(locatorRow?.selectByDefault).toBe(false);
  });

  it('does not offer maidenheadLocator override when channel has no locator', () => {
    const rows = diffChannelFromListing(
      baseChannel({ maidenheadLocator: null }),
      baseListing,
    );
    const locatorRow = rows.find((r) => r.field === 'maidenheadLocator');
    expect(locatorRow?.changed).toBe(false);
  });

  it('does not select location by default when remote coords are less precise', () => {
    const listing: RepeaterListing = {
      ...baseListing,
      locator: null,
      location: { lat: 51.12, lon: -1.23 },
    };
    const rows = diffChannelFromListing(
      baseChannel({ location: { lat: 51.123456, lon: -1.234567 } }),
      listing,
    );
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
