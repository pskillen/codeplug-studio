import { describe, expect, it } from 'vitest';
import { AT_D890_ADVANCED_SETTINGS_FIELD_IDS } from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { D890_MAP } from './constants.ts';
import { AT_D890_ERASE_UNIT_BYTES } from './eraseUnits.ts';
import { AT_D890_SETTINGS_FIELDS, resolveAtD890SettingsPatches } from './settingsFields.ts';
import {
  applyAtD890SettingsPatchesToUnit,
  assertAtD890SentinelSpansNotErased,
} from './settingsPatch.ts';

const MAIN = D890_MAP.OptionalSettingsMain;
const EXT = D890_MAP.OptionalSettingsExt;

describe('AT-D890 advanced settings fields', () => {
  it.each([
    ['language', MAIN + 0x05],
    ['powerOnPasswordEnabled', MAIN + 0x07],
    ['powerOnPasswordDigits', EXT + 0x40],
    ['professionalMode', MAIN + 0x34],
    ['repeaterMode', MAIN + 0x143],
    ['acceptRemoteKill', MAIN + 0x3c],
    ['acceptRemoteMonitor', MAIN + 0x3e],
    ['answerGpsRequests', MAIN + 0x3f],
    ['encryptionType', MAIN + 0x10a],
    ['autoRepeaterA', MAIN + 0x48],
    ['autoRepeaterB', MAIN + 0xd4],
  ])('%s sits at the CPS address, advanced, both targets', (id, address) => {
    const spec = AT_D890_SETTINGS_FIELDS.get(id)!;
    expect(spec.address).toBe(address);
    expect(spec.advanced).toBe(true);
    expect(spec.targets).toEqual(['stock', 'mm9pdy']);
    expect(AT_D890_ADVANCED_SETTINGS_FIELD_IDS).toContain(id);
  });

  it('does not offer the auto-repeater limits or offset indexes', () => {
    for (const spec of AT_D890_SETTINGS_FIELDS.values()) {
      for (let i = 0; i < spec.length; i++) {
        const off = spec.address - MAIN + i;
        expect(off >= 0xc4 && off <= 0xd3 && off !== 0xd4, spec.id).toBe(false);
        expect(off >= 0xf4 && off <= 0x103, spec.id).toBe(false);
        expect([0x68, 0x69, 0xf1, 0xf2]).not.toContain(off);
      }
    }
  });

  it.each([3, 255, -1, 1.5, '1', true])('refuses language %s', (v) => {
    expect(() => AT_D890_SETTINGS_FIELDS.get('language')!.encode(v as number)).toThrow(
      RadioProtocolError,
    );
  });

  it('accepts languages 0..2 and refuses professional mode 2', () => {
    for (const v of [0, 1, 2]) {
      expect([...AT_D890_SETTINGS_FIELDS.get('language')!.encode(v)]).toEqual([v]);
    }
    expect(() => AT_D890_SETTINGS_FIELDS.get('professionalMode')!.encode(2)).toThrow(
      RadioProtocolError,
    );
    expect([...AT_D890_SETTINGS_FIELDS.get('professionalMode')!.encode(1)]).toEqual([1]);
  });

  it('refuses auto repeater 3 and encryption type 2', () => {
    expect(() => AT_D890_SETTINGS_FIELDS.get('autoRepeaterA')!.encode(3)).toThrow();
    expect(() => AT_D890_SETTINGS_FIELDS.get('autoRepeaterB')!.encode(3)).toThrow();
    expect(() => AT_D890_SETTINGS_FIELDS.get('encryptionType')!.encode(2)).toThrow();
  });

  it('encodes digits as ASCII padded with 00, and empty as eight 00', () => {
    const spec = AT_D890_SETTINGS_FIELDS.get('powerOnPasswordDigits')!;
    expect(spec.length).toBe(8);
    expect([...spec.encode('4821')]).toEqual([0x34, 0x38, 0x32, 0x31, 0, 0, 0, 0]);
    expect([...spec.encode('12345678')]).toEqual([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38]);
    expect([...spec.encode('')]).toEqual(new Array(8).fill(0));
  });

  it.each(['12a4', '123456789', ' 123', '12.4'])('refuses the password %j', (v) => {
    expect(() => AT_D890_SETTINGS_FIELDS.get('powerOnPasswordDigits')!.encode(v)).toThrow(
      RadioProtocolError,
    );
  });
});

describe('power-on password pairing', () => {
  const on = [
    { fieldId: 'powerOnPasswordEnabled', value: true },
    { fieldId: 'powerOnPasswordDigits', value: '4821' },
  ];
  const clear = [
    { fieldId: 'powerOnPasswordEnabled', value: false },
    { fieldId: 'powerOnPasswordDigits', value: '' },
  ];

  it('resolves both halves into two patches', () => {
    const patches = resolveAtD890SettingsPatches(on, 'stock');
    expect(patches.map((p) => [p.fieldId, p.address])).toEqual([
      ['powerOnPasswordEnabled', MAIN + 0x07],
      ['powerOnPasswordDigits', EXT + 0x40],
    ]);
  });

  it('refuses either half alone, and an enable without digits', () => {
    expect(() => resolveAtD890SettingsPatches([on[0]!], 'stock')).toThrow(/together/);
    expect(() => resolveAtD890SettingsPatches([on[1]!], 'stock')).toThrow(/together/);
    expect(() =>
      resolveAtD890SettingsPatches(
        [
          { fieldId: 'powerOnPasswordEnabled', value: true },
          { fieldId: 'powerOnPasswordDigits', value: '' },
        ],
        'stock',
      ),
    ).toThrow(/1 to 8 digits/);
    expect(() =>
      resolveAtD890SettingsPatches(
        [
          { fieldId: 'powerOnPasswordEnabled', value: false },
          { fieldId: 'powerOnPasswordDigits', value: '1' },
        ],
        'stock',
      ),
    ).toThrow(/clears the digits/);
  });

  it('clear writes enable 0 and eight 00, and the erased-span guard does not fire', () => {
    const unit = new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(0xff);
    const mainAt = MAIN - D890_MAP.OptionalSettingsMain;
    // A live unit whose main record and power-on block hold data, as a radio's does.
    unit.fill(0x31, mainAt, mainAt + 0x200);
    unit.fill(0x31, EXT - MAIN, EXT - MAIN + 0x60);
    applyAtD890SettingsPatchesToUnit(MAIN, unit, resolveAtD890SettingsPatches(clear, 'stock'));
    expect(unit[0x07]).toBe(0);
    expect([...unit.subarray(EXT + 0x40 - MAIN, EXT + 0x48 - MAIN)]).toEqual(new Array(8).fill(0));
    expect(() => assertAtD890SentinelSpansNotErased(MAIN, unit)).not.toThrow();
  });
});
