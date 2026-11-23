import { describe, expect, it } from 'vitest';
import type { RadioFoundrySatelliteProfile } from '@core/radios/radiofoundry/satelliteCapability.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  encodeCommit,
  encodeDataChunk,
  encodeProfileChunks,
  encodeReplaceBegin,
  encodeSatelliteName,
  encodeTransactionId,
  parseProfileValues,
  parseSatelliteInfo,
  parseSatelliteList,
  radioFoundryTleEpochSeconds,
  SAT_PROFILE_CHUNK_MAX,
  serialiseSatelliteRecords,
} from './satellite.ts';

function tleLine1(catalog: number, epochField: string): string {
  const cat = String(catalog).padStart(5, '0');
  const line = `1 ${cat}U 98067A   ${epochField.padEnd(15).slice(0, 15)}  .00016717 00000-0  10230-3 0  9990`;
  if (line.length !== 69) throw new Error(`line1 length ${line.length}: ${JSON.stringify(line)}`);
  return line;
}

function tleLine2(catalog: number): string {
  const cat = String(catalog).padStart(5, '0');
  const line = `2 ${cat}  51.6416 247.4627 0006703 130.5360 325.0288 15.49560319 99999`;
  if (line.length !== 69) throw new Error(`line2 length ${line.length}`);
  return line;
}

export function tle(
  catalog: number,
  epoch: string,
): { line1: string; line2: string; name: string } {
  return {
    line1: tleLine1(catalog, epoch),
    line2: tleLine2(catalog),
    name: catalog === 25544 ? 'ISS' : 'AO-91',
  };
}

describe('serialiseSatelliteRecords', () => {
  it('serialises records in ascending catalog order', () => {
    const a = tle(43017, '24045.12345678');
    const b = tle(25544, '24045.51782528');
    const stream = serialiseSatelliteRecords(
      [
        { catalogId: 43017, name: 'AO-91', line1: a.line1, line2: a.line2 },
        { catalogId: 25544, name: 'ISS', line1: b.line1, line2: b.line2 },
      ],
      48,
    );
    expect(stream[0]).toBe(0xc8);
    expect(stream[1]).toBe(0x63);
    expect(stream[2]).toBe(0x00);
    expect(stream[3]).toBe(0x00);
    expect(stream[4]).toBe(3);
    expect(stream.length).toBe(5 + 3 + 138 + (5 + 5 + 138));
  });
});

describe('encodeSatelliteName', () => {
  it('encodes names as UTF-8 within the byte limit', () => {
    const acute = encodeSatelliteName('é'.repeat(30), 48);
    expect(acute.length).toBe(48);
    expect(new TextDecoder().decode(acute)).toBe('é'.repeat(24));
    expect(new TextDecoder().decode(encodeSatelliteName('AO\u000791', 48))).toBe('AO91');
    expect(new TextDecoder().decode(encodeSatelliteName('  ISS  ', 48))).toBe('ISS');
    const emoji = encodeSatelliteName('ab🙂cd', 4);
    expect(emoji.length).toBe(2);
    expect(new TextDecoder().decode(emoji)).toBe('ab');
  });
});

describe('serialiseSatelliteRecords errors', () => {
  it('refuses an empty set, duplicates, empty names and bad lines', () => {
    const good = tle(25544, '24045.51782528');
    expect(() => serialiseSatelliteRecords([], 48)).toThrow(RadioProtocolError);
    expect(() =>
      serialiseSatelliteRecords(
        [
          { catalogId: 1, name: 'A', line1: good.line1, line2: good.line2 },
          { catalogId: 1, name: 'B', line1: good.line1, line2: good.line2 },
        ],
        48,
      ),
    ).toThrow(RadioProtocolError);
    expect(() =>
      serialiseSatelliteRecords(
        [{ catalogId: 1, name: '   ', line1: good.line1, line2: good.line2 }],
        48,
      ),
    ).toThrow(RadioProtocolError);
    expect(() =>
      serialiseSatelliteRecords(
        [{ catalogId: 1, name: 'X', line1: good.line1.slice(0, 68), line2: good.line2 }],
        48,
      ),
    ).toThrow(RadioProtocolError);
  });
});

