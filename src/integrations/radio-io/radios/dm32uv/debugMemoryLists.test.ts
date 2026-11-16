import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { buildDm32SparseCapture } from './debugMemory.ts';
import { DM32_TALK_GROUPS_PER_PAGE, projectDm32Lists } from './debugMemoryLists.ts';

const BASE = 0x1000;
const A = (n: number) => BASE + n * 0x1000;
const TE = new TextEncoder();

function page(tag: number, fill = 0x00): Uint8Array {
  const data = new Uint8Array(4096).fill(fill);
  data[0xfff] = tag;
  return data;
}

/** Talk-group entry bytes written by hand: flag, name(16), NUL, id(3 LE), type, 2 reserved. */
function tgBytes(name: string, id: number, type: number): number[] {
  const out = new Array<number>(24).fill(0);
  TE.encode(name).forEach((b, i) => (out[1 + i] = b));
  out[18] = id & 0xff;
  out[19] = (id >> 8) & 0xff;
  out[20] = (id >> 16) & 0xff;
  out[21] = type;
  return out;
}

/** Page 0x44: one header byte, then entries every 24 bytes, hand-placed. */
function tgPage(entries: [string, number, number][]): Uint8Array {
  const p = page(0x44);
  entries.forEach((e, i) => p.set(tgBytes(...e), 1 + i * 24));
  return p;
}

function quickPage(count: number): Uint8Array {
  const p = page(0x0b);
  p[0] = count & 0xff;
  p[1] = count >> 8;
  return p;
}

function radioIdPage(count: number, entries: [number, string][]): Uint8Array {
  const p = page(0x67);
  p[0] = count;
  entries.forEach(([id, name], i) => {
    const off = 0x10 + i * 16;
    p[off] = id & 0xff;
    p[off + 1] = (id >> 8) & 0xff;
    p[off + 2] = (id >> 16) & 0xff;
    p.set(TE.encode(name), off + 3);
  });
  return p;
}

