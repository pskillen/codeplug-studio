/**
 * CPS-derived fixtures (#1465): synthetic images built from the stock CPS's documented encodings
 * (findings F110-F130), run through Studio's Read -> library -> Write path and asserted by
 * meaning. Per direction (AGENTS.md): A parses a CPS-shaped image, B exports from the model and
 * parses the bytes by the CPS's meaning. The fresh-record principle itself is pinned in
 * channelCodec.test.ts (#1464); here it is checked on a whole CPS-shaped image.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import {
  RT95_SETTING_FIELDS,
  RT95_POWER_ON_PASSWORD_DIGITS,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import {
  decodeChannelsFromImage,
  encodeChannelRecord,
  encodeChannelsIntoImage,
  findRt95UnrepresentableChannels,
} from './channelCodec.ts';
import { summariseRt95Clone } from './cloneSummary.ts';
import { RT95_CHANNEL_COUNT, RT95_IMAGE_SIZE, RT95_MODEL_ID } from './constants.ts';
import { RT95_CTCSS_VAL_TO_HZ } from './ctcssToneTable.ts';
import {
  buildCpsImage,
  CPS_CHANNEL_FIXTURES as F,
  cpsChannelRecord,
  cpsCtcssSweep,
  cpsNameView,
  mhz,
  parseCpsChannelRecord,
  type CpsChannelSpec,
} from './__fixtures__/cpsDerivedImage.ts';
import { buildFakeRt95Eeprom, createFakeRt95Pipe } from './__fixtures__/fakeRt95Pipe.ts';
import {
  RT95_PASSWORD_FIELD_IDS,
  RT95_SWEEP_FIELDS,
  rt95FixtureValues,
  rt95OverridesAt,
} from './__fixtures__/settingsFixtures.ts';
import { Rt95Protocol, setRt95EndAtForTests, setRt95RetryTuningForTests } from './protocol.ts';
import { decodeRt95RadioSettings, readRt95SettingsSnapshotFromImage } from './settingsCodec.ts';
import {
  RT95_SETTINGS_FIELDS,
  resolveRt95SettingsPatches,
  type Rt95SettingValue,
} from './settingsFields.ts';
import { applyRt95SettingsPatchesToImage } from './settingsPatch.ts';

const FIXTURES: CpsChannelSpec[] = [...Object.values(F), ...cpsCtcssSweep()];

function channelAt(image: Uint8Array, slot: number): RadioChannelDto {
  return decodeChannelsFromImage(image).find((c) => c.slotIndex === slot)!;
}

function recordAt(image: Uint8Array, slot: number): Uint8Array {
  return image.subarray((slot - 1) * 32, slot * 32);
}

/** Read -> library -> Write at the codec seam: decode a CPS image, encode onto a fresh one. */
function roundTrip(image: Uint8Array): Uint8Array {
  const library = decodeChannelsFromImage(image).filter((c) => !c.empty);
  const next = image.slice();
  encodeChannelsIntoImage(next, library);
  return next;
}

