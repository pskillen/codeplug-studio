// Vectors from RadioFoundry (MIT): site/tests/kv.test.mjs and tests/vectors/channel-modes.txt at 454a5b76.
// Copyright (c) 2026 The RadioFoundry Authors. Licence: __fixtures__/LICENSE-RadioFoundry.txt
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isChannelTagLive,
  radioFoundryChannelKindLabel,
  radioFoundryNameCheck,
  readChannelTagHeaders,
  type ChannelTagHeader,
} from './channelTags.ts';
import { SETTINGS_AREA_SIZE } from './layout.ts';
import { crc32, readRadioFoundrySettingsArea } from './settingsArea.ts';

function storedName(name: string, pad: number): Uint8Array {
  const out = new Uint8Array(16).fill(pad);
  out.set(new TextEncoder().encode(name), 0);
  return out;
}

function areaOf(entries: [number, number[]][]) {
  const data = entries.flatMap(([key, value]) => [key & 0xff, key >> 8, value.length & 0xff, value.length >> 8, ...value]);
  const s = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
  const crc = crc32(Uint8Array.from(data));
  s.fill(0, 0, 16);
  s.set([0x52, 0x46, 0x4b, 0x56, 1, 16, data.length & 0xff, data.length >> 8], 0);
  s.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, (crc >>> 24) & 0xff], 8);
  s.set(data, 16);
  return readRadioFoundrySettingsArea(s);
}

describe('radioFoundryNameCheck', () => {
  const lines = readFileSync(new URL('./__fixtures__/channel-modes.txt', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('check '));

  it('finds the five upstream check vectors', () => {
    expect(lines).toHaveLength(5);
  });

  it.each(lines)('%s', (line) => {
    const m = /^check ([0-9A-Fa-f]{4})(?: (.*))?$/.exec(line)!;
    const want = parseInt(m[1]!, 16);
    const name = m[2] ?? '';
    expect(radioFoundryNameCheck(storedName(name, 0xff))).toBe(want);
    expect(radioFoundryNameCheck(storedName(name, 0x00))).toBe(want);
  });
});

describe('readChannelTagHeaders', () => {
  it('returns only valid first tags', () => {
    const area = areaOf([
      [0x0400, [1, 0xff, 0xa9, 0x18, 0x03]],
      [0x07ff, [4, 2, 0x34, 0x12, 0x00]],
      [0x0401, [0, 0, 0, 0, 0]],
      [0x0402, [1, 0, 0, 0]],
      [0x0403, [2, 0, 1, 0, 0x04, 9, 9, 9, 9]],
      [0x0403, [3, 0, 1, 0, 0x00]],
      [0x0404, [0xff, 0, 0, 0, 0]],
      [0x0300, [1, 2, 3, 4, 5]],
    ]);
    const tags = readChannelTagHeaders(area);
    expect(tags.map((t) => t.channelNumber)).toEqual([1, 1024, 4]);
    expect(tags[0]).toEqual({
      channelNumber: 1,
      kind: 1,
      system: null,
      nameCheck: 0x18a9,
      txAllowed: true,
      baseStandsAlone: true,
    });
    expect(tags[1]).toMatchObject({ kind: 4, system: 2, nameCheck: 0x1234, txAllowed: false });
    expect(tags[2]).toMatchObject({ kind: 2, baseStandsAlone: false });
  });

  it('returns nothing for an area that is not valid', () => {
    expect(readChannelTagHeaders(readRadioFoundrySettingsArea(new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff)))).toEqual([]);
  });
});

describe('radioFoundryChannelKindLabel', () => {
  it('names merged kinds and flags unknown ones', () => {
    expect(radioFoundryChannelKindLabel(2)).toBe('P25 conventional');
    expect(radioFoundryChannelKindLabel(7)).toBe('kind 7 (not known to Studio)');
  });
});

describe('isChannelTagLive', () => {
  function record(name: string, { dmr = true, rxOnly = true } = {}): Uint8Array {
    const r = new Uint8Array(56).fill(0xff);
    r.set(storedName(name, 0xff), 0);
    r[0x18] = dmr ? 1 : 0;
    r[0x33] = rxOnly ? 0x04 : 0x00;
    return r;
  }
  const tag = (name: string, baseStandsAlone = false): ChannelTagHeader => ({
    channelNumber: 1,
    kind: 1,
    system: 0,
    nameCheck: radioFoundryNameCheck(storedName(name, 0xff)),
    txAllowed: false,
    baseStandsAlone,
  });

  it('is live on an RX-only DMR record with the matching name', () => {
    expect(isChannelTagLive(tag('T3 Ops'), record('T3 Ops'))).toBe(true);
  });
  it('is stale after a rename', () => {
    expect(isChannelTagLive(tag('T3 Ops'), record('T3 Ops 2'))).toBe(false);
  });
  it('is stale on an FM record', () => {
    expect(isChannelTagLive(tag('T3 Ops'), record('T3 Ops', { dmr: false }))).toBe(false);
  });
  it('is live on an FM record when the base stands alone', () => {
    expect(isChannelTagLive(tag('P25 Ops', true), record('P25 Ops', { dmr: false, rxOnly: false }))).toBe(true);
  });
  it('is stale on a DMR record that allows TX', () => {
    expect(isChannelTagLive(tag('T3 Ops'), record('T3 Ops', { rxOnly: false }))).toBe(false);
  });
});
