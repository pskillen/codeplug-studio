import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { newFormatBuild } from '@core/domain/factories.ts';
import { previewGeneratedChannelWireName } from './previewChannelWireName.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('previewGeneratedChannelWireName', () => {
  it('respects export name mode from build settings', () => {
    const channel: Channel = {
      ...newChannel(projectId, 'Glasgow West'),
      callsign: 'GB3GL',
      modeProfiles: [
        {
          mode: 'fm' as const,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          squelch: null,
          bandwidthKHz: 12.5,
        },
      ],
    };
    const build = {
      ...newFormatBuild(projectId, 'chirp-uv5r'),
      exportSettings: { nameModeOverride: 'name_only' as const, shortenNames: false },
    };

    expect(previewGeneratedChannelWireName(channel, build)).toBe('Glasgow West');
  });

  it('shortens to CHIRP UV-5R name limit when shortenNames is enabled', () => {
    const channel: Channel = {
      ...newChannel(projectId, 'Glasgow Scotland West'),
      callsign: 'GB3GL',
      modeProfiles: [
        {
          mode: 'fm' as const,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          squelch: null,
          bandwidthKHz: 12.5,
        },
      ],
    };
    const build = newFormatBuild(projectId, 'chirp-uv5r');

    const wireName = previewGeneratedChannelWireName(channel, build);
    expect(wireName.length).toBeLessThanOrEqual(12);
    expect(wireName).toBeTruthy();
  });

  it('shortens to Anytone AT-D890UV name limit when shortenNames is enabled', () => {
    const channel: Channel = {
      ...newChannel(projectId, 'Glasgow Scotland West Repeater'),
      callsign: 'GB3GL',
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 2 as const,
          dmrId: 1234567,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    };
    const build = newFormatBuild(projectId, 'anytone-at-d890uv');

    const wireName = previewGeneratedChannelWireName(channel, build);
    expect(wireName.length).toBeLessThanOrEqual(16);
    expect(wireName).toBeTruthy();
  });
});