describe('encodeProfileChunks', () => {
  it('splits ten profiles into chunks of four', () => {
    const profiles: RadioFoundrySatelliteProfile[] = [];
    for (let id = 1; id <= 10; id += 1) {
      profiles.push({ catalogId: id, rxHz: 436_000_000, txHz: 145_000_000, toneTenths: 0 });
    }
    const chunks = encodeProfileChunks(0x0102, profiles);
    expect(chunks.length).toBe(3);
    expect(chunks[0]!.length).toBe(61);
    expect(chunks[1]!.length).toBe(61);
    expect(chunks[2]!.length).toBe(33);
    expect(chunks[0]![4]).toBe(SAT_PROFILE_CHUNK_MAX);
    expect(chunks[1]![3]).toBe(4);
    expect(chunks[2]![4]).toBe(2);
    expect(chunks[0]![2]).toBe(10);
    expect(chunks[0]![5]).toBe(1);
    expect(chunks[0]![6]).toBe(0);
    expect(chunks[0]![7]).toBe(0);
    expect(chunks[0]![8]).toBe(0);
  });
});

describe('argument encoders', () => {
  it('encodes REPLACE_BEGIN, DATA, COMMIT and ABORT arguments', () => {
    expect([...encodeReplaceBegin(2, 0x120, 0xa1b2c3d4)]).toEqual([
      0x02, 0x00, 0x20, 0x01, 0xd4, 0xc3, 0xb2, 0xa1,
    ]);
    const data = encodeDataChunk(0x1234, 0x100, new Uint8Array([0xaa]));
    expect(data[0]).toBe(0x34);
    expect(data[1]).toBe(0x12);
    expect(data[2]).toBe(0x00);
    expect(data[3]).toBe(0x01);
    expect(data[4]).toBe(0xaa);
    expect([...encodeCommit(0x1234, 0xa1b2c3d4)]).toEqual([0x34, 0x12, 0xd4, 0xc3, 0xb2, 0xa1]);
    expect([...encodeTransactionId(0x0102)]).toEqual([0x02, 0x01]);
  });
});

describe('parsers', () => {
  it('parses INFO, LIST and profile values and refuses wrong lengths', () => {
    expect(parseSatelliteInfo(new Uint8Array([0x07, 0x0a, 0x00, 0x03, 0x00]))).toEqual({
      protocol: 7,
      capacity: 10,
      installed: 3,
    });
    expect(() => parseSatelliteInfo(new Uint8Array(4))).toThrow(RadioProtocolError);
    expect(() => parseSatelliteInfo(new Uint8Array(6))).toThrow(RadioProtocolError);
    const listBody = new Uint8Array(9);
    listBody[0] = 1;
    listBody[1] = 0x11;
    listBody[2] = 0x22;
    listBody[3] = 0x33;
    listBody[4] = 0x44;
    listBody[5] = 0xaa;
    listBody[6] = 0xbb;
    listBody[7] = 0xcc;
    listBody[8] = 0xdd;
    expect(parseSatelliteList(listBody)).toHaveLength(1);
    const prof = new Uint8Array(15);
    prof[0] = 1;
    expect(parseProfileValues(prof)).toHaveLength(1);
    expect(() => parseProfileValues(new Uint8Array(14))).toThrow(RadioProtocolError);
  });
});

describe('radioFoundryTleEpochSeconds', () => {
  it('computes the TLE epoch the way the radio does', () => {
    const base2026 = Math.trunc(Date.UTC(2026, 0, 1) / 1000);
    const base1999 = Math.trunc(Date.UTC(1999, 0, 1) / 1000);
    expect(radioFoundryTleEpochSeconds(tleLine1(99999, '26327.50000000'))).toBe(
      base2026 + 326 * 86_400 + 43_200,
    );
    expect(radioFoundryTleEpochSeconds(tleLine1(99999, '26001.00001157'))).toBe(base2026);
    expect(radioFoundryTleEpochSeconds(tleLine1(99999, '99365.99999999'))).toBe(
      base1999 + 364 * 86_400 + 86_399,
    );
    expect(radioFoundryTleEpochSeconds(tleLine1(99999, '26a01.0'))).toBe(null);
  });
});
