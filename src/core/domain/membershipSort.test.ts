import { describe, expect, it } from 'vitest';
import { newChannel, newDigitalContact, newTalkGroup, newZone } from '@core/domain/factories.ts';
import {
  buildExportSortConfirmMessage,
  buildExportSortSelectionConfirmMessage,
  sortChannelIdsByMode,
  sortRxGroupListMembersByMode,
  sortSelectedChannelIdsInOrder,
  sortZoneMembersByMode,
  sortZonesByName,
} from './membershipSort.ts';

describe('membershipSort', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';

  it('sorts channel ids by name', () => {
    const a = { ...newChannel(projectId, 'Bravo'), id: 'a' };
    const b = { ...newChannel(projectId, 'Alpha'), id: 'b' };
    const byId = new Map([
      [a.id, a],
      [b.id, b],
    ]);
    expect(sortChannelIdsByMode(['a', 'b'], byId, 'name')).toEqual(['b', 'a']);
  });

  it('sorts simplex before split', () => {
    const simplex = {
      ...newChannel(projectId, 'S'),
      id: 's',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    const split = {
      ...newChannel(projectId, 'R'),
      id: 'r',
      rxFrequency: 145_600_000,
      txFrequency: 145_000_000,
    };
    const byId = new Map([
      [simplex.id, simplex],
      [split.id, split],
    ]);
    expect(sortChannelIdsByMode(['r', 's'], byId, 'duplex')).toEqual(['s', 'r']);
  });

  it('sorts zone members and places channels before nested zones', () => {
    const ch = { ...newChannel(projectId, 'Zulu'), id: 'ch-1' };
    const nested = { ...newZone(projectId, 'Alpha'), id: 'zone-nested' };
    const members = [
      { kind: 'zone' as const, zoneId: nested.id },
      { kind: 'channel' as const, channelId: ch.id },
    ];
    const next = sortZoneMembersByMode(
      members,
      new Map([[ch.id, ch]]),
      new Map([[nested.id, nested]]),
      'name',
    );
    expect(next[0]).toEqual({ kind: 'channel', channelId: 'ch-1' });
    expect(next[1]).toEqual({ kind: 'zone', zoneId: 'zone-nested' });
  });

  it('sortZonesByName applies dense order', () => {
    const zones = [
      { ...newZone(projectId, 'Zulu'), id: 'z' },
      { ...newZone(projectId, 'Alpha'), id: 'a' },
    ];
    const next = sortZonesByName(zones);
    expect(next.find((z) => z.id === 'a')?.order).toBe(1);
    expect(next.find((z) => z.id === 'z')?.order).toBe(2);
  });

  it('sorts RGL members by name and preserves timeSlotOverride', () => {
    const tgA = { ...newTalkGroup(projectId, 'Zulu', 1), id: 'tg-a' };
    const tgB = { ...newTalkGroup(projectId, 'Alpha', 2), id: 'tg-b' };
    const members = [
      { ref: { kind: 'talkGroup' as const, id: tgA.id }, timeSlotOverride: 2 as const },
      { ref: { kind: 'talkGroup' as const, id: tgB.id } },
    ];
    const next = sortRxGroupListMembersByMode(
      members,
      new Map([
        [tgA.id, tgA],
        [tgB.id, tgB],
      ]),
      new Map(),
      'name',
    );
    expect(next.map((m) => m.ref.id)).toEqual([tgB.id, tgA.id]);
    expect(next[1]?.timeSlotOverride).toBe(2);
  });

  it('sorts RGL members by digital contact callsign when mode is callsign', () => {
    const dcZ = {
      ...newDigitalContact(projectId, 'Contact Z', 100),
      id: 'dc-z',
      callsign: 'ZZ9ZZ',
    };
    const dcA = {
      ...newDigitalContact(projectId, 'Contact A', 101),
      id: 'dc-a',
      callsign: 'AA1AA',
    };
    const members = [
      { ref: { kind: 'digitalContact' as const, id: dcZ.id } },
      { ref: { kind: 'digitalContact' as const, id: dcA.id } },
    ];
    const next = sortRxGroupListMembersByMode(
      members,
      new Map(),
      new Map([
        [dcZ.id, dcZ],
        [dcA.id, dcA],
      ]),
      'callsign',
    );
    expect(next.map((m) => m.ref.id)).toEqual([dcA.id, dcZ.id]);
  });

  it('buildExportSortConfirmMessage mentions build-only scope', () => {
    const message = buildExportSortConfirmMessage('name');
    expect(message).toContain('this radio build');
    expect(message).toContain('library order stays the same');
  });

  it('buildExportSortSelectionConfirmMessage mentions selection count and collate', () => {
    const message = buildExportSortSelectionConfirmMessage('band', 4);
    expect(message).toContain('4 selected');
    expect(message).toContain('brought together');
    expect(message).toContain('library order stays the same');
  });

  it('sortSelectedChannelIdsInOrder collates split selection then sorts the block', () => {
    const alpha = { ...newChannel(projectId, 'Alpha'), id: 'alpha' };
    const bravo = { ...newChannel(projectId, 'Bravo'), id: 'bravo' };
    const charlie = { ...newChannel(projectId, 'Charlie'), id: 'charlie' };
    const delta = { ...newChannel(projectId, 'Delta'), id: 'delta' };
    const echo = { ...newChannel(projectId, 'Echo'), id: 'echo' };
    const byId = new Map([
      [alpha.id, alpha],
      [bravo.id, bravo],
      [charlie.id, charlie],
      [delta.id, delta],
      [echo.id, echo],
    ]);
    // Order: alpha, echo, charlie, bravo, delta — select echo + bravo (split)
    const ordered = ['alpha', 'echo', 'charlie', 'bravo', 'delta'];
    expect(sortSelectedChannelIdsInOrder(ordered, ['echo', 'bravo'], byId, 'name')).toEqual([
      'alpha',
      'bravo',
      'echo',
      'charlie',
      'delta',
    ]);
  });

  it('sortSelectedChannelIdsInOrder is identity for contiguous already-sorted selection', () => {
    const a = { ...newChannel(projectId, 'A'), id: 'a' };
    const b = { ...newChannel(projectId, 'B'), id: 'b' };
    const c = { ...newChannel(projectId, 'C'), id: 'c' };
    const byId = new Map([
      [a.id, a],
      [b.id, b],
      [c.id, c],
    ]);
    const ordered = ['a', 'b', 'c'];
    expect(sortSelectedChannelIdsInOrder(ordered, ['a', 'b'], byId, 'name')).toEqual(ordered);
  });

  it('sortSelectedChannelIdsInOrder is identity when fewer than 2 selected', () => {
    const a = { ...newChannel(projectId, 'A'), id: 'a' };
    const b = { ...newChannel(projectId, 'B'), id: 'b' };
    const byId = new Map([
      [a.id, a],
      [b.id, b],
    ]);
    expect(sortSelectedChannelIdsInOrder(['a', 'b'], ['b'], byId, 'name')).toEqual(['a', 'b']);
    expect(sortSelectedChannelIdsInOrder(['a', 'b'], [], byId, 'name')).toEqual(['a', 'b']);
  });
});