describe('CPS-derived channel fixtures, direction A: parse a CPS-shaped image by meaning', () => {
  const image = buildCpsImage(FIXTURES);

  it('fills the occupied and scan bitmaps the way the CPS does', () => {
    expect(image[0x1940]).toBe(0b0001_1111 | 0b1110_0000); // slots 1-8
    expect(decodeChannelsFromImage(image).filter((c) => !c.empty)).toHaveLength(FIXTURES.length);
    expect(channelAt(image, F.narrowLow.slot).scanAdd).toBe(true);
    expect(channelAt(image, F.widePlus.slot).scanAdd).toBe(false);
    expect(channelAt(image, F.lastSlot.slot).scanAdd).toBe(true);
    expect(RT95_CHANNEL_COUNT).toBe(200);
  });

  it('reads width 12.5 and 25 kHz, power Low/Middle/High and the duplex enum', () => {
    const narrow = channelAt(image, F.narrowLow.slot);
    expect(narrow).toMatchObject({ bandwidth: 'NFM', powerPercent: 20, wireName: 'NFM-01' });
    expect(narrow.txHz).toBe(narrow.rxHz);
    const plus = channelAt(image, F.widePlus.slot);
    expect(plus).toMatchObject({ bandwidth: 'FM', powerPercent: 40, rxHz: mhz(145.6) });
    expect(plus.txHz).toBe(mhz(146.2));
    const minus = channelAt(image, F.uhfMinus.slot);
    expect(minus).toMatchObject({ bandwidth: 'FM', powerPercent: 100, rxHz: mhz(438.8) });
    expect(minus.txHz).toBe(mhz(431.2));
  });

  it('reads split duplex without asserting the TX meaning (open question O2)', () => {
    const split = channelAt(image, F.split.slot);
    expect(split).toMatchObject({ empty: false, rxHz: mhz(433.5), wireName: 'SPLIT4' });
  });

  it('reads TX off as receive only', () => {
    expect(channelAt(image, F.rxOnly.slot)).toMatchObject({ rxOnly: true, wireName: 'WX-5' });
    expect(channelAt(image, F.narrowLow.slot).rxOnly).toBeUndefined();
  });

  it('reads CTCSS, DCS normal/inverted and mixed tone modes', () => {
    expect(channelAt(image, F.ctcssPair.slot)).toMatchObject({
      txTone: { kind: 'ctcss', hz: 88.5 },
      rxTone: { kind: 'ctcss', hz: 100.0 },
    });
    expect(channelAt(image, F.dcsMixed.slot)).toMatchObject({
      txTone: { kind: 'dcs', code: 23, polarity: 'N' },
      rxTone: { kind: 'dcs', code: 754, polarity: 'I' },
    });
    expect(channelAt(image, F.toneCross.slot)).toMatchObject({
      txTone: { kind: 'ctcss', hz: 100.0 },
      rxTone: { kind: 'dcs', code: 25, polarity: 'N' },
    });
  });

  it('reads every one of the 51 CTCSS indexes on both ends', () => {
    expect(Object.keys(RT95_CTCSS_VAL_TO_HZ)).toHaveLength(51);
    for (const spec of cpsCtcssSweep()) {
      const ch = channelAt(image, spec.slot);
      expect(ch.txTone, spec.name).toEqual({
        kind: 'ctcss',
        hz: RT95_CTCSS_VAL_TO_HZ[spec.ctcssEncodeIndex!],
      });
      expect(ch.rxTone, spec.name).toEqual({
        kind: 'ctcss',
        hz: RT95_CTCSS_VAL_TO_HZ[spec.ctcssDecodeIndex!],
      });
    }
  });

  it('reads names: CPS charset, inner space, NUL after a short name, bytes outside the charset', () => {
    expect(channelAt(image, F.spacedName.slot).wireName).toBe('A B-12');
    expect(channelAt(image, F.nulName.slot).wireName).toBe('AB');
    // Studio shows the bytes as they are; the CPS would show spaces for them (F122).
    expect(channelAt(image, F.oddName.slot).wireName).toBe('lo/er.');
    expect(cpsNameView(recordAt(image, F.oddName.slot).subarray(24, 30))).toBe('');
  });

  it('reads the last slot', () => {
    expect(channelAt(image, 200)).toMatchObject({ wireName: 'LAST', scanAdd: true });
  });

  it('reads the documented-loss channels as Studio can hold them (20 kHz as 25, custom CTCSS as none)', () => {
    expect(channelAt(image, F.width20.slot).bandwidth).toBe('FM');
    const custom = channelAt(image, F.customCtcss.slot);
    expect(custom.txTone).toEqual({ kind: 'none' });
    expect(custom.rxTone).toEqual({ kind: 'none' });
  });

  it('reads a channel that carries unmodelled CPS bytes', () => {
    expect(channelAt(image, F.unmodelled.slot)).toMatchObject({
      wireName: 'UNMOD',
      rxHz: mhz(146.5),
      scanAdd: true,
    });
  });
});

