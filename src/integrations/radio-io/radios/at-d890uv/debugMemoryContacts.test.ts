import { describe, expect, it } from 'vitest';
import type { RadioBackupRegionV1 } from '../../backup/types.ts';
import { D890_MAP } from './constants.ts';
import { projectAtD890Memory } from './debugMemory.ts';
import { resolveAtD890BankSlot } from './debugMemoryContacts.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  receiveGroupAddress,
  talkgroupAddress,
} from './memory.ts';

/** Independent synthetic fixtures: bytes are written from first principles, not from the codecs. */
type Entry = [RadioBackupRegionV1, Uint8Array];
const sparse = (address: number, data: Uint8Array): Entry => [
  {
    id: `sparse-${address.toString(16)}`,
    label: 'Sparse configuration',
    address,
    byteLength: data.length,
    path: 'regions/x.bin',
    restoreRole: 'inspect-only',
  },
  data,
];
const project = (entries: readonly Entry[]) =>
  projectAtD890Memory(
    entries.map(([r]) => r),
    Object.fromEntries(entries.map(([r, b]) => [r.id, b])),
  );
const bcd = (digits: string) => Uint8Array.from(digits.match(/../g)!.map((p) => parseInt(p, 16)));
function wide(text: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  [...text].forEach((c, i) => {
    out[i * 2] = c.charCodeAt(0) & 0xff;
    out[i * 2 + 1] = c.charCodeAt(0) >> 8;
  });
  return out;
}
/** Inverted bitmap: every slot empty except the listed ones. */
function tgSet(occupied: number[], bytes = 0x4f0) {
  const out = new Uint8Array(bytes).fill(0xff);
  for (const b of occupied) out[b >> 3]! &= ~(1 << (b & 7));
  return sparse(D890_MAP.TalkgroupSet, out);
}
function rxSet(bits: number[]) {
  const out = new Uint8Array(0x20);
  for (const b of bits) out[b >> 3]! |= 1 << (b & 7);
  return sparse(D890_MAP.ReceiveGroupSet, out);
}
function record(opts: {
  type: number;
  id?: string;
  name?: string;
  callsign?: string;
  city?: string;
  idBytes?: number[];
}) {
  const r = new Uint8Array(0xc8);
  r[0] = opts.type;
  r.set(opts.idBytes ? Uint8Array.from(opts.idBytes) : bcd(opts.id ?? '00000091'), 2);
  if (opts.name) r.set(wide(opts.name, 0x20), 6);
  if (opts.city) r.set(wide(opts.city, 0x20), 0x2a);
  if (opts.callsign) r.set(wide(opts.callsign, 0x18), 0x4a);
  return r;
}
const bank = (index: number, r: Uint8Array) => sparse(talkgroupAddress(index), r);
function rxRecord(members: number[], name: string) {
  const r = new Uint8Array(0x120).fill(0xff);
  members.forEach((m, i) => new DataView(r.buffer).setUint32(i * 4, m, true));
  r.set(wide(name, 0x20), 0x100);
  return r;
}
const rx = (index: number, members: number[], name: string) =>
  sparse(receiveGroupAddress(index), rxRecord(members, name));

