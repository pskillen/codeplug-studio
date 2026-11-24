/**
 * RadioFoundry debug-link INFO_CHIP (0x0B): parse ≥ 28 data bytes after status 0.
 */

export const RADIOFOUNDRY_INFO_CHIP_COMMAND = 0x0b;

export const INFO_CHIP_UNAVAILABLE_MESSAGE =
  'Update RadioFoundry (builds from 22 Oct 2026 can be unlocked), or the radio could not read its chip ID. Nothing has changed.';

export interface RadioFoundryChipInfo {
  idCode: number;
  flashKb: number;
  /** The CLAIM token: UID word 0 at offset 6. */
  token: number;
  uid0: number;
  uid1: number;
  uid2: number;
  optcr: number;
  rdpLevel: number;
  rdpByte: number;
  wrp: number;
  bor: number;
  user: number;
  /** 0 STM32F4, 1 HR_C7000; absent bytes mean STM32F4. */
  family: number | null;
}

function readU16(data: Uint8Array, off: number): number {
  return data[off]! | (data[off + 1]! << 8);
}

function readU32(data: Uint8Array, off: number): number {
  return (
    (data[off]! | (data[off + 1]! << 8) | (data[off + 2]! << 16) | (data[off + 3]! << 24)) >>> 0
  );
}

/** Parse the data bytes after a status-0 INFO_CHIP reply (≥ 28 bytes). */
export function parseRadioFoundryChipInfo(data: Uint8Array): RadioFoundryChipInfo {
  if (data.length < 28) {
    throw new Error('INFO_CHIP data must be at least 28 bytes.');
  }
  const uid0 = readU32(data, 6);
  return {
    idCode: readU32(data, 0),
    flashKb: readU16(data, 4),
    token: uid0,
    uid0,
    uid1: readU32(data, 10),
    uid2: readU32(data, 14),
    optcr: readU32(data, 18),
    rdpLevel: data[22]!,
    rdpByte: data[23]!,
    wrp: readU16(data, 24),
    bor: data[26]!,
    user: data[27]!,
    family: data.length >= 29 ? data[28]! : null,
  };
}
