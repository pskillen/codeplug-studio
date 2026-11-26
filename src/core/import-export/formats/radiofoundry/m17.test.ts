// Vectors from RadioFoundry (MIT): tests/vectors/channel-modes.txt at adfbfce7.
// Copyright (c) 2026 The RadioFoundry Authors. Licence: __fixtures__/LICENSE-RadioFoundry.txt
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RADIOFOUNDRY_KIND_AES,
  RADIOFOUNDRY_KIND_M17,
  radioFoundryChannelKindLabel,
  radioFoundryNameCheck,
  writeRadioFoundryChannelTag,
} from './channelTags.ts';
import { SETTINGS_AREA_SIZE } from './layout.ts';
import {
  decodeM17CallsignRecord,
  decodeM17ChannelBlock,
  describeRadioFoundrySettingsEntry,
  encodeM17CallsignRecord,
  encodeM17ChannelBlock,
  encodeM17Destination,
  M17_RADIO_WIDE_KEY,
  resolveM17Callsign,
} from './m17.ts';
import { crc32, readRadioFoundrySettingsArea } from './settingsArea.ts';
import {
  encodeRadioFoundrySettingsSector,
  mergeRadioFoundrySettingsArea,
  type SettingsAreaValue,
} from './settingsAreaWrite.ts';

const VECTORS = readFileSync(new URL('./__fixtures__/channel-modes.txt', import.meta.url), 'utf8');

function linesStarting(prefix: string): string[] {
  return VECTORS.split('\n').filter((line) => line.startsWith(prefix));
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex === '-') return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Cases the plan quotes on top of the full vector groups in the fixture. */
const QUOTED = [
  'm17enc 3 1 030000009FDD51 AB1CD',
  'm17enc 3 0 130000009FDD51 AB1CD',
  'm17enc 0 1 000616FACECAED M17-M17 A',
  'm17enc 3 1 03000000000000 @all',
  'm17conv - 0 1 FFFFFFFFFFFF',
  'm17conv E5 5 1 FFFFFFFFFFFF',
  'm17conv 130000000ED87D 3 0 0000000ED87D',
  'm17conv 030000009FDD 3 1 FFFFFFFFFFFF',
  'm17conv 00EE6B28000000 0 1 FFFFFFFFFFFF',
  'm17conv 00EE6B27FFFFFF 0 1 EE6B27FFFFFF',
  'm17conv 05000000000001AA 5 1 000000000001',
  'm17dstbad AB1CDEFGHI',
  'm17dstbad AB*CD',
  'm17dstbad @ECHO',
  'm17dstbad M17_M17',
  'm17rec 41423143440000000000 AB1CD',
  'm17rec 61623163640000000000 AB1CD',
  'm17rec 41423143442020202020 AB1CD',
  'm17rec 4142314344FFFFFFFFFF AB1CD',
  'm17rec 20414231434400000000 -',
  'm17rec 41422043440000000000 -',
  'm17rec 41422A43440000000000 -',
  'm17rec 4142314344000000000001 AB1CD',
  'm17call - M0ABC M0ABC-1',
  "m17call - - Bob's",
  'm17call 4142314344 AB1CD Q0TEST',
  'm17call 41422A4344 Q0TEST Q0TEST',
  'check 18A9 A',
  'check 1687 T3 Ops',
  'check CDD2 Sixteen chars!!!',
];

describe('M17 channel-mode vectors', () => {
  it('quotes the plan cases inside the fixture', () => {
    for (const line of QUOTED) expect(VECTORS.split('\n')).toContain(line);
  });

  it.each(linesStarting('m17conv '))('%s', (line) => {
    const m = /^m17conv (-|[0-9A-Fa-f]+) ([0-9A-Fa-f]+) ([0-9A-Fa-f]+) ([0-9A-Fa-f]{12})$/.exec(
      line,
    )!;
    const decoded = decodeM17ChannelBlock(hexToBytes(m[1]!));
    expect(decoded.can).toBe(parseInt(m[2]!, 16));
    expect(decoded.squelchOn).toBe(parseInt(m[3]!, 16) === 1);
    expect(decoded.destinationHex).toBe(m[4]!.toUpperCase());
  });

  it.each(linesStarting('m17enc '))('%s', (line) => {
    const m = /^m17enc ([0-9A-Fa-f]+) ([0-9A-Fa-f]+) ([0-9A-Fa-f]+)(?: (.*))?$/.exec(line)!;
    const block = encodeM17ChannelBlock(parseInt(m[1]!, 16), parseInt(m[2]!, 16) === 1, m[4] ?? '');
    expect(block).not.toBeNull();
    expect(bytesToHex(block!)).toBe(m[3]!.toUpperCase());
  });

  it.each(linesStarting('m17dstbad '))('%s', (line) => {
    const text = line.slice('m17dstbad '.length);
    expect(encodeM17Destination(text)).toBeNull();
    expect(encodeM17ChannelBlock(0, true, text)).toBeNull();
  });

  it.each(linesStarting('m17rec '))('%s', (line) => {
    const m = /^m17rec (-|[0-9A-Fa-f]+) (-|[^\s]+)$/.exec(line)!;
    const callsign = decodeM17CallsignRecord(hexToBytes(m[1]!));
    expect(callsign ?? '-').toBe(m[2]);
  });

  it.each(linesStarting('m17call '))('%s', (line) => {
    const m = /^m17call (-|[0-9A-Fa-f]+) (-|[^\s]+)(?: (.*))?$/.exec(line)!;
    const callsign = resolveM17Callsign(hexToBytes(m[1]!), m[3] ?? '');
    expect(callsign ?? '-').toBe(m[2]);
  });
});

