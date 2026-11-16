import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import {
  buildDm32SparseCapture,
  decodeDm32ChannelRecord,
  type Dm32ChannelInventory,
} from './debugMemory.ts';
import {
  DM32_TALK_GROUPS_PER_PAGE,
  projectDm32Lists,
  resolveDm32ChannelReferences,
} from './debugMemoryLists.ts';

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

// ---------------------------------------------------------------------------------------------
// S4b: RX groups and channel references. Bytes are placed by hand, not through the encoders.

/** RX-group page: bitmask, entries from +0x11 stride 109, name at +0, members from +0x0B. */
function rxPage(groups: Record<number, { name: string; members: number[] }>): Uint8Array {
  const p = page(0x0f);
  let mask = 0;
  for (const [slot, g] of Object.entries(groups)) {
    const s = Number(slot);
    mask |= 1 << (s - 1);
    const base = 0x11 + (s - 1) * 109;
    TE.encode(g.name).forEach((b, i) => (p[base + i] = b));
    g.members.forEach((id, i) => {
      const off = base + 0x0b + i * 3;
      p[off] = id & 0xff;
      p[off + 1] = (id >> 8) & 0xff;
      p[off + 2] = (id >> 16) & 0xff;
    });
  }
  p[0] = mask & 0xff;
  p[1] = (mask >>> 8) & 0xff;
  p[2] = (mask >>> 16) & 0xff;
  p[3] = (mask >>> 24) & 0xff;
  return p;
}

describe('RX groups', () => {
  it('decodes bitmask holes, keeps order, duplicates and empty positions', () => {
    const { rxGroups } = lists({
      [A(0)]: rxPage({
        1: { name: 'First', members: [9, 9, 0] },
        4: { name: 'Fourth', members: [7] },
      }),
    });
    expect(rxGroups.status).toBe('captured');
    expect(rxGroups.occupiedSlots).toEqual([1, 4]);
    expect(rxGroups.bitmask).toBe(0b1001);
    const first = rxGroups.entries[0]!;
    expect(first.name).toBe('First');
    expect(first.members).toHaveLength(32);
    expect(first.members.slice(0, 3).map((m) => [m.empty, m.dmrId])).toEqual([
      [false, 9],
      [false, 9],
      [true, undefined],
    ]);
    expect(first.occupiedMembers).toBe(2);
    expect(rxGroups.entries[1]!.slot).toBe(4);
  });

  it('treats all-0xFF member positions as empty', () => {
    const p = rxPage({ 1: { name: 'G', members: [5] } });
    p.fill(0xff, 0x11 + 0x0b + 3, 0x11 + 0x0b + 6);
    const m = lists({ [A(0)]: p }).rxGroups.entries[0]!.members;
    expect(m[1]).toMatchObject({ empty: true });
    expect(m[0]).toMatchObject({ empty: false, dmrId: 5 });
  });

  it('matches members to talk groups by DMR ID: zero, one and many', () => {
    const { rxGroups } = lists({
      [A(0)]: tgPage([
        ['Alpha', 100, 4],
        ['Beta', 200, 4],
        ['Beta2', 200, 4],
      ]),
      [A(1)]: rxPage({ 1: { name: 'G', members: [100, 200, 300] } }),
    });
    const m = rxGroups.entries[0]!.members;
    expect(m[0]!.match).toEqual({ kind: 'matched', talkGroupSlot: 1, name: 'Alpha' });
    expect(m[1]!.match).toEqual({ kind: 'several', count: 2 });
    expect(m[2]!.match).toEqual({ kind: 'none' });
  });

  it('says talk groups are unavailable when the talk-group page is missing', () => {
    const { rxGroups } = lists({ [A(0)]: rxPage({ 1: { name: 'G', members: [1] } }) });
    expect(rxGroups.entries[0]!.members[0]!.match).toEqual({ kind: 'talk-groups-unavailable' });
  });

  it('reads the time-slot store only with a valid marker and check', () => {
    const p = rxPage({ 1: { name: 'G', members: [10, 11] } });
    expect(lists({ [A(0)]: p }).rxGroups.entries[0]!.timeSlotStore).toBe('no-marker');
    p.set([0x54, 0x53, 0x01, 0x00], 0xdfc);
    p[0xe00] = 0b1001; // position 1 -> TS1, position 2 -> TS2
    let check = 0xa5;
    for (let i = 0; i < 96; i++) check ^= p[0x11 + 0x0b + i]!;
    p[0xf00] = check;
    const ok = lists({ [A(0)]: p }).rxGroups.entries[0]!;
    expect(ok.timeSlotStore).toBe('valid');
    expect(ok.members.slice(0, 2).map((m) => m.timeSlot)).toEqual([1, 2]);
    p[0xf00] = check ^ 0xff;
    const bad = lists({ [A(0)]: p }).rxGroups.entries[0]!;
    expect(bad.timeSlotStore).toBe('check-failed');
    expect(bad.members.every((m) => m.timeSlot === undefined)).toBe(true);
  });

  it('is not captured, never zero groups, when missing, and ambiguous when twice', () => {
    expect(lists({ [A(0)]: tgPage([]) }).rxGroups.status).toBe('not-captured');
    const two = lists({ [A(0)]: rxPage({}), [A(1)]: rxPage({}) }).rxGroups;
    expect(two.status).toBe('ambiguous');
    expect(two.reason).toMatch(/Several pages tagged 0x0F, not decoded/);
  });

  it('works without a discovery map', () => {
    const r = lists({ [A(0)]: rxPage({ 2: { name: 'G', members: [] } }) }, false).rxGroups;
    expect(r.occupiedSlots).toEqual([2]);
  });
});

