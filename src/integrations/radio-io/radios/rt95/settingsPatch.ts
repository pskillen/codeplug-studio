/**
 * RT95 settings patches: merge onto image bytes (#1476).
 */

import type { MemoryMap } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { RT95_BLOCK_SIZE } from './constants.ts';
import type { Rt95SettingsPatch } from './settingsFields.ts';

export function mergeByte(current: number, patchByte: number, mask: number): number {
  return (current & ~mask & 0xff) | (patchByte & mask);
}

export function rt95PatchMaskMap(patches: readonly Rt95SettingsPatch[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const patch of patches) {
    for (let i = 0; i < patch.bytes.length; i++) {
      const address = patch.address + i;
      out.set(address, (out.get(address) ?? 0) | patch.mask[i]!);
    }
  }
  return out;
}

export function touchedRt95Blocks(patches: readonly Rt95SettingsPatch[]): Set<number> {
  const blocks = new Set<number>();
  for (const patch of patches) {
    const last = patch.address + patch.bytes.length - 1;
    for (let addr = patch.address & ~(RT95_BLOCK_SIZE - 1); addr <= last; addr += RT95_BLOCK_SIZE) {
      blocks.add(addr);
    }
  }
  return blocks;
}

export function applyRt95SettingsPatchesToImage(
  image: MemoryMap,
  patches: readonly Rt95SettingsPatch[],
): void {
  for (const patch of patches) {
    const current = image.get(patch.address, patch.bytes.length).slice();
    for (let i = 0; i < current.length; i++) {
      current[i] = mergeByte(current[i]!, patch.bytes[i]!, patch.mask[i]!);
    }
    image.set(patch.address, current);
  }
}

/**
 * Abort when fresh radio bytes differ from the pre-pause image outside the patch mask.
 */
export function assertRt95FreshBlockMatchesPrePause(
  blockAddr: number,
  prePause: Uint8Array,
  fresh: Uint8Array,
  maskMap: Map<number, number>,
): void {
  if (prePause.length !== RT95_BLOCK_SIZE || fresh.length !== RT95_BLOCK_SIZE) {
    throw new RadioProtocolError('RT95 settings drift check needs 16-byte blocks');
  }
  for (let i = 0; i < RT95_BLOCK_SIZE; i++) {
    const address = blockAddr + i;
    const mask = maskMap.get(address) ?? 0;
    const allowed = ~mask & 0xff;
    if ((prePause[i]! & allowed) !== (fresh[i]! & allowed)) {
      throw new RadioProtocolError(
        `RT95 settings write aborted: radio changed at ${address.toString(16)} since the review snapshot`,
      );
    }
  }
}

export function mergeRt95SettingsPatchIntoBlock(
  fresh: Uint8Array,
  blockAddr: number,
  patches: readonly Rt95SettingsPatch[],
): Uint8Array {
  const out = fresh.slice();
  for (const patch of patches) {
    for (let i = 0; i < patch.bytes.length; i++) {
      const address = patch.address + i;
      if (address < blockAddr || address >= blockAddr + RT95_BLOCK_SIZE) continue;
      const at = address - blockAddr;
      out[at] = mergeByte(out[at]!, patch.bytes[i]!, patch.mask[i]!);
    }
  }
  return out;
}
