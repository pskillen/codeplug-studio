/**
 * Channel-level diff of two decoded UV-5R Mini full reads: per changed slot, which fields of the 32-byte record
 * changed (the codec's fields, byte ranges for unnamed bytes) and whether the slot became empty or filled. Unchanged
 * slots are only counted. Slots 248 and 249 hold special data in this family, so they get lines of their own.
 */

import { decodeChannelRecord } from '../channelCodec.ts';
import { UV5R_MINI_LAYOUT } from '../../uv17pro-family/layout.ts';

/** One field of the channel record: `length` bytes from `offset`, or the `mask` bits of one byte. */
export interface Uv5rMiniChannelField {
  label: string;
  offset: number;
  length: number;
  mask?: number;
  /** False for the bytes and bits Studio doesn't model (`+0x0C..+0x13`), which an unchanged Write keeps. */
  modelled: boolean;
}

/** The record's fields in offset order (`docs/reference/radios/baofeng/uv-5r-mini/channel-record.md`). */
export const UV5R_MINI_CHANNEL_FIELDS: readonly Uv5rMiniChannelField[] = [
  { label: 'RX frequency', offset: 0, length: 4, modelled: true },
  { label: 'TX frequency', offset: 4, length: 4, modelled: true },
  { label: 'RX tone', offset: 8, length: 2, modelled: true },
  { label: 'TX tone', offset: 10, length: 2, modelled: true },
  { label: 'scode', offset: 12, length: 1, modelled: false },
  { label: 'PTT ID', offset: 13, length: 1, modelled: false },
  { label: 'power', offset: 14, length: 1, mask: 0x03, modelled: true },
  { label: 'scramble', offset: 14, length: 1, mask: 0x30, modelled: false },
  { label: '+0x0E bits 7–6/3–2', offset: 14, length: 1, mask: 0xcc, modelled: false },
  { label: 'wide', offset: 15, length: 1, mask: 0x40, modelled: true },
  { label: 'RX DTMF (sqmode)', offset: 15, length: 1, mask: 0x30, modelled: false },
  { label: 'BCL', offset: 15, length: 1, mask: 0x08, modelled: false },
  { label: 'scan', offset: 15, length: 1, mask: 0x04, modelled: true },
  { label: 'FHSS', offset: 15, length: 1, mask: 0x01, modelled: false },
  { label: '+0x0F bits 7/1', offset: 15, length: 1, mask: 0x82, modelled: false },
  { label: 'bytes +0x10..+0x13', offset: 16, length: 4, modelled: false },
  { label: 'name', offset: 20, length: 12, modelled: true },
];

/**
 * The range whose unmodelled bytes and bits an unchanged-fields line vouches for. Power, wide and scan also lie in
 * it, so the line never claims the whole range is unchanged.
 */
export const UV5R_MINI_UNMODELLED_RANGE = '+0x0C..+0x13';

/** 1-based slots that hold special data, reported on their own lines (memory-layout.md: `0x1EF0`). */
export const UV5R_MINI_SPECIAL_SLOTS: readonly number[] = [248, 249];

export type Uv5rMiniChannelChangeKind = 'filled' | 'emptied' | 'changed' | 'emptyChanged';

export interface Uv5rMiniChannelChange {
  /** 1-based slot number. */
  slot: number;
  kind: Uv5rMiniChannelChangeKind;
  /** Decoded name in the first and second read; empty for an empty slot. */
  nameBefore: string;
  nameAfter: string;
  /** Labels of the fields that differ, in offset order. Empty for `filled` and `emptied`. */
  fields: string[];
  /**
   * True when every unmodelled byte and bit in `+0x0C..+0x13` is the same in both reads. The modelled power, wide
   * and scan bits in that range may still have changed.
   */
  unmodelledUnchanged: boolean;
}

export interface Uv5rMiniSpecialSlotDiff {
  slot: number;
  /** Absolute start of the slot's 32 bytes. */
  start: number;
  /** Offsets inside the slot (`0..31`) that differ, ascending. */
  diffOffsets: number[];
}

