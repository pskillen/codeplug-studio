import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { buildDm32SparseCapture, projectDm32Memory } from './debugMemory.ts';
import { projectDm32MemoryLists } from './debugMemoryZones.ts';

const BASE = 0x1000;
const A = (n: number) => BASE + n * 0x1000;

function pageBytes(tag: number): Uint8Array {
  const data = new Uint8Array(4096).fill(0xff);
  data[0xfff] = tag;
  return data;
}

const bcd = (digits: string) =>
  digits
    .match(/../g)!
    .map((p) => parseInt(p, 16))
    .reverse();

/** A channel record, written independently of the encoders. */
function channel(name: string, rx = '14500000'): Uint8Array {
  const r = new Uint8Array(48);
  r.set(new TextEncoder().encode(name), 0);
  r.set(bcd(rx), 0x10);
  r.set(bcd(rx), 0x14);
  return r;
}

/** Channel page 0: the given channels at slots 1..n, count n, remaining slots erased. */
function channelPage(names: (string | null)[], count = names.length): Uint8Array {
  const page = pageBytes(0x12);
  page[0] = count & 0xff;
  page[1] = count >> 8;
  names.forEach((n, i) => {
    if (n !== null) page.set(channel(n), 0x10 + i * 48);
  });
  return page;
}

function zoneRecord(name: string, members: number[], countByte = members.length): Uint8Array {
  const r = new Uint8Array(145).fill(0xff);
  const bytes = new TextEncoder().encode(name);
  r.fill(0xff, 0, 16);
  r.set(bytes, 0);
  if (bytes.length < 16) r[bytes.length] = 0;
  r[16] = countByte;
  members.forEach((m, i) => {
    r[17 + i * 2] = m & 0xff;
    r[18 + i * 2] = m >> 8;
  });
  return r;
}

/** First zone page: header count, then records from +16. */
function zonePage(tag: number, records: Uint8Array[], count?: number): Uint8Array {
  const page = pageBytes(tag);
  const first = tag === 0x5c;
  if (first) {
    page.fill(0, 0, 16);
    page[0] = count ?? records.length;
    page[1] = 3;
    page[3] = 4;
    page[5] = 1;
    page[7] = 2;
  }
  records.forEach((r, i) => page.set(r, (first ? 16 : 0) + i * 145));
  return page;
}

function scanRecord(name: string, members: number[], raw = members.length + 1): Uint8Array {
  const r = new Uint8Array(57);
  r.set(new TextEncoder().encode(name), 0);
  r[0x0b] = members.length === 0 && raw === 1 ? 0 : raw;
  r[0x0c] = 0x04;
  r[0x0d] = 0x32;
  members.forEach((m, i) => {
    r[0x1a + i * 2] = m & 0xff;
    r[0x1b + i * 2] = m >> 8;
  });
  return r;
}

function scanPage(records: Uint8Array[], count = records.length): Uint8Array {
  const page = pageBytes(0x11);
  page.fill(0, 0, 0x1000 - 1);
  page[0] = count;
  records.forEach((r, i) => page.set(r, 57 * (i + 1) - 56));
  return page;
}

interface Spec {
  pages: Record<number, Uint8Array>;
  /** Extra discovered entries for pages that are not captured. */
  uncaptured?: { address: number; tag: number }[];
  discovery?: boolean;
}

function archive(spec: Spec): Dm32CompareArchive {
  const regions: RadioBackupRegionV1[] = [];
  const bytes: Record<string, Uint8Array> = {};
  for (const [addr, data] of Object.entries(spec.pages)) {
    const id = `sparse-${Number(addr).toString(16)}`;
    regions.push({
      id,
      label: 'Sparse',
      address: Number(addr),
      byteLength: data.length,
      path: `regions/${id}.bin`,
      restoreRole: 'inspect-only',
    });
    bytes[id] = data;
  }
  const manifest = {
    format: 'radio-backup',
    version: 1,
    capturedAt: '2026-01-01T00:00:00.000Z',
    radioModelId: 'DM-32UV',
    coverage: 'partial',
    addressBase: BASE,
    imageByteLength: 12 * 0x1000,
    regions,
  } as unknown as RadioBackupManifestV1;
  const sidecars: Record<string, Uint8Array> = {};
  if (spec.discovery !== false)
    sidecars[DM32_DEBUG_CAPTURE_PATH] = new TextEncoder().encode(
      JSON.stringify({
        modelString: 'DP570UV',
        v0a: { start: BASE, end: BASE + 12 * 0x1000 - 1 },
        window: { start: BASE, end: BASE + 11 * 0x1000 },
        discovered: [
          ...Object.entries(spec.pages).map(([a, d]) => ({ address: Number(a), tag: d[0xfff] })),
          ...(spec.uncaptured ?? []),
        ],
        channelCount: 0,
        extraReadTags: [],
        factory: { status: 'not-kept', reason: 'mismatch' },
      }),
    );
  return { manifest, regions: bytes, sidecars };
}

