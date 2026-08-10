import { describe, expect, it } from 'vitest';
import type { SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';
import {
  FREQUENCY_FIELD_ERROR,
  TONE_FIELD_ERROR,
  fieldError,
  sortTransmittersAliveFirst,
  transmitterLabel,
} from './satelliteEditorHelpers.ts';

function transmitter(overrides: Partial<SatelliteTransmitterInfo> = {}): SatelliteTransmitterInfo {
  return {
    uuid: 'tx-1',
    description: 'FM repeater',
    mode: 'FM',
    downlinkHz: 145_800_000,
    uplinkHz: 145_200_000,
    alive: true,
    status: 'active',
    ...overrides,
  };
}

describe('transmitterLabel', () => {
  it('includes description and mode', () => {
    expect(transmitterLabel(transmitter())).toBe('FM repeater — FM');
  });

  it('falls back to "unknown mode" when mode is null', () => {
    expect(transmitterLabel(transmitter({ mode: null }))).toBe('FM repeater — unknown mode');
  });

  it('flags inactive transmitters', () => {
    expect(transmitterLabel(transmitter({ alive: false }))).toBe('FM repeater — FM (inactive)');
  });
});

describe('sortTransmittersAliveFirst', () => {
  it('sorts alive transmitters before inactive ones without reordering within each group', () => {
    const dead1 = transmitter({ uuid: 'dead-1', alive: false });
    const alive1 = transmitter({ uuid: 'alive-1', alive: true });
    const dead2 = transmitter({ uuid: 'dead-2', alive: false });
    const alive2 = transmitter({ uuid: 'alive-2', alive: true });

    const sorted = sortTransmittersAliveFirst([dead1, alive1, dead2, alive2]);

    expect(sorted.map((t) => t.uuid)).toEqual(['alive-1', 'alive-2', 'dead-1', 'dead-2']);
  });
});

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
