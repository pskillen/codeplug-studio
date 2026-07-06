import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import {
  directZoneMemberChannelIds,
  formatZoneDirectMemberSummary,
  normalizeZoneMemberEntry,
} from './zoneMembers.ts';

function zone(members: Zone['members']): Zone {
  return {
    id: 'z1',
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test',
    members,
    comment: '',
  };
}

describe('normalizeZoneMemberEntry', () => {
  it('accepts legacy channelId-only shape', () => {
    expect(normalizeZoneMemberEntry({ channelId: 'ch-a' })).toEqual({
      kind: 'channel',
      channelId: 'ch-a',
    });
  });

  it('accepts discriminated channel and zone members', () => {
    expect(normalizeZoneMemberEntry({ kind: 'channel', channelId: 'ch-a' })).toEqual({
      kind: 'channel',
      channelId: 'ch-a',
    });
    expect(normalizeZoneMemberEntry({ kind: 'zone', zoneId: 'z-child' })).toEqual({
      kind: 'zone',
      zoneId: 'z-child',
    });
  });
});

describe('directZoneMemberChannelIds', () => {
  it('reads channelId from ZoneMemberEntry', () => {
    expect(
      directZoneMemberChannelIds(
        zone([
          { kind: 'channel', channelId: 'ch-a' },
          { kind: 'channel', channelId: 'ch-b' },
        ]),
      ),
    ).toEqual(['ch-a', 'ch-b']);
  });

  it('normalizes legacy EntityRef members on read', () => {
    expect(
      directZoneMemberChannelIds(
        zone([
          { kind: 'channel', id: 'ch-a' } as unknown as Zone['members'][number],
          { channelId: 'ch-b' } as unknown as Zone['members'][number],
        ]),
      ),
    ).toEqual(['ch-a', 'ch-b']);
  });
});

describe('formatZoneDirectMemberSummary', () => {
  it('formats channels only', () => {
    expect(formatZoneDirectMemberSummary(zone([{ kind: 'channel', channelId: 'ch-a' }]))).toBe(
      '1 channel',
    );
    expect(
      formatZoneDirectMemberSummary(
        zone([
          { kind: 'channel', channelId: 'ch-a' },
          { kind: 'channel', channelId: 'ch-b' },
        ]),
      ),
    ).toBe('2 channels');
  });

  it('formats zones only', () => {
    expect(formatZoneDirectMemberSummary(zone([{ kind: 'zone', zoneId: 'z-child' }]))).toBe(
      '1 zone',
    );
  });

  it('formats mixed channel and zone members', () => {
    expect(
      formatZoneDirectMemberSummary(
        zone([
          { kind: 'channel', channelId: 'ch-a' },
          { kind: 'zone', zoneId: 'z-child' },
          { kind: 'zone', zoneId: 'z-other' },
        ]),
      ),
    ).toBe('1 channel + 2 zones');
  });

  it('returns No members when empty', () => {
    expect(formatZoneDirectMemberSummary(zone([]))).toBe('No members');
  });
});
