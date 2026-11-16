import { describe, expect, it } from 'vitest';
import type { RadioBackupRegionV1 } from '../../backup/types.ts';
import { D890_MAP } from './constants.ts';
import { channelPrimaryAddress, channelSecondaryAddress } from './memory.ts';
import { projectAtD890Memory } from './debugMemory.ts';

/** Independent synthetic fixtures: addresses and bytes are written out, not taken from the codecs. */
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
function bitmap(bytes: number, bits: number[]): Uint8Array {
  const out = new Uint8Array(bytes);
  for (const b of bits) out[b >> 3]! |= 1 << (b & 7);
  return out;
}
const bcd = (digits: string) => Uint8Array.from(digits.match(/../g)!.map((p) => parseInt(p, 16)));
function wide(text: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  [...text].forEach((c, i) => {
    out[i * 2] = c.charCodeAt(0);
  });
  return out;
}
function channelEntries(index: number, name: string): Entry[] {
  const rec = new Uint8Array(0x80);
  rec.set(bcd('14550000'), 0);
  rec.set(wide(name, 0x20), 0x44);
  return [
    sparse(channelPrimaryAddress(index), rec.slice(0, 0x40)),
    sparse(channelSecondaryAddress(index), rec.slice(0x40)),
  ];
}
const SCAN_SET = 0x3482c60;
const scanSet = (bits: number[]) => sparse(SCAN_SET, bitmap(0x20, bits));
/** Banked address written out by hand: 0x2100000 + bank * 0x80000 + slot * 0x200. */
const scanAt = (index: number) =>
  0x2100000 + Math.floor(index / 32) * 0x80000 + (index % 32) * 0x200;
const u16 = (v: number) => [v & 0xff, v >> 8];

/** A full 0x200 scan-list stride with the given pieces. */
function scanRecord(opts: {
  select?: number;
  p1?: number;
  p2?: number;
  name?: string;
  members?: number[];
}): Uint8Array {
  const out = new Uint8Array(0x200).fill(0xff);
  out[0x01] = opts.select ?? 0;
  out.set(u16(opts.p1 ?? 0xffff), 0x02);
  out.set(u16(opts.p2 ?? 0xffff), 0x04);
  out.fill(0, 0x0e, 0x2e);
  out.set(wide(opts.name ?? '', 0x20), 0x0e);
  (opts.members ?? []).forEach((m, i) => out.set(u16(m), 0x30 + i * 2));
  return out;
}

