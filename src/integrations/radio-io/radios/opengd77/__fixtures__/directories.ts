/**
 * Test support: synthetic OpenGD77 contact, RX group and User Database bytes (fake IDs and `TEST`
 * text only). Shared by the directory projection and viewer tests.
 */
import { OPENUV380_OFFSET, OPENGD77_CONTACT_SIZE } from '../constants.ts';
import { buildOpenGd77DebugArchiveParts } from '../debugCapture.ts';
import type { OpenGd77MemoryArchive } from '../debugMemory.ts';
import { OPENGD77_DM1701_MODEL_ID } from '../hydration.ts';
import { createOpenUv380Image, writeAbs } from '../memory.ts';
import { encodeOpenGd77UserDatabase } from '../userDatabaseCodec.ts';
import { makeOpenGd77FirmwareInfoPayload } from './scriptedPipe.ts';

/** Header, segment 0 then segment 1 concatenated exactly as the product packs the region. */
export function syntheticUserDatabaseRegion(
  count: number,
  textOf: (i: number) => string = (i) => `TEST ${i}`,
): Uint8Array {
  const rows = Array.from({ length: count }, (_, i) => ({
    wireName: textOf(i),
    digitalId: 1_000_001 + i,
    callsign: '',
    city: '',
    province: '',
    country: '',
    remark: '',
  }));
  const enc = encodeOpenGd77UserDatabase(rows);
  const out = new Uint8Array(enc.header.length + enc.entries0.length + enc.entries1.length);
  out.set(enc.header, 0);
  out.set(enc.entries0, enc.header.length);
  out.set(enc.entries1, enc.header.length + enc.entries0.length);
  return out;
}

/** A hand-built 0x18-byte contact record from the documented offsets (not via the encoder). */
export function handBuiltContactRecord(
  name: string,
  digitalIdDigits: string,
  callType: number,
  timeSlotByte = 0x01,
): Uint8Array {
  const rec = new Uint8Array(OPENGD77_CONTACT_SIZE).fill(0xff);
  for (let i = 0; i < name.length; i++) rec[i] = name.charCodeAt(i);
  const digits = digitalIdDigits.padStart(8, '0');
  for (let i = 0; i < 4; i++)
    rec[0x10 + i] = (Number(digits[i * 2]) << 4) | Number(digits[i * 2 + 1]);
  rec[0x14] = callType;
  rec[0x17] = timeSlotByte;
  return rec;
}

/** A hand-built 27-byte User Database entry: ID 9999999 and the text `TEST`. */
export function handBuiltUserDatabaseEntry(): Uint8Array {
  const rec = new Uint8Array(27);
  rec.set([0x7f, 0x96, 0x98], 0); // 9999999 = 0x98967f, little endian
  rec.set([0x78, 0xf7, 0x5e], 3); // T E S T in the 6-bit alphabet
  return rec;
}

export function putContactRecord(
  image: ReturnType<typeof createOpenUv380Image>,
  slot: number,
  rec: Uint8Array,
) {
  writeAbs(image, OPENUV380_OFFSET.contacts + (slot - 1) * OPENGD77_CONTACT_SIZE, rec);
}

export function syntheticDirectoryArchive(
  image = createOpenUv380Image(),
  userDatabase: Uint8Array = new Uint8Array(12),
  modelId: string = OPENGD77_DM1701_MODEL_ID,
): OpenGd77MemoryArchive {
  const p = buildOpenGd77DebugArchiveParts({
    modelId,
    capturedAt: '2026-01-01T00:00:00.000Z',
    capturedVia: 'web-serial',
    firmwareInfoRaw: makeOpenGd77FirmwareInfoPayload(0x08, { features: 0 }),
    calibrationWorkingCopy: new Uint8Array(512),
    settingsGap: new Uint8Array(0x60),
    image,
    userDatabase,
  });
  return { manifest: p.manifest, regions: p.regions };
}
