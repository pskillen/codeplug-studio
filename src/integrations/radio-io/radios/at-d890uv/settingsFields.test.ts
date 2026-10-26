import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import {
  AT_D890_NEVER_PATCH_MAIN_OFFSETS,
  AT_D890_SETTINGS_FIELDS,
  assertAtD890SettingsSpecPermitted,
  resolveAtD890SettingsPatches,
  type AtD890SettingsFieldSpec,
} from './settingsFields.ts';

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
