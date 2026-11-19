import { describe, expect, it } from 'vitest';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import {
  applyMappedReadToChannel,
  channelFromMappedRead,
  mapReadChannel,
  mapReadChannels,
  readToneToChannelTone,
} from './mapReadChannel.ts';
import type { ReadChannelInput } from './types.ts';

const input: ReadChannelInput = {
  slotIndex: 3,
  empty: false,
  wireName: ' Test ',
  rxHz: 145500000,
  txHz: 145000000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: 20,
  bandwidth: 'NFM',
  scanAdd: true,
};
const mapped = () => mapReadChannel(input)!;

describe('radio read mapping', () => {
  it('skips empty and invalid slots and preserves order', () => {
    expect(mapReadChannel({ ...input, empty: true })).toBeNull();
    expect(mapReadChannel({ ...input, rxHz: 0 })).toBeNull();
    expect(
      mapReadChannels([input, { ...input, rxHz: -1 }, { ...input, slotIndex: 1 }]).map(
        (x) => x.slot,
      ),
    ).toEqual([3, 1]);
  });
  it('formats decoded tones', () => {
    expect([
      readToneToChannelTone({ kind: 'none' }),
      readToneToChannelTone({ kind: 'ctcss', hz: 88.5 }),
      readToneToChannelTone({ kind: 'ctcss', hz: 100 }),
      readToneToChannelTone({ kind: 'dcs', code: 23 }),
      readToneToChannelTone({ kind: 'dcs', code: 23, polarity: 'I' }),
    ]).toEqual(['none', '88.5', '100.0', 'D023N', 'D023I']);
  });
  it('maps radio fields and optional flags', () => {
    expect(mapped()).toEqual({
      slot: 3,
      name: 'Test',
      fields: {
        rxFrequency: 145500000,
        txFrequency: 145000000,
        power: 20,
        scanInclusion: 'alwaysScan',
        forbidTransmit: 'allow',
        mode: 'fm',
        analog: { rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
      },
    });
    const other = mapReadChannel({
      ...input,
      wireName: '  ',
      txHz: 0,
      rxOnly: true,
      scanAdd: false,
      bandwidth: 'FM',
      powerPercent: 100,
      analogMode: 'am',
    })!;
    expect(other.name).toBe('Channel 3');
    expect(other.fields).toMatchObject({
      txFrequency: 145500000,
      forbidTransmit: 'forbid',
      scanInclusion: 'skip',
      power: 100,
      mode: 'am',
      analog: { bandwidthKHz: 25 },
    });
    const absent = mapReadChannel({ ...input, scanAdd: undefined, powerPercent: null })!;
    expect(absent.fields).not.toHaveProperty('scanInclusion');
    expect(absent.fields.power).toBeNull();
  });
  it('creates a fresh channel with the reported profile', () => {
    const m = mapReadChannel({ ...input, analogMode: 'am', scanAdd: undefined })!;
    const a = channelFromMappedRead('project', m);
    expect(a.id).not.toBe(channelFromMappedRead('project', m).id);
    expect(a).toMatchObject({
      projectId: 'project',
      primaryMode: 'am',
      scanInclusion: 'default',
      modeProfiles: [{ mode: 'am', squelch: null, bandwidthKHz: 12.5 }],
    });
  });
  it('merges profiles additively and preserves unrelated fields', () => {
    const initial = {
      ...channelFromMappedRead('project', mapped()),
      name: 'kept',
      callsign: 'CALL',
      power: 100,
      comment: 'comment',
      modeProfiles: [defaultModeProfile('dmr')],
      primaryMode: 'dmr' as const,
    };
    const result = applyMappedReadToChannel(initial, mapped());
    expect(result.modeProfiles.map((p) => p.mode)).toEqual(['dmr', 'fm']);
    expect(result.modeProfiles[0]).toBe(initial.modeProfiles[0]);
    expect(result).toMatchObject({
      name: 'kept',
      callsign: 'CALL',
      power: 100,
      comment: 'comment',
      primaryMode: 'dmr',
    });
    expect(applyMappedReadToChannel(result, mapped())).toBe(result);
    const changed = mapReadChannel({
      ...input,
      rxTone: { kind: 'ctcss', hz: 88.5 },
      scanAdd: false,
      rxOnly: true,
      bandwidth: 'FM',
    })!;
    const updated = applyMappedReadToChannel(result, changed);
    expect(updated.modeProfiles[1]).toMatchObject({ rxTone: '88.5', bandwidthKHz: 25 });
    expect(updated).toMatchObject({ scanInclusion: 'skip', forbidTransmit: 'forbid' });
    expect(updated.modeProfiles[0]).toBe(initial.modeProfiles[0]);
    const am = channelFromMappedRead('project', mapReadChannel({ ...input, analogMode: 'am' })!);
    expect(applyMappedReadToChannel(am, mapped()).modeProfiles.map((p) => p.mode)).toEqual([
      'am',
      'fm',
    ]);
    expect(
      applyMappedReadToChannel(
        channelFromMappedRead('project', mapped()),
        mapReadChannel({ ...input, analogMode: 'am' })!,
      ).modeProfiles.map((p) => p.mode),
    ).toEqual(['fm', 'am']);
    expect(
      applyMappedReadToChannel({ ...am, modeProfiles: [], primaryMode: null }, mapped())
        .primaryMode,
    ).toBe('fm');
  });
});
