import { describe, expect, it } from 'vitest';
import {
  AT_D890_KEY_FUNCTION_MAX,
  AT_D890_POWER_ON_LINE_MAX_LENGTH,
  AT_D890_ALL_SETTINGS_FIELD_IDS,
  AT_D890_V1_SETTINGS_FIELD_IDS,
  atD890KeyFunctionOptions,
  atD890SettingField,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import { atD890UploadBankIntentFromOrganisation } from './memory.ts';
import {
  AT_D890_NEVER_PATCH_MAIN_OFFSETS,
  AT_D890_SETTINGS_FIELDS,
  assertAtD890SettingsSpecPermitted,
  resolveAtD890SettingsPatches,
  type AtD890SettingValue,
  type AtD890SettingsFieldSpec,
} from './settingsFields.ts';
import {
  applyAtD890SettingsPatchesToUnit,
  assertAtD890SentinelSpansNotErased,
} from './settingsPatch.ts';

function spec(
  address: number,
  over: Partial<AtD890SettingsFieldSpec> = {},
): AtD890SettingsFieldSpec {
  return {
    id: 'synthetic',
    address,
    length: 1,
    targets: ['stock', 'mm9pdy'],
    advanced: false,
    encode: () => Uint8Array.of(1),
    decode: () => 1,
    ...over,
  };
}

describe('AT-D890 settings field registry', () => {
  it('registers only permitted specs', () => {
    expect(AT_D890_SETTINGS_FIELDS.size).toBeGreaterThan(0);
    for (const s of AT_D890_SETTINGS_FIELDS.values()) {
      expect(() => assertAtD890SettingsSpecPermitted(s)).not.toThrow();
    }
  });

  it('registers keyShortP1 and keyShortP2 at +0x13 and +0x14 for both targets', () => {
    expect(AT_D890_SETTINGS_FIELDS.get('keyShortP1')?.address).toBe(0x3500013);
    expect(AT_D890_SETTINGS_FIELDS.get('keyShortP2')?.address).toBe(0x3500014);
    expect(AT_D890_SETTINGS_FIELDS.get('keyShortP1')?.targets).toEqual(['stock', 'mm9pdy']);
  });

  it.each([
    ['LocalInfo', D890_MAP.LocalInfo],
    ['alarm bitmap', 0x3482e00],
    ['alarm data', 0x3483000],
    ['Zone A', 0x3500400],
    ['Zone B', 0x3500600],
    ['MM9PDY store (+0x200)', 0x3500200],
    ['family safe-skip', AT_D890_SAFE_SKIP_WRITE_ADDR],
    ['marker 0x353fbf0', 0x353fbf0],
    ['marker 0x353fff0', 0x353fff0],
    ['past the main record', 0x3500160],
    ['past the power-on block', 0x3500948],
  ])('refuses a spec at %s', (_name, address) => {
    expect(() => assertAtD890SettingsSpecPermitted(spec(address))).toThrow(RadioProtocolError);
  });

  it('refuses a spec that starts in range but runs into a refused byte', () => {
    expect(() => assertAtD890SettingsSpecPermitted(spec(0x350015f, { length: 2 }))).toThrow(
      RadioProtocolError,
    );
  });

  it.each(AT_D890_NEVER_PATCH_MAIN_OFFSETS.map((off) => [`+0x${off.toString(16)}`, off] as const))(
    'refuses the never-patch offset %s',
    (_name, off) => {
      expect(() => assertAtD890SettingsSpecPermitted(spec(0x3500000 + off))).toThrow(
        RadioProtocolError,
      );
    },
  );

  it('accepts a spec in the power-on block and a masked single-byte spec', () => {
    expect(() =>
      assertAtD890SettingsSpecPermitted(spec(0x3500900, { length: 0x20 })),
    ).not.toThrow();
    expect(() => assertAtD890SettingsSpecPermitted(spec(0x3500040, { mask: 0x0f }))).not.toThrow();
    expect(() =>
      assertAtD890SettingsSpecPermitted(spec(0x3500040, { mask: 0x0f, length: 2 })),
    ).toThrow(RadioProtocolError);
  });
});

describe('resolveAtD890SettingsPatches', () => {
  it('resolves step keys to one-byte patches with a full mask', () => {
    const patches = resolveAtD890SettingsPatches(
      [
        { fieldId: 'keyShortP1', value: 14 },
        { fieldId: 'keyShortP2', value: 13 },
      ],
      'mm9pdy',
    );
    expect(patches.map((p) => [p.fieldId, p.address, [...p.bytes], [...p.mask]])).toEqual([
      ['keyShortP1', 0x3500013, [14], [0xff]],
      ['keyShortP2', 0x3500014, [13], [0xff]],
    ]);
  });

  it('refuses an unknown field', () => {
    expect(() => resolveAtD890SettingsPatches([{ fieldId: 'nope', value: 1 }], 'stock')).toThrow(
      /not a writable radio setting/,
    );
  });

  it('refuses a field the target does not have', () => {
    const registry = new Map([['mmOnly', spec(0x3500040, { id: 'mmOnly', targets: ['mm9pdy'] })]]);
    expect(() =>
      resolveAtD890SettingsPatches([{ fieldId: 'mmOnly', value: 1 }], 'stock', registry),
    ).toThrow(/not available on the stock target/);
    expect(() =>
      resolveAtD890SettingsPatches([{ fieldId: 'mmOnly', value: 1 }], 'mm9pdy', registry),
    ).not.toThrow();
  });

  it('refuses an out-of-range value', () => {
    expect(() =>
      resolveAtD890SettingsPatches([{ fieldId: 'keyShortP1', value: 65 }], 'stock'),
    ).toThrow(RadioProtocolError);
    expect(() =>
      resolveAtD890SettingsPatches([{ fieldId: 'keyShortP1', value: -1 }], 'stock'),
    ).toThrow(RadioProtocolError);
    expect(() =>
      resolveAtD890SettingsPatches([{ fieldId: 'keyShortP1', value: 1.5 }], 'stock'),
    ).toThrow(RadioProtocolError);
    expect(() =>
      resolveAtD890SettingsPatches([{ fieldId: 'keyShortP1', value: '3' }], 'stock'),
    ).toThrow(RadioProtocolError);
  });

  it('refuses the same field twice', () => {
    expect(() =>
      resolveAtD890SettingsPatches(
        [
          { fieldId: 'keyShortP1', value: 1 },
          { fieldId: 'keyShortP1', value: 2 },
        ],
        'stock',
      ),
    ).toThrow(/set twice/);
  });

  it('refuses two fields that share a bit, and allows disjoint bits of one byte', () => {
    const lo = spec(0x3500040, { id: 'lo', mask: 0x0f });
    const hi = spec(0x3500040, { id: 'hi', mask: 0xf0 });
    const all = spec(0x3500040, { id: 'all' });
    const registry = new Map([
      ['lo', lo],
      ['hi', hi],
      ['all', all],
    ]);
    expect(
      resolveAtD890SettingsPatches(
        [
          { fieldId: 'lo', value: 1 },
          { fieldId: 'hi', value: 1 },
        ],
        'stock',
        registry,
      ),
    ).toHaveLength(2);
    expect(() =>
      resolveAtD890SettingsPatches(
        [
          { fieldId: 'lo', value: 1 },
          { fieldId: 'all', value: 1 },
        ],
        'stock',
        registry,
      ),
    ).toThrow(/overlaps/);
  });
});

describe('AT-D890 v1 settings fields', () => {
  const sampleFor = (id: string): AtD890SettingValue[] => {
    const def = atD890SettingField(id)!;
    if (def.kind === 'boolean') return [false, true];
    if (def.kind === 'text') return ['', 'A', 'MM9PDY TEST', 'LINE TWO 12345'];
    if (def.kind === 'password') return ['', '1', '12345678'];
    return def.options!.map((o) => o.value);
  };

  it('registers exactly the core field ids, each permitted', () => {
    expect([...AT_D890_SETTINGS_FIELDS.keys()].sort()).toEqual(
      [...AT_D890_ALL_SETTINGS_FIELD_IDS].sort(),
    );
    for (const s of AT_D890_SETTINGS_FIELDS.values()) {
      expect(() => assertAtD890SettingsSpecPermitted(s), s.id).not.toThrow();
      expect(s.targets).toEqual(['stock', 'mm9pdy']);
      expect(s.advanced).toBe(atD890SettingField(s.id)!.advanced);
    }
  });

  it.each(AT_D890_ALL_SETTINGS_FIELD_IDS)(
    '%s: decode(encode(v)) === v for every offered value',
    (id) => {
      const spec = AT_D890_SETTINGS_FIELDS.get(id)!;
      for (const v of sampleFor(id)) {
        const bytes = spec.encode(v);
        expect(bytes.length, id).toBe(spec.length);
        expect(spec.decode(bytes), `${id}=${String(v)}`).toBe(v);
      }
    },
  );

  it.each(AT_D890_ALL_SETTINGS_FIELD_IDS)('%s: refuses a value outside the list', (id) => {
    const spec = AT_D890_SETTINGS_FIELDS.get(id)!;
    const def = atD890SettingField(id)!;
    const bad: unknown[] = [{}, null, undefined];
    if (def.kind === 'boolean') bad.push(1, 'on');
    else if (def.kind === 'password') bad.push(5, true, '123456789', '12a4', ' 1', '١٢٣');
    else if (def.kind === 'text')
      bad.push(5, 'x'.repeat(AT_D890_POWER_ON_LINE_MAX_LENGTH + 1), 'café', 'tab\t', '中');
    else {
      const values = def.options!.map((o) => o.value);
      bad.push(true, '1', -1, 1.5);
      for (let n = 0; n < 256; n++) {
        if (!values.includes(n)) bad.push(n);
      }
    }
    for (const v of bad) {
      expect(() => spec.encode(v as AtD890SettingValue), `${id}=${String(v)}`).toThrow(
        RadioProtocolError,
      );
    }
  });

  it('keyShort* and keyLong* refuse 65 and 255 and accept 0 and 64', () => {
    const ids = AT_D890_V1_SETTINGS_FIELD_IDS.filter((i) => /^key(Short|Long)/.test(i));
    expect(ids).toHaveLength(10);
    for (const id of ids) {
      const spec = AT_D890_SETTINGS_FIELDS.get(id)!;
      expect(() => spec.encode(AT_D890_KEY_FUNCTION_MAX + 1)).toThrow(RadioProtocolError);
      expect(() => spec.encode(255)).toThrow(RadioProtocolError);
      expect([...spec.encode(0)]).toEqual([0]);
      expect([...spec.encode(AT_D890_KEY_FUNCTION_MAX)]).toEqual([AT_D890_KEY_FUNCTION_MAX]);
    }
  });

  it('puts the ten key fields at +0x10..0x14 and +0x41..0x45', () => {
    ['PF1', 'PF2', 'PF3', 'P1', 'P2'].forEach((k, i) => {
      expect(AT_D890_SETTINGS_FIELDS.get(`keyShort${k}`)!.address).toBe(0x3500010 + i);
      expect(AT_D890_SETTINGS_FIELDS.get(`keyLong${k}`)!.address).toBe(0x3500041 + i);
    });
  });

  it('refuses the colour index 7 for name colours and 8 for the call sign colour', () => {
    for (const id of [
      'channelNameColourA',
      'channelNameColourB',
      'zoneNameColourA',
      'zoneNameColourB',
    ]) {
      expect(() => AT_D890_SETTINGS_FIELDS.get(id)!.encode(7)).toThrow(RadioProtocolError);
    }
    expect([...AT_D890_SETTINGS_FIELDS.get('callSignColour')!.encode(7)]).toEqual([7]);
    expect(() => AT_D890_SETTINGS_FIELDS.get('callSignColour')!.encode(8)).toThrow(
      RadioProtocolError,
    );
  });

  it('decodes values Studio does not offer to undefined', () => {
    const get = (id: string, b: number) =>
      AT_D890_SETTINGS_FIELDS.get(id)!.decode(Uint8Array.of(b));
    expect(get('callDisplayMode', 2)).toBeUndefined();
    expect(get('powerOnScreen', 2)).toBeUndefined();
    expect(get('standbyBackground', 1)).toBeUndefined();
    expect(get('keyShortP1', 65)).toBeUndefined();
    expect(get('keyShortP1', 0xff)).toBeUndefined();
  });

  it('decodes any non-zero volume bar byte as on, other booleans only 0 and 1', () => {
    const get = (id: string, b: number) =>
      AT_D890_SETTINGS_FIELDS.get(id)!.decode(Uint8Array.of(b));
    expect(get('volumeBar', 7)).toBe(true);
    expect(get('keyTone', 7)).toBe(true);
    expect(get('smsAlert', 7)).toBeUndefined();
    expect(get('keyTone', 0)).toBe(false);
  });

  it('encodes power-on lines as UTF-16LE, NUL padded to 0x20 bytes', () => {
    const line1 = AT_D890_SETTINGS_FIELDS.get('powerOnLine1')!;
    const line2 = AT_D890_SETTINGS_FIELDS.get('powerOnLine2')!;
    expect(line1.address).toBe(D890_MAP.OptionalSettingsExt);
    expect(line2.address).toBe(D890_MAP.OptionalSettingsExt + 0x20);
    const bytes = line1.encode('AB');
    expect(bytes.length).toBe(0x20);
    expect([...bytes.subarray(0, 6)]).toEqual([0x41, 0, 0x42, 0, 0, 0]);
    expect(bytes.subarray(4).every((b) => b === 0)).toBe(true);
    expect([...line2.encode('')]).toEqual(new Array(0x20).fill(0));
    expect(line1.decode(line1.encode('12345678901234'))).toBe('12345678901234');
    expect(line1.decode(new Uint8Array(0x20).fill(0xff))).toBeUndefined();
  });

  it('always leaves a NUL terminator after a power-on line, even at the longest length', () => {
    // The firmware draws a line until 0x0000; a full 16 unit line would run into the next one.
    expect(AT_D890_POWER_ON_LINE_MAX_LENGTH).toBeLessThanOrEqual(15);
    for (const id of ['powerOnLine1', 'powerOnLine2']) {
      const spec = AT_D890_SETTINGS_FIELDS.get(id)!;
      for (const text of ['', 'A', 'x'.repeat(AT_D890_POWER_ON_LINE_MAX_LENGTH)]) {
        const bytes = spec.encode(text);
        expect([...bytes.subarray(0x1e)], `${id} "${text}"`).toEqual([0, 0]);
      }
      expect(() => spec.encode('x'.repeat(16))).toThrow(RadioProtocolError);
      expect(() => spec.encode('x'.repeat(15))).toThrow(RadioProtocolError);
    }
  });

  it('does not offer TX preamble 0..4: the firmware uses at least 5', () => {
    const spec = AT_D890_SETTINGS_FIELDS.get('txPreamble')!;
    for (const v of [0, 1, 4]) expect(() => spec.encode(v)).toThrow(RadioProtocolError);
    expect([...spec.encode(5)]).toEqual([5]);
    expect([...spec.encode(40)]).toEqual([40]);
    expect(() => spec.encode(41)).toThrow(RadioProtocolError);
  });

  it('offers nothing above the firmware load clamp (0x080DDEE0) or reader ceiling', () => {
    const ceilings: Record<string, number> = {
      callDisplayMode: 1,
      lastCaller: 3,
      aliasDisplayPriority: 2,
      aliasTxFormat: 2,
      callSignColour: 7,
      powerOnScreen: 1, // clamp is >2, custom picture (2) is not offered
      powerOnVolumeLevel: 15,
      maxVolume: 8,
      maxHeadphoneVolume: 8,
      audioProfile: 3,
      rxNoiseReduction: 5,
      txNoiseReduction: 5,
      menuExitTime: 11,
      standbyTextColour: 7,
      channelNameColourA: 6,
      channelNameColourB: 6,
      zoneNameColourA: 6,
      zoneNameColourB: 6,
      standbyBackground: 0,
      timeZone: 33,
      longPressTime: 4,
      voiceHeaderRepeats: 10,
      smsFormat: 2,
      txPreamble: 40,
      backlightTimeout: 15,
      txTimeout: 8,
      autoPowerOff: 4,
      powerSave: 2,
      dmrMicGain: 5,
      analogueMicGain: 5,
      talkPermitTone: 3,
      digitalIdleTone: 3,
    };
    for (const [id, ceiling] of Object.entries(ceilings)) {
      const values = atD890SettingField(id)!.options!.map((o) => o.value);
      expect(Math.max(...values), id).toBeLessThanOrEqual(ceiling);
    }
  });

  it('keeps masked +0x110 specs independent', () => {
    const patches = resolveAtD890SettingsPatches(
      [
        { fieldId: 'showChannelType', value: true },
        { fieldId: 'showTimeSlot', value: false },
        { fieldId: 'showColourCode', value: true },
      ],
      'stock',
    );
    expect(patches.map((p) => [p.bytes[0], p.mask[0]])).toEqual([
      [0x01, 0x01],
      [0x00, 0x02],
      [0x04, 0x04],
    ]);
    const unit = new Uint8Array(0x40000).fill(0xff);
    applyAtD890SettingsPatchesToUnit(0x3500000, unit, patches);
    expect(unit[0x110]).toBe(0xff & ~0x02);
    expect(AT_D890_SETTINGS_FIELDS.get('showTimeSlot')!.decode(Uint8Array.of(unit[0x110]!))).toBe(
      false,
    );
    expect(AT_D890_SETTINGS_FIELDS.get('showColourCode')!.decode(Uint8Array.of(unit[0x110]!))).toBe(
      true,
    );
  });

  it('a mixed set (enum, boolean, text, masked bit) changes exactly those bytes', () => {
    const unit = new Uint8Array(0x40000).fill(0xaa);
    const before = unit.slice();
    const patches = resolveAtD890SettingsPatches(
      [
        { fieldId: 'callSignColour', value: 7 },
        { fieldId: 'volumeBar', value: false },
        { fieldId: 'powerOnLine1', value: 'HI' },
        { fieldId: 'showTimeSlot', value: true },
      ],
      'stock',
    );
    applyAtD890SettingsPatchesToUnit(0x3500000, unit, patches);
    const changed: number[] = [];
    unit.forEach((b, i) => {
      if (b !== before[i]) changed.push(i);
    });
    const lineBytes = Array.from({ length: 0x20 }, (_, i) => 0x900 + i);
    // 0xaa -> 0xaa | 0x02 changes nothing at +0x110 (bit 1 is already set), so it is not listed.
    expect(changed).toEqual([0x47, 0xbc, ...lineBytes]);
    expect(unit[0x110]).toBe(0xaa);
  });

  it('leaves the digital protocol byte +0x152, NXDN mic gain +0x153 and Reset Digital Protocol +0x154 as read when the radio does not report NXDN enabled (the Write session adds the +0x154 = Off patch only then)', () => {
    for (const spec of AT_D890_SETTINGS_FIELDS.values()) {
      const end = spec.address + spec.length;
      for (const off of [0x152, 0x153, 0x154]) {
        const at = 0x3500000 + off;
        expect(spec.address <= at && at < end, `${spec.id} covers +0x${off.toString(16)}`).toBe(
          false,
        );
      }
    }
    const unit = new Uint8Array(0x40000).fill(0xaa);
    unit[0x152] = 1;
    unit[0x153] = 3;
    unit[0x154] = 2;
    const patches = resolveAtD890SettingsPatches(
      [
        { fieldId: 'callSignColour', value: 7 },
        { fieldId: 'volumeBar', value: false },
        { fieldId: 'showTimeSlot', value: true },
      ],
      'mm9pdy',
    );
    expect(patches.length).toBeGreaterThan(0);
    applyAtD890SettingsPatchesToUnit(0x3500000, unit, patches);
    expect(unit[0x152]).toBe(1);
    expect(unit[0x153]).toBe(3);
    expect(unit[0x154]).toBe(2);
  });

  it('the +0x154 = Off patch is added only for the MM9PDY target with the session flag', () => {
    const on = atD890UploadBankIntentFromOrganisation({
      atD890SettingsTarget: 'mm9pdy',
      atD890ResetDigitalProtocolOff: true,
    });
    expect(on.settingsPatches?.map((p) => [p.address, [...p.bytes]])).toEqual([[0x3500154, [0]]]);
    for (const organisation of [
      { atD890SettingsTarget: 'mm9pdy' as const },
      { atD890SettingsTarget: 'stock' as const, atD890ResetDigitalProtocolOff: true },
      { atD890ResetDigitalProtocolOff: true },
    ]) {
      expect(atD890UploadBankIntentFromOrganisation(organisation).settingsPatches).toBeUndefined();
    }
  });

  it('never trips the erased-span guard for a valid encode, empty lines included', () => {
    const unit = new Uint8Array(0x40000).fill(0xff);
    const patches = resolveAtD890SettingsPatches(
      [
        { fieldId: 'keyTone', value: false },
        { fieldId: 'powerOnLine1', value: '' },
        { fieldId: 'powerOnLine2', value: '' },
      ],
      'stock',
    );
    applyAtD890SettingsPatchesToUnit(0x3500000, unit, patches);
    expect(() => assertAtD890SentinelSpansNotErased(0x3500000, unit)).not.toThrow();
    expect(unit.subarray(0x900, 0x940).every((b) => b === 0)).toBe(true);
  });

  it('MM9PDY key names change labels, not wire values', () => {
    const stock = atD890KeyFunctionOptions('stock');
    const mm = atD890KeyFunctionOptions('mm9pdy');
    const spec = AT_D890_SETTINGS_FIELDS.get('keyShortP1')!;
    for (let i = 0; i < stock.length; i++) {
      expect([...spec.encode(stock[i]!.value)]).toEqual([...spec.encode(mm[i]!.value)]);
    }
  });
});