const project = (spec: Spec) =>
  projectDm32MemoryLists(projectDm32Memory(buildDm32SparseCapture(archive(spec))));

describe('zones', () => {
  const channels = channelPage(['ONE', null, 'THREE'], 3);

  it('decodes names, keeps member order and duplicates, resolves by slot', () => {
    const { zones } = project({
      pages: {
        [A(0)]: channels,
        [A(1)]: zonePage(0x5c, [zoneRecord('Local', [3, 1, 1, 2, 9, 5000, 0])]),
      },
    });
    expect(zones.status).toBe('captured');
    expect(zones.header).toMatchObject({ count: 1, channelA: 3, channelB: 4, zoneA: 1, zoneB: 2 });
    const state = zones.entries[0]!.state;
    if (state.kind !== 'decoded') throw new Error('expected decoded');
    expect(state.name).toBe('Local');
    expect(state.members.map((m) => [m.slot, m.status, m.label])).toEqual([
      [3, 'resolved', 'THREE'],
      [1, 'resolved', 'ONE'],
      [1, 'resolved', 'ONE'],
      [2, 'empty', undefined],
      // slot 9 is beyond the stated channel count of 3: nothing decoded for it
      [9, 'not-captured', undefined],
      [5000, 'out-of-range', undefined],
      [0, 'out-of-range', undefined],
    ]);
  });

  it('reports an invalid member count raw and reads no members', () => {
    const { zones } = project({
      pages: {
        [A(0)]: channels,
        [A(1)]: zonePage(0x5c, [zoneRecord('Bad', [1], 255)]),
      },
    });
    const state = zones.entries[0]!.state;
    if (state.kind !== 'decoded') throw new Error('expected decoded');
    expect(state.memberCountValid).toBe(false);
    expect(state.memberCountRaw).toBe(255);
    expect(state.members).toEqual([]);
  });

  it('marks vacant records and the inventory not captured when the first page is missing', () => {
    const vacant = new Uint8Array(145).fill(0xff);
    vacant[0] = 0;
    vacant[16] = 0;
    const { zones } = project({
      pages: { [A(0)]: channels, [A(1)]: zonePage(0x5c, [vacant, zoneRecord('Z', [])], 2) },
    });
    expect(zones.entries.map((e) => e.state.kind)).toEqual(['vacant', 'decoded']);
    expect(zones.vacant).toBe(1);
    const none = project({
      pages: { [A(0)]: channels },
      uncaptured: [{ address: A(1), tag: 0x5c }],
    });
    expect(none.zones.status).toBe('not-captured');
    expect(none.zones.entries).toEqual([]);
  });

  it('keeps later zone pages in order across an uncaptured middle page', () => {
    // 29 zones: record 29 is the first record of the second page (tag 0x5D); the first page holds 28.
    const first = Array.from({ length: 28 }, (_, i) => zoneRecord(`Z${i + 1}`, []));
    const second = [zoneRecord('Z29', [1])];
    const withMiddle = project({
      pages: {
        [A(0)]: channels,
        [A(1)]: zonePage(0x5c, first, 29),
        [A(3)]: zonePage(0x5d, second),
      },
    }).zones;
    expect(withMiddle.entries).toHaveLength(29);
    expect(withMiddle.entries[28]!.state.kind).toBe('decoded');
    // Same, but page 0x5D is discovered and not read: its records are not captured, not absent.
    const missing = project({
      pages: { [A(0)]: channels, [A(1)]: zonePage(0x5c, first, 29) },
      uncaptured: [{ address: A(2), tag: 0x5d }],
    }).zones;
    expect(missing.entries[28]!.state).toMatchObject({ kind: 'not-captured' });
    expect(missing.notCaptured).toBe(1);
    expect(missing.decoded).toBe(28);
  });

  it('does not guess page order without a discovery map', () => {
    const { zones, scanLists } = project({
      pages: {
        [A(0)]: channels,
        [A(1)]: zonePage(0x5c, [zoneRecord('Z', [])]),
        [A(2)]: scanPage([scanRecord('Scan', [1])]),
      },
      discovery: false,
    });
    expect(zones.status).toBe('page-order-not-established');
    expect(zones.entries).toEqual([]);
    // Scan lists have a single tag and still work.
    expect(scanLists.status).toBe('captured');
    expect(scanLists.entries).toHaveLength(1);
  });

  it('says members cannot be resolved when channels are not captured', () => {
    const { zones } = project({
      pages: { [A(1)]: zonePage(0x5c, [zoneRecord('Z', [1])]) },
      uncaptured: [{ address: A(0), tag: 0x12 }],
    });
    const state = zones.entries[0]!.state;
    if (state.kind !== 'decoded') throw new Error('expected decoded');
    expect(state.members[0]!.status).toBe('inventory-not-captured');
  });

  it('caps the stated zone count at hardware capacity', () => {
    const { zones } = project({
      pages: { [A(0)]: channels, [A(1)]: zonePage(0x5c, [zoneRecord('Z', [])], 255) },
    });
    expect(zones.excess).toBe(5);
    expect(zones.entries).toHaveLength(250);
  });
});

