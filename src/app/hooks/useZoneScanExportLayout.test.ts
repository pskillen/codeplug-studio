import { describe, expect, it } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import {
  zoneGroupingLayoutSupported,
  zoneScanExportSupported,
  zoneScanSetSupported,
} from './useZoneScanExportLayout.ts';

function buildStub(profileId: string) {
  return newRadioBuildForProfile('p1', profileId).build;
}

describe('zoneScanExportSupported', () => {
  it('is true for DM32 (ZoneGrouping + ScanLists)', () => {
    expect(zoneScanExportSupported(buildStub('dm32-baofeng-dm32uv'))).toBe(true);
  });

  it('is true for Anytone (ZoneGrouping + DedicatedScanLists)', () => {
    expect(zoneScanExportSupported(buildStub('anytone-at-d890uv'))).toBe(true);
  });

  it('is false for OpenGD77 (ZoneAsScanList only, no zone-derived scan panel)', () => {
    expect(zoneScanExportSupported(buildStub('opengd77-1701'))).toBe(false);
  });

  it('is false for CHIRP (no ZoneGrouping)', () => {
    expect(zoneScanExportSupported(buildStub('chirp-uv5r'))).toBe(false);
  });
});

describe('zoneGroupingLayoutSupported', () => {
  it('is true for OpenGD77 and DM32', () => {
    expect(zoneGroupingLayoutSupported(buildStub('opengd77-1701'))).toBe(true);
    expect(zoneGroupingLayoutSupported(buildStub('dm32-baofeng-dm32uv'))).toBe(true);
  });

  it('is false for CHIRP', () => {
    expect(zoneGroupingLayoutSupported(buildStub('chirp-uv5r'))).toBe(false);
  });
});

describe('zoneScanSetSupported', () => {
  it('is true for the MM9PDY RT95 and UV-5R Mini, which have no scan-list export', () => {
    for (const profile of ['radio-io-rt95-mm9pdy', 'radio-io-uv5r-mini-mm9pdy']) {
      expect(zoneScanSetSupported(buildStub(profile))).toBe(true);
      expect(zoneScanExportSupported(buildStub(profile))).toBe(false);
    }
  });

  it('is false for DM32, Anytone, OpenGD77 and the stock flat radios', () => {
    for (const profile of [
      'dm32-baofeng-dm32uv',
      'anytone-at-d890uv',
      'radio-io-at-d890uv-mm9pdy',
      'opengd77-1701',
      'radio-io-uv5r-mini',
      'radio-io-rt95',
    ]) {
      expect(zoneScanSetSupported(buildStub(profile))).toBe(false);
    }
  });
});
