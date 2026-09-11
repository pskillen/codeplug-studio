import { describe, expect, it } from 'vitest';
import { emptyLibrary, newChannel } from '@core/domain/factories.ts';
import type { PublicServiceCountry, PublicServiceEntry, PublicServiceGroup } from '@core/domain/publicServices/types.ts';
import { buildPublicServiceImportPlan } from './publicServiceImport.ts';

const PROJECT_ID = 'proj-1';
const PORT_HZ = 156_600_000;

function entry(
  partial: Partial<PublicServiceEntry> & Pick<PublicServiceEntry, 'channelId' | 'name'>,
): PublicServiceEntry {
  return {
    label: partial.label ?? partial.name,
    rxFrequencyHz: 156_800_000,
    txFrequencyHz: 156_800_000,
    modes: [{ mode: 'fm', isPrimary: true, bandwidthKHz: 25 }],
    status: 'active',
    confidence: 'high',
    source: { type: 'official', url: 'https://example.org/a', title: 'Plan' },
    ...partial,
  };
}

function group(
  groupId: string,
  entries: PublicServiceEntry[],
  extra: Partial<PublicServiceGroup> = {},
): PublicServiceGroup {
  return {
    groupId,
    label: extra.label ?? groupId,
    category: extra.category ?? 'maritime',
    entries,
  };
}

const COUNTRY: PublicServiceCountry = {
  countryCode: 'ZZ',
  countryLabel: 'Exampleland',
  datasetVersion: 'test',
  knownGaps: [],
  groups: [
    group(
      'zz-distress',
      [entry({ channelId: 'ch-16', name: 'CG Ch16', rxFrequencyHz: 156_800_000, txFrequencyHz: 156_800_000 })],
      { label: 'Distress', category: 'maritime' },
    ),
    group(
      'zz-dublin',
      [entry({ channelId: 'ch-12', name: 'Dublin VTS12', rxFrequencyHz: PORT_HZ, txFrequencyHz: PORT_HZ })],
      { label: 'Dublin Port', category: 'transport' },
    ),
    group(
      'zz-cork',
      [entry({ channelId: 'ch-12', name: 'Cork Hbr Ch12', rxFrequencyHz: PORT_HZ, txFrequencyHz: PORT_HZ })],
      { label: 'Cork Harbour', category: 'transport' },
    ),
  ],
};

describe('buildPublicServiceImportPlan', () => {
  it('returns channels to add with name-skips and frequency advisories', () => {
    const library = emptyLibrary();
    library.channels = [
      { ...newChannel(PROJECT_ID, 'CG Ch16'), rxFrequency: 430_000_000, txFrequency: 430_000_000 },
      { ...newChannel(PROJECT_ID, 'Clyde CG'), rxFrequency: PORT_HZ, txFrequency: PORT_HZ },
    ];

    const plan = buildPublicServiceImportPlan(library, PROJECT_ID, COUNTRY, [
      'zz-distress',
      'zz-dublin',
    ]);

    expect(plan.channelsToAdd.map((ch) => ch.name)).toEqual(['Dublin VTS12']);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]?.reason).toBe('name');
    expect(plan.advisories).toHaveLength(1);
    expect(plan.advisories[0]?.existingName).toBe('Clyde CG');
    expect(plan.zones).toHaveLength(0);
  });

  it('creates one zone per selected group that adds channels', () => {
    const plan = buildPublicServiceImportPlan(
      emptyLibrary(),
      PROJECT_ID,
      COUNTRY,
      ['zz-dublin', 'zz-cork'],
      { alsoCreateZones: true },
    );

    expect(plan.channelsToAdd).toHaveLength(2);
    expect(plan.zones.map((zone) => zone.name)).toEqual(['Dublin Port', 'Cork Harbour']);
    expect(plan.zones[0]?.members).toHaveLength(1);
    expect(plan.zones[1]?.members).toHaveLength(1);
    const first = plan.zones[0]?.members[0];
    expect(first?.kind).toBe('channel');
    if (first?.kind === 'channel') {
      expect(first.channelId).toBe(plan.channelsToAdd[0]?.id);
    }
  });

  it('does not create a zone for a group whose channels are all skipped', () => {
    const library = emptyLibrary();
    library.channels = [
      { ...newChannel(PROJECT_ID, 'CG Ch16'), rxFrequency: 156_800_000, txFrequency: 156_800_000 },
    ];

    const plan = buildPublicServiceImportPlan(library, PROJECT_ID, COUNTRY, ['zz-distress'], {
      alsoCreateZones: true,
    });

    expect(plan.channelsToAdd).toHaveLength(0);
    expect(plan.zones).toHaveLength(0);
  });
});
