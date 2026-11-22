// Vectors from RadioFoundry (MIT): site/tests/kv.test.mjs and tests/vectors/channel-modes.txt at 454a5b76.
// Copyright (c) 2026 The RadioFoundry Authors. Licence: __fixtures__/LICENSE-RadioFoundry.txt
import { describe, expect, it } from 'vitest';
import { SETTINGS_AREA_ADDRESS, SETTINGS_AREA_SIZE } from './layout.ts';
import {
  crc32,
  firstSettingsEntry,
  readRadioFoundrySettingsArea,
  settingsAreaSector,
} from './settingsArea.ts';

const HEADER = [0x52, 0x46, 0x4b, 0x56, 0x01, 0x10, 0x0d, 0x00, 0x9c, 0x60, 0xfa, 0x04, 0, 0, 0, 0];
const DATA = [0x01, 0x00, 0x04, 0x00, 0x39, 0x30, 0x00, 0x00, 0x01, 0x70, 0x01, 0x00, 0xaa];

function vectorSector(): Uint8Array {
  const s = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
  s.set(HEADER, 0);
  s.set(DATA, 16);
  return s;
}

/** Builds a sector with a computed CRC (the literal vector above pins the CRC independently). */
function buildSector(
  data: number[],
  { version = 1, headerLength = 16 }: { version?: number; headerLength?: number } = {},
): Uint8Array {
  const s = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
  const crc = crc32(Uint8Array.from(data));
  s.fill(0, 0, headerLength);
  s.set([0x52, 0x46, 0x4b, 0x56, version, headerLength, data.length & 0xff, data.length >> 8], 0);
  s.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, (crc >>> 24) & 0xff], 8);
  s.set(data, headerLength);
  return s;
}

describe('crc32', () => {
  it('matches the zlib check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('readRadioFoundrySettingsArea', () => {
  it('reads the upstream valid sector', () => {
    const area = readRadioFoundrySettingsArea(vectorSector());
    expect(area.state).toBe('valid');
    expect(area.version).toBe(1);
    expect(area.entries.map((e) => [e.key, [...e.value]])).toEqual([
      [1, [0x39, 0x30, 0, 0]],
      [0x7001, [0xaa]],
    ]);
  });

  it('reads a valid area with no entries', () => {
    const s = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
    s.set([0x52, 0x46, 0x4b, 0x56, 1, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0);
    const area = readRadioFoundrySettingsArea(s);
    expect(area.state).toBe('valid');
    expect(area.entries).toEqual([]);
  });

  it('reads a longer header', () => {
    const area = readRadioFoundrySettingsArea(buildSector(DATA, { headerLength: 24 }));
    expect(area.state).toBe('valid');
    expect(area.entries).toHaveLength(2);
  });

  it('rejects the mutations as bad, newer or empty', () => {
    const check = (mutate: (s: Uint8Array) => void) => {
      const s = vectorSector();
      mutate(s);
      return readRadioFoundrySettingsArea(s).state;
    };
    expect(check((s) => (s[0] = 0x51))).toBe('bad');
    expect(check((s) => s.fill(0x00))).toBe('bad');
    expect(check((s) => (s[16 + 4] ^= 0x01))).toBe('bad');
    expect(check((s) => (s[5] = 12))).toBe('bad');
    expect(check((s) => ((s[6] = 0xf8), (s[7] = 0x0f)))).toBe('bad');
    expect(check((s) => (s[4] = 0))).toBe('bad');
    expect(check((s) => (s[4] = 2))).toBe('newer');
    expect(check((s) => s.fill(0xff))).toBe('empty');
  });

  it('rejects an entry longer than the data even when the CRC matches', () => {
    const data = [0x01, 0x00, 0x10, 0x00, 0xaa];
    expect(readRadioFoundrySettingsArea(buildSector(data)).state).toBe('bad');
  });

  it('reports newer with no entries', () => {
    const area = readRadioFoundrySettingsArea(buildSector(DATA, { version: 2 }));
    expect(area).toMatchObject({ state: 'newer', version: 2, entries: [] });
  });

  it('throws on a wrong-length argument', () => {
    expect(() => readRadioFoundrySettingsArea(new Uint8Array(10))).toThrow();
  });

  it('takes the first entry for a duplicate key', () => {
    const area = readRadioFoundrySettingsArea(
      buildSector([0x05, 0x00, 0x01, 0x00, 0x11, 0x05, 0x00, 0x01, 0x00, 0x22]),
    );
    expect(area.entries).toHaveLength(2);
    expect([...firstSettingsEntry(area, 5)!.value]).toEqual([0x11]);
    expect(firstSettingsEntry(area, 6)).toBeNull();
  });
});

describe('settingsAreaSector', () => {
  it('returns the 0xE000 sector of an image', () => {
    const image = new Uint8Array(SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE + 8);
    image[SETTINGS_AREA_ADDRESS] = 7;
    const sector = settingsAreaSector(image);
    expect(sector.length).toBe(SETTINGS_AREA_SIZE);
    expect(sector[0]).toBe(7);
    expect(() => settingsAreaSector(new Uint8Array(100))).toThrow();
  });
});
