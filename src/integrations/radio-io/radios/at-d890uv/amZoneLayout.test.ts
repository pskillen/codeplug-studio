/**
 * Locks the AmAir / AmZone binary layout verified against hardware on 2026-07-28.
 *
 * Byte patterns below are transcribed from a real `ID890UV` dump that was reconciled
 * field-for-field with the CPS `AMAir.CSV` / `AMZone.CSV` egress for the same codeplug
 * (24 AM channels + VFO; 3 zones of 10 / 9 / 5 members). They exist to catch a regression
 * in the map constants — several of which contradict anytone-cps, so a "fix" that silently
 * restores the upstream values would otherwise go unnoticed.
 *
 * See `docs/reference/radios/anytone/at-d890uv/memory-layout.md`.
 */

import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';

/** Zone 0 "Glasgow Airband" — first `0x40` bytes of its `AmZoneData` record. */
const ZONE0_HEAD = Uint8Array.from([
  // "Glasgow Airband" UTF-16LE (15 chars), NUL-padded through 0x21
  0x47, 0x00, 0x6c, 0x00, 0x61, 0x00, 0x73, 0x00, 0x67, 0x00, 0x6f, 0x00, 0x77, 0x00, 0x20, 0x00,
  0x41, 0x00, 0x69, 0x00, 0x72, 0x00, 0x62, 0x00, 0x61, 0x00, 0x6e, 0x00, 0x64, 0x00, 0x00, 0x00,
  // 0x20: name terminator/padding, then members from 0x22 (u16 LE)
  0x00, 0x00, 0x12, 0x00, 0x10, 0x00, 0x0f, 0x00, 0x11, 0x00, 0x07, 0x00, 0x17, 0x00, 0x16, 0x00,
  0x13, 0x00, 0x15, 0x00, 0x14, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
]);

/** Member order as programmed, in CSV order — deliberately unsorted. */
const ZONE0_MEMBERS = [18, 16, 15, 17, 7, 23, 22, 19, 21, 20];

/** `AmZoneScan` bytes for zones 0-3: 10, 9, 5, and 0 members, all scanned. */
const SCAN_HEAD = Uint8Array.from([
  0xff, 0x03, 0x00, 0x00, 0xff, 0x01, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

/**
 * `AmZoneAChannel` from the sample whose zones 0/1/2 select member positions 0/1/2.
 * This is the pattern that distinguishes u16 LE from u8 — under u8 it would read
 * `00 01 02`, which is what anytone-cps writes.
 */
const ACHANNEL_POS_012 = Uint8Array.from([
  0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

function u16le(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
}

function setBits(buf: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < buf.length * 8; i++) {
    if ((buf[i >> 3]! & (1 << (i & 7))) !== 0) out.push(i);
  }
  return out;
}

describe('AmZone record layout (hardware-verified 2026-07-28)', () => {
  it('decodes the zone name as NUL-terminated UTF-16LE', () => {
    const raw = ZONE0_HEAD.subarray(D890_MAP.AmZoneNameOffset, D890_MAP.AmZoneNameLength);
    const name = new TextDecoder('utf-16le').decode(raw).split('\0')[0];
    expect(name).toBe('Glasgow Airband');
  });

  it('reserves 0x20-0x21 for the name terminator, not a member count', () => {
    // A member-count field here would read 10 for this zone; it reads 0.
    expect(u16le(ZONE0_HEAD, 0x20)).toBe(0);
  });

  it('decodes members as u16 LE from 0x22, preserving programmed order', () => {
    const members: number[] = [];
    for (let slot = 0; slot < D890_MAP.AmZoneMemberSlots; slot++) {
      const off = D890_MAP.AmZoneMembersOffset + slot * 2;
      if (off + 1 >= ZONE0_HEAD.length) break;
      const v = u16le(ZONE0_HEAD, off);
      if (v === 0xffff) break;
      members.push(v);
    }
    expect(members).toEqual(ZONE0_MEMBERS);
  });

  it('sizes the member list to fill the record up to the reserved tail', () => {
    const end = D890_MAP.AmZoneMembersOffset + D890_MAP.AmZoneMemberSlots * 2;
    expect(end).toBe(0x62);
    expect(end).toBeLessThan(D890_MAP.AmZoneDataLength);
  });
});

describe('AmZoneAChannel (hardware-verified 2026-07-28)', () => {
  it('is u16 LE per zone, sized for all 16 zones', () => {
    expect(D890_MAP.AmZoneAChannelStride).toBe(2);
    expect(D890_MAP.AmZoneCount * D890_MAP.AmZoneAChannelStride).toBe(
      D890_MAP.AmZoneAChannelLength,
    );
  });

  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
  ])('zone %i selects member position %i', (zone, pos) => {
    expect(u16le(ACHANNEL_POS_012, zone * D890_MAP.AmZoneAChannelStride)).toBe(pos);
  });

  it('would decode wrongly if read as u8 — the anytone-cps write bug', () => {
    // anytone-cps writes `aChannelData[i] = pos`, producing 00 01 02 for these zones.
    const asU8 = [0, 1, 2].map((z) => ACHANNEL_POS_012[z]);
    expect(asU8).not.toEqual([0, 1, 2]);
    expect(asU8).toEqual([0, 0, 1]);
  });
});

describe('AmZoneScan bitmap (hardware-verified 2026-07-28)', () => {
  /** anytone-cps uses 0x10 here, which reads outside the zone slice for zone > 0. */
  it('is 4 bytes per zone, not 0x10', () => {
    expect(D890_MAP.AmZoneScanStride).toBe(4);
    expect(D890_MAP.AmZoneScanStride * 8).toBe(D890_MAP.AmZoneMemberSlots);
  });

  it('covers all 16 zones in 0x40 bytes', () => {
    expect(D890_MAP.AmZoneCount * D890_MAP.AmZoneScanStride).toBe(0x40);
  });

  it.each([
    [0, 10],
    [1, 9],
    [2, 5],
    [3, 0],
  ])('zone %i has %i scanned members', (zone, count) => {
    const slice = SCAN_HEAD.subarray(
      zone * D890_MAP.AmZoneScanStride,
      (zone + 1) * D890_MAP.AmZoneScanStride,
    );
    expect(setBits(slice)).toHaveLength(count);
  });

  it('indexes bits by member-list position, not global channel index', () => {
    const zone0 = SCAN_HEAD.subarray(0, D890_MAP.AmZoneScanStride);
    // Member positions 0..9 — contiguous despite the members being scattered globals.
    expect(setBits(zone0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(setBits(zone0)).not.toEqual([...ZONE0_MEMBERS].sort((a, b) => a - b));
  });
});
