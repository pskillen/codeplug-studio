import { describe, expect, it } from 'vitest';
import { emptyLibrary, newDigitalContact, newTalkGroup } from '@core/domain/factories.ts';
import { entityRefKey } from './entityRefs.ts';
import {
  applyTimeslotSegment,
  formatTimeSlotOverride,
  memberOptionMatchesFilter,
  memberSupportsTimeSlotOverride,
  resolveRxGroupListMemberDisplay,
  timeslotSegmentValue,
} from './rxGroupListMembers.ts';

describe('entityRefKey', () => {
  it('combines kind and id', () => {
    expect(entityRefKey({ kind: 'talkGroup', id: 'tg-1' })).toBe('talkGroup:tg-1');
  });
});

describe('formatTimeSlotOverride', () => {
  it('formats typed slots and unset', () => {
    expect(formatTimeSlotOverride(1)).toBe('TS1');
    expect(formatTimeSlotOverride(2)).toBe('TS2');
    expect(formatTimeSlotOverride(null)).toBe('—');
    expect(formatTimeSlotOverride(undefined)).toBe('—');
  });
});

describe('memberSupportsTimeSlotOverride', () => {
  it('allows talk groups and DMR digital contacts only', () => {
    const library = {
      ...emptyLibrary(),
      talkGroups: [newTalkGroup('p1', 'Scotland', 123)],
      digitalContacts: [
        newDigitalContact('p1', 'DMR User', 456, 'dmr'),
        newDigitalContact('p1', 'D-Star User', 789, 'dstar'),
      ],
    };
    const tg = library.talkGroups[0]!;
    const dmr = library.digitalContacts[0]!;
    const dstar = library.digitalContacts[1]!;

    expect(memberSupportsTimeSlotOverride({ ref: { kind: 'talkGroup', id: tg.id } }, library)).toBe(
      true,
    );
    expect(
      memberSupportsTimeSlotOverride({ ref: { kind: 'digitalContact', id: dmr.id } }, library),
    ).toBe(true);
    expect(
      memberSupportsTimeSlotOverride({ ref: { kind: 'digitalContact', id: dstar.id } }, library),
    ).toBe(false);
  });
});

describe('resolveRxGroupListMemberDisplay', () => {
  it('resolves talk group and digital contact members', () => {
    const library = {
      ...emptyLibrary(),
      talkGroups: [newTalkGroup('p1', 'Scotland', 950)],
      digitalContacts: [newDigitalContact('p1', 'Local', 1234567, 'dmr')],
    };
    const tg = library.talkGroups[0]!;
    const dc = library.digitalContacts[0]!;

    expect(
      resolveRxGroupListMemberDisplay(
        { ref: { kind: 'talkGroup', id: tg.id }, timeSlotOverride: 2 },
        library,
      ),
    ).toEqual({
      ref: { kind: 'talkGroup', id: tg.id },
      name: 'Scotland',
      kindLabel: 'Talk group',
      digitalId: 950,
      timeSlotOverride: 2,
      brokenRef: false,
    });

    expect(
      resolveRxGroupListMemberDisplay({ ref: { kind: 'digitalContact', id: dc.id } }, library),
    ).toMatchObject({
      name: 'Local',
      kindLabel: 'Digital contact',
      digitalId: 1234567,
      brokenRef: false,
    });
  });

  it('flags missing refs', () => {
    const library = emptyLibrary();
    expect(
      resolveRxGroupListMemberDisplay({ ref: { kind: 'talkGroup', id: 'missing' } }, library),
    ).toMatchObject({
      name: 'Missing talk group',
      brokenRef: true,
    });
    expect(
      resolveRxGroupListMemberDisplay({ ref: { kind: 'digitalContact', id: 'missing' } }, library),
    ).toMatchObject({
      name: 'Missing digital contact',
      brokenRef: true,
    });
  });
});

describe('applyTimeslotSegment', () => {
  const member = { ref: { kind: 'talkGroup' as const, id: 'tg-1' }, timeSlotOverride: 2 as const };

  it('sets and clears typed slot values', () => {
    expect(applyTimeslotSegment(member, '1')).toEqual({
      ref: { kind: 'talkGroup', id: 'tg-1' },
      timeSlotOverride: 1,
    });
    expect(applyTimeslotSegment(member, 'auto')).toEqual({
      ref: { kind: 'talkGroup', id: 'tg-1' },
    });
    expect(timeslotSegmentValue(member)).toBe('2');
    expect(timeslotSegmentValue({ ref: { kind: 'talkGroup', id: 'tg-1' } })).toBe('auto');
  });
});

describe('memberOptionMatchesFilter', () => {
  it('matches name or digital id', () => {
    expect(memberOptionMatchesFilter('Scotland', 950, 'scot')).toBe(true);
    expect(memberOptionMatchesFilter('Scotland', 950, '950')).toBe(true);
    expect(memberOptionMatchesFilter('Scotland', 950, 'wales')).toBe(false);
  });
});