describe('scan lists', () => {
  const channels = channelPage(['ONE', 'TWO'], 2);

  it('count 0 lists nothing but is captured; count 1 shows one list', () => {
    const none = project({ pages: { [A(0)]: channels, [A(1)]: scanPage([]) } }).scanLists;
    expect(none.status).toBe('captured');
    expect(none.entries).toEqual([]);
    const one = project({
      pages: { [A(0)]: channels, [A(1)]: scanPage([scanRecord('Sc', [2, 1])]) },
    }).scanLists;
    const state = one.entries[0]!.state;
    if (state.kind !== 'decoded') throw new Error('expected decoded');
    expect(state.name).toBe('Sc');
    // named members + 1 (the implicit current channel)
    expect(state.memberCountRaw).toBe(3);
    expect(state.namedCount).toBe(2);
    expect(state.members.map((m) => [m.slot, m.label])).toEqual([
      [2, 'TWO'],
      [1, 'ONE'],
    ]);
    expect(state.raw).toMatchObject({ b0c: 4, b0d: 0x32 });
  });

  it('empty list stores raw 0; an out-of-range raw count is not read', () => {
    const empty = project({
      pages: { [A(0)]: channels, [A(1)]: scanPage([scanRecord('E', [])]) },
    }).scanLists.entries[0]!.state;
    if (empty.kind !== 'decoded') throw new Error('expected decoded');
    expect(empty.memberCountRaw).toBe(0);
    expect(empty.namedCount).toBe(0);
    const bad = project({
      pages: { [A(0)]: channels, [A(1)]: scanPage([scanRecord('B', [1], 200)]) },
    }).scanLists.entries[0]!.state;
    if (bad.kind !== 'decoded') throw new Error('expected decoded');
    expect(bad.namedCount).toBeUndefined();
    expect(bad.members).toEqual([]);
  });

  it('is not captured when the page is absent and caps the count at 32', () => {
    const none = project({
      pages: { [A(0)]: channels },
      uncaptured: [{ address: A(1), tag: 0x11 }],
    });
    expect(none.scanLists.status).toBe('not-captured');
    const many = project({
      pages: { [A(0)]: channels, [A(1)]: scanPage([scanRecord('Sc', [1])], 40) },
    }).scanLists;
    expect(many.excess).toBe(8);
    expect(many.entries).toHaveLength(32);
  });
});
