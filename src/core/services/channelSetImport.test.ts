import { describe, expect, it } from 'vitest';
import { emptyLibrary } from '@core/domain/factories.ts';
import { generateChannelsFromSet } from '@core/domain/channelSets/index.ts';
import { buildChannelSetImportPlan } from './channelSetImport.ts';

const PROJECT_ID = 'proj-1';

describe('buildChannelSetImportPlan', () => {
  it('returns channels to add and skipped duplicates', () => {
    const library = emptyLibrary();
    const existing = generateChannelsFromSet(PROJECT_ID, 'pmr446').slice(0, 2);
    library.channels = existing;

    const plan = buildChannelSetImportPlan(library, PROJECT_ID, 'pmr446');
    expect(plan.channelsToAdd).toHaveLength(14);
    expect(plan.skipped).toHaveLength(2);
    expect(plan.skipped.every((s) => s.reason === 'rx_hz')).toBe(true);
  });

  it('creates a zone when alsoCreateZone is set', () => {
    const plan = buildChannelSetImportPlan(emptyLibrary(), PROJECT_ID, 'uk-vhf-simplex-v', {
      alsoCreateZone: true,
      zoneName: 'VHF Simplex',
    });
    expect(plan.zone?.name).toBe('VHF Simplex');
    expect(plan.zone?.members).toHaveLength(plan.channelsToAdd.length);
    const firstMember = plan.zone?.members[0];
    expect(firstMember?.kind).toBe('channel');
    if (firstMember?.kind === 'channel') {
      expect(firstMember.channelId).toBe(plan.channelsToAdd[0]?.id);
    }
  });

  it('does not create a zone when all channels are skipped', () => {
    const library = emptyLibrary();
    library.channels = generateChannelsFromSet(PROJECT_ID, 'pmr446');

    const plan = buildChannelSetImportPlan(library, PROJECT_ID, 'pmr446', {
      alsoCreateZone: true,
    });
    expect(plan.channelsToAdd).toHaveLength(0);
    expect(plan.zone).toBeUndefined();
  });

  it('respects includedIndices', () => {
    const plan = buildChannelSetImportPlan(emptyLibrary(), PROJECT_ID, 'pmr446', {
      includedIndices: [0, 2],
    });
    expect(plan.channelsToAdd).toHaveLength(2);
    expect(plan.channelsToAdd[0]?.name).toBe('PMR446-1');
    expect(plan.channelsToAdd[1]?.name).toBe('PMR446-3');
  });
});
