import { describe, expect, it } from 'vitest';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { emptyLibrary, newChannel, newTalkGroup, newZone } from './factories.ts';
import { summariseLibrary } from './summary.ts';
import type {
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  Library,
} from '../models/library.ts';

const projectId = 'p1';

describe('summariseLibrary', () => {
  it('counts entities and groups channels by mode and band', () => {
    const fm = {
      ...newChannel(projectId, 'FM 2m'),
      rxFrequency: 145_500_000,
      modeProfiles: [defaultModeProfile('fm') as ChannelModeProfileAnalog],
    };
    const dmrProfile: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 1,
      dmrId: null,
      contactRef: null,
      rxGroupListId: null,
    };
    const dmr = {
      ...newChannel(projectId, 'DMR 70cm'),
      rxFrequency: 439_000_000,
      modeProfiles: [dmrProfile],
    };
    const library: Library = {
      ...emptyLibrary(),
      channels: [fm, dmr],
      talkGroups: [newTalkGroup(projectId, 'GB', 235)],
    };

    const summary = summariseLibrary(library);
    expect(summary.counts.channels).toBe(2);
    expect(summary.counts.talkGroups).toBe(1);
    expect(summary.channelsByMode).toContainEqual({ mode: 'FM', count: 1 });
    expect(summary.channelsByMode).toContainEqual({ mode: 'DMR', count: 1 });
    expect(summary.channelsByBand).toContainEqual({ band: '2 m', count: 1 });
    expect(summary.channelsByBand).toContainEqual({ band: '70 cm', count: 1 });
  });

  it('reports dangling references as integrity warnings', () => {
    const zone = {
      ...newZone(projectId, 'Ghosts'),
      members: [{ kind: 'channel' as const, channelId: 'missing' }],
    };
    const library: Library = { ...emptyLibrary(), zones: [zone] };

    const summary = summariseLibrary(library);
    expect(summary.danglingReferences).toHaveLength(1);
    expect(summary.danglingReferences[0]).toMatchObject({
      fromName: 'Ghosts',
      targetId: 'missing',
    });
  });
});
