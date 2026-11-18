import { describe, expect, it } from 'vitest';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { channelFromMappedRead, mapReadChannel } from './mapReadChannel.ts';
import { planReadChannelUpsert } from './upsertReadChannels.ts';

const read = mapReadChannel({
  slotIndex: 1,
  empty: false,
  wireName: 'Test',
  rxHz: 145500000,
  txHz: 145500000,
  rxTone: { kind: 'ctcss', hz: 110.9 },
  txTone: { kind: 'dcs', code: 23 },
  powerPercent: 20,
  bandwidth: 'NFM',
  scanAdd: true,
})!;
const channel = () => channelFromMappedRead('p', read);

describe('planReadChannelUpsert', () => {
  it('creates in order and re-reading is unchanged', () => {
    const plan = planReadChannelUpsert({ channels: [] }, 'p', [read, { ...read, slot: 2 }]);
    expect(plan.creates.map((c) => c.slot)).toEqual([1, 2]);
    expect(plan.creates[0].channel.power).toBe(20);
    expect(plan.slotToChannelId.size).toBe(2);
    expect(
      planReadChannelUpsert({ channels: plan.creates.map((c) => c.channel) }, 'p', [
        read,
        { ...read, slot: 2 },
      ]).unchanged,
    ).toHaveLength(2);
  });
  it('updates tones and other fields but preserves power and unrelated data', () => {
    const before = Object.freeze({
      ...channel(),
      callsign: 'CALL',
      comment: 'kept',
      power: 50,
      scanInclusion: 'skip' as const,
      modeProfiles: [
        {
          ...defaultModeProfile('fm'),
          rxTone: '88.5' as const,
          txTone: 'none' as const,
          bandwidthKHz: 25 as const,
        },
      ],
    });
    const result = planReadChannelUpsert({ channels: [before] }, 'p', [read]);
    expect(result.updates[0].changedFields).toEqual([
      'rxTone',
      'txTone',
      'bandwidth',
      'scanInclusion',
    ]);
    expect(result.updates[0].after).toMatchObject({
      callsign: 'CALL',
      comment: 'kept',
      power: 50,
      modeProfiles: [{ rxTone: '110.9', txTone: 'D023N', bandwidthKHz: 12.5 }],
    });
  });
  it('adds the read mode without removing existing modes', () => {
    for (const mode of ['dmr', 'am'] as const) {
      const profile = defaultModeProfile(mode);
      const before = { ...channel(), modeProfiles: [profile], primaryMode: mode };
      const update = planReadChannelUpsert({ channels: [before] }, 'p', [read]).updates[0];
      expect(update.changedFields).toContain('mode');
      expect(update.after.modeProfiles).toEqual([profile, channel().modeProfiles[0]]);
      expect(update.after.primaryMode).toBe(mode);
    }
  });
  it('prefers library name, claims each row once and handles duplicate slots', () => {
    const derived = { ...channel(), name: 'Other' };
    const exact = channel();
    const plan = planReadChannelUpsert({ channels: [derived, exact] }, 'p', [read, read], {
      nameCandidatesByChannelId: new Map([[derived.id, ['Test']]]),
    });
    expect(plan.unchanged[0].channelId).toBe(exact.id);
    expect(plan.unchanged[1].matchedBy).toBe('shortened-name');
    expect(plan.slotToChannelId.get(1)).toBe(derived.id);
    expect(
      planReadChannelUpsert({ channels: [exact] }, 'p', [read, { ...read, slot: 2 }]).creates,
    ).toHaveLength(1);
  });
  it('requires both frequencies and a matching name, treating null TX as RX', () => {
    const c = { ...channel(), txFrequency: null };
    expect(planReadChannelUpsert({ channels: [c] }, 'p', [read]).unchanged).toHaveLength(1);
    for (const other of [
      { ...c, rxFrequency: null },
      { ...c, txFrequency: 1 },
      { ...c, name: 'other' },
    ])
      expect(planReadChannelUpsert({ channels: [other] }, 'p', [read]).creates).toHaveLength(1);
  });
});