describe('AT-D890UV bank projection', () => {
  it('does not treat a missing bitmap as empty', () => {
    const p = project([bank(0, record({ type: 1 }))]);
    expect(p.bank.bitmap).toBe('not-captured');
    expect(p.bank.entries).toEqual([]);
  });

  it('reads a captured fully-erased inverted bitmap as empty', () => {
    const p = project([tgSet([])]);
    expect(p.bank.bitmap).toBe('captured');
    expect(p.bank.occupied).toBe(0);
  });

  it('refuses a partially captured bitmap', () => {
    const p = project([sparse(D890_MAP.TalkgroupSet, new Uint8Array(0x100).fill(0xff))]);
    expect(p.bank.bitmap).toBe('not-captured');
  });

  it('keeps sparse holes, one-based slots and slots across the 999/1000 bank boundary', () => {
    const p = project([
      tgSet([0, 5, 999, 1000]),
      bank(0, record({ type: 1, id: '00002350', name: 'UK calling' })),
      bank(999, record({ type: 0, id: '00123456', name: 'Last of bank 0' })),
      bank(1000, record({ type: 2, id: '00000093', name: 'All' })),
    ]);
    expect(p.bank.entries.map((e) => e.slot)).toEqual([1, 6, 1000, 1001]);
    expect(p.bank.occupied).toBe(4);
    expect(p.bank.decoded).toBe(3);
    expect(p.bank.entries.map((e) => e.state.kind)).toEqual([
      'decoded',
      'not-captured',
      'decoded',
      'decoded',
    ]);
    const e999 = p.bank.entries[2]!.state;
    expect(e999.kind === 'decoded' && e999.record.dmrId).toBe(123456);
    const e1000 = p.bank.entries[3]!.state;
    expect(e1000.kind === 'decoded' && e1000.record.callType).toBe(2);
  });

  it('covers a record spanned by adjacent entries and refuses a truncated one', () => {
    const whole = record({ type: 1, id: '00000091', name: 'Worldwide' });
    const addr = talkgroupAddress(2);
    const split = project([
      tgSet([2]),
      sparse(addr, whole.slice(0, 0x60)),
      sparse(addr + 0x60, whole.slice(0x60)),
    ]);
    expect(split.bank.entries[0]!.state.kind).toBe('decoded');
    const cut = project([tgSet([2]), sparse(addr, whole.slice(0, 0xc0))]);
    expect(cut.bank.entries[0]!.state.kind).toBe('not-captured');
  });

  it('reports bits beyond capacity and never decodes them', () => {
    const p = project([tgSet([0, 10_000, 10_050]), bank(0, record({ type: 1 }))]);
    expect(p.bank.occupied).toBe(1);
    expect(p.bank.outOfRangeBits).toEqual([10_000, 10_050]);
  });

  it('keeps private and group entries that share an ID apart, with callsign and city', () => {
    const p = project([
      tgSet([0, 1]),
      bank(
        0,
        record({ type: 0, id: '00000091', name: 'Alice', callsign: 'MM9PDY', city: 'Leith' }),
      ),
      bank(1, record({ type: 1, id: '00000091', name: 'Worldwide' })),
    ]);
    const [a, b] = p.bank.entries.map((e) => (e.state.kind === 'decoded' ? e.state.record : null));
    expect(a).toMatchObject({ callType: 0, dmrId: 91, callsign: 'MM9PDY', city: 'Leith' });
    expect(b).toMatchObject({ callType: 1, dmrId: 91, callsign: '', name: 'Worldwide' });
  });

  it('keeps unknown types, malformed BCD and unnamed records visible and unclassified', () => {
    const p = project([
      tgSet([0, 1, 2]),
      bank(0, record({ type: 7, name: 'Odd' })),
      bank(1, record({ type: 1, idBytes: [0x00, 0x00, 0x0a, 0x91], name: 'Bad id' })),
      bank(2, record({ type: 1, id: '00000009' })),
    ]);
    const [unknown, bad, unnamed] = p.bank.entries.map((e) => e.state);
    expect(unknown).toMatchObject({ kind: 'unknown-type', rawCallType: 7, name: 'Odd' });
    expect(bad).toMatchObject({ kind: 'malformed', name: 'Bad id' });
    expect(unnamed).toMatchObject({ kind: 'decoded', record: { name: '', dmrId: 9 } });
    expect(p.bank.decoded).toBe(1);
  });
});

