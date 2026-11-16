import { describe, expect, it } from 'vitest';
import type { RadioBackupRegionV1 } from '../../backup/types.ts';
import { AT_D890_VITAL_UNIT_BYTES } from './vitalBackup.ts';
import { D890_MAP } from './constants.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  zoneChannelsAddress,
  zoneNameAddress,
} from './memory.ts';
import {
  buildAtD890SparseCapture,
  decodeAtD890ZoneName,
  projectAtD890Memory,
} from './debugMemory.ts';

/** Independent synthetic fixtures: bytes are written from first principles, not from the codecs. */
type Piece = { address: number; data: Uint8Array };
type Entry = [RadioBackupRegionV1, Uint8Array];

const sparse = (address: number, data: Uint8Array, id?: string): Entry => [
  {
    id: id ?? `sparse-${address.toString(16)}`,
    label: 'Sparse configuration',
    address,
    byteLength: data.length,
    path: 'regions/x.bin',
    restoreRole: 'inspect-only',
  },
  data,
];
function build(entries: readonly Entry[]) {
  const bytes: Record<string, Uint8Array> = {};
  for (const [r, b] of entries) bytes[r.id] = b;
  return { regions: entries.map(([r]) => r), bytes };
}
const project = (entries: readonly Entry[]) => {
  const { regions, bytes } = build(entries);
  return projectAtD890Memory(regions, bytes);
};

function bitmap(bytes: number, bits: number[]): Uint8Array {
  const out = new Uint8Array(bytes);
  for (const b of bits) out[b >> 3]! |= 1 << (b & 7);
  return out;
}
const bcd = (digits: string) => Uint8Array.from(digits.match(/../g)!.map((p) => parseInt(p, 16)));
function wide(text: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  [...text].forEach((c, i) => {
    out[i * 2] = c.charCodeAt(0) & 0xff;
    out[i * 2 + 1] = c.charCodeAt(0) >> 8;
  });
  return out;
}
/** Analogue channel: RX 145.5 MHz simplex, name at 0x44 (secondary half). */
function channelHalves(name: string) {
  const rec = new Uint8Array(0x80);
  rec.set(bcd('14550000'), 0);
  rec.set(wide(name, 0x20), 0x44);
  return { primary: rec.slice(0, 0x40), secondary: rec.slice(0x40), whole: rec };
}
function channelPieces(index: number, name: string): [Piece, Piece] {
  const h = channelHalves(name);
  return [
    { address: channelPrimaryAddress(index), data: h.primary },
    { address: channelSecondaryAddress(index), data: h.secondary },
  ];
}
const piece = ({ address, data }: Piece) => sparse(address, data);
const channelSet = (slots: number[]) => sparse(D890_MAP.ChannelSet, bitmap(0x200, slots));
const zoneSet = (bits: number[]) => sparse(D890_MAP.ZoneSet, bitmap(0x20, bits));
function members(indices: number[]): Uint8Array {
  const out = new Uint8Array(0x200).fill(0xff);
  indices.forEach((v, i) => {
    out[i * 2] = v & 0xff;
    out[i * 2 + 1] = v >> 8;
  });
  return out;
}