describe('M17 channel tag', () => {
  it('names a kind-6 tag and the callsign for the settings tab', () => {
    const every = writeRadioFoundryChannelTag({
      kind: RADIOFOUNDRY_KIND_M17,
      system: null,
      storedName: new Uint8Array(16),
      txAllowed: true,
      block: encodeM17ChannelBlock(3, false, 'ECHO')!,
    });
    expect(describeRadioFoundrySettingsEntry(0x0406, every)).toBe(
      'Channel 7: M17, CAN 3, every CAN, ECHO',
    );
    const only = writeRadioFoundryChannelTag({
      kind: RADIOFOUNDRY_KIND_M17,
      system: null,
      storedName: new Uint8Array(16),
      txAllowed: true,
      block: encodeM17ChannelBlock(1, true, '')!,
    });
    expect(describeRadioFoundrySettingsEntry(0x0400, only)).toBe(
      'Channel 1: M17, CAN 1, squelch, ALL',
    );
    expect(describeRadioFoundrySettingsEntry(0x0a06, encodeM17CallsignRecord('AB1CD')!)).toBe(
      'M17 callsign: AB1CD',
    );
    expect(describeRadioFoundrySettingsEntry(0x0a06, Uint8Array.of(0x01))).toBe('M17 callsign');
    expect(describeRadioFoundrySettingsEntry(0x0400, Uint8Array.of(2, 0, 0, 0, 0))).toBeNull();
    expect(describeRadioFoundrySettingsEntry(0x0001, Uint8Array.of(1))).toBeNull();
  });

  it('names kind 5 and kind 6', () => {
    expect(radioFoundryChannelKindLabel(RADIOFOUNDRY_KIND_AES)).toBe('Conventional DMR AES-256');
    expect(radioFoundryChannelKindLabel(RADIOFOUNDRY_KIND_M17)).toBe('M17 conventional');
  });

  it('writes the whole kind-6 tag from the model, with reserved bits clear', () => {
    const storedName = new Uint8Array(16).fill(0xff);
    storedName[0] = 'A'.charCodeAt(0);
    const block = encodeM17ChannelBlock(3, false, 'AB1CD')!;
    const tag = writeRadioFoundryChannelTag({
      kind: RADIOFOUNDRY_KIND_M17,
      system: null,
      storedName,
      txAllowed: true,
      block,
    });
    const check = radioFoundryNameCheck(storedName);
    expect([...tag.subarray(0, 5)]).toEqual([0x06, 0xff, check & 0xff, check >> 8, 0x01]);
    expect([...tag.subarray(5)]).toEqual([...block]);
    expect(tag[4]! & 0xfe).toBe(0);
    expect(tag.length).toBe(12);
  });
});

function sectorOf(entries: [number, number[]][], headerLength = 16): Uint8Array {
  const data = entries.flatMap(([key, value]) => [
    key & 0xff,
    key >> 8,
    value.length & 0xff,
    value.length >> 8,
    ...value,
  ]);
  const sector = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
  const crc = crc32(Uint8Array.from(data));
  sector.fill(0, 0, headerLength);
  sector.set([0x52, 0x46, 0x4b, 0x56, 1, headerLength, data.length & 0xff, data.length >> 8], 0);
  sector.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, (crc >>> 24) & 0xff], 8);
  sector.set(data, headerLength);
  return sector;
}