function channelRecord(mode: number, rxGroup: number, radioIdIdx: number): Uint8Array {
  const r = new Uint8Array(48);
  TE.encode('CH').forEach((b, i) => (r[i] = b));
  r.set([0x00, 0x00, 0x50, 0x14], 0x10);
  r[0x18] = mode << 4;
  r[0x1f] = rxGroup;
  r[0x2b] = radioIdIdx;
  return r;
}

function channelInventory(
  chans: { mode: number; rxGroup: number; radioId: number; tx?: number }[],
  extra: Partial<Dm32ChannelInventory> = {},
): Dm32ChannelInventory {
  return {
    capacity: 4000,
    status: 'captured',
    declaredCount: chans.length,
    excess: 0,
    entries: chans.map((c, i) => ({
      slot: i + 1,
      state: decodeDm32ChannelRecord(channelRecord(c.mode, c.rxGroup, c.radioId), i + 1),
      txContactIndex: c.tx,
    })),
    decoded: chans.length,
    empty: 0,
    blank: 0,
    notCaptured: 0,
    txContactBlocks: { low: true, high: true },
    ...extra,
  };
}

describe('channel references', () => {
  const full = () =>
    lists({
      [A(0)]: tgPage([
        ['Alpha', 100, 4],
        ['Beta', 200, 4],
      ]),
      [A(1)]: quickPage(5),
      [A(2)]: rxPage({ 2: { name: 'Group2', members: [200] } }),
      [A(3)]: radioIdPage(2, [[11, 'Home']]),
    });

  it('resolves the TX contact by position: 0, 1, out of range and beyond the decoded page', () => {
    const res = resolveDm32ChannelReferences(
      channelInventory([
        { mode: 1, rxGroup: 0, radioId: 0xff, tx: 0 },
        { mode: 1, rxGroup: 0, radioId: 0xff, tx: 1 },
        { mode: 1, rxGroup: 0, radioId: 0xff, tx: 4095 },
        { mode: 1, rxGroup: 0, radioId: 0xff, tx: 4 },
        { mode: 1, rxGroup: 0, radioId: 0xff, tx: 6 },
        { mode: 1, rxGroup: 0, radioId: 0xff },
      ]),
      full(),
    );
    const tx = (n: number) => res.byChannel.get(n)!.txContact;
    expect(tx(1).status).toBe('none');
    expect(tx(2)).toMatchObject({ status: 'resolved', label: 'Alpha', targetSlot: 1 });
    expect(tx(3).status).toBe('out-of-range');
    expect(tx(4).status).toBe('not-decoded');
    expect(tx(5).status).toBe('absent');
    expect(tx(6).status).toBe('not-captured');
  });

  it('resolves the radio ID and RX group with assumed labels', () => {
    const res = resolveDm32ChannelReferences(
      channelInventory([
        { mode: 1, rxGroup: 2, radioId: 0 },
        { mode: 1, rxGroup: 0, radioId: 0xff },
        { mode: 1, rxGroup: 3, radioId: 1 },
        { mode: 1, rxGroup: 33, radioId: 250 },
        { mode: 0, rxGroup: 2, radioId: 0 },
      ]),
      full(),
    );
    const c = (n: number) => res.byChannel.get(n)!;
    expect(c(1).rxGroup).toMatchObject({
      status: 'resolved',
      label: 'Group2',
      note: 'assumed 1-based; not verified on hardware',
    });
    expect(c(1).radioId).toMatchObject({ status: 'resolved', label: 'Home (11)' });
    expect(c(2).rxGroup).toMatchObject({ status: 'none', note: 'assumed' });
    expect(c(2).radioId!.status).toBe('none');
    expect(c(3).rxGroup!.status).toBe('absent');
    expect(c(3).radioId).toMatchObject({ status: 'absent', note: 'vacant position' });
    expect(c(4).rxGroup!.status).toBe('out-of-range');
    expect(c(4).radioId!.status).toBe('out-of-range');
    expect(c(5).rxGroup).toBeUndefined();
  });

  it('reports lists not captured', () => {
    const none = lists({ [A(0)]: page(0x03) });
    const res = resolveDm32ChannelReferences(
      channelInventory([{ mode: 1, rxGroup: 1, radioId: 0, tx: 1 }]),
      none,
    );
    const c = res.byChannel.get(1)!;
    expect(c.txContact.status).toBe('inventory-not-captured');
    expect(c.rxGroup!.status).toBe('inventory-not-captured');
    expect(c.radioId!.status).toBe('inventory-not-captured');
  });

  it('builds Referenced by from TX contacts and uniquely matched RX members', () => {
    const res = resolveDm32ChannelReferences(
      channelInventory([{ mode: 1, rxGroup: 0, radioId: 0xff, tx: 2 }]),
      full(),
    );
    expect(res.referencedBy.get(2)).toEqual({
      channels: [{ slot: 1, label: 'CH' }],
      rxGroups: [{ slot: 2, name: 'Group2' }],
    });
    expect(res.referencedBy.get(1)).toBeUndefined();
    expect(res.partialReasons).toEqual([]);
  });

  it('labels Referenced by partial when coverage is incomplete', () => {
    const res = resolveDm32ChannelReferences(
      channelInventory([{ mode: 1, rxGroup: 0, radioId: 0xff, tx: 1 }], {
        notCaptured: 2,
        txContactBlocks: { low: true, high: false },
      }),
      lists({ [A(0)]: tgPage([['A', 1, 4]]) }),
    );
    expect(res.partialReasons).toEqual([
      '2 channel records were not captured',
      'some TX contact pages were not captured',
      'RX groups were not captured',
    ]);
  });
});
