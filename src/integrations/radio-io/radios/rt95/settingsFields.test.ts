import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { RT95_BANDLIMIT_OFFSET } from './constants.ts';
import {
  RT95_SETTINGS_FIELDS,
  assertRt95SettingsSpecPermitted,
  resolveRt95SettingsPatches,
  rt95UploadSettingsFromOrganisation,
} from './settingsFields.ts';
import { mergeByte, mergeRt95SettingsPatchIntoBlock } from './settingsPatch.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';

describe('RT95 settings registry', () => {
  it('loads only permitted addresses', () => {
    for (const spec of RT95_SETTINGS_FIELDS.values()) {
      expect(() => assertRt95SettingsSpecPermitted(spec)).not.toThrow();
    }
  });

  it('refuses channel and bitfield spans at module load', () => {
    expect(() =>
      assertRt95SettingsSpecPermitted({
        id: 'bad',
        address: 0x10,
        length: 1,
        targets: ['stock'],
        advanced: false,
        trust: 'test',
        encode: () => Uint8Array.of(0),
        decode: () => 0,
      }),
    ).toThrow(RadioProtocolError);
    expect(() =>
      assertRt95SettingsSpecPermitted({
        id: 'bad2',
        address: 0x1940,
        length: 1,
        targets: ['stock'],
        advanced: false,
        trust: 'test',
        encode: () => Uint8Array.of(0),
        decode: () => 0,
      }),
    ).toThrow(RadioProtocolError);
    expect(() =>
      assertRt95SettingsSpecPermitted({
        id: 'bad3',
        address: RT95_BANDLIMIT_OFFSET,
        length: 1,
        targets: ['stock'],
        advanced: false,
        trust: 'test',
        encode: () => Uint8Array.of(0),
        decode: () => 0,
      }),
    ).toThrow(RadioProtocolError);
  });

  it('refuses overlapping bits on 0x321B', () => {
    expect(() =>
      resolveRt95SettingsPatches(
        [
          { fieldId: 'knobMode', value: 1 },
          { fieldId: 'trfEnable', value: true },
        ],
        'stock',
      ),
    ).not.toThrow();
    expect(() =>
      resolveRt95SettingsPatches(
        [
          { fieldId: 'knobMode', value: 1 },
          { fieldId: 'knobMode', value: 0 },
        ],
        'stock',
      ),
    ).toThrow(/set twice/);
  });

  it('applies password enable only with six digits', () => {
    expect(() =>
      resolveRt95SettingsPatches([{ fieldId: 'powerOnPasswordEnabled', value: true }], 'stock'),
    ).toThrow(/six digits/);
    expect(() =>
      resolveRt95SettingsPatches(
        [
          { fieldId: 'powerOnPasswordEnabled', value: true },
          { fieldId: 'powerOnPasswordDigits', value: '123456' },
        ],
        'stock',
      ),
    ).not.toThrow();
  });
});

describe('mergeByte', () => {
  it('changes only masked bits', () => {
    expect(mergeByte(0xff, 0x02, 0x02)).toBe(0xff);
    expect(mergeByte(0x42, 0x03, 0x03)).toBe(0x43);
  });
});

describe('RT95 zone key patch', () => {
  const zoneKey = { group: 1, key: 3 } as const;

  it('MM9PDY writes one DIR byte at the key-table address', () => {
    const patches = rt95UploadSettingsFromOrganisation(
      { rt95ZoneKey: zoneKey } as RadioWriteOrganisation,
      'radio-io-rt95-mm9pdy',
    );
    expect(patches).toHaveLength(1);
    expect(patches[0]!.address).toBe(0x3252);
    expect([...patches[0]!.bytes]).toEqual([0x0e]);
    expect([...patches[0]!.mask]).toEqual([0xff]);
  });

  it('stock RT95 never writes it', () => {
    expect(
      rt95UploadSettingsFromOrganisation(
        { rt95ZoneKey: zoneKey } as RadioWriteOrganisation,
        'radio-io-rt95',
      ),
    ).toEqual([]);
  });

  it('an explicit PF-key override on the same byte merges after it and wins', () => {
    const patches = rt95UploadSettingsFromOrganisation(
      {
        rt95ZoneKey: zoneKey,
        rt95SettingsOverrides: [{ fieldId: 'pfKeyMode1P3', value: 0 }],
      } as RadioWriteOrganisation,
      'radio-io-rt95-mm9pdy',
    );
    expect(patches.map((p) => p.fieldId)).toEqual(['zoneKey', 'pfKeyMode1P3']);
    const block = mergeRt95SettingsPatchIntoBlock(new Uint8Array(16), 0x3250, patches);
    expect(block[2]).toBe(1);
  });
});
