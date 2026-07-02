import { describe, expect, it } from 'vitest';
import type { Channel, TalkGroup } from '@core/models/library.ts';
import { expandMultiTalkGroupMemberWireRows } from './multiTalkGroup.ts';

function channel(partial: Partial<Channel> & Pick<Channel, 'name' | 'callsign'>): Channel {
  return {
    id: 'ch-1',
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    rxFrequency: null,
    txFrequency: null,
    location: null,
    useLocation: false,
    maidenheadLocator: null,
    power: null,
    scanSkip: false,
    forbidTransmit: false,
    comment: '',
    modeProfiles: [],
    ...partial,
  };
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

describe('expandMultiTalkGroupMemberWireRows', () => {
  it('expands m×n: multi-mode site rows × one RX-list talk group member', () => {
    const tg = talkGroup({ name: 'Scotland TS2', digitalId: 950, abbreviation: 'Sco TS2' });
    const ch = channel({
      callsign: 'GB7GL',
      name: 'Glasgow',
      modeProfiles: [
        { mode: 'fm', squelch: 50, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 2,
          dmrId: 123,
          contactRef: null,
          rxGroupListId: 'rgl-1',
        },
      ],
    });
    const library = { talkGroups: [tg], digitalContacts: [] };

    const rows = expandMultiTalkGroupMemberWireRows(
      ch,
      [{ ref: { kind: 'talkGroup', id: tg.id }, timeSlotOverride: 2 }],
      library,
      undefined,
      true,
      {
        shortenNames: true,
        maxNameLength: 16,
        useTalkGroupAbbreviation: true,
        multiTalkGroupExportNameMode: 'callsign_tg_abbrev',
      },
      'opengd77-1701',
    );

    expect(rows).toHaveLength(2);
    const fmRow = rows.find((r) => r.mode === 'fm');
    const dmrRow = rows.find((r) => r.mode === 'dmr');
    expect(fmRow?.wireName).toBe('GB7GL-F Sco TS2');
    expect(dmrRow?.wireName).toBe('GB7GL-D Sco TS2');
    expect(dmrRow?.wireName.length).toBeLessThanOrEqual(16);
  });
});