export interface Uv5rMiniChannelDiff {
  /** Changed slots, ascending; slots 248 and 249 are never here. */
  changes: Uv5rMiniChannelChange[];
  /** Slots, other than 248 and 249, whose 32 bytes are identical. */
  unchangedCount: number;
  special: Uv5rMiniSpecialSlotDiff[];
}

function fieldDiffers(a: Uint8Array, b: Uint8Array, f: Uv5rMiniChannelField): boolean {
  for (let i = f.offset; i < f.offset + f.length; i++) {
    const mask = f.mask ?? 0xff;
    if ((a[i]! & mask) !== (b[i]! & mask)) return true;
  }
  return false;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function diffUv5rMiniChannels(a: Uint8Array, b: Uint8Array): Uv5rMiniChannelDiff {
  const size = UV5R_MINI_LAYOUT.channelSize;
  const changes: Uv5rMiniChannelChange[] = [];
  const special: Uv5rMiniSpecialSlotDiff[] = [];
  let unchangedCount = 0;
  for (let slot = 1; slot <= UV5R_MINI_LAYOUT.channelCount; slot++) {
    const start = (slot - 1) * size;
    const ra = a.subarray(start, start + size);
    const rb = b.subarray(start, start + size);
    if (UV5R_MINI_SPECIAL_SLOTS.includes(slot)) {
      const diffOffsets: number[] = [];
      for (let i = 0; i < size; i++) if (ra[i] !== rb[i]) diffOffsets.push(i);
      special.push({ slot, start, diffOffsets });
      continue;
    }
    if (sameBytes(ra, rb)) {
      unchangedCount++;
      continue;
    }
    const da = decodeChannelRecord(ra, slot);
    const db = decodeChannelRecord(rb, slot);
    const differing = UV5R_MINI_CHANNEL_FIELDS.filter((f) => fieldDiffers(ra, rb, f));
    let kind: Uv5rMiniChannelChangeKind;
    if (da.empty && db.empty) kind = 'emptyChanged';
    else if (da.empty) kind = 'filled';
    else if (db.empty) kind = 'emptied';
    else kind = 'changed';
    const both = kind === 'changed' || kind === 'emptyChanged';
    changes.push({
      slot,
      kind,
      nameBefore: da.wireName,
      nameAfter: db.wireName,
      fields: both ? differing.map((f) => f.label) : [],
      unmodelledUnchanged: differing.every((f) => f.modelled),
    });
  }
  return { changes, unchangedCount, special };
}

const rel = (n: number) => `+0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
const quoted = (name: string) => (name ? ` "${name}"` : '');

/**
 * One line per changed slot, e.g. `Slot 37 "NAME": name changed; unmodelled bytes and bits of +0x0C..+0x13
 * unchanged`.
 */
export function formatUv5rMiniChannelChange(c: Uv5rMiniChannelChange): string {
  switch (c.kind) {
    case 'filled':
      return `Slot ${c.slot}: filled${quoted(c.nameAfter)}`;
    case 'emptied':
      return `Slot ${c.slot}: emptied (was${quoted(c.nameBefore) || ' unnamed'})`;
    case 'emptyChanged':
      return `Slot ${c.slot}: empty in both reads; differs in ${c.fields.join(', ')}`;
    case 'changed': {
      const renamed = c.nameBefore !== c.nameAfter ? ` (was${quoted(c.nameBefore)})` : '';
      const kept = c.unmodelledUnchanged
        ? `; unmodelled bytes and bits of ${UV5R_MINI_UNMODELLED_RANGE} unchanged`
        : '';
      return `Slot ${c.slot}${quoted(c.nameAfter)}${renamed}: ${c.fields.join(', ')} changed${kept}`;
    }
  }
}

/** `Slot 248 (0x1EE0–0x1EFF, special data): identical`, or the offsets inside the slot that differ. */
export function formatUv5rMiniSpecialSlot(s: Uv5rMiniSpecialSlotDiff): string {
  const h = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
  const head = `Slot ${s.slot} (${h(s.start)}–${h(s.start + UV5R_MINI_LAYOUT.channelSize - 1)}, special data)`;
  const n = s.diffOffsets.length;
  if (n === 0) return `${head}: identical`;
  return `${head}: ${n} ${n === 1 ? 'byte differs' : 'bytes differ'} at ${s.diffOffsets.map(rel).join(' ')}`;
}