describe('CPS-derived channel fixtures, direction B: export from the model, parse by CPS meaning', () => {
  const dto = (over: Partial<RadioChannelDto> = {}): RadioChannelDto => ({
    slotIndex: 1,
    empty: false,
    wireName: 'TEST',
    rxHz: mhz(145.5),
    txHz: mhz(145.5),
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
    ...over,
  });
  const view = (over: Partial<RadioChannelDto> = {}) =>
    parseCpsChannelRecord(encodeChannelRecord(dto(over)));

  it('writes width 12.5 as 0 and 25 as 2, never the 20 kHz code', () => {
    expect(view({ bandwidth: 'NFM' }).width).toBe(0);
    expect(view({ bandwidth: 'FM' }).width).toBe(2);
  });

  it('writes power Low, Middle, High as 0, 1, 2', () => {
    expect([20, 40, 100].map((p) => view({ powerPercent: p }).power)).toEqual([0, 1, 2]);
  });

  it('writes duplex none, plus and minus with the offset', () => {
    expect(view()).toMatchObject({ duplex: 0, offsetHz: 0 });
    expect(view({ txHz: mhz(146.1) })).toMatchObject({ duplex: 1, offsetHz: mhz(0.6) });
    expect(view({ rxHz: mhz(438.8), txHz: mhz(431.2) })).toMatchObject({
      duplex: 2,
      offsetHz: mhz(7.6),
    });
  });

  it('writes receive only as TX off', () => {
    expect(view({ rxOnly: true }).txOff).toBe(true);
    expect(view().txOff).toBe(false);
  });

  it('writes tone modes and indexes the way the CPS reads them, for all 51 CTCSS tones', () => {
    for (const [index, hz] of Object.entries(RT95_CTCSS_VAL_TO_HZ)) {
      const v = view({ txTone: { kind: 'ctcss', hz }, rxTone: { kind: 'ctcss', hz } });
      expect(v, `index ${index}`).toMatchObject({
        encodeMode: 1,
        decodeMode: 1,
        ctcssEncodeIndex: Number(index),
        ctcssDecodeIndex: Number(index),
      });
    }
    expect(view()).toMatchObject({ encodeMode: 0, decodeMode: 0 });
  });

  it('writes DCS codes as binary words of the octal digits, with invert in bit 9', () => {
    const normal = view({ txTone: { kind: 'dcs', code: 23, polarity: 'N' } });
    expect(normal).toMatchObject({ encodeMode: 2, dcsEncodeCode: 23, dcsEncodeInvert: false });
    const high = view({ rxTone: { kind: 'dcs', code: 754, polarity: 'I' } });
    expect(high).toMatchObject({ decodeMode: 2, dcsDecodeCode: 754, dcsDecodeInvert: true });
    const raw = encodeChannelRecord(dto({ txTone: { kind: 'dcs', code: 23, polarity: 'N' } }));
    expect(raw[16]).toBe(0x13); // D023 is 0x13 (F121)
  });

  it('writes names as ASCII, space padded to six; an empty name is six spaces', () => {
    expect(view({ wireName: 'AB' }).nameBytes).toEqual([0x41, 0x42, 0x20, 0x20, 0x20, 0x20]);
    expect(view({ wireName: '' }).nameBytes).toEqual(new Array(6).fill(0x20));
    expect(view({ wireName: 'LONGER-NAME' }).nameBytes).toEqual(
      [...'LONGER'].map((c) => c.charCodeAt(0)),
    );
    expect(cpsNameView(view({ wireName: 'NFM-01' }).nameBytes)).toBe('NFM-01');
  });

  it('writes the CPS-explained bytes Studio does not model as Off / 0 on every record', () => {
    const lib = decodeChannelsFromImage(buildCpsImage(FIXTURES)).filter((c) => !c.empty);
    for (const ch of lib) {
      expect(parseCpsChannelRecord(encodeChannelRecord(ch)), ch.wireName).toMatchObject({
        byte8: 0,
        dtmfId: 0,
        optionalSignalling: 0,
        fiveToneId: 0,
        customCtcssDeciHz: 0,
      });
    }
  });
});

