/**
 * Shared checksum helpers for radio-side tables Studio writes.
 *
 * - CRC-16/CCITT-FALSE: poly `0x1021`, init `0xFFFF`, MSB first, no reflection, no xorout.
 *   Check value: `crc16CcittFalse("123456789") === 0x29B1`.
 * - CRC-32 (IEEE 802.3, zlib): reflected poly `0xEDB88320`, init and xorout `0xFFFFFFFF`.
 *   Check value: `crc32Ieee("123456789") === 0xCBF43926`.
 */

export function crc16CcittFalse(data: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

let crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crc32Table = table;
  return table;
}

export function crc32Ieee(data: Uint8Array): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
