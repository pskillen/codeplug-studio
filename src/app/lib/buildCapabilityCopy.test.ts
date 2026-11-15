import { describe, expect, it } from 'vitest';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import { conceptsForCapabilities } from './buildCapabilityCopy.ts';

describe('conceptsForCapabilities: zones over a per-channel scan flag (RT95 and Mini MM9PDY)', () => {
  const traits = [
    BuildCapabilityTrait.ZoneGrouping,
    BuildCapabilityTrait.ZoneAsScanList,
    BuildCapabilityTrait.PerChannelScanFlag,
    BuildCapabilityTrait.ZoneScanSet,
  ];

  it('says a zone scans its scan set and All channels scans the per-channel flag', () => {
    const concepts = conceptsForCapabilities(traits, 'radio-io');
    const body = concepts.find((c) => c.id === 'zone-scan')?.body ?? '';
    expect(body).toMatch(/In a zone, Scan visits the zone's scan set/);
    expect(body).toMatch(/Scan in this zone/);
    expect(body).toMatch(/In All channels.*Scan in All channels/);
    expect(concepts.map((c) => c.id)).toEqual(
      expect.arrayContaining(['zone-channel-order', 'channel-descriptions']),
    );
  });

  it('keys the scan-set copy on the zone scan set trait', () => {
    const concepts = conceptsForCapabilities(
      traits.filter((t) => t !== BuildCapabilityTrait.ZoneScanSet),
      'radio-io',
    );
    expect(concepts.find((c) => c.id === 'zone-scan')?.body).toBe(
      "Scan visits the zone's channels that have scan on, in channel-number order.",
    );
  });

  it('keeps the plain zone-scan copy for other zone-as-scan-list profiles', () => {
    const concepts = conceptsForCapabilities(
      [BuildCapabilityTrait.ZoneGrouping, BuildCapabilityTrait.ZoneAsScanList],
      'radio-io',
    );
    expect(concepts.find((c) => c.id === 'zone-scan')?.body).toMatch(/Reorder the zone/);
    expect(concepts.some((c) => c.id === 'channel-descriptions')).toBe(false);
  });
});
