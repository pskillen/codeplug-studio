import { describe, expect, it } from 'vitest';
import type {
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  ChannelModeProfile,
} from '../models/library.ts';
import {
  channelHasFmAmProfile,
  defaultModeProfile,
  findAnalogProfile,
  findDmrProfile,
  isModeOnlyStub,
  normalizeModeProfile,
  pickFmAmModeProfile,
  reconcilePrimaryMode,
  resolveChannelPrimaryMode,
  syncModeProfiles,
  validateModeProfiles,
} from './modeProfiles.ts';

describe('defaultModeProfile', () => {
  it('returns full analog shape', () => {
    const p = defaultModeProfile('fm');
    expect(p).toMatchObject({
      mode: 'fm',
      squelch: null,
      rxTone: 'none',
      txTone: 'none',
      bandwidthKHz: null,
    });
  });

  it('returns ssb profile with default usb sideband', () => {
    expect(defaultModeProfile('ssb')).toMatchObject({
      mode: 'ssb',
      ssbSideband: 'usb',
    });
  });

  it('returns full dstar shape', () => {
    expect(defaultModeProfile('dstar')).toMatchObject({
      mode: 'dstar',
      urCall: 'CQCQCQ',
      rpt1Call: '',
      rpt2Call: '',
    });
  });
});

describe('normalizeModeProfile', () => {
  it('upgrades mode-only stub', () => {
    expect(normalizeModeProfile({ mode: 'ysf' } as ChannelModeProfile)).toMatchObject({
      mode: 'ysf',
      dgId: null,
    });
  });

  it('adds bandwidthKHz to legacy analog profile', () => {
    const legacy = {
      mode: 'fm' as const,
      squelch: 50,
      rxTone: 'none' as const,
      txTone: 'none' as const,
    } as ChannelModeProfile;
    expect(normalizeModeProfile(legacy)).toMatchObject({ bandwidthKHz: null });
  });

  it('migrates legacy ssb-usb to ssb with usb sideband', () => {
    const legacy = {
      mode: 'ssb-usb',
      squelch: null,
      rxTone: 'none',
      txTone: 'none',
      bandwidthKHz: null,
    } as unknown as ChannelModeProfile;
    expect(normalizeModeProfile(legacy)).toMatchObject({
      mode: 'ssb',
      ssbSideband: 'usb',
    });
  });

  it('migrates legacy ssb-lsb to ssb with lsb sideband', () => {
    const legacy = { mode: 'ssb-lsb' } as unknown as ChannelModeProfile;
    expect(normalizeModeProfile(legacy)).toMatchObject({
      mode: 'ssb',
      ssbSideband: 'lsb',
    });
  });

  it('defaults ssb sideband to usb when omitted', () => {
    const legacy = {
      mode: 'ssb',
      squelch: null,
      rxTone: 'none',
      txTone: 'none',
      bandwidthKHz: null,
    } as ChannelModeProfileAnalog;
    expect(normalizeModeProfile(legacy)).toMatchObject({
      mode: 'ssb',
      ssbSideband: 'usb',
    });
  });
});

describe('normalizeModeProfile (NXDN)', () => {
  it('moves a legacy talkGroupRef to contactRef', () => {
    const legacy = {
      mode: 'nxdn',
      rxRan: 1,
      txRan: 2,
      unitId: 77,
      talkGroupRef: { kind: 'talkGroup', id: 'tg-1' },
    } as unknown as ChannelModeProfile;
    const out = normalizeModeProfile(legacy);
    expect(out).toMatchObject({
      mode: 'nxdn',
      rxRan: 1,
      unitId: 77,
      contactRef: { kind: 'talkGroup', id: 'tg-1' },
      rxGroupListId: null,
      nxdnRate: null,
    });
    expect('talkGroupRef' in out).toBe(false);
  });

  it('keeps contactRef when both are present', () => {
    const out = normalizeModeProfile({
      mode: 'nxdn',
      rxRan: null,
      txRan: null,
      ownDigitalIdId: null,
      contactRef: { kind: 'digitalContact', id: 'c-1' },
      talkGroupRef: { kind: 'talkGroup', id: 'tg-1' },
    } as unknown as ChannelModeProfile);
    expect(out).toMatchObject({ contactRef: { kind: 'digitalContact', id: 'c-1' } });
  });

  it('defaults the new fields on a profile that lacks them', () => {
    expect(defaultModeProfile('nxdn')).toEqual({
      mode: 'nxdn',
      rxRan: null,
      txRan: null,
      ownDigitalIdId: null,
      contactRef: null,
      rxGroupListId: null,
      nxdnRate: null,
    });
  });
});

describe('syncModeProfiles', () => {
  it('preserves existing profiles and adds defaults for new modes', () => {
    const fm: ChannelModeProfileAnalog = {
      mode: 'fm',
      squelch: 25,
      rxTone: '88.5',
      txTone: '88.5',
      bandwidthKHz: 12.5,
      analogSquelchMode: 'default',
    };
    const synced = syncModeProfiles(['fm', 'dmr'], [fm]);
    expect(synced).toHaveLength(2);
    expect(synced[0]).toEqual(fm);
    expect(synced[1]?.mode).toBe('dmr');
  });

  it('drops deselected modes', () => {
    const dmr = defaultModeProfile('dmr') as ChannelModeProfileDMR;
    dmr.colourCode = 7;
    const synced = syncModeProfiles(['dmr'], [defaultModeProfile('fm'), dmr]);
    expect(synced).toHaveLength(1);
    expect((synced[0] as ChannelModeProfileDMR).colourCode).toBe(7);
  });
});

