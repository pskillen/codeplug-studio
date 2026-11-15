import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { buildDm32SparseCapture, projectDm32Memory } from './debugMemory.ts';

const BASE = 0x1000;
const page = (n: number) => BASE + n * 0x1000;

/** Synthetic page: all 0xFF records unless set, tag at +0xFFF. Built without the encoders. */
function pageBytes(tag: number, fill = 0xff): Uint8Array {
  const data = new Uint8Array(4096).fill(fill);
  data[0xfff] = tag;
  return data;
}

/** Little-endian BCD of an 8-digit 10 Hz number. */
const bcd = (digits: string) =>
  digits
    .match(/../g)!
    .map((p) => parseInt(p, 16))
    .reverse();

function record(name: string, rx = '14500000', tx = '14500000', mode = 0x00): Uint8Array {
  const r = new Uint8Array(48);
  r.set(new TextEncoder().encode(name), 0);
  r.set(bcd(rx), 0x10);
  r.set(tx ? bcd(tx) : [0xff, 0xff, 0xff, 0xff], 0x14);
  r[0x18] = mode;
  r[0x19] = 0x80 | 0x02; // wide, scan list 2
  return r;
}

/** Offset of 1-based slot inside its page, written out independently of the codec. */
function put(pages: Uint8Array[], slot: number, rec: Uint8Array) {
  if (slot <= 84) pages[0]!.set(rec, 0x10 + (slot - 1) * 48);
  else {
    const k = slot - 85;
    pages[1 + Math.floor(k / 85)]!.set(rec, (k % 85) * 48);
  }
}

interface Spec {
  pages: Record<number, Uint8Array>;
  discovered?: { address: number; tag: number }[] | false;
  regions?: RadioBackupRegionV1[];
  extraBytes?: Record<string, Uint8Array>;
  windowPages?: number;
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
  regions.push(...(spec.regions ?? []));
  Object.assign(bytes, spec.extraBytes);
  const n = spec.windowPages ?? 8;
  const manifest = {
    format: 'radio-backup',
    version: 1,
    capturedAt: '2026-01-01T00:00:00.000Z',
    radioModelId: 'DM-32UV',
    coverage: 'partial',
    addressBase: BASE,
    imageByteLength: n * 0x1000,
    regions,
  } as unknown as RadioBackupManifestV1;
  const sidecars: Record<string, Uint8Array> = {};
  if (spec.discovered !== false) {
    sidecars[DM32_DEBUG_CAPTURE_PATH] = new TextEncoder().encode(
      JSON.stringify({
        modelString: 'DP570UV',
        v0a: { start: BASE, end: BASE + n * 0x1000 - 1 },
        window: { start: BASE, end: BASE + (n - 1) * 0x1000 },
        discovered:
          spec.discovered ??
          Object.entries(spec.pages).map(([a, d]) => ({ address: Number(a), tag: d[0xfff] })),
        channelCount: 0,
        extraReadTags: [],
        factory: { status: 'not-kept', reason: 'mismatch' },
      }),
    );
  }
  return { manifest, regions: bytes, sidecars };
}

const project = (spec: Spec) => projectDm32Memory(buildDm32SparseCapture(archive(spec))).channels;

function channelPages(count: number, n = 1) {
  const pages = Array.from({ length: n }, (_, i) => pageBytes(0x12 + i));
  pages[0]![0] = count & 0xff;
  pages[0]![1] = count >> 8;
  return pages;
}

describe('buildDm32SparseCapture', () => {
  it('accepts whole blocks, splits runs and lists refusals with reasons', () => {
    const run = new Uint8Array(0x2000);
    run[0xfff] = 0x12;
    run[0x1fff] = 0x13;
    const partial = new Uint8Array(0x1000 + 100);
    const outside = pageBytes(0x20);
    const capture = buildDm32SparseCapture(
      archive({
        pages: { [page(0)]: run, [page(3)]: partial, [0x90000]: outside },
      }),
    );
    expect([...capture.blocks.keys()]).toEqual([page(0), page(1)]);
    expect(capture.block(page(1))![0xfff]).toBe(0x13);
    expect(capture.covers(page(0), 0x2000)).toBe(true);
    expect(capture.covers(page(1) + 0xff0, 0x20)).toBe(false);
    expect(capture.refused.map((r) => r.reason)).toEqual(
      expect.arrayContaining(['Not whole 4 KiB blocks', 'Outside the V-frame 0x0A window']),
    );
  });

  it('refuses overlapping entries whole', () => {
    const capture = buildDm32SparseCapture(
      archive({ pages: { [page(0)]: new Uint8Array(0x2000), [page(1)]: pageBytes(0x13) } }),
    );
    expect(capture.blocks.size).toBe(0);
    expect(capture.refused).toHaveLength(2);
    expect(capture.refused[0]!.reason).toBe('Overlaps another entry');
  });

  it('has no discovery when capture.json is absent', () => {
    expect(
      buildDm32SparseCapture(archive({ pages: {}, discovered: false })).discovery,
    ).toBeUndefined();
  });
});

