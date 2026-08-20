import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
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
  rxToneHz: null,
  txToneHz: null,
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
    ...newChannel('p1', 'Danbury', 'GB3DA'),
    rxFrequency: 145_725_000,
    txFrequency: 145_125_000,
    comment: 'My note',
    location: io91wm,
    useLocation: true,
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
    const rows = diffChannelFromListing(baseChannel({ maidenheadLocator: null }), baseListing);
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
    expect(rxRow?.emphasis).toBeUndefined();
  });

  it('deselects and warns when a ukrepeater refresh would clear the RX tone (#1254)', () => {
    const channel = baseChannel({
      modeProfiles: [
        { mode: 'fm', rxTone: '88.5', txTone: '88.5', squelch: null, bandwidthKHz: null },
      ],
    });
    // ukrepeater semantics: ctcss maps to TX only, RX stays null/none.
    const listing: RepeaterListing = { ...baseListing, rxToneHz: null, txToneHz: 88.5 };
    const rows = diffChannelFromListing(channel, listing);

    const rxToneRow = rows.find((r) => r.field === 'rxTone');
    expect(rxToneRow?.changed).toBe(true);
    expect(rxToneRow?.local).toBe('88.5');
    expect(rxToneRow?.remote).toBe('None');
    expect(rxToneRow?.selectByDefault).toBe(false);
    expect(rxToneRow?.emphasis).toBe('warning');

    // TX tone matches (88.5 both sides) — no change, no warning.
    const txToneRow = rows.find((r) => r.field === 'txTone');
    expect(txToneRow?.changed).toBe(false);
    expect(txToneRow?.emphasis).toBeUndefined();
  });

  it('deselects and warns when the directory has no colour code for a DMR channel', () => {
    const channel = baseChannel({
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 3,
          dmrMode: null,
          timeslot: null,
          dmrId: null,
          contactRef: null,
          rxGroupListId: null,
          sendTalkerAlias: 'default',
        },
      ],
    });
    const listing: RepeaterListing = {
      ...baseListing,
      modes: ['dmr'],
      primaryMode: 'dmr',
      colourCode: null,
    };
    const rows = diffChannelFromListing(channel, listing);
    const ccRow = rows.find((r) => r.field === 'colourCode');
    expect(ccRow?.changed).toBe(true);
    expect(ccRow?.local).toBe('3');
    expect(ccRow?.remote).toBe('—');
    expect(ccRow?.selectByDefault).toBe(false);
    expect(ccRow?.emphasis).toBe('warning');
  });

  it('deselects and warns when the directory would clear the comment', () => {
    const listing: RepeaterListing = { ...baseListing, source: 'irts', name: '', status: '' };
    const channel = baseChannel({ comment: 'Keep me' });
    const rows = diffChannelFromListing(channel, listing);
    const commentRow = rows.find((r) => r.field === 'comment');
    expect(commentRow?.changed).toBe(true);
    expect(commentRow?.remote).toBe('—');
    expect(commentRow?.selectByDefault).toBe(false);
    expect(commentRow?.emphasis).toBe('warning');
  });

  it('deselects and warns when the directory has no location at all (not just less precise)', () => {
    const listing: RepeaterListing = { ...baseListing, locator: null, location: null };
    const rows = diffChannelFromListing(baseChannel(), listing);
    const locationRow = rows.find((r) => r.field === 'location');
    expect(locationRow?.changed).toBe(true);
    expect(locationRow?.remote).toBe('—');
    expect(locationRow?.selectByDefault).toBe(false);
    expect(locationRow?.emphasis).toBe('warning');
  });

  it('does not warn on a genuine (non-clearing) name change', () => {
    const listing: RepeaterListing = { ...baseListing, name: 'New Name' };
    const rows = diffChannelFromListing(baseChannel(), listing);
    const nameRow = rows.find((r) => r.field === 'name');
    expect(nameRow?.changed).toBe(true);
    expect(nameRow?.selectByDefault).toBe(true);
    expect(nameRow?.emphasis).toBeUndefined();
  });
});
