/**
 * AT-D890UV digital contact bank encode — block-hopped DigitalContact* regions.
 * Cite: docs/reference/radios/anytone/at-d890uv/memory-layout.md (facts only).
 */

import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import { AT_D890_BLOCK_SIZE, D890_MAP } from './constants.ts';
import { encodeBcdAsHexU32, decodeBcdAsHexU32 } from './bcd.ts';
import type { AtD890StagingChunk } from './sparseEraseRmw.ts';

const ANYTONE_CALL_TYPE_PRIVATE = 0;
const ANYTONE_CALL_ALERT_NONE = 0;

const NAME_MAX_CHARS = 16;
const CITY_MAX_CHARS = 15;
const CALLSIGN_MAX_CHARS = 8;
const STATE_MAX_CHARS = 16;
const COUNTRY_MAX_CHARS = 16;
const REMARK_MAX_CHARS = 16;

function writeU32Be(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >> 24) & 0xff;
  buf[offset + 1] = (value >> 16) & 0xff;
  buf[offset + 2] = (value >> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function encodeWideCharCString(text: string, maxChars: number): Uint8Array {
  const trimmed = text.slice(0, maxChars);
  const out = new Uint8Array((trimmed.length + 1) * 2);
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i) & 0xffff;
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return out;
}

function concatParts(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function digitalContactOrderKey(digitalId: number): number {
  const bcdNum = decodeBcdAsHexU32(encodeBcdAsHexU32(digitalId));
  return (bcdNum << 1) + ANYTONE_CALL_TYPE_PRIVATE;
}

/** Variable-length wire record for one private digital contact. */
export function encodeAtD890DigitalContactRecord(contact: RadioDigitalContactDto): Uint8Array {
  const header = new Uint8Array(6);
  header[0] = ANYTONE_CALL_TYPE_PRIVATE;
  header[1] = ANYTONE_CALL_ALERT_NONE;
  header.set(encodeBcdAsHexU32(contact.digitalId), 2);
  return concatParts([
    header,
    encodeWideCharCString(contact.wireName, NAME_MAX_CHARS),
    encodeWideCharCString(contact.city, CITY_MAX_CHARS),
    encodeWideCharCString(contact.callsign, CALLSIGN_MAX_CHARS),
    encodeWideCharCString(contact.province, STATE_MAX_CHARS),
    encodeWideCharCString(contact.country, COUNTRY_MAX_CHARS),
    encodeWideCharCString(contact.remark, REMARK_MAX_CHARS),
  ]);
}

export function atD890BlockHoppedAddress(
  base: number,
  linearOffset: number,
  blockLength: number,
  stride: number,
): number {
  const addrMod = linearOffset % blockLength;
  const block = Math.floor((linearOffset - addrMod) / blockLength);
  return base + block * stride + addrMod;
}

function padOrderTable(raw: Uint8Array): Uint8Array {
  const padTo = raw.length + 0x10 - (raw.length % 0x10);
  const out = new Uint8Array(padTo);
  out.fill(0xff);
  out.set(raw);
  return out;
}

export interface AtD890DigitalContactPack {
  contactCount: number;
  meta: Uint8Array;
  orderLinear: Uint8Array;
  dataLinear: Uint8Array;
  stagingChunks: AtD890StagingChunk[];
}

/** Pack contacts into meta / order / data linear streams and upload staging chunks. */
export function packAtD890DigitalContacts(
  contacts: readonly RadioDigitalContactDto[],
): AtD890DigitalContactPack {
  const orderEntries: { key: number; dataOffset: number }[] = [];
  const dataParts: Uint8Array[] = [];
  let dataOffset = 0;

  for (const contact of contacts) {
    if (contact.digitalId <= 0) continue;
    const record = encodeAtD890DigitalContactRecord(contact);
    orderEntries.push({ key: digitalContactOrderKey(contact.digitalId), dataOffset });
    dataParts.push(record);
    dataOffset += record.length;
  }

  orderEntries.sort((a, b) => a.key - b.key);

  const orderRaw = new Uint8Array(orderEntries.length * D890_MAP.DigitalContactOrderEntrySize);
  for (let i = 0; i < orderEntries.length; i++) {
    const entry = orderEntries[i]!;
    writeU32Be(orderRaw, i * 8, entry.key);
    writeU32Be(orderRaw, i * 8 + 4, entry.dataOffset);
  }
  const orderLinear = padOrderTable(orderRaw);
  const dataLinear = concatParts(dataParts);

  const endAddress =
    dataLinear.length === 0
      ? D890_MAP.DigitalContactData
      : atD890BlockHoppedAddress(
          D890_MAP.DigitalContactData,
          dataLinear.length,
          D890_MAP.DigitalContactDataBlockLength,
          D890_MAP.DigitalContactDataStride,
        );

  const meta = new Uint8Array(D890_MAP.DigitalContactMetaLength);
  const metaView = new DataView(meta.buffer);
  metaView.setUint32(0, orderEntries.length, true);
  metaView.setUint32(4, endAddress, true);

  const stagingChunks: AtD890StagingChunk[] = [
    { address: D890_MAP.DigitalContactMeta, data: meta },
    ...stagingChunksFromLinearRegion(
      D890_MAP.DigitalContactOrder,
      orderLinear,
      D890_MAP.DigitalContactOrderBlockLength,
      D890_MAP.DigitalContactOrderBlockStride,
    ),
    ...stagingChunksFromLinearRegion(
      D890_MAP.DigitalContactData,
      dataLinear,
      D890_MAP.DigitalContactDataBlockLength,
      D890_MAP.DigitalContactDataStride,
    ),
  ];

  return {
    contactCount: orderEntries.length,
    orderLinear,
    dataLinear,
    meta,
    stagingChunks,
  };
}

function stagingChunksFromLinearRegion(
  base: number,
  linear: Uint8Array,
  blockLength: number,
  stride: number,
): AtD890StagingChunk[] {
  if (linear.length === 0) return [];
  const alignedLength = Math.ceil(linear.length / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
  const chunks: AtD890StagingChunk[] = [];
  for (let off = 0; off < alignedLength; off += AT_D890_BLOCK_SIZE) {
    const addr = atD890BlockHoppedAddress(base, off, blockLength, stride);
    const sliceEnd = Math.min(off + AT_D890_BLOCK_SIZE, linear.length);
    const slice = linear.subarray(off, sliceEnd);
    const padded = new Uint8Array(AT_D890_BLOCK_SIZE);
    padded.fill(0xff);
    padded.set(slice);
    chunks.push({ address: addr, data: padded });
  }
  return chunks;
}
