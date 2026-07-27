import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newFormatBuild,
  newProjectMeta,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import { assemble } from '@core/services/assemble.ts';
import {
  buildTalkGroupTimeslotCloneIndex,
  collectTalkGroupSlotDemand,
  composeTalkGroupCloneWireName,
  profileHasTalkGroupTimeslotClones,
  resolveTalkGroupRxMemberSlot,
  resolveTalkGroupTxSlot,
} from './talkGroupTimeslotClones.ts';

const PROJECT_ID = newProjectMeta('P').id;

function dmrChannel(
  name: string,
  contactRef: { kind: 'talkGroup'; id: string },
  timeslot: 1 | 2,
  rxGroupListId: string | null = null,
) {
  const ch = newChannel(PROJECT_ID, name, 430_000_000, 430_000_000);
  const dmr: ChannelModeProfileDMR = {
    mode: 'dmr',
    colourCode: 1,
    timeslot,
    dmrId: null,
    contactRef,
    rxGroupListId,
  };
  return { ...ch, modeProfiles: [dmr], primaryMode: 'dmr' as const };
}

describe('talkGroupTimeslotClones', () => {
  it('gates on OpenGD77 profiles only', () => {
    expect(profileHasTalkGroupTimeslotClones('opengd77-1701')).toBe(true);
    expect(profileHasTalkGroupTimeslotClones('radio-io-opengd77-1701')).toBe(true);
    expect(profileHasTalkGroupTimeslotClones('dm32-baofeng-dm32uv')).toBe(false);
    expect(profileHasTalkGroupTimeslotClones('anytone-at-d890uv')).toBe(false);
  });

  it('resolves TX slot from channel timeslot', () => {
    expect(resolveTalkGroupTxSlot(2)).toBe(2);
    expect(resolveTalkGroupTxSlot(1)).toBe(1);
    expect(resolveTalkGroupTxSlot(null)).toBe(1);
  });

  it('resolves RX member slot from override or TS1 default', () => {
    expect(resolveTalkGroupRxMemberSlot(2)).toBe(2);
    expect(resolveTalkGroupRxMemberSlot(1)).toBe(1);
    expect(resolveTalkGroupRxMemberSlot(null)).toBe(1);
    expect(resolveTalkGroupRxMemberSlot(undefined)).toBe(1);
  });

  it('collects demanded slots from TX and RGL members', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland', 2355);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg.id }, timeSlotOverride: 2 as const },
        { ref: { kind: 'talkGroup' as const, id: tg.id }, timeSlotOverride: 1 as const },
      ],
    };
    const channel = dmrChannel('Glasgow', { kind: 'talkGroup', id: tg.id }, 1, rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'opengd77-1701');
    const assembled = assemble(build, {
      channels: [channel],
      zones: [],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    });

    const demand = collectTalkGroupSlotDemand(assembled);
    expect([...demand.get(tg.id)!].sort()).toEqual([1, 2]);
  });

  it('emits only referenced clones with TS suffix wire names', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland 2355', 2355);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg.id }, timeSlotOverride: 2 as const },
      ],
    };
    const channel = dmrChannel('Glasgow', { kind: 'talkGroup', id: tg.id }, 1, rgl.id);
    const assembled = {
      buildId: 'b1',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
      buildName: 'Test',
      channels: [{ entity: channel, wireName: channel.name }],
      zones: [],
      scanLists: [],
      talkGroups: [{ entity: tg, wireName: tg.name }],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [{ entity: rgl, wireName: rgl.name }],
    };

    const baseNames = new Map([[tg.id, 'Scotland 2355']]);
    const index = buildTalkGroupTimeslotCloneIndex(assembled, baseNames);
    expect(index.clones).toHaveLength(2);
    expect(index.clones.map((c) => c.wireName).sort()).toEqual([
      'Scotland 2355 TS1',
      'Scotland 2355 TS2',
    ]);
    expect(index.wireNameFor(tg.id, 2)).toBe('Scotland 2355 TS2');
  });

  it('shortens base before TS suffix when over name limit', () => {
    const reserved = new Set<string>();
    const name = composeTalkGroupCloneWireName(
      'Very Long Scotland Name',
      2,
      reserved,
      16,
    );
    expect(name).toMatch(/TS2$/);
    expect(name.length).toBeLessThanOrEqual(16);
  });

  it('defaults unlinked-only talk groups to a single TS1 clone', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Lonely', 99);
    const build = newFormatBuild(PROJECT_ID, 'opengd77-1701');
    const assembled = assemble(build, {
      channels: [],
      zones: [],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    });
    const baseNames = new Map([[tg.id, 'Lonely']]);
    const index = buildTalkGroupTimeslotCloneIndex(assembled, baseNames);
    expect(index.clones).toHaveLength(1);
    expect(index.clones[0]?.slot).toBe(1);
    expect(index.clones[0]?.wireName).toBe('Lonely TS1');
  });
});
