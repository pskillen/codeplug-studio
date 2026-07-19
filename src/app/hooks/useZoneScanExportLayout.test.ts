import { describe, expect, it } from 'vitest';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { zoneGroupingLayoutSupported, zoneScanExportSupported } from './useZoneScanExportLayout.ts';

function buildStub(profileId: string, formatId: string): FormatBuild {
  return {
    id: 'b1',
    projectId: 'p1',
    name: 'Test',
    formatId,
    profileId,
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    layout: { sections: [] },
    channelOverrides: [],
    zoneOverrides: [],
    scanListOverrides: [],
    talkGroupOverrides: [],
    rxGroupListOverrides: [],
    contactOverrides: [],
  } as FormatBuild;
}

describe('zoneScanExportSupported', () => {
  it('is true for DM32 (ZoneGrouping + ScanLists)', () => {
    expect(zoneScanExportSupported(buildStub('dm32-baofeng-dm32uv', 'dm32'))).toBe(true);
  });

  it('is true for Anytone (ZoneGrouping + DedicatedScanLists)', () => {
    expect(zoneScanExportSupported(buildStub('anytone-at-d890uv', 'anytone'))).toBe(true);
  });

  it('is false for OpenGD77 (ZoneAsScanList only, no zone-derived scan panel)', () => {
    expect(zoneScanExportSupported(buildStub('opengd77-1701', 'opengd77'))).toBe(false);
  });

  it('is false for CHIRP (no ZoneGrouping)', () => {
    expect(zoneScanExportSupported(buildStub('chirp-uv5r', 'chirp'))).toBe(false);
  });
});

describe('zoneGroupingLayoutSupported', () => {
  it('is true for OpenGD77 and DM32', () => {
    expect(zoneGroupingLayoutSupported(buildStub('opengd77-1701', 'opengd77'))).toBe(true);
    expect(zoneGroupingLayoutSupported(buildStub('dm32-baofeng-dm32uv', 'dm32'))).toBe(true);
  });

  it('is false for CHIRP', () => {
    expect(zoneGroupingLayoutSupported(buildStub('chirp-uv5r', 'chirp'))).toBe(false);
  });
});