describe('scan lists', () => {
  it('needs the complete bitmap and does not claim zero lists without it', () => {
    const s = project([sparse(SCAN_SET, bitmap(0x1f, [0]))]).scanLists;
    expect(s.bitmap).toBe('not-captured');
    expect(s.entries).toEqual([]);
  });

  it('shows a captured empty bitmap as genuinely empty', () => {
    const s = project([scanSet([])]).scanLists;
    expect(s).toMatchObject({ bitmap: 'captured', occupied: 0, decoded: 0, entries: [] });
  });

  it('uses banked addresses across the index 31/32 transition and keeps one-based slots', () => {
    expect(scanAt(31)).toBe(0x2103e00);
    expect(scanAt(32)).toBe(0x2180000);
    const s = project([
      scanSet([0, 31, 32]),
      sparse(scanAt(31), scanRecord({ name: 'Bank0 last' })),
      sparse(scanAt(32), scanRecord({ name: 'Bank1 first' })),
    ]).scanLists;
    expect(s.occupied).toBe(3);
    const names = s.entries.map((e) => [e.slot, e.name]);
    expect(names).toEqual([
      [1, { status: 'not-captured' }],
      [32, { status: 'captured', text: 'Bank0 last' }],
      [33, { status: 'captured', text: 'Bank1 first' }],
    ]);
    // Only the lists with captured spans decode; the missing one is not counted as decoded.
    expect(s.decoded).toBe(2);
  });

  it('bounds the capacity at 250 and reports excess bits', () => {
    const s = project([scanSet([249, 250, 255])]).scanLists;
    expect(s.capacity).toBe(250);
    expect(s.occupied).toBe(1);
    expect(s.entries[0]!.slot).toBe(250);
    expect(s.outOfRangeBits).toEqual([250, 255]);
  });

  it('decodes name, members and priority only from their own captured spans', () => {
    const rec = scanRecord({ name: 'Local', members: [3, 7] });
    const s = project([
      scanSet([0, 1, 2]),
      // List 1: name only.
      sparse(scanAt(0) + 0x0e, rec.slice(0x0e, 0x2e)),
      // List 2: members truncated by one byte.
      sparse(scanAt(1) + 0x30, rec.slice(0x30, 0x30 + 199)),
      // List 3: priority only.
      sparse(scanAt(2) + 0x01, rec.slice(0x01, 0x06)),
    ]).scanLists;
    const [a, b, c] = s.entries;
    expect(a!.name).toEqual({ status: 'captured', text: 'Local' });
    expect(a!.members.status).toBe('not-captured');
    expect(a!.priority.status).toBe('not-captured');
    expect(b!.members.status).toBe('not-captured');
    expect(c!.priority.status).toBe('captured');
    expect(c!.name.status).toBe('not-captured');
    expect(s.decoded).toBe(0);
  });

  it('keeps member order, duplicates and empties, and reuses the channel statuses', () => {
    const s = project([
      sparse(D890_MAP.ChannelSet, bitmap(0x200, [0, 5])),
      ...channelEntries(0, 'GB3ED'),
      sparse(channelPrimaryAddress(5), new Uint8Array(0x40)), // second half missing
      scanSet([0]),
      sparse(scanAt(0), scanRecord({ members: [0, 0xffff, 5, 0, 9, 4000, 4464] })),
    ]).scanLists;
    const members = s.entries[0]!.members;
    if (members.status !== 'captured') throw new Error('members');
    expect(members.list.map((m) => [m.position, m.rawIndex, m.status])).toEqual([
      [1, 0, 'resolved'],
      [3, 5, 'not-captured'],
      [4, 0, 'resolved'],
      [5, 9, 'absent'],
      [6, 4000, 'out-of-range'],
      [7, 4464, 'out-of-range'],
    ]);
  });

  it('marks unresolved members when the channel bitmap is missing', () => {
    const s = project([scanSet([0]), sparse(scanAt(0), scanRecord({ members: [2] }))]).scanLists;
    const members = s.entries[0]!.members;
    if (members.status !== 'captured') throw new Error('members');
    expect(members.list[0]!.status).toBe('inventory-not-captured');
  });

  it('decodes all priority sentinels, one-based, and marks matching members without reordering', () => {
    const s = project([
      sparse(D890_MAP.ChannelSet, bitmap(0x200, [0, 1, 2])),
      ...channelEntries(0, 'A'),
      ...channelEntries(1, 'B'),
      ...channelEntries(2, 'C'),
      scanSet([0, 1, 2, 3]),
      // Priority 1 = word 2 -> channel index 1; priority 2 = Current. Members: index 2, 1.
      sparse(scanAt(0), scanRecord({ select: 3, p1: 2, p2: 0, members: [2, 1] })),
      // Off / Off.
      sparse(scanAt(1), scanRecord({ select: 0, p1: 0xffff, p2: 0xffff })),
      // Priority outside the membership: word 1 -> index 0, word 3 -> index 2; member is index 1.
      sparse(scanAt(2), scanRecord({ select: 1, p1: 1, p2: 3, members: [1] })),
      // Unknown select enum and out-of-range priority words.
      sparse(scanAt(3), scanRecord({ select: 9, p1: 5000, p2: 4001 })),
    ]).scanLists;
    const [first, off, outside, unknown] = s.entries;
    if (first!.priority.status !== 'captured') throw new Error('priority');
    expect(first!.priority.select).toEqual({ raw: 3, label: 'Select 1 + Select 2' });
    expect(first!.priority.first).toMatchObject({ kind: 'channel', word: 2, rawIndex: 1 });
    expect(first!.priority.second).toMatchObject({ kind: 'current', word: 0 });
    if (first!.members.status !== 'captured') throw new Error('members');
    expect(first!.members.list.map((m) => [m.rawIndex, m.roles])).toEqual([
      [2, []],
      [1, [1]],
    ]);
    if (off!.priority.status !== 'captured') throw new Error('priority');
    expect(off!.priority.first.kind).toBe('off');
    expect(off!.priority.second.kind).toBe('off');
    if (outside!.priority.status !== 'captured') throw new Error('priority');
    expect(outside!.priority.first).toMatchObject({ kind: 'channel', rawIndex: 0 });
    if (outside!.priority.first.kind !== 'channel') throw new Error('kind');
    expect(outside!.priority.first.member.status).toBe('resolved');
    expect(outside!.priority.second).toMatchObject({ kind: 'channel', rawIndex: 2 });
    if (outside!.members.status !== 'captured') throw new Error('members');
    expect(outside!.members.list.map((m) => m.roles)).toEqual([[]]);
    if (unknown!.priority.status !== 'captured') throw new Error('priority');
    expect(unknown!.priority.select).toEqual({ raw: 9 });
    if (unknown!.priority.first.kind !== 'channel') throw new Error('kind');
    expect(unknown!.priority.first.member.status).toBe('out-of-range');
    if (unknown!.priority.second.kind !== 'channel') throw new Error('kind');
    expect(unknown!.priority.second.member.status).toBe('out-of-range');
  });
});

