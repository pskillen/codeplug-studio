import { describe, expect, it } from 'vitest';

import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';
import {
  decodeUv5rMiniSettings,
  decodeUv5rMiniVfo,
  UV5R_MINI_SETTINGS_FIELDS,
  UV5R_MINI_VFO_FIELDS,
  uv5rMiniFrameCounts,
} from './settingsFrame.ts';

const read = () => new Uint8Array(UV5R_MINI_FULL_READ_SIZE);

function coverage(fields: readonly { offset: number; length: number }[], size: number) {
  const seen = new Array<number>(size).fill(0);
  for (const f of fields) for (let i = 0; i < f.length; i++) seen[f.offset + i]++;
  return seen;
}

describe('settings frame', () => {
  it('accounts for all 64 bytes once: 45 named, 19 with no reader', () => {
    expect(coverage(UV5R_MINI_SETTINGS_FIELDS, 64).every((n) => n === 1)).toBe(true);
    expect(uv5rMiniFrameCounts(UV5R_MINI_SETTINGS_FIELDS)).toEqual({
      traced: 41,
      partly: 4,
      unknown: 0,
      named: 45,
      noReader: 19,
    });
  });

  it('marks the inferred names partly and says so', () => {
    const partly = UV5R_MINI_SETTINGS_FIELDS.filter(
      (f) => f.kind === 'named' && f.confidence === 'partly',
    ).map((f) => f.offset);
    expect(partly).toEqual([0x15, 0x16, 0x38, 0x39]);
    for (const f of UV5R_MINI_SETTINGS_FIELDS.filter((x) => x.confidence === 'partly')) {
      expect(f.evidence + f.encoding).toMatch(/inferred/);
    }
  });

  it('decodes each value from its address', () => {
    const r = read();
    r.set([2, 1, 3, 4, 0, 8], 0x9000); // squelch, save, vox, backlight, dual watch, TOT
    r[0x901a] = 0x01; // work mode: A channel, B VFO
    r[0x9020] = 6; // VOX delay
    r.set([0x90, 0x01], 0x902c); // 400
    r.set([0xd6, 0x01], 0x902e); // 470
    r[0x9032] = 0x1c;
    r[0x9033] = 0xff;
    r[0x9039] = 9;
    const s = decodeUv5rMiniSettings(r);
    const text = Object.fromEntries(s.fields.map((f) => [f.field.name, f.text]));
    expect(text['Squelch']).toBe('2');
    expect(text['Power Save']).toBe('On');
    expect(text['VOX level']).toBe('4');
    expect(text['Backlight']).toBe('20 s');
    expect(text['Dual Watch']).toBe('Off');
    expect(text['TOT']).toBe('120 s');
    expect(text['Work mode']).toBe('A channel, B VFO');
    expect(text['VOX delay']).toBe('1.1 s');
    expect(text['VFO scan range, low']).toBe('400 MHz');
    expect(text['VFO scan range, high']).toBe('470 MHz');
    expect(text['SK1 short-press function']).toBe('Scan');
    expect(text['Second key function']).toBe('0xFF');
    expect(text['DTMF call hang time']).toBe('10 s');
    expect(s.fields.find((f) => f.address === 0x9013)?.text).toBe('No reader');
  });

  it('says a value outside the firmware table is not in it', () => {
    const r = read();
    r[0x9008] = 7;
    const s = decodeUv5rMiniSettings(r);
    expect(s.fields.find((f) => f.field.name === 'Language')?.text).toMatch(/not in the firmware/);
  });

  it('notes the CHIRP key mismatch on the second key and the unread 0x34 pair', () => {
    const key = UV5R_MINI_SETTINGS_FIELDS.find((f) => f.offset === 0x33)!;
    expect(key.encoding).toMatch(/CHIRP.*0x34.*firmware reads 0x33.*inferred statically/);
    const pair = UV5R_MINI_SETTINGS_FIELDS.find((f) => f.offset === 0x34)!;
    expect(pair.kind).toBe('no-reader');
  });

  it('flags an erased frame, refuses a short read, and does not alias', () => {
    const r = new Uint8Array(UV5R_MINI_FULL_READ_SIZE).fill(0xff);
    expect(decodeUv5rMiniSettings(r).empty).toBe(true);
    r[0x9000] = 3;
    const s = decodeUv5rMiniSettings(r);
    expect(s.empty).toBe(false);
    s.fields[0].bytes[0] ^= 0xff;
    expect(r[0x9000]).toBe(3);
    expect(() => decodeUv5rMiniSettings(new Uint8Array(0x9000))).toThrow(/no settings frame/);
  });
});

describe('VFO frame', () => {
  it('accounts for all 32 bytes: 22 traced, 2 inferred, 8 unread', () => {
    expect(coverage(UV5R_MINI_VFO_FIELDS, 32).every((n) => n >= 1)).toBe(true);
    expect(uv5rMiniFrameCounts(UV5R_MINI_VFO_FIELDS)).toEqual({
      traced: 22,
      partly: 2,
      unknown: 0,
      named: 24,
      noReader: 8,
    });
  });

  it('decodes frequency and offset digits for A and B from their own records', () => {
    const r = read();
    r.set([1, 4, 6, 5, 2, 0, 0, 0], 0x8000); // 146.52000
    r.set([4, 3, 0, 1, 2, 5, 0, 0], 0x8020); // 430.12500
    r.set([0, 0, 0, 6, 0, 0, 0], 0x8014); // 000.6000
    r[0x800e] = 0x40 | 5; // shift minus, code 5
    r[0x8010] = 1;
    const v = decodeUv5rMiniVfo(r);
    const get = (side: 0 | 1, name: string) =>
      v.sides[side].fields.find((f) => f.field.name === name)!.text;
    expect(v.sides.map((s) => s.side)).toEqual(['A', 'B']);
    expect(get(0, 'Frequency')).toBe('146.52000 MHz');
    expect(get(1, 'Frequency')).toBe('430.12500 MHz');
    expect(get(0, 'Offset')).toBe('000.6000 MHz');
    expect(get(0, 'Shift direction')).toBe('−');
    expect(get(0, 'Signalling code')).toBe('5');
    expect(get(0, 'Power index')).toBe('Low');
  });

  it('shows raw bytes when a digit byte is not a digit', () => {
    const r = read();
    r.set([1, 4, 0xff, 5, 2, 0, 0, 0], 0x8000);
    const f = decodeUv5rMiniVfo(r).sides[0].fields.find((x) => x.field.name === 'Frequency')!;
    expect(f.text).toMatch(/not digits/);
  });
});