describe('CPS-derived channel fixtures, Read -> library -> Write', () => {
  const image = buildCpsImage(FIXTURES);

  it('keeps every modelled field through a round trip', () => {
    const before = decodeChannelsFromImage(image).filter((c) => !c.empty);
    const after = decodeChannelsFromImage(roundTrip(image)).filter((c) => !c.empty);
    expect(after).toHaveLength(before.length);
    for (const b of before) {
      const a = after.find((c) => c.slotIndex === b.slotIndex)!;
      if (b.slotIndex === F.split.slot) {
        // Split duplex is written back as none/plus/minus (Studio never writes 3): only RX is pinned.
        expect(a.rxHz).toBe(b.rxHz);
        continue;
      }
      expect(a, b.wireName).toEqual(b);
    }
  });

  it('keeps the occupied and scan bitmaps', () => {
    const next = roundTrip(image);
    expect(next.subarray(0x1940, 0x1980)).toEqual(image.subarray(0x1940, 0x1980));
  });

  it('writes the CPS-explained bytes Studio does not model as Off / 0 (owner principle, #1536)', () => {
    const next = roundTrip(image);
    const rec = recordAt(next, F.unmodelled.slot);
    expect(parseCpsChannelRecord(rec)).toMatchObject({
      byte8: 0,
      dtmfId: 0,
      optionalSignalling: 0,
      fiveToneId: 0,
      customCtcssDeciHz: 0,
    });
    for (const i of [18, 19, 22]) expect(rec[i], `byte ${i}`).toBe(0);
    expect(rec[11]! >> 4).toBe(0);
    // And it was not zero before: the fixture really carried them.
    const before = parseCpsChannelRecord(recordAt(image, F.unmodelled.slot));
    expect(before).toMatchObject({ byte8: 0x5a, dtmfId: 7, optionalSignalling: 3, fiveToneId: 12 });
  });

  it('20 kHz and custom CTCSS are documented, intentional loss, with their warnings', () => {
    const lost = findRt95UnrepresentableChannels(image);
    expect(lost.width20kHz).toEqual([F.width20.slot]);
    expect(lost.customCtcss).toEqual([F.customCtcss.slot]);

    const bag = createRadioCloneHydrationBag({
      radioModelId: RT95_MODEL_ID,
      imageBytes: image,
      capturedVia: 'web-serial',
    });
    const warnings = summariseRt95Clone(bag)?.roundTripWarnings ?? [];
    expect(warnings.join('\n')).toMatch(/20 kHz.*slots 12\b/);
    expect(warnings.join('\n')).toMatch(/custom CTCSS.*slots 13\b/);

    const next = roundTrip(image);
    expect(parseCpsChannelRecord(recordAt(next, F.width20.slot)).width).toBe(2);
    expect(parseCpsChannelRecord(recordAt(next, F.customCtcss.slot))).toMatchObject({
      encodeMode: 0,
      decodeMode: 0,
      ctcssEncodeIndex: 0,
      ctcssDecodeIndex: 0,
      customCtcssDeciHz: 0,
    });
    expect(findRt95UnrepresentableChannels(next)).toEqual({ width20kHz: [], customCtcss: [] });
  });

  it('keeps names outside the CPS charset (the CPS itself would turn them into spaces)', () => {
    expect(channelAt(roundTrip(image), F.oddName.slot).wireName).toBe('lo/er.');
  });
});

describe('CPS-derived image through the real Read, library, Write (fake cable)', () => {
  beforeEach(() => {
    setRt95EndAtForTests(0);
    setRt95RetryTuningForTests({ intervalMs: 20, budgetMs: 400, timeoutMs: 10 });
  });
  afterEach(() => {
    setRt95EndAtForTests(0);
    setRt95RetryTuningForTests({});
  });

  it('keeps channels by meaning and leaves 0x32A0 and above, settings and unmodelled settings bytes alone', async () => {
    const eeprom = buildFakeRt95Eeprom();
    const cps = buildCpsImage(FIXTURES);
    // Bytes the CPS would zero; Studio keeps them (read-modify-write outside the channel span).
    const kept = [0x3203, 0x3212, 0x321f, 0x3262, 0x326e, 0x326f];
    for (const a of kept) cps[a] = 0xc3;
    eeprom.set(cps, 0);
    const tail = eeprom.slice(0x32a0);

    const pipe = createFakeRt95Pipe({ eeprom });
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    const prior = await radio.download();
    const library = radio.decodeChannels(prior).filter((c) => !c.empty);
    await radio.upload(radio.encodeChannels(prior, library));

    const written = pipe.eeprom.slice(0, RT95_IMAGE_SIZE);
    for (const a of kept) expect(written[a], `0x${a.toString(16)}`).toBe(0xc3);
    expect(pipe.eeprom.slice(0x32a0)).toEqual(tail);
    const after = decodeChannelsFromImage(written).filter((c) => !c.empty);
    expect(after).toHaveLength(library.length);
    expect(channelAt(written, F.dcsMixed.slot).rxTone).toEqual({
      kind: 'dcs',
      code: 754,
      polarity: 'I',
    });
    expect(parseCpsChannelRecord(recordAt(written, F.unmodelled.slot)).byte8).toBe(0);
  });
});

