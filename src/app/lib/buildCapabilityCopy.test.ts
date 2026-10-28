import { describe, expect, it } from 'vitest';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import { conceptsForCapabilities } from './buildCapabilityCopy.ts';

describe('conceptsForCapabilities: zones over a per-channel scan flag (RT95 MM9PDY)', () => {
  const traits = [
    BuildCapabilityTrait.ZoneGrouping,
    BuildCapabilityTrait.ZoneAsScanList,
    BuildCapabilityTrait.PerChannelScanFlag,
  ];

  it('says scan visits the channels with scan on, in channel-number order', () => {
    const concepts = conceptsForCapabilities(traits, 'radio-io');
    expect(concepts.find((c) => c.id === 'zone-scan')?.body).toBe(
      "Scan visits the zone's channels that have scan on, in channel-number order.",
    );
    expect(concepts.map((c) => c.id)).toEqual(
      expect.arrayContaining(['zone-channel-order', 'channel-descriptions']),
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