const MAIN = 0x3500000;
const EXT = 0x3500900;
const APRS = 0x3501280;
const settings = (entries: readonly Entry[]) => project(entries).settings;
const field = (s: ReturnType<typeof settings>, id: string) => s.fields.find((f) => f.id === id)!;

describe('settings', () => {
  it('publishes nothing from an empty capture', () => {
    const s = settings([]);
    expect(s.counts.captured).toBe(0);
    expect(s.counts.registered).toBeGreaterThan(80);
    expect(s.fields.every((f) => f.status === 'not-captured')).toBe(true);
    expect(s.unknown).toEqual([]);
    expect(s.missingBytes).toBe(0x160 + 0x48);
  });

  it('decodes a field only from its exact captured span, independently of its neighbours', () => {
    // backlightLevel is main +0x26; capture just that byte.
    const s = settings([sparse(MAIN + 0x26, Uint8Array.of(2))]);
    expect(field(s, 'backlightLevel')).toMatchObject({ status: 'captured', raw: [2] });
    expect(field(s, 'keyTone').status).toBe('not-captured');
    expect(field(s, 'backlightTimeout').status).toBe('not-captured');
    expect(s.counts.captured).toBe(1);
  });

  it('decodes main and ext fields independently', () => {
    const onlyExt = settings([sparse(EXT, wide('MM9PDY', 0x20))]);
    expect(field(onlyExt, 'powerOnLine1')).toMatchObject({ status: 'captured', value: 'MM9PDY' });
    expect(field(onlyExt, 'backlightLevel').status).toBe('not-captured');
    const onlyMain = settings([sparse(MAIN + 0x26, Uint8Array.of(1))]);
    expect(field(onlyMain, 'powerOnLine1').status).toBe('not-captured');
  });

  it('treats a partially captured multi-byte field as not captured', () => {
    const s = settings([sparse(EXT, new Uint8Array(0x1f))]);
    expect(field(s, 'powerOnLine1').status).toBe('not-captured');
  });

  it('keeps unsupported values with raw bytes and no decoded value', () => {
    // language +0x05 holds 7, which is not an offered or read-only value.
    const s = settings([sparse(MAIN + 0x05, Uint8Array.of(7))]);
    const f = field(s, 'language');
    expect(f).toMatchObject({ status: 'captured', raw: [7] });
    expect(f.value).toBeUndefined();
    expect(s.counts).toMatchObject({ captured: 1, decoded: 0 });
  });

  it('shows the whole byte for masked fields and names the unclaimed bits as having no reader', () => {
    // +0x110 carries three flags (bits 0..2); bit 7 and bit 3 are set and belong to no field.
    const s = settings([sparse(MAIN + 0x110, Uint8Array.of(0x85))]);
    expect(field(s, 'showChannelType')).toMatchObject({ raw: [0x85], value: true });
    expect(field(s, 'showTimeSlot').value).toBe(false);
    expect(field(s, 'showColourCode').value).toBe(true);
    expect(s.unknown).toEqual([]);
    expect(s.named).toEqual([
      expect.objectContaining({
        address: MAIN + 0x110,
        name: 'ChanDisCtr (bits 3–7)',
        kind: 'no-reader',
        confidence: 'traced',
        mask: 0xf8,
        bytes: [0x85],
      }),
    ]);
  });

  it('names captured unregistered bytes and counts missing ones', () => {
    // Offsets 0x60..0x62 are claimed by no field (VFO scan limits); also capture one claimed byte.
    const s = settings([
      sparse(MAIN + 0x60, Uint8Array.of(1, 2, 3)),
      sparse(MAIN + 0x03, Uint8Array.of(0)),
    ]);
    expect(s.unknown).toEqual([]);
    expect(s.named).toEqual([
      expect.objectContaining({
        address: MAIN + 0x60,
        name: 'VfoScanFreq0..3',
        kind: 'meaning',
        bytes: [1, 2, 3],
        complete: false,
      }),
    ]);
    expect(s.missingBytes).toBe(0x160 + 0x48 - 4);
  });

  it('names all 276 unclaimed bytes from a full capture: nothing is left unknown', () => {
    const s = settings([sparse(MAIN, new Uint8Array(0x160)), sparse(EXT, new Uint8Array(0x48))]);
    expect(s.unknown).toEqual([]);
    const bytes = (kind: string) =>
      s.named.filter((n) => n.kind === kind).reduce((n, r) => n + r.bytes.length, 0);
    expect(s.named.reduce((n, r) => n + r.bytes.length, 0)).toBe(276);
    expect(s.named.every((n) => n.complete)).toBe(true);
    expect(bytes('unreferenced')).toBe(3);
    expect(bytes('no-reader')).toBe(1);
    expect(bytes('never-read')).toBe(23);
    expect(bytes('meaning')).toBe(249);
    const lock = s.named.find((n) => n.address === MAIN + 0xbe)!;
    expect(lock.meaning).toContain('bit 4 forced lock');
    expect(s.named.find((n) => n.address === MAIN + 0xc2)).toMatchObject({ confidence: 'partly' });
  });

  it('shows the real zero states as readings and keeps the Write model unchanged', () => {
    const read = (id: string, offset: number, v: number) =>
      field(settings([sparse(MAIN + offset, Uint8Array.of(v))]), id);
    expect(read('groupCallHangTime', 0x19, 0)).toMatchObject({ stateText: 'No hang time (0)' });
    expect(read('privateCallHangTime', 0x1a, 0)).toMatchObject({ stateText: 'No hang time (0)' });
    expect(read('manualDialGroupHangTime', 0x107, 0)).toMatchObject({
      stateText: '0 (acts as 1 s)',
    });
    expect(read('analogueCallHold', 0x50, 0)).toMatchObject({ stateText: 'No hold (0)' });
    expect(read('txPreamble', 0x1c, 3)).toMatchObject({ stateText: '3 (sent as 5, 300 ms)' });
    expect(read('voiceHeaderRepeats', 0x1b, 1)).toMatchObject({ stateText: '1 (sent as is)' });
    expect(read('voiceHeaderRepeats', 0x1b, 10).firmwareNote).toContain('goes on air as 9');
    expect(read('powerOnVolumeLevel', 0x156, 0)).toMatchObject({ stateText: 'Level 0' });
    // The decoded value stays undefined: the settings model (and so Write) still refuses zero.
    expect(read('groupCallHangTime', 0x19, 0).value).toBeUndefined();
    // A value the model already offers gets no override text.
    expect(read('txPreamble', 0x1c, 7).stateText).toBeUndefined();
  });

  it('decodes the GPS template text as UTF-16 and says when the capture is shorter than the block', () => {
    const text = wide('MM9PDY', 0x30);
    const s = settings([sparse(APRS, text)]);
    expect(s.gpsText).toEqual({
      text: 'MM9PDY',
      capturedBytes: 0x30,
      blockBytes: 0x42,
      truncated: true,
    });
    expect(settings([]).gpsText).toBeUndefined();
  });

  it('reads the MM9PDY store read-only: valid, invalid and not captured', () => {
    const rec = new Uint8Array(32);
    rec[0] = 0x4d;
    rec[1] = 0x36;
    rec[2] = 1;
    rec[3] = 1;
    rec[18] = 2;
    rec[21] = 1;
    rec[31] = rec.slice(0, 31).reduce((a, b) => (a + b) & 0xff, 0);
    const ok = settings([sparse(MAIN + 0x200, rec)]).mm9pdy;
    if (ok.status !== 'valid') throw new Error('expected valid');
    expect(ok.settings.find((x) => x.byte === 3)).toMatchObject({ valueLabel: 'Scan list' });
    expect(ok.settings.find((x) => x.byte === 18)).toMatchObject({ valueLabel: '0.5 s' });
    expect(ok.settings.find((x) => x.byte === 21)).toMatchObject({
      valueLabel: 'Unlocked with the PIN',
    });
    const bad = rec.slice();
    bad[31] ^= 1;
    expect(settings([sparse(MAIN + 0x200, bad)]).mm9pdy.status).toBe('invalid');
    expect(settings([sparse(MAIN + 0x200, new Uint8Array(32).fill(0xff))]).mm9pdy.status).toBe(
      'invalid',
    );
    expect(settings([]).mm9pdy).toEqual({ status: 'not-captured' });
  });

  it('keeps APRS bytes raw and per captured run', () => {
    const s = settings([sparse(APRS + 2, Uint8Array.of(9, 8))]);
    expect(s.aprsRuns).toEqual([{ address: APRS + 2, bytes: [9, 8] }]);
    expect(s.counts.captured).toBe(0);
  });

  it('groups known fields and falls back to Other', () => {
    const s = settings([]);
    expect(field(s, 'backlightLevel').group).toBe('display');
    expect(field(s, 'keyTone').group).toBe('audio');
    expect(field(s, 'autoPowerOff').group).toBe('power');
    expect(field(s, 'keyShortPF1').group).toBe('keys');
    expect(field(s, 'groupCallHangTime').group).toBe('dmr');
    expect(field(s, 'answerGpsRequests').group).toBe('gps');
    expect(field(s, 'acceptRemoteKill').group).toBe('privacy');
    expect(field(s, 'professionalMode').group).toBe('other');
  });

  it('labels a target-specific key name as conditional, never inferring the firmware', () => {
    // Key function 13 is named differently when the radio runs MM9PDY.
    const s = settings([sparse(MAIN + 0x10, Uint8Array.of(13))]);
    const f = field(s, 'keyShortPF1');
    expect(f.valueLabel).toBeDefined();
    expect(f.conditional).toContain('TG Previous');
  });
});
