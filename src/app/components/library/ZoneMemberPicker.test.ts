import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import {
  channelMatchesZoneMemberFilter,
  computeZoneMemberPickerMapFilters,
} from './ZoneMemberPicker.tsx';

describe('channelMatchesZoneMemberFilter', () => {
  const projectId = 'proj-1';

  it('matches empty filter', () => {
    const ch = newChannel(projectId, 'Local');
    expect(channelMatchesZoneMemberFilter(ch, '')).toBe(true);
  });

  it('matches channel name', () => {
    const ch = { ...newChannel(projectId, 'Doncaster'), callsign: 'GB3DA' };
    expect(channelMatchesZoneMemberFilter(ch, 'don')).toBe(true);
  });

  it('matches callsign when name does not match', () => {
    const ch = { ...newChannel(projectId, 'Doncaster'), callsign: 'GB3DA' };
    expect(channelMatchesZoneMemberFilter(ch, 'gb3')).toBe(true);
    expect(channelMatchesZoneMemberFilter(ch, 'chester')).toBe(false);
  });
});

describe('computeZoneMemberPickerMapFilters', () => {
  const projectId = 'proj-1';

  it('hides available channels not matching callsign filter from map', () => {
    const channels = [
      { ...newChannel(projectId, 'Alpha'), callsign: 'GB3AA', id: 'a' },
      { ...newChannel(projectId, 'Bravo'), callsign: 'GB3BB', id: 'b' },
    ];
    const filters = computeZoneMemberPickerMapFilters(channels, [], 'gb3bb', '', true, true, [], []);
    expect(filters.hiddenMarkerChannelIds).toEqual(['a']);
  });

  it('hides in-zone members not matching callsign filter from map and hull', () => {
    const channels = [
      { ...newChannel(projectId, 'Alpha'), callsign: 'GB3AA', id: 'a' },
      { ...newChannel(projectId, 'Bravo'), callsign: 'GB3BB', id: 'b' },
    ];
    const filters = computeZoneMemberPickerMapFilters(
      channels,
      ['a', 'b'],
      '',
      'gb3aa',
      true,
      true,
      [
        { kind: 'channel', channelId: 'a' },
        { kind: 'channel', channelId: 'b' },
      ],
      [],
    );
    expect(filters.hiddenMarkerChannelIds).toEqual(['b']);
    expect(filters.hiddenZoneMemberIds).toEqual(['b']);
  });
});
