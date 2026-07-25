/**
 * DM-32UV operator DMR radio-ID bank encode — metadata 0x67.
 * Cite: NeonPlug encodeDMRRadioID / writeDMRRadioIDs; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioRadioIdDto } from '../../radioWriteProjection.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import type { Dm32TalkGroupEncodeContext } from './talkGroupCodec.ts';

const TE = new TextEncoder();

export const DM32_DMR_RADIO_ID_ENTRY_SIZE = 16;
export const DM32_DMR_RADIO_IDS_MAX = 250;

function findBlock(
  discovered: readonly { address: number; metadata: number }[],
  metadata: number,
): { address: number } | undefined {
  return discovered.find((b) => b.metadata === metadata);
}

/** Encode one 16-byte DMR radio-ID entry (3-byte LE ID + 12-byte null-terminated name). */
export function encodeDm32RadioIdEntry(dmrId: number, name: string): Uint8Array {
  const data = new Uint8Array(DM32_DMR_RADIO_ID_ENTRY_SIZE);
  data.fill(0x00);
  const id = dmrId >>> 0;
  data[0] = id & 0xff;
  data[1] = (id >>> 8) & 0xff;
  data[2] = (id >>> 16) & 0xff;

  const nameBytes = TE.encode(name);
  const maxNameLength = 12;
  const nameLength = Math.min(nameBytes.length, maxNameLength - 1);
  for (let i = 0; i < nameLength; i++) {
    data[3 + i] = nameBytes[i]!;
  }
  if (nameLength < maxNameLength) {
    data[3 + nameLength] = 0x00;
  }
  return data;
}

/** Pack operator radio IDs into a fresh 0x67 block. */
export function encodeDm32RadioIdBlock(radioIds: readonly RadioRadioIdDto[]): Uint8Array {
  const data = new Uint8Array(DM32_BLOCK_SIZE);
  data.fill(0x00);
  const count = Math.min(radioIds.length, DM32_DMR_RADIO_IDS_MAX);
  data[0] = count & 0xff;
  for (let i = 0; i < count; i++) {
    const entry = radioIds[i]!;
    const encoded = encodeDm32RadioIdEntry(entry.dmrId, entry.name);
    data.set(encoded, 0x10 + i * DM32_DMR_RADIO_ID_ENTRY_SIZE);
  }
  data[DM32_METADATA_OFFSET] = DM32_METADATA.DMR_RADIO_IDS;
  return data;
}

export function encodeRadioIdsIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32TalkGroupEncodeContext,
  radioIds: readonly RadioRadioIdDto[],
): MemoryMap {
  const block = findBlock(ctx.discovered, DM32_METADATA.DMR_RADIO_IDS);
  if (!block) return image;
  const packed = encodeDm32RadioIdBlock(radioIds);
  image.set(block.address - ctx.addressBase, packed);
  return image;
}
