import { describe, expect, it } from 'vitest';
import {
  hasUv5rminiRadioSpecific,
  summariseUv5rminiRadioSpecific,
} from './uv5rRadioSpecificPreview.ts';

/** Sample shape from a NeonPlug UV5R-Mini radio-read export. */
const SAMPLE_UV5R_RADIO_SETTINGS = {
  radioSpecific: {
    squelch: 1,
    savemode: 1,
    vox: 4,
    backlight: 2,
    dualstandby: 1,
    tot: 12,
    beep: 0,
    voicesw: false,
    voice: 0,
    sidetone: 0,
    scanmode: 0,
    pttid: 0,
    pttdly: 5,
    chadistype: 0,
    chbdistype: 0,
    bcl: false,
    autolock: false,
    alarmmode: 0,
    alarmtone: false,
    tailclear: true,
    rpttailclear: 5,
    rpttaildet: 5,
    roger: false,
    aOrB: 0,
    fmenable: false,
    chaworkmode: 1,
    chbworkmode: 1,
    keylock: false,
    powerondistype: 1,
    voxdlytime: 6,
    menuquittime: 1,
    dispani: false,
    totalarm: 0,
    ctsdcsscantype: 0,
    hangup: 1,
    voxsw: false,
    inputdtmf: false,
  },
};

describe('uv5rRadioSpecificPreview', () => {
  it('detects UV5R radioSpecific bags', () => {
    expect(hasUv5rminiRadioSpecific(SAMPLE_UV5R_RADIO_SETTINGS)).toBe(true);
    expect(hasUv5rminiRadioSpecific({ beep: true, volume: 5 })).toBe(false);
    expect(hasUv5rminiRadioSpecific(null)).toBe(false);
  });

  it('decodes labelled sections with NeonPlug option labels', () => {
    const sections = summariseUv5rminiRadioSpecific(SAMPLE_UV5R_RADIO_SETTINGS);
    expect(sections.map((s) => s.id)).toEqual([
      'basic',
      'display',
      'ptt',
      'scan',
      'alarm',
      'repeater',
      'vox',
    ]);

    const basic = Object.fromEntries(
      (sections.find((s) => s.id === 'basic')?.rows ?? []).map((r) => [r.key, r.displayValue]),
    );
    expect(basic.squelch).toBe('1');
    expect(basic.savemode).toBe('On');
    expect(basic.vox).toBe('4');
    expect(basic.backlight).toBe('10 sec');
    expect(basic.tot).toBe('180 sec');
    expect(basic.beep).toBe('Off');
    expect(basic.voicesw).toBe('Off');
    expect(basic.voice).toBe('English');

    const display = Object.fromEntries(
      (sections.find((s) => s.id === 'display')?.rows ?? []).map((r) => [r.key, r.displayValue]),
    );
    expect(display.powerondistype).toBe('BATT voltage');
    expect(display.aOrB).toBe('A');
    expect(display.chaworkmode).toBe('Channel');

    const repeater = Object.fromEntries(
      (sections.find((s) => s.id === 'repeater')?.rows ?? []).map((r) => [r.key, r.displayValue]),
    );
    expect(repeater.tailclear).toBe('On');
    expect(repeater.rpttailclear).toBe('500 ms');
  });

  it('returns empty for DM32-style shallow radioSettings', () => {
    expect(
      summariseUv5rminiRadioSpecific({
        powerOnDisplayLine1: 'KEEP',
        beep: true,
        volume: 5,
        vfoA: { number: 1 },
      }),
    ).toEqual([]);
  });

  it('puts unknown leaf keys under Other', () => {
    const sections = summariseUv5rminiRadioSpecific({
      radioSpecific: { squelch: 0, mysteryFlag: true },
    });
    expect(sections.find((s) => s.id === 'other')?.rows).toEqual([
      { key: 'mysteryFlag', label: 'mysteryFlag', displayValue: 'On' },
    ]);
  });
});