function archive(pages: Record<number, Uint8Array>, discovery = true): Dm32CompareArchive {
  const regions: RadioBackupRegionV1[] = [];
  const bytes: Record<string, Uint8Array> = {};
  for (const [addr, data] of Object.entries(pages)) {
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
  if (discovery)
    sidecars[DM32_DEBUG_CAPTURE_PATH] = TE.encode(
      JSON.stringify({
        modelString: 'DP570UV',
        v0a: { start: BASE, end: BASE + 12 * 0x1000 - 1 },
        window: { start: BASE, end: BASE + 11 * 0x1000 },
        discovered: Object.entries(pages).map(([a, d]) => ({ address: Number(a), tag: d[0xfff] })),
        channelCount: 0,
        extraReadTags: [],
        factory: { status: 'not-kept', reason: 'mismatch' },
      }),
    );
  return { manifest, regions: bytes, sidecars };
}

const lists = (pages: Record<number, Uint8Array>, discovery = true) =>
  projectDm32Lists(buildDm32SparseCapture(archive(pages, discovery)));

describe('talk groups', () => {
  it('uses a 24-byte stride across the first-entry header byte', () => {
    const { talkGroups } = lists({
      [A(0)]: tgPage([
        ['Local', 9, 4],
        ['Parrot', 9990, 3],
        ['All', 0xffffff, 5],
      ]),
    });
    expect(talkGroups.status).toBe('captured');
    expect(talkGroups.entries.map((e) => [e.slot, e.name, e.dmrId, e.callType])).toEqual([
      [1, 'Local', 9, 'group'],
      [2, 'Parrot', 9990, 'private'],
      [3, 'All', 0xffffff, 'all'],
    ]);
  });

  it('reports an unknown call type raw and a one-page capacity', () => {
    const { talkGroups } = lists({ [A(0)]: tgPage([['Odd', 1, 9]]) });
    expect(talkGroups.entries[0]).toMatchObject({ callType: 'unknown', callTypeRaw: 9 });
    expect(talkGroups.pageCapacity).toBe(DM32_TALK_GROUPS_PER_PAGE);
    expect(DM32_TALK_GROUPS_PER_PAGE).toBe(170);
  });

  it('flags a quick-access count that disagrees with the decoded count', () => {
    const { talkGroups } = lists({
      [A(0)]: tgPage([['One', 1, 4]]),
      [A(1)]: quickPage(300),
    });
    expect(talkGroups.storedCount).toBe(300);
    expect(talkGroups.decoded).toBe(1);
    expect(talkGroups.countMismatch).toBe(true);
    const agree = lists({ [A(0)]: tgPage([['One', 1, 4]]), [A(1)]: quickPage(1) });
    expect(agree.talkGroups.countMismatch).toBe(false);
  });

  it('reports a stored count above the 800 capacity', () => {
    const { talkGroups } = lists({ [A(0)]: tgPage([]), [A(1)]: quickPage(900) });
    expect(talkGroups.excess).toBe(100);
  });

  it('shows tags 0x45-0x48 present without decoding them, and discovered-not-captured', () => {
    const base = archive({ [A(0)]: tgPage([['One', 1, 4]]), [A(1)]: page(0x45, 0x11) });
    const sidecar = JSON.parse(new TextDecoder().decode(base.sidecars[DM32_DEBUG_CAPTURE_PATH]));
    sidecar.discovered.push({ address: A(5), tag: 0x46 });
    base.sidecars[DM32_DEBUG_CAPTURE_PATH] = TE.encode(JSON.stringify(sidecar));
    const { talkGroups } = projectDm32Lists(buildDm32SparseCapture(base));
    const byTag = Object.fromEntries(talkGroups.overflow.map((o) => [o.tag, o]));
    expect(byTag[0x45]!.addresses).toEqual([A(1)]);
    expect(byTag[0x46]!.discoveredNotCaptured).toBe(true);
    expect(byTag[0x47]).toMatchObject({ addresses: [], discoveredNotCaptured: false });
    expect(talkGroups.entries).toHaveLength(1);
  });

  it('is not captured, never zero entries, when the page is missing', () => {
    const { talkGroups } = lists({ [A(1)]: quickPage(3) });
    expect(talkGroups.status).toBe('not-captured');
    expect(talkGroups.entries).toEqual([]);
  });

  it('lists several pages with the same tag and decodes none', () => {
    const { talkGroups } = lists({ [A(0)]: tgPage([['A', 1, 4]]), [A(2)]: tgPage([['B', 2, 4]]) });
    expect(talkGroups.status).toBe('ambiguous');
    expect(talkGroups.reason).toMatch(/Several pages tagged 0x44, not decoded/);
    expect(talkGroups.entries).toEqual([]);
  });

  it('works without a discovery map', () => {
    expect(lists({ [A(0)]: tgPage([['A', 1, 4]]) }, false).talkGroups.decoded).toBe(1);
  });
});

describe('radio IDs', () => {
  it('decodes ids and names, keeping the one-based slot', () => {
    const { radioIds } = lists({
      [A(0)]: radioIdPage(2, [
        [1234567, 'Home'],
        [7654321, 'Portable'],
      ]),
    });
    expect(radioIds.entries.map((e) => [e.slot, e.dmrId, e.name])).toEqual([
      [1, 1234567, 'Home'],
      [2, 7654321, 'Portable'],
    ]);
  });

  it('counts vacant positions inside the stated count and caps at 250', () => {
    const p = radioIdPage(3, [[5, 'A']]);
    p.fill(0xff, 0x10 + 16, 0x10 + 32);
    const { radioIds } = lists({ [A(0)]: p });
    expect(radioIds.decoded).toBe(1);
    expect(radioIds.vacant).toBe(2);
    const over = lists({ [A(0)]: radioIdPage(255, []) }).radioIds;
    expect(over.excess).toBe(5);
    expect(over.entries.length + over.vacant).toBe(250);
  });

  it('is not captured when the page is missing', () => {
    expect(lists({ [A(0)]: tgPage([]) }).radioIds.status).toBe('not-captured');
  });
});

describe('analogue contacts', () => {
  it('reads the count at +0x1FF and raw 32-byte records from +0x200', () => {
    const p = page(0x06);
    p[0x1ff] = 2;
    p.fill(0xab, 0x200, 0x220);
    p.fill(0xcd, 0x220, 0x240);
    const { analogContacts } = lists({ [A(0)]: p });
    expect(analogContacts.declaredCount).toBe(2);
    expect(analogContacts.records).toHaveLength(2);
    expect(analogContacts.records[1]!.raw[0]).toBe(0xcd);
    expect(analogContacts.records[1]!.raw).toHaveLength(32);
  });

  it('reports records the stated count places beyond the captured page', () => {
    const p = page(0x06);
    p[0x1ff] = 200;
    const { analogContacts } = lists({ [A(0)]: p });
    expect(analogContacts.records).toHaveLength(111);
    expect(analogContacts.beyondPage).toBe(89);
  });

  it('is not captured when the page is missing', () => {
    expect(lists({ [A(0)]: tgPage([]) }).analogContacts.status).toBe('not-captured');
  });
});
