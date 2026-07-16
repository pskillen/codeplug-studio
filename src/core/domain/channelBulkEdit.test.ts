import { describe, expect, it } from 'vitest';
import type { Channel, ChannelModeProfile } from '../models/library.ts';
import { newChannel } from './factories.ts';
import { defaultModeProfile } from './modeProfiles.ts';
import {
  analyzeChannelBulkEditImpact,
  applyChannelBulkPatch,
  channelBulkEditWouldChange,
  countChannelsWithAnalogProfile,
} from './channelBulkEdit.ts';

const projectId = 'proj-bulk-edit';

function channelWithProfiles(name: string, modeProfiles: ChannelModeProfile[]): Channel {
  return { ...newChannel(projectId, name), modeProfiles };
}

describe('applyChannelBulkPatch', () => {
  it('applies only enabled channel-level keys', () => {
    const channel: Channel = {
      ...newChannel(projectId, 'Local'),
      scanInclusion: 'default' as const,
      forbidTransmit: 'default' as const,
      power: 50,
    };

    const patched = applyChannelBulkPatch(channel, {
      scanInclusion: 'skip',
      power: 75,
    });

    expect(patched.scanInclusion).toBe('skip');
    expect(patched.power).toBe(75);
    expect(patched.forbidTransmit).toBe('default');
  });

  it('updates squelch on all analog profiles', () => {
    const channel = channelWithProfiles('Analog mix', [
      defaultModeProfile('fm'),
      defaultModeProfile('am'),
      defaultModeProfile('dmr'),
    ]);

    const patched = applyChannelBulkPatch(channel, { analogSquelch: 25 });

    const fm = patched.modeProfiles.find((p) => p.mode === 'fm');
    const am = patched.modeProfiles.find((p) => p.mode === 'am');
    const dmr = patched.modeProfiles.find((p) => p.mode === 'dmr');

    expect(fm).toMatchObject({ squelch: 25 });
    expect(am).toMatchObject({ squelch: 25 });
    expect(dmr).toMatchObject({ mode: 'dmr' });
  });

  it('leaves DMR-only channel unchanged when patching analog squelch', () => {
    const channel = channelWithProfiles('DMR only', [defaultModeProfile('dmr')]);
    const patched = applyChannelBulkPatch(channel, { analogSquelch: 50 });
    expect(patched).toEqual(channel);
  });
});

describe('channelBulkEditWouldChange', () => {
  it('returns false when values already match', () => {
    const channel: Channel = {
      ...newChannel(projectId, 'Local'),
      scanInclusion: 'skip' as const,
      power: 50,
    };

    expect(channelBulkEditWouldChange(channel, { scanInclusion: 'skip', power: 50 })).toBe(false);
  });

  it('returns false for analog squelch on DMR-only channel', () => {
    const channel = channelWithProfiles('DMR', [defaultModeProfile('dmr')]);
    expect(channelBulkEditWouldChange(channel, { analogSquelch: 50 })).toBe(false);
  });
});

describe('analyzeChannelBulkEditImpact', () => {
  it('counts channel-level fields for all selected channels', () => {
    const channels = [newChannel(projectId, 'A'), newChannel(projectId, 'B')];

    expect(analyzeChannelBulkEditImpact(channels, { scanInclusion: 'alwaysScan' })).toEqual({
      scanInclusion: { appliesTo: 2, skipped: 0 },
    });
  });

  it('counts analog squelch skips for channels without analog profiles', () => {
    const channels = [
      channelWithProfiles('FM', [defaultModeProfile('fm')]),
      channelWithProfiles('DMR', [defaultModeProfile('dmr')]),
      channelWithProfiles('Empty', []),
    ];

    expect(analyzeChannelBulkEditImpact(channels, { analogSquelch: 25 })).toEqual({
      analogSquelch: {
        appliesTo: 1,
        skipped: 2,
        skipReason: 'no_analog_profile',
      },
    });
  });
});

describe('countChannelsWithAnalogProfile', () => {
  it('counts mixed selection', () => {
    const channels = [
      channelWithProfiles('FM', [defaultModeProfile('fm')]),
      channelWithProfiles('DMR', [defaultModeProfile('dmr')]),
    ];
    expect(countChannelsWithAnalogProfile(channels)).toBe(1);
  });
});