describe('findModeProfile helpers', () => {
  it('finds analog and dmr profiles', () => {
    const channel = {
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(findAnalogProfile(channel)?.mode).toBe('fm');
    expect(findDmrProfile(channel)?.mode).toBe('dmr');
  });
});

describe('validateModeProfiles', () => {
  it('flags duplicate modes', () => {
    expect(validateModeProfiles([defaultModeProfile('fm'), defaultModeProfile('fm')])).toContain(
      'Duplicate mode profile: fm',
    );
  });

  it('flags duplicate ssb profiles', () => {
    expect(validateModeProfiles([defaultModeProfile('ssb'), defaultModeProfile('ssb')])).toContain(
      'Duplicate mode profile: ssb',
    );
  });

  it('flags invalid DMR colour code', () => {
    const dmr = defaultModeProfile('dmr') as ChannelModeProfileDMR;
    dmr.colourCode = 20;
    expect(validateModeProfiles([dmr])).toContain('DMR colour code must be 0–15');
  });
});

describe('validateModeProfiles (NXDN)', () => {
  const nxdn = (patch: Record<string, unknown>) =>
    ({ ...defaultModeProfile('nxdn'), ...patch }) as ChannelModeProfile;

  it('rejects a Digital ID that is missing or of the other protocol, when the IDs are given', () => {
    const own = (id: string, protocol: 'dmr' | 'nxdn') => ({
      id,
      projectId: 'p',
      revision: 1,
      updatedAt: '',
      name: '',
      protocol,
      number: 5,
      isDefault: false,
    });
    const ids = [own('n1', 'nxdn'), own('d1', 'dmr')];
    expect(validateModeProfiles([nxdn({ ownDigitalIdId: 'n1' })], ids)).toEqual([]);
    expect(validateModeProfiles([nxdn({ ownDigitalIdId: 'd1' })], ids)).toContain(
      "This channel's NXDN ID is not in Digital IDs",
    );
    expect(validateModeProfiles([nxdn({ ownDigitalIdId: 'gone' })], ids)).toHaveLength(1);
    const dmr = { ...defaultModeProfile('dmr'), ownDigitalIdId: 'n1' } as ChannelModeProfile;
    expect(validateModeProfiles([dmr], ids)).toContain(
      "This channel's DMR ID is not in Digital IDs",
    );
    // Default, and no IDs passed: nothing to check.
    expect(validateModeProfiles([nxdn({ ownDigitalIdId: null })], ids)).toEqual([]);
    expect(validateModeProfiles([nxdn({ ownDigitalIdId: 'gone' })])).toEqual([]);
  });

  it('accepts a talk group or digital contact call, rejects other kinds', () => {
    expect(
      validateModeProfiles([nxdn({ contactRef: { kind: 'digitalContact', id: 'c' } })]),
    ).toEqual([]);
    expect(validateModeProfiles([nxdn({ contactRef: { kind: 'talkGroup', id: 'c' } })])).toEqual(
      [],
    );
    expect(
      validateModeProfiles([nxdn({ contactRef: { kind: 'analogContact', id: 'c' } })]),
    ).toContain('NXDN call must be a talk group or a digital contact');
  });
});

describe('isModeOnlyStub', () => {
  it('detects stub profiles', () => {
    expect(isModeOnlyStub({ mode: 'p25' })).toBe(true);
    expect(isModeOnlyStub(defaultModeProfile('ysf'))).toBe(false);
  });
});

describe('reconcilePrimaryMode', () => {
  it('returns null when no profiles', () => {
    expect(reconcilePrimaryMode('fm', [])).toBeNull();
  });

  it('keeps primary when still in profiles', () => {
    const profiles = [defaultModeProfile('fm'), defaultModeProfile('dmr')];
    expect(reconcilePrimaryMode('dmr', profiles)).toBe('dmr');
  });

  it('falls back to first profile when primary removed', () => {
    const profiles = [defaultModeProfile('dmr')];
    expect(reconcilePrimaryMode('fm', profiles)).toBe('dmr');
  });
});

describe('resolveChannelPrimaryMode', () => {
  it('uses primaryMode when present in profiles', () => {
    const channel = {
      primaryMode: 'dmr' as const,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(resolveChannelPrimaryMode(channel)).toBe('dmr');
  });

  it('falls back to first profile when primary not in profiles', () => {
    const channel = {
      primaryMode: 'ysf' as const,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(resolveChannelPrimaryMode(channel)).toBe('fm');
  });
});

describe('pickFmAmModeProfile', () => {
  it('picks FM/AM and ignores SSB and digital', () => {
    expect(
      pickFmAmModeProfile({
        modeProfiles: [defaultModeProfile('dmr'), defaultModeProfile('fm')],
      })?.mode,
    ).toBe('fm');
    expect(
      channelHasFmAmProfile({
        modeProfiles: [defaultModeProfile('ssb'), defaultModeProfile('dmr')],
      }),
    ).toBe(false);
  });
});