describe('AT-D890UV RX groups', () => {
  const entries = [
    tgSet([0, 1, 4]),
    bank(0, record({ type: 1, id: '00002350', name: 'UK' })),
    bank(1, record({ type: 1, id: '00002355', name: 'Scotland' })),
    bank(4, record({ type: 1, idBytes: [0xff, 0, 0, 0] })),
  ];

  it('treats a missing RX bitmap as not captured', () => {
    expect(project([...entries, rx(0, [0], 'A')]).rxGroups.bitmap).toBe('not-captured');
  });

  it('keeps order, duplicates, empty positions and unresolved members', () => {
    const p = project([
      ...entries,
      rxSet([0, 3, 255]),
      rx(0, [1, 0, 1, 0xffffffff, 2, 4, 10_000, 0xfffffffe], 'Scots'),
    ]);
    expect(p.rxGroups.occupied).toBe(2);
    expect(p.rxGroups.outOfRangeBits).toEqual([255]);
    const g = p.rxGroups.entries[0]!;
    expect(g.name).toEqual({ status: 'captured', text: 'Scots' });
    if (g.members.status !== 'captured') throw new Error('members');
    expect(g.members.list.map((m) => [m.position, m.rawIndex, m.reference.status])).toEqual([
      [1, 1, 'resolved'],
      [2, 0, 'resolved'],
      [3, 1, 'resolved'],
      [5, 2, 'absent'],
      [6, 4, 'unreadable'],
      [7, 10_000, 'out-of-range'],
      [8, 0xfffffffe, 'out-of-range'],
    ]);
    // Group slot 4 has no captured members.
    expect(p.rxGroups.entries[1]!.members.status).toBe('not-captured');
    expect(p.references.rxGroupsComplete).toBe(false);
  });

  it('decodes names and members independently and time-slot tails only when captured', () => {
    const base = receiveGroupAddress(0);
    const full = rxRecord([0, 1], 'Named');
    const noTail = project([...entries, rxSet([0]), sparse(base, full)]);
    expect(noTail.rxGroups.entries[0]!.overrides).toBe('not-captured');
    const tail = new Uint8Array(64).fill(0xff);
    tail[0] = 2;
    tail[1] = 1;
    const withTail = project([
      ...entries,
      rxSet([0]),
      sparse(base, full),
      sparse(base + 0x120, tail),
    ]);
    const g = withTail.rxGroups.entries[0]!;
    expect(g.overrides).toBe('captured');
    if (g.members.status !== 'captured') throw new Error('members');
    expect(g.members.list.map((m) => m.timeSlot)).toEqual([2, 1]);
    const nameOnly = project([
      ...entries,
      rxSet([0]),
      sparse(base + 0x100, full.slice(0x100, 0x120)),
    ]);
    expect(nameOnly.rxGroups.entries[0]!.name).toEqual({ status: 'captured', text: 'Named' });
    expect(nameOnly.rxGroups.entries[0]!.members.status).toBe('not-captured');
  });

  it('cannot resolve members when the bank bitmap is missing', () => {
    const p = project([rxSet([0]), rx(0, [3], 'X')]);
    const g = p.rxGroups.entries[0]!;
    if (g.members.status !== 'captured') throw new Error('members');
    expect(g.members.list[0]!.reference.status).toBe('inventory-not-captured');
  });
});

describe('bank references', () => {
  const digitalChannel = (index: number, contact: number) => {
    const rec = new Uint8Array(0x80);
    rec.set(bcd('43350000'), 0);
    rec[0x08] = 0x0d;
    new DataView(rec.buffer).setUint32(0x14, contact - 1, true);
    rec.set(wide('DMR One', 0x20), 0x44);
    return [
      sparse(channelPrimaryAddress(index), rec.slice(0, 0x40)),
      sparse(channelSecondaryAddress(index), rec.slice(0x40)),
    ];
  };
  const chBits = new Uint8Array(0x200);
  chBits[0] = 1;
  const base = [
    sparse(D890_MAP.ChannelSet, chBits),
    ...digitalChannel(0, 2),
    tgSet([0, 1]),
    bank(0, record({ type: 1, id: '00002350', name: 'UK' })),
    bank(1, record({ type: 1, id: '00002350', name: 'Dup ID' })),
    rxSet([0]),
    rx(0, [1], 'Scots'),
  ];

  it('resolves a channel contact against its one-based slot, not the DMR ID', () => {
    const p = project(base);
    const ref = resolveAtD890BankSlot(p.bank, 2);
    expect(ref.status).toBe('resolved');
    expect(ref.record?.name).toBe('Dup ID');
    expect(resolveAtD890BankSlot(p.bank, 3).status).toBe('absent');
    expect(resolveAtD890BankSlot(p.bank, 10_001).status).toBe('out-of-range');
    expect(resolveAtD890BankSlot(p.bank, 0).status).toBe('out-of-range');
  });

  it('lists captured evidence and labels coverage', () => {
    const p = project(base);
    const used = p.references.bySlot.get(2)!;
    expect(used.channels).toEqual([{ slot: 1, label: 'DMR One' }]);
    expect(used.rxGroups).toEqual([{ slot: 1, name: 'Scots', position: 1 }]);
    expect(p.references.bySlot.get(1)).toBeUndefined();
    expect(p.references.channelsComplete).toBe(true);
    expect(p.references.rxGroupsComplete).toBe(true);
  });

  it('flags incomplete coverage when a channel half is missing', () => {
    const p = project(base.filter((e) => e[0].address !== channelSecondaryAddress(0)));
    expect(p.references.channelsComplete).toBe(false);
  });
});
