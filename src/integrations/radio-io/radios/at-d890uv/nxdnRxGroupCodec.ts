/**
 * AT-D890UV NXDN RX group lists (MM9PDY Write NXDN).
 *
 * One flash unit (firmware RE, NXDN codeplug): 250 strides of `0x200` at `0x04B80000`, and a
 * **positive** bitmap (set = used) at `0x04BA0000` in the same unit. A list holds up to 64 u32 LE
 * **NXDN list slots** (the position of the member in the NXDN talk-group / contact list), stored
 * contiguously with `FFFFFFFF` after the last: the firmware stops at the first slot that is not a
 * valid one, so there are no gaps. The name is UTF-16LE at `+0x100` (`0x22` bytes).
 *
 * Studio owns the unit: it writes list `i` at stride `i` and sets bit `i`, and nothing else.
 */

import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { RadioNxdnRxGroupDto } from '../../radioWriteProjection.ts';
import { listSetBits, setBitmapBit } from './bitmap.ts';
import { AT_D890_NXDN } from './constants.ts';
import type { AtD890NxdnStagedBytes } from './nxdnListCodec.ts';
import { decodeWideCharName, encodeWideCharName } from './wideChar.ts';

function writeU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

function readU32Le(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  );
}

/** One list: 64 member slots (`FF` past the count), then the name; `0x122` bytes of the `0x200` stride. */
export function encodeAtD890NxdnRxGroupRecord(group: RadioNxdnRxGroupDto): Uint8Array {
  if (group.memberSlots.length > AT_D890UV_LIMITS.NXDN_RX_GROUP_MEMBERS_MAX) {
    throw new RangeError(
      `NXDN RX group "${group.wireName}" has ${group.memberSlots.length} members; the radio holds ${AT_D890UV_LIMITS.NXDN_RX_GROUP_MEMBERS_MAX}`,
    );
  }
  const out = new Uint8Array(AT_D890_NXDN.RxGroupNameOffset + AT_D890_NXDN.RxGroupNameBytes);
  out.fill(0xff, 0, AT_D890_NXDN.RxGroupMemberBytes);
  group.memberSlots.forEach((slot, i) => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= AT_D890UV_LIMITS.NXDN_LIST_MAX) {
      throw new RangeError(
        `NXDN RX group "${group.wireName}" member ${i} is list slot ${slot}, outside 0-${AT_D890UV_LIMITS.NXDN_LIST_MAX - 1}`,
      );
    }
    writeU32Le(out, i * 4, slot);
  });
  out.set(
    encodeWideCharName(
      group.wireName.slice(0, AT_D890UV_LIMITS.NXDN_NAME_MAX),
      AT_D890_NXDN.RxGroupNameBytes,
    ),
    AT_D890_NXDN.RxGroupNameOffset,
  );
  return out;
}

/**
 * The bytes Studio stages for the NXDN RX groups: each list at its stride, and the positive
 * bitmap (all zero when there are no lists, so no list is left marked used).
 */
export function encodeAtD890NxdnRxGroups(
  groups: readonly RadioNxdnRxGroupDto[],
): AtD890NxdnStagedBytes[] {
  if (groups.length > AT_D890UV_LIMITS.NXDN_RX_GROUP_LISTS_MAX) {
    throw new RangeError(
      `${groups.length} NXDN RX group lists; the radio holds ${AT_D890UV_LIMITS.NXDN_RX_GROUP_LISTS_MAX}`,
    );
  }
  const out: AtD890NxdnStagedBytes[] = [];
  const bitmap = new Uint8Array(AT_D890_NXDN.RxGroupSetBytes);
  groups.forEach((group, i) => {
    out.push({
      address: AT_D890_NXDN.RxGroupData + i * AT_D890_NXDN.RxGroupStride,
      bytes: encodeAtD890NxdnRxGroupRecord(group),
    });
    setBitmapBit(bitmap, i, true);
  });
  out.push({ address: AT_D890_NXDN.RxGroupSet, bytes: bitmap });
  return out;
}

/** Decode the lists marked used in the bitmap (inverse of {@link encodeAtD890NxdnRxGroups}). */
export function decodeAtD890NxdnRxGroups(
  read: (address: number, length: number) => Uint8Array,
): RadioNxdnRxGroupDto[] {
  const bitmap = read(AT_D890_NXDN.RxGroupSet, AT_D890_NXDN.RxGroupSetBytes);
  return listSetBits(bitmap).map((i) => {
    const stride = read(
      AT_D890_NXDN.RxGroupData + i * AT_D890_NXDN.RxGroupStride,
      AT_D890_NXDN.RxGroupNameOffset + AT_D890_NXDN.RxGroupNameBytes,
    );
    const memberSlots: number[] = [];
    for (let m = 0; m < AT_D890UV_LIMITS.NXDN_RX_GROUP_MEMBERS_MAX; m++) {
      const slot = readU32Le(stride, m * 4);
      if (slot === 0xffff_ffff) break;
      memberSlots.push(slot);
    }
    return {
      wireName: decodeWideCharName(
        stride.subarray(
          AT_D890_NXDN.RxGroupNameOffset,
          AT_D890_NXDN.RxGroupNameOffset + AT_D890_NXDN.RxGroupNameBytes,
        ),
      ),
      memberSlots,
    };
  });
}