/** Fields the sweep cannot round trip because of a known bug (see the `it.fails` below). */
const KNOWN_BROKEN = ['monKeyFunction'];

describe('CPS-derived settings fixtures', () => {
  const blank = (fill = 0xa5): Uint8Array => new Uint8Array(RT95_IMAGE_SIZE).fill(fill);

  it('covers every registered field (the password pair is covered below)', () => {
    const ids = [...RT95_SETTINGS_FIELDS.keys()].sort();
    const covered = [...RT95_SWEEP_FIELDS.map((f) => f.id), ...RT95_PASSWORD_FIELD_IDS].sort();
    expect(covered).toEqual(ids);
  });

  it('writes and reads back every option, boolean and string of every field, touching only its bytes', () => {
    for (const def of RT95_SWEEP_FIELDS) {
      if (KNOWN_BROKEN.includes(def.id)) continue;
      const spec = RT95_SETTINGS_FIELDS.get(def.id)!;
      for (const value of rt95FixtureValues(def)) {
        const base = blank();
        const map = memoryMapFromBytes(base.slice());
        applyRt95SettingsPatchesToImage(
          map,
          resolveRt95SettingsPatches([{ fieldId: def.id, value }], 'stock'),
        );
        const label = `${def.id} = ${String(value)}`;
        expect(
          spec.decode(map.bytes.subarray(spec.address, spec.address + spec.length)),
          label,
        ).toBe(value);
        const changed: number[] = [];
        for (let a = 0; a < base.length; a++) if (map.bytes[a] !== base[a]) changed.push(a);
        const outside = changed.filter((a) => a < spec.address || a >= spec.address + spec.length);
        expect(outside, label).toEqual([]);
        if (spec.mask !== undefined) {
          const keep = ~spec.mask & 0xff;
          expect(map.bytes[spec.address]! & keep, label).toBe(base[spec.address]! & keep);
        }
      }
    }
  });

  // MON Key Function is an enum on mask 0x20 (0x321B bit 5) but encodes its value unshifted, so
  // option 1 masks to 0 and is never written, and a set bit reads back as 0x20 (not an option).
  // Found by the all-fields sweep (#1465). `it.fails` flips to an error when it is fixed.
  it.fails('writes and reads back MON Key Function option 1 (known bug, see follow-up)', () => {
    const spec = RT95_SETTINGS_FIELDS.get('monKeyFunction')!;
    const map = memoryMapFromBytes(blank(0x00));
    applyRt95SettingsPatchesToImage(
      map,
      resolveRt95SettingsPatches([{ fieldId: 'monKeyFunction', value: 1 }], 'stock'),
    );
    expect(spec.decode(map.bytes.subarray(0x321b, 0x321c))).toBe(1);
  });

  it('survives Read -> library -> Write: decode an image, write the decoded values onto another', () => {
    const source = memoryMapFromBytes(blank(0x00));
    applyRt95SettingsPatchesToImage(
      source,
      resolveRt95SettingsPatches(rt95OverridesAt('last'), 'stock'),
    );
    const decoded = decodeRt95RadioSettings(
      readRt95SettingsSnapshotFromImage(source.bytes),
      'stock',
    );
    const overrides = RT95_SWEEP_FIELDS.map((f) => ({
      fieldId: f.id,
      value: decoded[f.id]!.value as Rt95SettingValue,
    }));
    for (const o of overrides) expect(o.value, o.fieldId).not.toBeUndefined();
    const target = memoryMapFromBytes(blank(0x00));
    applyRt95SettingsPatchesToImage(target, resolveRt95SettingsPatches(overrides, 'stock'));
    const again = decodeRt95RadioSettings(readRt95SettingsSnapshotFromImage(target.bytes), 'stock');
    for (const f of RT95_SWEEP_FIELDS) expect(again[f.id]!.value, f.id).toBe(decoded[f.id]!.value);
  });

  it('stores the combo index raw in the fields the CPS documents that way (F124)', () => {
    const raw: [string, number][] = [
      ['beepVolume', 0x3200],
      ['frequencyStep', 0x3201],
      ['squelchLevelA', 0x3204],
      ['squelchLevelB', 0x3205],
      ['speakerVolume', 0x3206],
      ['timeOutTimer', 0x320e],
      ['autoPowerOff', 0x320f],
      ['tbstFrequency', 0x3210],
      ['steType', 0x3218],
      ['steFrequency', 0x3219],
    ];
    for (const [id, address] of raw) {
      const def = RT95_SETTING_FIELDS.find((f) => f.id === id)!;
      for (const option of def.options!) {
        const map = memoryMapFromBytes(blank(0x00));
        applyRt95SettingsPatchesToImage(
          map,
          resolveRt95SettingsPatches([{ fieldId: id, value: option.value }], 'stock'),
        );
        expect(map.bytes[address], `${id} ${option.value}`).toBe(option.value);
      }
    }
  });

  it('packs 0x321B as the CPS bits (MON key aside, see above) and never sets bits 6 and 7', () => {
    // Knob mode is an enum (option 1 = bit 0); the other four are switches.
    const bits: [string, number, number | boolean][] = [
      ['knobMode', 0x01, 1],
      ['trfEnable', 0x02, true],
      ['powerOnResetEnable', 0x04, true],
      ['saveChannelParameter', 0x08, true],
      ['channelLocked', 0x10, true],
    ];
    const map = memoryMapFromBytes(blank(0x00));
    applyRt95SettingsPatchesToImage(
      map,
      resolveRt95SettingsPatches(
        bits.map(([fieldId, , value]) => ({ fieldId, value })),
        'stock',
      ),
    );
    expect(map.bytes[0x321b]).toBe(0x1f);
    for (const [id, bit, value] of bits) {
      const one = memoryMapFromBytes(blank(0x00));
      applyRt95SettingsPatchesToImage(
        one,
        resolveRt95SettingsPatches([{ fieldId: id, value }], 'stock'),
      );
      expect(one.bytes[0x321b], id).toBe(bit);
    }
  });

  it('writes the power-on password pair: enable flag plus six ASCII digits, padded with 0x00', () => {
    const map = memoryMapFromBytes(blank(0x00));
    applyRt95SettingsPatchesToImage(
      map,
      resolveRt95SettingsPatches(
        [
          { fieldId: 'powerOnPasswordEnabled', value: true },
          { fieldId: 'powerOnPasswordDigits', value: '012345' },
        ],
        'stock',
      ),
    );
    expect(map.bytes[0x3207]! & 1).toBe(1);
    expect([...map.bytes.subarray(0x3240, 0x3240 + RT95_POWER_ON_PASSWORD_DIGITS)]).toEqual(
      [...'012345'].map((c) => c.charCodeAt(0)),
    );
  });

  it('settings-only Write keeps the bytes the CPS would zero and the top two bits of 0x321B', async () => {
    setRt95EndAtForTests(0);
    setRt95RetryTuningForTests({ intervalMs: 20, budgetMs: 400, timeoutMs: 10 });
    try {
      const eeprom = buildFakeRt95Eeprom();
      // Gaps and unmodelled bytes in the settings group (F124, F126): a stock CPS Write sends 0x00.
      const unmodelled = [0x3203, 0x3212, 0x321f, 0x3222, 0x3246, 0x325c, 0x3262, 0x326e, 0x326f];
      for (const a of unmodelled) eeprom[a] = 0xc3;
      eeprom[0x321b] = 0xc0;
      const pipe = createFakeRt95Pipe({ eeprom });
      const radio = new Rt95Protocol();
      await radio.connect(pipe);
      const image = await radio.download();
      await radio.uploadSettingsPatches(
        resolveRt95SettingsPatches(rt95OverridesAt('last'), 'stock'),
        image,
      );
      for (const a of unmodelled) expect(pipe.eeprom[a], `0x${a.toString(16)}`).toBe(0xc3);
      expect(pipe.eeprom[0x321b]! & 0xc0).toBe(0xc0);
      expect(pipe.eeprom[0x321b]! & 0x1f).toBe(0x1f);
    } finally {
      setRt95EndAtForTests(0);
      setRt95RetryTuningForTests({});
    }
  });

  it.todo(
    'keeps the DTMF memory in-use mask at 0x326E-0x326F consistent with edited PTT-ID memories (F119, F124): Studio writes the memories and never the mask',
  );
});