function readEntries(sector: Uint8Array): SettingsAreaValue[] {
  const area = readRadioFoundrySettingsArea(sector);
  expect(area.state).toBe('valid');
  return area.entries.map((entry) => ({ key: entry.key, value: new Uint8Array(entry.value) }));
}

describe('mergeRadioFoundrySettingsArea', () => {
  it('keeps the first value of a key and copies an unknown value byte for byte', () => {
    const opaque = [0xde, 0xad, 0x00, 0xff, 0x10];
    const sector = sectorOf([
      [0x0005, [0x11]],
      [0x0005, [0x22]],
      [0x0300, opaque],
    ]);
    const written = mergeRadioFoundrySettingsArea(sector, {
      ownsChannelTable: false,
      radioWide: new Map([[0x0009, { value: Uint8Array.of(0x01) }]]),
    });
    expect(written.status).toBe('written');
    if (written.status !== 'written') return;
    expect(readEntries(written.sector).map((entry) => [entry.key, [...entry.value]])).toEqual([
      [0x0005, [0x11]],
      [0x0300, opaque],
      [0x0009, [0x01]],
    ]);
  });

  it('keeps bytes after the 10-byte callsign when setting 0x0A06 from the front', () => {
    const stored = [...encodeM17CallsignRecord('Q0TEST')!, 0xab, 0xcd];
    const sector = sectorOf([[M17_RADIO_WIDE_KEY, stored]]);
    const next = encodeM17CallsignRecord('AB1CD')!;
    const written = mergeRadioFoundrySettingsArea(sector, {
      ownsChannelTable: false,
      radioWide: new Map([[M17_RADIO_WIDE_KEY, { value: next, head: true }]]),
    });
    expect(written.status).toBe('written');
    if (written.status !== 'written') return;
    const value = readEntries(written.sector)[0]!.value;
    expect([...value.subarray(0, 10)]).toEqual([...next]);
    expect([...value.subarray(10)]).toEqual([0xab, 0xcd]);
  });

  it('leaves an absent callsign record untouched', () => {
    const sector = sectorOf([[0x0003, [0x01]]]);
    const written = mergeRadioFoundrySettingsArea(sector, {
      ownsChannelTable: true,
      channelTags: new Map(),
    });
    expect(written.status).toBe('unchanged');
    expect(readRadioFoundrySettingsArea(sector).entries.map((entry) => entry.key)).toEqual([
      0x0003,
    ]);
  });

  it('drops every channel tag and appends the tags Studio built', () => {
    const sector = sectorOf([
      [0x0003, [0x01]],
      [0x0400, [2, 0xff, 0, 0, 0]],
      [0x0401, [6, 0xff, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7]],
      [0x1900, [0x25]],
    ]);
    const tag = Uint8Array.of(6, 0xff, 0xa9, 0x18, 0x01, 3, 0, 0, 0, 0, 0, 0);
    const written = mergeRadioFoundrySettingsArea(sector, {
      ownsChannelTable: true,
      channelTags: new Map([[5, tag]]),
    });
    expect(written.status).toBe('written');
    if (written.status !== 'written') return;
    expect(readEntries(written.sector).map((entry) => [entry.key, [...entry.value]])).toEqual([
      [0x0003, [0x01]],
      [0x1900, [0x25]],
      [0x0404, [...tag]],
    ]);
  });

  it('replaces a channel tag that already uses that key, and leaves the same tag unchanged', () => {
    const sector = sectorOf([[0x0400, [2, 0xff, 0, 0, 0]]]);
    const tag = Uint8Array.of(6, 0xff, 0xa9, 0x18, 0x01, 3, 0, 0, 0, 0, 0, 0);
    const replaced = mergeRadioFoundrySettingsArea(sector, {
      ownsChannelTable: true,
      channelTags: new Map([[1, tag]]),
    });
    expect(replaced.status).toBe('written');
    if (replaced.status !== 'written') return;
    expect(readEntries(replaced.sector)).toEqual([{ key: 0x0400, value: tag }]);
    expect(
      mergeRadioFoundrySettingsArea(replaced.sector, {
        ownsChannelTable: true,
        channelTags: new Map([[1, tag]]),
      }).status,
    ).toBe('unchanged');
  });

  it('leaves channel tags in place when the write does not own the channel table', () => {
    const tag = [4, 0xff, 1, 2, 0];
    const sector = sectorOf([
      [0x0400, tag],
      [0x0003, [0x00]],
    ]);
    const written = mergeRadioFoundrySettingsArea(sector, {
      ownsChannelTable: false,
      channelTags: new Map([[1, Uint8Array.of(6)]]),
      radioWide: new Map([[0x0003, { value: Uint8Array.of(0x01) }]]),
    });
    expect(written.status).toBe('written');
    if (written.status !== 'written') return;
    expect(readEntries(written.sector).map((entry) => [entry.key, [...entry.value]])).toEqual([
      [0x0400, tag],
      [0x0003, [0x01]],
    ]);
  });

  it('reuses the header length and reserved bytes of a valid sector', () => {
    const sector = sectorOf([[0x0001, [0x02]]], 24);
    sector[14] = 0xab;
    sector[20] = 0xcd;
    const crc = crc32(sector.subarray(24, 24 + 5));
    sector[8] = crc & 0xff;
    sector[9] = (crc >>> 8) & 0xff;
    sector[10] = (crc >>> 16) & 0xff;
    sector[11] = (crc >>> 24) & 0xff;
    const written = mergeRadioFoundrySettingsArea(sector, {
      ownsChannelTable: false,
      radioWide: new Map([[0x0004, { value: Uint8Array.of(0x07) }]]),
    });
    expect(written.status).toBe('written');
    if (written.status !== 'written') return;
    expect(written.sector[5]).toBe(24);
    expect(written.sector[14]).toBe(0xab);
    expect(written.sector[20]).toBe(0xcd);
    expect(readEntries(written.sector).map((entry) => entry.key)).toEqual([0x0001, 0x0004]);
  });

  it('starts a fresh area from erased or invalid bytes', () => {
    const erased = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
    const invalid = new Uint8Array(SETTINGS_AREA_SIZE);
    for (const sector of [erased, invalid]) {
      const before = sector.slice();
      const written = mergeRadioFoundrySettingsArea(sector, {
        ownsChannelTable: false,
        radioWide: new Map([[0x0001, { value: Uint8Array.of(0x05) }]]),
      });
      expect(written.status).toBe('written');
      if (written.status !== 'written') return;
      expect([...sector]).toEqual([...before]);
      expect(readEntries(written.sector)).toEqual([{ key: 0x0001, value: Uint8Array.of(0x05) }]);
      expect(written.sector[SETTINGS_AREA_SIZE - 1]).toBe(0xff);
    }
  });

  it('returns unchanged for a no-op, including a set of the same value', () => {
    const sector = sectorOf([
      [0x0003, [0x01]],
      [0x0a06, [...encodeM17CallsignRecord('AB1CD')!]],
    ]);
    expect(mergeRadioFoundrySettingsArea(sector, { ownsChannelTable: false }).status).toBe(
      'unchanged',
    );
    expect(
      mergeRadioFoundrySettingsArea(sector, {
        ownsChannelTable: true,
        channelTags: new Map(),
        radioWide: new Map([[0x0a06, { value: encodeM17CallsignRecord('AB1CD')!, head: true }]]),
      }).status,
    ).toBe('unchanged');
    expect(
      mergeRadioFoundrySettingsArea(new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff), {
        ownsChannelTable: false,
      }).status,
    ).toBe('unchanged');
  });

  it('refuses a newer area and an overflow, and leaves the sector as it was', () => {
    const newer = sectorOf([[0x0001, [0x01]]]);
    newer[4] = 2;
    const beforeNewer = newer.slice();
    expect(
      mergeRadioFoundrySettingsArea(newer, {
        ownsChannelTable: false,
        radioWide: new Map([[0x0002, { value: Uint8Array.of(0x01) }]]),
      }),
    ).toEqual({ status: 'refused', reason: 'newer' });
    expect([...newer]).toEqual([...beforeNewer]);

    const full = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
    const beforeFull = full.slice();
    expect(
      mergeRadioFoundrySettingsArea(full, {
        ownsChannelTable: false,
        radioWide: new Map([[0x0001, { value: new Uint8Array(4077) }]]),
      }),
    ).toEqual({ status: 'refused', reason: 'overflow', overflowBytes: 1 });
    expect([...full]).toEqual([...beforeFull]);
  });

  it('writes a CRC the reader accepts', () => {
    const encoded = encodeRadioFoundrySettingsSector([
      { key: 0x0001, value: Uint8Array.of(0x39, 0x30, 0x00, 0x00) },
    ]);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const area = readRadioFoundrySettingsArea(encoded.sector);
    expect(area.state).toBe('valid');
    expect(area.entries.map((entry) => [entry.key, [...entry.value]])).toEqual([
      [1, [0x39, 0x30, 0, 0]],
    ]);
  });
});
