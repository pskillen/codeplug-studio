import { describe, expect, it } from 'vitest';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import {
  classifyOpenGd77SatelliteSlot,
  isFrequencyInOpenGd77SatelliteRange,
  isOpenGd77SatelliteFrequencyEligible,
} from './satelliteCapability.ts';

function tx(
  overrides: Partial<Pick<SatelliteTransmitter, 'mode' | 'label' | 'uplinkHz' | 'downlinkHz'>>,
): Pick<SatelliteTransmitter, 'mode' | 'label' | 'uplinkHz' | 'downlinkHz'> {
  return {
    mode: 'FM',
    label: 'Voice',
    uplinkHz: 145_850_000,
    downlinkHz: 436_795_000,
    ...overrides,
  };
}

describe('classifyOpenGd77SatelliteSlot', () => {
  it('maps FM-family and empty mode to Freq 1', () => {
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'FM' }))).toBe('fm');
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'NFM' }))).toBe('fm');
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: null }))).toBe('fm');
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: '' }))).toBe('fm');
  });

  it('maps APRS / packet / AFSK to Freq 2', () => {
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'APRS', label: 'ISS APRS' }))).toBe('aprs');
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'AFSK', label: 'Packet' }))).toBe('aprs');
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'FM', label: 'AX.25' }))).toBe('aprs');
  });

  it('maps beacon, CW, SSTV, and telemetry to Freq 3', () => {
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'CW', label: 'Beacon' }))).toBe('beacon');
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'SSTV', label: 'ISS SSTV' }))).toBe('beacon');
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'CW', label: 'Downlink' }))).toBe('beacon');
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'TLM', label: 'Telemetry' }))).toBe('beacon');
  });

  it('rejects DMR and digital-sat modes', () => {
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'DMR', label: 'Voice' }))).toBeNull();
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'BPSK', label: 'BPSK' }))).toBeNull();
    expect(classifyOpenGd77SatelliteSlot(tx({ mode: 'GFSK', label: 'GFSK' }))).toBeNull();
  });
});

describe('isFrequencyInOpenGd77SatelliteRange', () => {
  it('accepts unset, 2m, and 70cm through 480 MHz', () => {
    expect(isFrequencyInOpenGd77SatelliteRange(null)).toBe(true);
    expect(isFrequencyInOpenGd77SatelliteRange(145_800_000)).toBe(true);
    expect(isFrequencyInOpenGd77SatelliteRange(479_999_000)).toBe(true);
  });

  it('rejects L-band and above 480 MHz', () => {
    expect(isFrequencyInOpenGd77SatelliteRange(1_260_000_000)).toBe(false);
    expect(isFrequencyInOpenGd77SatelliteRange(481_000_000)).toBe(false);
  });
});

describe('isOpenGd77SatelliteFrequencyEligible', () => {
  it('requires every set frequency to be in range', () => {
    expect(
      isOpenGd77SatelliteFrequencyEligible(
        tx({ uplinkHz: null, downlinkHz: 145_800_000 }) as SatelliteTransmitter,
      ),
    ).toBe(true);
    expect(
      isOpenGd77SatelliteFrequencyEligible(
        tx({ uplinkHz: 1_269_000_000, downlinkHz: 145_800_000 }) as SatelliteTransmitter,
      ),
    ).toBe(false);
  });
});
