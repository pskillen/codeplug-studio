import { describe, expect, it } from 'vitest';
import type { Channel, DigitalContact, TalkGroup } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import {
  composeMultiTalkGroupWireName,
  multiTalkGroupProtectedSuffix,
} from './multiTalkGroupWireName.ts';
import { applyMultiTalkGroupWireNameLimits } from './multiTalkGroup.ts';

function channel(partial: Partial<Channel> & Pick<Channel, 'name' | 'callsign'>): Channel {
  return { ...newChannel('p1', partial.name, partial.callsign), ...partial };
}

function talkGroup(partial: Partial<TalkGroup> & Pick<TalkGroup, 'name' | 'digitalId'>): TalkGroup {
  return {
    id: 'tg-1',
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'dmr',
    comment: '',
    ...partial,
  };
}

describe('composeMultiTalkGroupWireName', () => {
  it('composes callsign + TG abbrev when mode is callsign_tg_abbrev', () => {
    const ch = channel({ callsign: 'GB7GL', name: 'Glasgow' });
    const tg = talkGroup({ name: 'Scotland TS2', digitalId: 950, abbreviation: 'Sco TS2' });
    const member = { kind: 'talkGroup' as const, id: tg.id };
    const composed = composeMultiTalkGroupWireName(ch, member, 'callsign_tg_abbrev', {
      talkGroups: [tg],
      digitalContacts: [],
      useTalkGroupAbbreviation: true,
      siteWireName: 'GB7GL Glasgow-D',
    });
    expect(composed).toBe('GB7GL-D Sco TS2');
  });

  it('composes callsign + TG number without timeslot in suffix_tg_number mode', () => {
    const ch = channel({ callsign: 'GB7GL', name: 'Glasgow' });
    const tg = talkGroup({ name: 'Scotland TS2', digitalId: 950 });
    const member = { kind: 'talkGroup' as const, id: tg.id };
    const composed = composeMultiTalkGroupWireName(ch, member, 'suffix_tg_number', {
      talkGroups: [tg],
      digitalContacts: [],
      memberTimeSlotOverride: 2,
      siteWireName: 'GB7GL',
    });
    expect(composed).toBe('GL 950');
  });

  it('derives no-callsign suffix from channel abbreviation, not disambiguated site wire name', () => {
    const ch = channel({ callsign: '', name: 'Hotspot', abbreviation: 'Hspt' });
    const tg = talkGroup({ name: 'TG 2357910', digitalId: 2357910 });
    const member = { kind: 'talkGroup' as const, id: tg.id };
    const composed = composeMultiTalkGroupWireName(ch, member, 'suffix_tg_number', {
      talkGroups: [tg],
      digitalContacts: [],
      siteWireName: 'Hspt 2',
    });
    expect(composed).toBe('PT 2357910');
    expect(composed).not.toMatch(/^\s+\d/);
  });
});

describe('applyMultiTalkGroupWireNameLimits', () => {
  it('prefers TG abbreviation over dictionary shortening for long composed names', () => {
    const ch = channel({ callsign: 'GB7GL', name: 'Glasgow' });
    const tg = talkGroup({ name: 'Scotland TS2', digitalId: 950, abbreviation: 'Sco TS2' });
    const member = { kind: 'talkGroup' as const, id: tg.id };
    const library = { talkGroups: [tg], digitalContacts: [] as DigitalContact[] };
    const reserved = new Set<string>();
    const warnings: string[] = [];

    const wireName = applyMultiTalkGroupWireNameLimits(
      ch,
      member,
      library,
      'GB7GL Glasgow-D',
      2,
      reserved,
      {
        shortenNames: true,
        maxNameLength: 16,
        useTalkGroupAbbreviation: true,
        multiTalkGroupExportNameMode: 'callsign_name_tg',
      },
      'opengd77-1701',
      warnings,
    );

    expect(wireName).toBe('GB7GL-D Sco TS2');
    expect(wireName.length).toBeLessThanOrEqual(16);
  });

  it('uses append-mode talkGroupMemberSuffix when abbrev differs from full name', () => {
    const ch = channel({ callsign: 'GB7AC', name: 'Largs' });
    const tg = talkGroup({ name: 'Scot West TS1', digitalId: 950, abbreviation: 'SW1' });
    const member = { kind: 'talkGroup' as const, id: tg.id };
    const library = { talkGroups: [tg], digitalContacts: [] };
    const reserved = new Set<string>();

    const wireName = applyMultiTalkGroupWireNameLimits(
      ch,
      member,
      library,
      'GB7AC Largs',
      null,
      reserved,
      {
        shortenNames: true,
        maxNameLength: 20,
        useTalkGroupAbbreviation: true,
        multiTalkGroupExportNameMode: 'append',
      },
      undefined,
      [],
    );

    expect(wireName).toBe('GB7AC Largs SW1');
  });

  it('does not apply talkGroupMemberSuffix in append mode when useTalkGroupAbbreviation is false', () => {
    const ch = channel({ callsign: 'GB7AC', name: 'Largs' });
    const tg = talkGroup({ name: 'Scot West TS1', digitalId: 950, abbreviation: 'SW1' });
    const member = { kind: 'talkGroup' as const, id: tg.id };
    const library = { talkGroups: [tg], digitalContacts: [] };

    const withAbbrev = applyMultiTalkGroupWireNameLimits(
      ch,
      member,
      library,
      'GB7AC Largs',
      null,
      new Set<string>(),
      {
        shortenNames: true,
        maxNameLength: 24,
        useTalkGroupAbbreviation: true,
        multiTalkGroupExportNameMode: 'append',
      },
      undefined,
      [],
    );

    const withoutAbbrev = applyMultiTalkGroupWireNameLimits(
      ch,
      member,
      library,
      'GB7AC Largs',
      null,
      new Set<string>(),
      {
        shortenNames: true,
        maxNameLength: 24,
        useTalkGroupAbbreviation: false,
        multiTalkGroupExportNameMode: 'append',
      },
      undefined,
      [],
    );

    expect(withAbbrev).toBe('GB7AC Largs SW1');
    expect(withoutAbbrev).not.toContain(' SW1');
    expect(withoutAbbrev).not.toBe(withAbbrev);
  });
});

describe('multiTalkGroupProtectedSuffix', () => {
  it('returns abbreviated TG label for callsign_tg_abbrev mode', () => {
    const ch = channel({ callsign: 'GB7GL', name: 'Glasgow' });
    const tg = talkGroup({ name: 'Scotland TS2', digitalId: 950, abbreviation: 'Sco TS2' });
    const member = { kind: 'talkGroup' as const, id: tg.id };
    const suffix = multiTalkGroupProtectedSuffix(ch, member, 'callsign_tg_abbrev', {
      talkGroups: [tg],
      digitalContacts: [],
      useTalkGroupAbbreviation: true,
    });
    expect(suffix).toBe(' Sco TS2');
  });
});
