import { describe, expect, it } from 'vitest';
import type {
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  ChannelModeProfile,
} from '../models/library.ts';
import {
  defaultModeProfile,
  findAnalogProfile,
  findDmrProfile,
  isModeOnlyStub,
  normalizeModeProfile,
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
