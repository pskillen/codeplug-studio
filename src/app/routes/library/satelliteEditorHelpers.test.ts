import { describe, expect, it } from 'vitest';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import {
  FREQUENCY_FIELD_ERROR,
  TONE_FIELD_ERROR,
  fieldError,
  formatSatnogsSyncedAt,
  transmitterSourceLabel,
  visibleTransmitters,
} from './satelliteEditorHelpers.ts';

function transmitter(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'tx-1',
    label: 'FM repeater',
    mode: 'FM',
    uplinkHz: 145_200_000,
    downlinkHz: 145_800_000,
    uplinkToneHz: null,
    downlinkToneHz: null,
    source: 'manual',
    satnogsUuid: null,
    satnogsAlive: null,
    satnogsStatus: null,
    satnogsSyncedAt: null,
    dismissed: false,
    ...overrides,
  };
}

describe('fieldError', () => {
  it('returns undefined for blank input', () => {
    expect(fieldError('', null, FREQUENCY_FIELD_ERROR)).toBeUndefined();
    expect(fieldError('   ', null, FREQUENCY_FIELD_ERROR)).toBeUndefined();
  });

  it('returns undefined when the value parsed successfully', () => {
    expect(fieldError('145.825', 145_825_000, FREQUENCY_FIELD_ERROR)).toBeUndefined();
  });

  it('returns the message when non-blank input failed to parse', () => {
    expect(fieldError('-1', null, FREQUENCY_FIELD_ERROR)).toBe(FREQUENCY_FIELD_ERROR);
    expect(fieldError('abc', null, TONE_FIELD_ERROR)).toBe(TONE_FIELD_ERROR);
  });
});

describe('visibleTransmitters', () => {
  it('filters out dismissed rows', () => {
    const kept = transmitter({ id: 'kept' });
    const dismissed = transmitter({ id: 'dismissed', dismissed: true });

    expect(visibleTransmitters([kept, dismissed])).toEqual([kept]);
  });

  it('keeps manual and non-dismissed satnogs rows', () => {
    const manual = transmitter({ id: 'manual', source: 'manual' });
    const satnogs = transmitter({ id: 'satnogs', source: 'satnogs', dismissed: false });

    expect(visibleTransmitters([manual, satnogs])).toEqual([manual, satnogs]);
  });
});

describe('formatSatnogsSyncedAt', () => {
  it('returns a placeholder for null', () => {
    expect(formatSatnogsSyncedAt(null)).toBe('not yet synced');
  });

  it('returns a placeholder for an unparsable value', () => {
    expect(formatSatnogsSyncedAt('not-a-date')).toBe('not yet synced');
  });

  it('formats a valid ISO timestamp', () => {
    const iso = '2026-01-01T00:00:00.000Z';
    expect(formatSatnogsSyncedAt(iso)).toBe(new Date(iso).toLocaleString());
  });
});

describe('transmitterSourceLabel', () => {
  it('labels manual rows plainly', () => {
    expect(transmitterSourceLabel(transmitter({ source: 'manual' }))).toBe('Manual');
  });

  it('labels satnogs rows with the sync time', () => {
    const iso = '2026-01-01T00:00:00.000Z';
    const label = transmitterSourceLabel(transmitter({ source: 'satnogs', satnogsSyncedAt: iso }));
    expect(label).toBe(`SatNOGS · synced ${new Date(iso).toLocaleString()}`);
  });

  it('labels never-synced satnogs rows', () => {
    const label = transmitterSourceLabel(transmitter({ source: 'satnogs', satnogsSyncedAt: null }));
    expect(label).toBe('SatNOGS · synced not yet synced');
  });
});
