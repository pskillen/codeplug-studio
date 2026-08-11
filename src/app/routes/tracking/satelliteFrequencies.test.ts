import { describe, expect, it } from 'vitest';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { resolvePassFrequencyFields, satelliteHasFrequencies } from './satelliteFrequencies.ts';

function transmitter(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'transmitter-1',
    label: 'Transmitter',
    mode: null,
    uplinkHz: null,
    downlinkHz: null,
    uplinkToneHz: null,
    downlinkToneHz: null,
    source: 'manual',
    satnogsUuid: null,
    satnogsAlive: null,
    satnogsStatus: null,
    satnogsSyncedAt: null,
    dismissed: false,
    includeInWrite: true,
    ...overrides,
  };
}

describe('satelliteHasFrequencies', () => {
  it('is true when a transmitter has uplink or downlink set', () => {
    expect(satelliteHasFrequencies([transmitter({ uplinkHz: 145_990_000 })])).toBe(true);
    expect(satelliteHasFrequencies([transmitter({ downlinkHz: 437_800_000 })])).toBe(true);
  });

  it('is false when no transmitters have frequencies', () => {
    expect(satelliteHasFrequencies([])).toBe(false);
    expect(satelliteHasFrequencies([transmitter()])).toBe(false);
  });

  it('ignores dismissed transmitters', () => {
    expect(satelliteHasFrequencies([transmitter({ uplinkHz: 145_990_000, dismissed: true })])).toBe(
      false,
    );
  });
});

describe('resolvePassFrequencyFields', () => {
  it('joins multiple transmitters into a single `·`-separated column', () => {
    const fields = resolvePassFrequencyFields([
      transmitter({ id: 't1', uplinkHz: 145_990_000, downlinkHz: 437_800_000 }),
      transmitter({ id: 't2', uplinkHz: 145_200_000, downlinkHz: 145_800_000 }),
    ]);

    expect(fields.hasFrequencies).toBe(true);
    expect(fields.txDisplay).toBe('145.99 MHz · 145.2 MHz');
    expect(fields.rxDisplay).toBe('437.8 MHz · 145.8 MHz');
    expect(fields.txSortHz).toBe(145_200_000);
    expect(fields.rxSortHz).toBe(145_800_000);
  });

  it('shows a single transmitter value with no separator', () => {
    const fields = resolvePassFrequencyFields([
      transmitter({ uplinkHz: 145_200_000, downlinkHz: 145_800_000 }),
    ]);

    expect(fields.txDisplay).toBe('145.2 MHz');
    expect(fields.rxDisplay).toBe('145.8 MHz');
  });

  it('shows "—" and null sort values when there are no transmitters or frequencies', () => {
    expect(resolvePassFrequencyFields([])).toEqual({
      hasFrequencies: false,
      txDisplay: '—',
      rxDisplay: '—',
      txSortHz: null,
      rxSortHz: null,
    });
  });

  it('excludes dismissed transmitters from display and sort values', () => {
    const fields = resolvePassFrequencyFields([
      transmitter({ id: 't1', uplinkHz: 145_990_000, dismissed: true }),
      transmitter({ id: 't2', uplinkHz: 145_200_000 }),
    ]);

    expect(fields.txDisplay).toBe('145.2 MHz');
    expect(fields.txSortHz).toBe(145_200_000);
  });
});
