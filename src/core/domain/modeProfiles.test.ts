import { describe, expect, it } from 'vitest';
import type {
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  ChannelModeProfile,
} from '../models/library.ts';
import type { ChannelModeEdit } from './modeProfiles.ts';
import {
  addChannelMode,
  channelHasFmAmProfile,
  defaultModeProfile,
  findAnalogProfile,
  findDmrProfile,
  isModeOnlyStub,
  normalizeModeProfile,
  pickFmAmModeProfile,
  reconcilePrimaryMode,
  removeChannelMode,
  resolveChannelPrimaryMode,
  setChannelMainMode,
  switchChannelMode,
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

function emptyEdit(): ChannelModeEdit {
  return { modeProfiles: [], primaryMode: null, parked: [] };
}

function freezeEdit(edit: ChannelModeEdit): ChannelModeEdit {
  Object.freeze(edit);
  Object.freeze(edit.modeProfiles);
  Object.freeze(edit.parked);
  edit.modeProfiles.forEach((p) => Object.freeze(p));
  edit.parked.forEach((p) => Object.freeze(p));
  return edit;
}

describe('switchChannelMode', () => {
  it('is unchanged when the target is already the only mode', () => {
    const edit = {
      modeProfiles: [defaultModeProfile('fm')],
      primaryMode: 'fm' as const,
      parked: [],
    };
    const out = switchChannelMode(edit, 'fm');
    expect(out).toEqual(edit);
  });

  it('is unchanged with two or more modes', () => {
    const edit = {
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'fm' as const,
      parked: [],
    };
    expect(switchChannelMode(edit, 'ysf')).toEqual({
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'fm',
      parked: [],
    });
  });

  it('parks FM and switches to DMR at the same index', () => {
    const fm: ChannelModeProfileAnalog = {
      mode: 'fm',
      squelch: 25,
      rxTone: '88.5',
      txTone: '88.5',
      bandwidthKHz: 12.5,
      analogSquelchMode: 'default',
    };
    const edit = { modeProfiles: [fm], primaryMode: 'fm' as const, parked: [] };
    const out = switchChannelMode(edit, 'dmr');
    expect(out.modeProfiles).toHaveLength(1);
    expect(out.modeProfiles[0]?.mode).toBe('dmr');
    expect(out.primaryMode).toBe('dmr');
    expect(out.parked).toHaveLength(1);
    expect(out.parked[0]).toEqual(fm);
  });

  it('restores parked FM with tones when switching back from DMR', () => {
    const fm: ChannelModeProfileAnalog = {
      mode: 'fm',
      squelch: 25,
      rxTone: '88.5',
      txTone: '88.5',
      bandwidthKHz: 12.5,
      analogSquelchMode: 'default',
    };
    const original = { modeProfiles: [fm], primaryMode: 'fm' as const, parked: [] };
    const afterDmr = switchChannelMode(original, 'dmr');
    const restored = switchChannelMode(afterDmr, 'fm');
    expect(restored.modeProfiles).toEqual([fm]);
    expect(restored.primaryMode).toBe('fm');
    expect(restored.parked[0]?.mode).toBe('dmr');
  });

  it('sets a default profile when switching from no mode', () => {
    const out = switchChannelMode(emptyEdit(), 'p25');
    expect(out.modeProfiles).toEqual([defaultModeProfile('p25')]);
    expect(out.primaryMode).toBe('p25');
  });

  it('restores a parked profile when switching from no mode', () => {
    const ysf = defaultModeProfile('ysf');
    const edit = { modeProfiles: [], primaryMode: null, parked: [ysf] };
    const out = switchChannelMode(edit, 'ysf');
    expect(out.modeProfiles).toEqual([ysf]);
    expect(out.parked).toEqual([]);
  });

  it('carries analogue tones when switching FM to AM', () => {
    const fm: ChannelModeProfileAnalog = {
      mode: 'fm',
      squelch: 40,
      rxTone: '100.0',
      txTone: '100.0',
      bandwidthKHz: 25,
      analogSquelchMode: 'default',
    };
    const out = switchChannelMode(
      { modeProfiles: [fm], primaryMode: 'fm', parked: [] },
      'am',
    );
    expect(out.modeProfiles[0]).toMatchObject({
      mode: 'am',
      rxTone: '100.0',
      txTone: '100.0',
      bandwidthKHz: 25,
      squelch: 40,
    });
  });

  it('does not carry DMR colour code when switching to FM', () => {
    const dmr = defaultModeProfile('dmr') as ChannelModeProfileDMR;
    dmr.colourCode = 9;
    const out = switchChannelMode(
      { modeProfiles: [dmr], primaryMode: 'dmr', parked: [] },
      'fm',
    );
    expect((out.modeProfiles[0] as ChannelModeProfileAnalog).rxTone).toBe('none');
    expect(out.parked[0]?.mode).toBe('dmr');
    expect((out.parked[0] as ChannelModeProfileDMR).colourCode).toBe(9);
  });

  it('uses parked DMR without re-defaulting', () => {
    const dmr = defaultModeProfile('dmr') as ChannelModeProfileDMR;
    dmr.colourCode = 3;
    const fm = defaultModeProfile('fm');
    const edit = {
      modeProfiles: [fm],
      primaryMode: 'fm' as const,
      parked: [dmr],
    };
    const out = switchChannelMode(edit, 'dmr');
    expect((out.modeProfiles[0] as ChannelModeProfileDMR).colourCode).toBe(3);
    expect(out.parked).toEqual([fm]);
  });
});

describe('addChannelMode', () => {
  it('is unchanged when the mode is already present', () => {
    const edit = {
      modeProfiles: [defaultModeProfile('fm')],
      primaryMode: 'fm' as const,
      parked: [],
    };
    expect(addChannelMode(edit, 'fm')).toEqual(edit);
  });

  it('appends a default profile and keeps primary', () => {
    const edit = {
      modeProfiles: [defaultModeProfile('fm')],
      primaryMode: 'fm' as const,
      parked: [],
    };
    const out = addChannelMode(edit, 'dmr');
    expect(out.modeProfiles.map((p) => p.mode)).toEqual(['fm', 'dmr']);
    expect(out.primaryMode).toBe('fm');
  });

  it('restores a parked profile when adding', () => {
    const dmr = defaultModeProfile('dmr') as ChannelModeProfileDMR;
    dmr.colourCode = 5;
    const edit = {
      modeProfiles: [defaultModeProfile('fm')],
      primaryMode: 'fm' as const,
      parked: [dmr],
    };
    const out = addChannelMode(edit, 'dmr');
    expect((out.modeProfiles[1] as ChannelModeProfileDMR).colourCode).toBe(5);
    expect(out.parked).toEqual([]);
  });

  it('sets primary to the first mode when it was null', () => {
    const edit = addChannelMode(emptyEdit(), 'nxdn');
    expect(edit.primaryMode).toBe('nxdn');
  });
});

describe('removeChannelMode', () => {
  it('is unchanged when the mode is absent', () => {
    const edit = {
      modeProfiles: [defaultModeProfile('fm')],
      primaryMode: 'fm' as const,
      parked: [],
    };
    expect(removeChannelMode(edit, 'dmr')).toEqual(edit);
  });

  it('parks the removed profile and advances primary', () => {
    const fm: ChannelModeProfileAnalog = {
      mode: 'fm',
      squelch: 25,
      rxTone: '88.5',
      txTone: '88.5',
      bandwidthKHz: null,
      analogSquelchMode: 'default',
    };
    const dmr = defaultModeProfile('dmr') as ChannelModeProfileDMR;
    dmr.colourCode = 7;
    const edit = {
      modeProfiles: [fm, dmr],
      primaryMode: 'fm' as const,
      parked: [],
    };
    const out = removeChannelMode(edit, 'fm');
    expect(out.modeProfiles).toHaveLength(1);
    expect((out.modeProfiles[0] as ChannelModeProfileDMR).colourCode).toBe(7);
    expect(out.primaryMode).toBe('dmr');
    expect(out.parked[0]).toEqual(fm);
  });

  it('clears primary when no modes remain', () => {
    const out = removeChannelMode(
      { modeProfiles: [defaultModeProfile('m17')], primaryMode: 'm17', parked: [] },
      'm17',
    );
    expect(out.modeProfiles).toEqual([]);
    expect(out.primaryMode).toBeNull();
  });
});

describe('setChannelMainMode', () => {
  it('sets primary when the mode is on the channel', () => {
    const edit = {
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'fm' as const,
      parked: [],
    };
    const out = setChannelMainMode(edit, 'dmr');
    expect(out.primaryMode).toBe('dmr');
    expect(out.modeProfiles.map((p) => p.mode)).toEqual(['fm', 'dmr']);
  });

  it('is unchanged when the mode is not present', () => {
    const edit = {
      modeProfiles: [defaultModeProfile('fm')],
      primaryMode: 'fm' as const,
      parked: [],
    };
    expect(setChannelMainMode(edit, 'ysf')).toEqual(edit);
  });
});

describe('mode transitions (same output as today editor)', () => {
  it('switch fm then add dmr from empty', () => {
    let edit = emptyEdit();
    edit = switchChannelMode(edit, 'fm');
    edit = addChannelMode(edit, 'dmr');
    expect(edit.modeProfiles).toEqual([
      defaultModeProfile('fm'),
      defaultModeProfile('dmr'),
    ]);
    expect(edit.primaryMode).toBe('fm');
  });

  it('remove fm from fm+dmr with configured profiles', () => {
    const fm: ChannelModeProfileAnalog = {
      mode: 'fm',
      squelch: 25,
      rxTone: '88.5',
      txTone: '88.5',
      bandwidthKHz: null,
      analogSquelchMode: 'default',
    };
    const dmr = defaultModeProfile('dmr') as ChannelModeProfileDMR;
    dmr.colourCode = 7;
    const out = removeChannelMode(
      { modeProfiles: [fm, dmr], primaryMode: 'fm', parked: [] },
      'fm',
    );
    expect(out.modeProfiles).toEqual([dmr]);
    expect(out.primaryMode).toBe('dmr');
  });

  it('add ysf to fm+dmr with dmr primary preserves order', () => {
    const edit = {
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
      primaryMode: 'dmr' as const,
      parked: [],
    };
    const out = addChannelMode(edit, 'ysf');
    expect(out.modeProfiles.map((p) => p.mode)).toEqual(['fm', 'dmr', 'ysf']);
    expect(out.primaryMode).toBe('dmr');
  });
});

describe('mode transitions (input immutability)', () => {
  it('does not mutate frozen inputs', () => {
    const fm = defaultModeProfile('fm');
    const before = freezeEdit({ modeProfiles: [fm], primaryMode: 'fm', parked: [] });
    const snapshot = structuredClone(before);
    switchChannelMode(before, 'dmr');
    expect(before).toEqual(snapshot);
    addChannelMode(before, 'dmr');
    expect(before).toEqual(snapshot);
    removeChannelMode(before, 'fm');
    expect(before).toEqual(snapshot);
    setChannelMainMode(before, 'dmr');
    expect(before).toEqual(snapshot);
  });
});