describe('projectDm32Channels', () => {
  it('distinguishes an empty slot from a record that was not captured', () => {
    const [p0] = channelPages(100, 2);
    put([p0!], 2, record('ALPHA'));
    const inv = project({
      pages: { [page(0)]: p0! },
      // Page 1 is discovered but was not read.
      discovered: [
        { address: page(0), tag: 0x12 },
        { address: page(1), tag: 0x13 },
      ],
    });
    expect(inv.status).toBe('captured');
    expect(inv.entries[0]!.state.kind).toBe('empty');
    expect(inv.entries[1]!.state.kind).toBe('decoded');
    expect(inv.entries[83]!.state.kind).toBe('empty');
    expect(inv.entries[84]!.state).toMatchObject({ kind: 'not-captured' });
    expect(inv.notCaptured).toBe(16);
    expect(inv.decoded).toBe(1);
  });

  it('reports a count above capacity and lists only the capacity', () => {
    const inv = project({ pages: { [page(0)]: channelPages(5000)[0]! } });
    expect(inv.declaredCount).toBe(5000);
    expect(inv.excess).toBe(1000);
    expect(inv.entries).toHaveLength(4000);
  });

  it('maps page boundaries 84/85 and 169/170', () => {
    const pages = channelPages(170, 3);
    for (const slot of [84, 85, 169, 170]) put(pages, slot, record(`CH${slot}`));
    const inv = project({
      pages: { [page(0)]: pages[0]!, [page(1)]: pages[1]!, [page(2)]: pages[2]! },
    });
    const name = (slot: number) => {
      const s = inv.entries[slot - 1]!.state;
      return s.kind === 'decoded' ? s.channel.wireName : s.kind;
    };
    expect([84, 85, 169, 170].map(name)).toEqual(['CH84', 'CH85', 'CH169', 'CH170']);
    expect(name(83)).toBe('empty');
  });

  it('keeps later pages in order when a middle page was not captured', () => {
    const pages = channelPages(170, 3);
    put(pages, 170, record('LAST'));
    const inv = project({
      pages: { [page(0)]: pages[0]!, [page(5)]: pages[2]! },
      discovered: [
        { address: page(0), tag: 0x12 },
        { address: page(2), tag: 0x13 },
        { address: page(5), tag: 0x14 },
      ],
    });
    expect(inv.entries[100]!.state.kind).toBe('not-captured');
    expect(inv.entries[169]!.state).toMatchObject({
      kind: 'decoded',
      channel: { wireName: 'LAST' },
    });
  });

  it('orders pages by tag, not address, and excludes the VFO tag 0x41', () => {
    const pages = channelPages(85, 2);
    put(pages, 85, record('SECOND'));
    const vfo = pageBytes(0x41);
    vfo.set(record('VFO'), 0);
    const inv = project({
      // Tag 0x13 sits at a lower address than the first page.
      pages: { [page(1)]: pages[0]!, [page(0)]: pages[1]!, [page(4)]: vfo },
      discovered: [
        { address: page(1), tag: 0x12 },
        { address: page(0), tag: 0x13 },
        { address: page(4), tag: 0x41 },
      ],
    });
    expect(inv.entries[84]!.state).toMatchObject({ channel: { wireName: 'SECOND' } });
  });

  it('does not establish page order without a discovery map', () => {
    const inv = project({ pages: { [page(0)]: channelPages(3)[0]! }, discovered: false });
    expect(inv.status).toBe('page-order-not-established');
    expect(inv.entries).toHaveLength(0);
  });

  it('says not captured when the first page is missing, and a count of 0 is a real zero', () => {
    expect(project({ pages: {}, discovered: [{ address: page(0), tag: 0x12 }] }).status).toBe(
      'not-captured',
    );
    const zero = project({ pages: { [page(0)]: channelPages(0)[0]! } });
    expect(zero.status).toBe('captured');
    expect(zero.entries).toHaveLength(0);
  });

  it('shows non-BCD RX, no stored TX, zero-filled blank and the raw mode byte', () => {
    const pages = channelPages(4);
    put(pages, 1, record('BAD', '1450A000'));
    put(pages, 2, record('RXONLY', '14500000', '', 0x18));
    put(pages, 3, new Uint8Array(48));
    const inv = project({ pages: { [page(0)]: pages[0]! } });
    const [bad, noTx, zero, ff] = inv.entries.map((e) => e.state);
    expect(bad).toMatchObject({ kind: 'decoded', flags: { rxInvalidBcd: true } });
    if (bad!.kind === 'decoded') expect([...bad.flags.rxRaw]).toEqual([0x00, 0xa0, 0x50, 0x14]);
    expect(noTx).toMatchObject({ kind: 'decoded', flags: { noTxStored: true, modeByte: 0x18 } });
    expect(zero).toMatchObject({ kind: 'blank' });
    expect(ff!.kind).toBe('empty');
  });

  it('shows the raw TX-contact index only when its block was captured', () => {
    const pages = channelPages(2);
    put(pages, 2, record('DIGI', '43000000', '43000000', 0x10));
    const tx = pageBytes(0x42, 0x00);
    // Channel 2: byte0 high nibble = id bits 11..8, byte1 = low byte (id 0x123).
    tx[2] = 0x11;
    tx[3] = 0x23;
    const without = project({ pages: { [page(0)]: pages[0]! } });
    expect(without.entries[1]!.txContactIndex).toBeUndefined();
    const withTx = project({ pages: { [page(0)]: pages[0]!, [page(1)]: tx } });
    expect(withTx.entries[1]!.txContactIndex).toBe(0x123);
  });
});