describe('buildAtD890SparseCapture', () => {
  it('reads across adjacent entries but never across a gap', () => {
    const { regions, bytes } = build([
      sparse(0x1000000, new Uint8Array(16).fill(1)),
      sparse(0x1000010, new Uint8Array(16).fill(2)),
      sparse(0x1000030, new Uint8Array(16).fill(3)),
    ]);
    const capture = buildAtD890SparseCapture(regions, bytes);
    expect(Array.from(capture.read(0x100000c, 8)!)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
    expect(capture.covers(0x1000000, 32)).toBe(true);
    expect(capture.covers(0x1000000, 33)).toBe(false);
    expect(capture.read(0x1000020, 16)).toBeUndefined();
    expect(capture.read(0x1000030, 17)).toBeUndefined();
  });

  it('refuses wrong provenance, lengths, bounds and overlaps; excludes vital and unclassified', () => {
    const wrongRole: Entry = [
      { ...sparse(0x2000020, new Uint8Array(16))[0], restoreRole: 'restorable' },
      new Uint8Array(16),
    ];
    const shortBytes: Entry = [
      { ...sparse(0x2000030, new Uint8Array(16))[0], byteLength: 32 },
      new Uint8Array(16),
    ];
    const vital: Entry = [
      {
        id: 'vital-tune-a',
        label: 'Tune',
        address: 0x4f00000,
        byteLength: AT_D890_VITAL_UNIT_BYTES,
        path: 'regions/v.bin',
        restoreRole: 'inspect-only',
      },
      new Uint8Array(AT_D890_VITAL_UNIT_BYTES),
    ];
    const { regions, bytes } = build([
      sparse(0x2000000, new Uint8Array(16)),
      sparse(0x2000010, new Uint8Array(16), 'sparse-dead'),
      wrongRole,
      shortBytes,
      sparse(0x5000000 - 8, new Uint8Array(16)),
      sparse(0x2000100, new Uint8Array(32)),
      sparse(0x2000110, new Uint8Array(32)),
      vital,
    ]);
    const capture = buildAtD890SparseCapture(regions, bytes);
    expect(capture.accepted).toEqual(['sparse-2000000']);
    expect(capture.refused.map((r) => r.id).sort()).toEqual(
      ['sparse-2000030', 'sparse-4fffff8', 'sparse-2000100', 'sparse-2000110'].sort(),
    );
    expect(capture.refused.find((r) => r.id === 'sparse-2000030')!.reason).toMatch(/length/);
    expect(capture.refused.find((r) => r.id === 'sparse-4fffff8')!.reason).toMatch(/outside/);
    expect(capture.excluded).toEqual({ vital: 1, unclassified: 2 });
    expect(capture.covers(0x2000100, 16)).toBe(false);
  });

  it('refuses duplicate provenance entirely', () => {
    const { regions, bytes } = build([
      sparse(0x2000000, new Uint8Array(16).fill(1)),
      sparse(0x2000000, new Uint8Array(16).fill(2)),
    ]);
    const capture = buildAtD890SparseCapture(regions, bytes);
    expect(capture.accepted).toEqual([]);
    expect(capture.refused).toHaveLength(2);
  });
});

describe('channel inventory', () => {
  it('keeps non-contiguous slots one-based and unrenumbered', () => {
    const inv = project([
      channelSet([0, 6, 3999]),
      ...channelPieces(0, 'GB3ED Edinburgh').map(piece),
      ...channelPieces(6, 'Simplex').map(piece),
      ...channelPieces(3999, 'Last').map(piece),
    ]).channels;
    expect(inv.bitmap).toBe('captured');
    expect(inv.entries.map((e) => e.slot)).toEqual([1, 7, 4000]);
    expect(inv.occupied).toBe(3);
    expect(inv.decoded).toBe(3);
    const first = inv.entries[0]!.state;
    expect(first.kind === 'decoded' && first.channel.wireName).toBe('GB3ED Edinburgh');
    expect(first.kind === 'decoded' && first.channel.rxHz).toBe(145_500_000);
  });

  it('decodes a record split across adjacent regions', () => {
    const whole = channelHalves('Split').whole;
    const base = channelPrimaryAddress(2);
    const inv = project([
      channelSet([2]),
      sparse(base, whole.slice(0, 0x50)),
      sparse(base + 0x50, whole.slice(0x50)),
    ]).channels;
    expect(inv.entries[0]!.state.kind).toBe('decoded');
  });

  it('reports a missing bitmap as not captured, not zero entries', () => {
    const inv = project(channelPieces(0, 'A').map(piece)).channels;
    expect(inv.bitmap).toBe('not-captured');
    expect(inv.entries).toEqual([]);
  });

  it('treats a truncated bitmap as not captured', () => {
    const inv = project([sparse(D890_MAP.ChannelSet, bitmap(0x1f0, [0]))]).channels;
    expect(inv.bitmap).toBe('not-captured');
  });

  it('keeps an occupied slot visible when either half is missing', () => {
    const [p0] = channelPieces(0, 'OnlyPrimary');
    const [, s1] = channelPieces(1, 'OnlySecondary');
    const inv = project([channelSet([0, 1, 2]), piece(p0), piece(s1)]).channels;
    expect(inv.entries.map((e) => e.state)).toEqual([
      { kind: 'not-captured', primary: true, secondary: false },
      { kind: 'not-captured', primary: false, secondary: true },
      { kind: 'not-captured', primary: false, secondary: false },
    ]);
    expect(inv.occupied).toBe(3);
    expect(inv.decoded).toBe(0);
  });

  it('treats truncated record bytes as missing', () => {
    const [p, s] = channelPieces(0, 'Cut');
    const inv = project([
      channelSet([0]),
      piece(p),
      sparse(s.address, s.data.slice(0, 0x30)),
    ]).channels;
    expect(inv.entries[0]!.state).toMatchObject({
      kind: 'not-captured',
      primary: true,
      secondary: false,
    });
  });

  it('distinguishes a captured empty record from missing bytes', () => {
    const empty = new Uint8Array(0x40).fill(0xff);
    const inv = project([
      channelSet([5]),
      sparse(channelPrimaryAddress(5), empty),
      sparse(channelSecondaryAddress(5), empty),
    ]).channels;
    expect(inv.entries[0]!.state.kind).toBe('empty-record');
    expect(inv.decoded).toBe(0);
  });

  it('reports bitmap bits beyond the hardware slot count and omits them', () => {
    const inv = project([channelSet([0, 4000, 4095])]).channels;
    expect(inv.outOfRangeBits).toEqual([4000, 4095]);
    expect(inv.entries.map((e) => e.slot)).toEqual([1]);
    expect(inv.capacity).toBe(4000);
  });

  it('keeps zero occupied distinct from not captured', () => {
    const inv = project([channelSet([])]).channels;
    expect(inv.bitmap).toBe('captured');
    expect(inv.occupied).toBe(0);
  });
});

describe('zone inventory', () => {
  it('decodes Unicode, unnamed zones, ordered duplicates and terminators', () => {
    const z = project([
      channelSet([0, 1]),
      ...channelPieces(0, 'One').map(piece),
      ...channelPieces(1, 'Two').map(piece),
      zoneSet([0, 3, 4]),
      sparse(zoneNameAddress(0), wide('Zöne ★', 0x20)),
      sparse(zoneChannelsAddress(0), members([1, 0, 1, 1])),
      sparse(zoneNameAddress(3), new Uint8Array(0x20)),
      sparse(zoneChannelsAddress(3), new Uint8Array(0x200).fill(0xff)),
      sparse(zoneNameAddress(4), new Uint8Array(0x20).fill(0xff)),
      sparse(zoneChannelsAddress(4), members([0])),
    ]).zones;
    expect(z.entries.map((e) => e.slot)).toEqual([1, 4, 5]);
    const first = z.entries[0]!;
    expect(first.name).toEqual({ status: 'captured', text: 'Zöne ★' });
    const list = first.members.status === 'captured' ? first.members.list : [];
    expect(list.map((m) => [m.position, m.rawIndex, m.slot, m.status])).toEqual([
      [1, 1, 2, 'resolved'],
      [2, 0, 1, 'resolved'],
      [3, 1, 2, 'resolved'],
      [4, 1, 2, 'resolved'],
    ]);
    expect(list[1]!.channel!.wireName).toBe('One');
    expect(z.entries[1]!.name).toEqual({ status: 'captured', text: '' });
    expect(z.entries[1]!.members).toMatchObject({ status: 'captured', list: [] });
    expect(z.entries[2]!.name).toEqual({ status: 'captured', text: '' });
  });

  it('keeps absent, uncaptured, unreadable, unresolvable and out-of-range members distinct', () => {
    const [p] = channelPieces(1, 'Half');
    const empty = new Uint8Array(0x40).fill(0xff);
    const z = project([
      channelSet([0, 1, 2]),
      ...channelPieces(0, 'Fine').map(piece),
      piece(p),
      sparse(channelPrimaryAddress(2), empty),
      sparse(channelSecondaryAddress(2), empty),
      zoneSet([0]),
      sparse(zoneChannelsAddress(0), members([0, 1, 2, 7, 4000, 5000])),
    ]).zones;
    const m = z.entries[0]!.members;
    const list = m.status === 'captured' ? m.list : [];
    expect(list.map((x) => x.status)).toEqual([
      'resolved',
      'not-captured',
      'unreadable',
      'absent',
      'out-of-range',
      'out-of-range',
    ]);
    expect(list[4]!.slot).toBeUndefined();
    expect(z.entries[0]!.name).toEqual({ status: 'not-captured' });
  });

  it('cannot resolve members when the channel bitmap is missing', () => {
    const z = project([zoneSet([0]), sparse(zoneChannelsAddress(0), members([0]))]).zones;
    const m = z.entries[0]!.members;
    expect(m.status === 'captured' && m.list[0]!.status).toBe('inventory-not-captured');
  });

  it('decodes names and membership independently', () => {
    const z = project([
      zoneSet([0, 1]),
      sparse(zoneNameAddress(0), wide('Named', 0x20)),
      sparse(zoneChannelsAddress(1), members([])),
    ]).zones;
    expect(z.entries[0]!.members).toEqual({ status: 'not-captured' });
    expect(z.entries[0]!.name).toEqual({ status: 'captured', text: 'Named' });
    expect(z.entries[1]!.name).toEqual({ status: 'not-captured' });
    expect(z.entries[1]!.members.status).toBe('captured');
  });

  it('does not enumerate zones without a complete zone bitmap, and flags out-of-range bits', () => {
    expect(project([]).zones.bitmap).toBe('not-captured');
    const z = project([zoneSet([0, 250, 255])]).zones;
    expect(z.outOfRangeBits).toEqual([250, 255]);
    expect(z.capacity).toBe(250);
    expect(z.entries.map((e) => e.slot)).toEqual([1]);
  });

  it('does not turn a truncated member list into a captured one', () => {
    const z = project([
      zoneSet([0]),
      sparse(zoneChannelsAddress(0), members([0]).slice(0, 0x100)),
    ]).zones;
    expect(z.entries[0]!.members).toEqual({ status: 'not-captured' });
  });
});

describe('decodeAtD890ZoneName', () => {
  it('stops at the first terminator or erased fill', () => {
    const f = wide('Ab', 0x20);
    f.set(wide('zz', 4), 6);
    expect(decodeAtD890ZoneName(f)).toBe('Ab');
    expect(decodeAtD890ZoneName(new Uint8Array(0x20).fill(0xff))).toBe('');
    expect(decodeAtD890ZoneName(wide('Sixteen chars ok!', 0x20))).toBe('Sixteen chars ok');
  });
});
