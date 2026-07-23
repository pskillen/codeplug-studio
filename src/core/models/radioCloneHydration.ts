/**
 * Web Serial / binary clone hydration for {@link EgressPath.hydration} (#654).
 *
 * Parallel to NeonPlug file donor bags (`formatId: 'neonplug'`): persist the
 * full (or sparse) clone image so unmodelled registers survive write-back.
 * Modelled channels still come from assemble() — this bag is not wire-stash
 * for library entities.
 *
 * Opaque at the YAML boundary (native-yaml already passes unknown formatIds).
 *
 * Contiguous radios (UV-5R Mini) use `imageBase64`. Sparse block radios (DM-32UV)
 * use `blocks[]` (absolute addresses + 4KB payloads); `imageBase64` may be empty.
 */

import type { CpsWireHydrationBase } from './cpsWireHydration.ts';

export const RADIO_CLONE_HYDRATION_FORMAT_ID = 'radio-clone' as const;

/** One absolute-addressed memory block in a sparse radio-clone retain. */
export interface RadioCloneSparseBlock {
  /** Absolute radio memory address (start of block). */
  address: number;
  /** Block payload as base64 (typically 4096 bytes). */
  dataBase64: string;
}

export interface RadioCloneRetain {
  /** Registry model id (e.g. UV5R-Mini, DM-32UV). */
  radioModelId: string;
  /** How the image was captured. */
  capturedVia: 'web-serial' | 'ble' | 'import';
  /**
   * Packed contiguous clone image as base64.
   * May be empty when {@link blocks} is present (sparse radios).
   */
  imageBase64: string;
  /** Optional firmware string parsed from the image / V-frames. */
  firmware?: string;
  /**
   * Contiguous image byte length, or sum of sparse block payloads when
   * {@link blocks} is used.
   */
  imageByteLength: number;
  /**
   * Sparse absolute-addressed blocks (DM-32UV 4KB map). When present and
   * non-empty, write/read paths prefer these over {@link imageBase64}.
   */
  blocks?: RadioCloneSparseBlock[];
  /**
   * Absolute base address when a contiguous MemoryMap uses offsets relative
   * to the radio config range (optional; sparse helpers may set this).
   */
  addressBase?: number;
  /** DM-32UV V-frame contact bank absolute start (when Read included the bank). */
  dm32ContactsBase?: number;
  /** DM-32UV V-frame contact bank absolute end (inclusive-ish end from V-frame). */
  dm32ContactsEnd?: number;
}

export interface RadioCloneHydrationBag extends CpsWireHydrationBase {
  formatId: typeof RADIO_CLONE_HYDRATION_FORMAT_ID;
  retain: RadioCloneRetain;
}

function isSparseBlock(value: unknown): value is RadioCloneSparseBlock {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.address === 'number' && typeof b.dataBase64 === 'string' && b.dataBase64.length > 0
  );
}

export function radioCloneHasSparseBlocks(bag: RadioCloneHydrationBag): boolean {
  return Array.isArray(bag.retain.blocks) && bag.retain.blocks.length > 0;
}

export function isRadioCloneHydrationBag(value: unknown): value is RadioCloneHydrationBag {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.formatId !== RADIO_CLONE_HYDRATION_FORMAT_ID) return false;
  const retain = record.retain;
  if (retain == null || typeof retain !== 'object' || Array.isArray(retain)) return false;
  const r = retain as Record<string, unknown>;
  if (typeof r.radioModelId !== 'string') return false;
  if (typeof r.imageByteLength !== 'number') return false;
  if (r.capturedVia !== 'web-serial' && r.capturedVia !== 'ble' && r.capturedVia !== 'import') {
    return false;
  }
  if (typeof r.imageBase64 !== 'string') return false;

  const blocks = r.blocks;
  const hasBlocks =
    Array.isArray(blocks) && blocks.length > 0 && blocks.every((block) => isSparseBlock(block));
  const hasContiguous = r.imageBase64.length > 0;
  if (!hasBlocks && !hasContiguous) return false;
  if (blocks !== undefined && !Array.isArray(blocks)) return false;
  if (Array.isArray(blocks) && blocks.length > 0 && !hasBlocks) return false;
  if (r.addressBase !== undefined && typeof r.addressBase !== 'number') return false;
  return true;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function createRadioCloneHydrationBag(input: {
  radioModelId: string;
  imageBytes: Uint8Array;
  firmware?: string;
  capturedVia?: RadioCloneRetain['capturedVia'];
  sourceFileName?: string;
  capturedAt?: string;
}): RadioCloneHydrationBag {
  return {
    formatId: RADIO_CLONE_HYDRATION_FORMAT_ID,
    sourceFileName: input.sourceFileName,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    retain: {
      radioModelId: input.radioModelId,
      capturedVia: input.capturedVia ?? 'web-serial',
      imageBase64: bytesToBase64(input.imageBytes),
      imageByteLength: input.imageBytes.length,
      ...(input.firmware !== undefined ? { firmware: input.firmware } : {}),
    },
  };
}

/** Persist a sparse absolute-addressed block map (DM-32UV-class radios). */
export function createRadioCloneHydrationBagFromBlocks(input: {
  radioModelId: string;
  blocks: readonly { address: number; data: Uint8Array }[];
  addressBase?: number;
  firmware?: string;
  capturedVia?: RadioCloneRetain['capturedVia'];
  sourceFileName?: string;
  capturedAt?: string;
  dm32ContactsBase?: number;
  dm32ContactsEnd?: number;
}): RadioCloneHydrationBag {
  if (input.blocks.length === 0) {
    throw new RangeError('Sparse radio-clone hydration requires at least one block');
  }
  const blocks: RadioCloneSparseBlock[] = input.blocks.map((b) => ({
    address: b.address,
    dataBase64: bytesToBase64(b.data),
  }));
  const imageByteLength = input.blocks.reduce((sum, b) => sum + b.data.length, 0);
  return {
    formatId: RADIO_CLONE_HYDRATION_FORMAT_ID,
    sourceFileName: input.sourceFileName,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    retain: {
      radioModelId: input.radioModelId,
      capturedVia: input.capturedVia ?? 'web-serial',
      imageBase64: '',
      imageByteLength,
      blocks,
      ...(input.addressBase !== undefined ? { addressBase: input.addressBase } : {}),
      ...(input.firmware !== undefined ? { firmware: input.firmware } : {}),
      ...(input.dm32ContactsBase !== undefined
        ? { dm32ContactsBase: input.dm32ContactsBase }
        : {}),
      ...(input.dm32ContactsEnd !== undefined ? { dm32ContactsEnd: input.dm32ContactsEnd } : {}),
    },
  };
}

/** Contiguous image bytes — throws if the bag is sparse-only. */
export function radioCloneImageBytes(bag: RadioCloneHydrationBag): Uint8Array {
  if (!bag.retain.imageBase64) {
    throw new RangeError('radioCloneImageBytes: bag has no contiguous image (sparse blocks only)');
  }
  return base64ToBytes(bag.retain.imageBase64);
}

/** Decode sparse blocks; empty array when the bag is contiguous-only. */
export function radioCloneSparseBlockBytes(
  bag: RadioCloneHydrationBag,
): { address: number; data: Uint8Array }[] {
  const blocks = bag.retain.blocks;
  if (!blocks || blocks.length === 0) return [];
  return blocks.map((b) => ({
    address: b.address,
    data: base64ToBytes(b.dataBase64),
  }));
}
